import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import { CaptchaService } from './captcha.service';
import type { Prisma, User } from '@prisma/client';
import type {
  PendingResetItem,
  ApproveResetResponse,
  ResetHistoryItem,
  ResetHistoryResponse,
} from '@monitor/shared';

const CODE_TTL_MS = 30 * 60 * 1000; // verification code lifetime
const RATE_PER_IP_PER_HOUR = 5;
const GENERIC_OK = { ok: true } as const;

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Forgot-password workflow with admin-approval chain.
 *
 *   1. user fills the public form → submitRequest()  (anti-bot, rate-limited)
 *   2. an approver of the right role sees it via listPendingForApprover()
 *   3. approve() mints a 6-digit code; the plaintext is returned ONCE to
 *      the approver, who hands it to the requester out-of-band
 *   4. the requester redeems it via verifyAndConsume()
 *
 * Information-leak rules:
 *   - submitRequest() always returns { ok: true } so an attacker can't probe
 *     "does username X exist?". If we can't act on the request (no user, no
 *     contact match, no eligible approver) we silently drop it.
 *   - verifyAndConsume() returns the same error for "bad username" and
 *     "bad code" so an attacker can't enumerate either independently.
 */
@Injectable()
export class PasswordResetService {
  private readonly log = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly captcha: CaptchaService,
  ) {}

  // ---------------------------------------------------------------------------
  // PUBLIC FLOW (no auth)
  // ---------------------------------------------------------------------------

  issueCaptcha() {
    return this.captcha.issue();
  }

  async submitRequest(
    input: {
      username: string;
      contact: string;
      captchaId: string;
      captchaAnswer: string;
      hp?: string;
    },
    meta: RequestMeta,
  ): Promise<typeof GENERIC_OK> {
    // Honeypot — only bots fill this.
    if (input.hp && input.hp.trim().length > 0) {
      this.log.warn(`Honeypot tripped from ip=${meta.ipAddress ?? 'unknown'}`);
      return GENERIC_OK;
    }

    if (!this.captcha.verifyAndConsume(input.captchaId, input.captchaAnswer)) {
      throw new BadRequestException('Captcha ไม่ถูกต้องหรือหมดอายุ — กรุณาลองใหม่');
    }

    await this.enforceRateLimits(input.username, meta.ipAddress ?? null);

    const user = await this.prisma.user.findUnique({
      where: { username: input.username },
    });

    // Silently swallow when:
    //   - user doesn't exist
    //   - user is deactivated
    //   - provided contact doesn't match either stored email or phone
    // The form on the frontend always says "if your details match, an admin
    // will be notified" so the absence of a real follow-up is the only signal
    // an attacker gets — and they can't distinguish it from "admin is slow".
    if (!user || !user.isActive || !contactMatches(input.contact, user)) {
      this.log.log(
        `Reset request ignored (no match) username=${input.username} ip=${meta.ipAddress ?? '?'}`,
      );
      return GENERIC_OK;
    }

    // Pending-request check above already blocked the duplicate-pending
    // case. The remaining superseded state is `approved` — a prior request
    // was approved but the requester never received / used the code. Auto-
    // expire it so the new submission can produce a fresh approval cycle.
    await this.prisma.passwordResetRequest.updateMany({
      where: { userId: user.id, status: 'approved' },
      data: { status: 'expired' },
    });

    await this.prisma.passwordResetRequest.create({
      data: {
        userId: user.id,
        providedContact: input.contact,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent ?? null,
      },
    });

    this.log.log(`Reset request queued for ${user.username} (role=${user.role})`);
    return GENERIC_OK;
  }

  // ---------------------------------------------------------------------------
  // APPROVAL FLOW (authenticated)
  // ---------------------------------------------------------------------------

  /** Pending requests this approver is allowed to act on, given their role. */
  async listPendingForApprover(approver: User): Promise<PendingResetItem[]> {
    const requests = await this.prisma.passwordResetRequest.findMany({
      where: { status: 'pending' },
      orderBy: { requestedAt: 'desc' },
      include: { user: true },
      take: 100,
    });

    // Site-overlap is only needed for the site_admin route; precompute once.
    let approverSiteIds: Set<bigint> | null = null;
    if (approver.role === 'site_admin') {
      const links = await this.prisma.userSite.findMany({
        where: { userId: approver.id },
        select: { siteId: true },
      });
      approverSiteIds = new Set(links.map((l) => l.siteId));
    }

    const out: PendingResetItem[] = [];
    for (const req of requests) {
      const eligible = await this.isEligibleApprover(
        approver,
        req.user,
        approverSiteIds,
      );
      if (!eligible) continue;
      out.push(this.toPendingItem(req, req.user));
    }
    return out;
  }

  /** History of every reset request this approver is allowed to see —
   *  same site-overlap rules as the pending inbox, but includes every
   *  status (used, rejected, expired) so admins can audit the trail. */
  async listHistoryForApprover(
    approver: User,
    limit: number,
    offset: number,
    userIdFilter: bigint | null = null,
  ): Promise<ResetHistoryResponse> {
    // Pre-compute eligible userIds. Doing the filter in SQL would let us
    // paginate cleanly; the in-memory filter below is fine for the volumes
    // expected here (one request per user per day cap).
    let allowedUserIds: bigint[] | null = null;
    if (approver.role === 'super_admin') {
      allowedUserIds = null;
    } else if (approver.role === 'site_admin') {
      const myLinks = await this.prisma.userSite.findMany({
        where: { userId: approver.id },
        select: { siteId: true },
      });
      if (myLinks.length === 0) {
        return { rows: [], total: 0 };
      }
      const siteIds = myLinks.map((l) => l.siteId);
      const peers = await this.prisma.userSite.findMany({
        where: { siteId: { in: siteIds } },
        select: { userId: true },
        distinct: ['userId'],
      });
      allowedUserIds = Array.from(new Set(peers.map((p) => p.userId)));
    } else {
      // viewers shouldn't reach this endpoint, but be defensive.
      return { rows: [], total: 0 };
    }

    // Apply optional single-user filter. If the requested userId is outside
    // the approver's allowed set, return nothing — don't leak existence.
    let where: { userId?: bigint | { in: bigint[] } } = {};
    if (userIdFilter !== null) {
      if (allowedUserIds !== null && !allowedUserIds.some((id) => id === userIdFilter)) {
        return { rows: [], total: 0 };
      }
      where = { userId: userIdFilter };
    } else if (allowedUserIds !== null) {
      where = { userId: { in: allowedUserIds } };
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.passwordResetRequest.findMany({
        where,
        orderBy: { requestedAt: 'desc' },
        skip: offset,
        take: limit,
        include: {
          user: { select: { username: true, fullName: true, role: true } },
          approver: { select: { username: true } },
        },
      }),
      this.prisma.passwordResetRequest.count({ where }),
    ]);

    const out: ResetHistoryItem[] = rows.map((r) => ({
      id: Number(r.id),
      userId: Number(r.userId),
      username: r.user.username,
      fullName: r.user.fullName ?? null,
      role: r.user.role,
      providedContact: r.providedContact,
      requestedAt: r.requestedAt.toISOString(),
      status: r.status,
      ipAddress: r.ipAddress ?? null,
      approverId: r.approverId === null ? null : Number(r.approverId),
      approverUsername: r.approver?.username ?? null,
      approvedAt: r.approvedAt ? r.approvedAt.toISOString() : null,
      rejectedReason: r.rejectedReason ?? null,
      usedAt: r.usedAt ? r.usedAt.toISOString() : null,
    }));

    return { rows: out, total };
  }

  /** Approve → mint a single-use 6-digit code, return the plaintext ONCE. */
  async approve(
    requestId: bigint,
    approver: User,
  ): Promise<ApproveResetResponse> {
    const req = await this.prisma.passwordResetRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });
    if (!req) throw new NotFoundException('ไม่พบคำขอ');
    if (req.status !== 'pending') {
      throw new BadRequestException('คำขอนี้ถูกดำเนินการไปแล้ว');
    }

    const eligible = await this.isEligibleApprover(approver, req.user, null);
    if (!eligible) throw new ForbiddenException('ไม่มีสิทธิ์อนุมัติคำขอนี้');

    const code = generateNumericCode(6);
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + CODE_TTL_MS);

    await this.prisma.passwordResetRequest.update({
      where: { id: req.id },
      data: {
        status: 'approved',
        approverId: approver.id,
        approvedAt: new Date(),
        codeHash,
        codeExpiresAt: expiresAt,
      },
    });

    return {
      code,
      expiresAt: expiresAt.toISOString(),
      username: req.user.username,
    };
  }

  async reject(requestId: bigint, approver: User, reason?: string) {
    const req = await this.prisma.passwordResetRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });
    if (!req) throw new NotFoundException('ไม่พบคำขอ');
    if (req.status !== 'pending') {
      throw new BadRequestException('คำขอนี้ถูกดำเนินการไปแล้ว');
    }
    const eligible = await this.isEligibleApprover(approver, req.user, null);
    if (!eligible) throw new ForbiddenException('ไม่มีสิทธิ์ปฏิเสธคำขอนี้');

    await this.prisma.passwordResetRequest.update({
      where: { id: req.id },
      data: {
        status: 'rejected',
        approverId: approver.id,
        approvedAt: new Date(),
        rejectedReason: reason ?? null,
      },
    });
    return GENERIC_OK;
  }

  // ---------------------------------------------------------------------------
  // helpers
  // ---------------------------------------------------------------------------

  /** Approval chain logic:
   *    viewer       → any site_admin sharing ≥1 site, OR any super_admin
   *    site_admin   → any super_admin
   *    super_admin  → any OTHER super_admin (cross-reset)
   */
  private async isEligibleApprover(
    approver: User,
    requester: User,
    approverSiteIds: Set<bigint> | null,
  ): Promise<boolean> {
    if (!approver.isActive) return false;
    if (requester.role === 'super_admin') {
      return approver.role === 'super_admin' && approver.id !== requester.id;
    }
    if (requester.role === 'site_admin') {
      return approver.role === 'super_admin';
    }
    // viewer
    if (approver.role === 'super_admin') return true;
    if (approver.role !== 'site_admin') return false;
    // Site overlap — approver and requester must share at least one site.
    const overlap = await this.haveSiteOverlap(
      approver.id,
      requester.id,
      approverSiteIds,
    );
    return overlap;
  }

  private async haveSiteOverlap(
    approverId: bigint,
    requesterId: bigint,
    approverSiteIds: Set<bigint> | null,
  ): Promise<boolean> {
    if (!approverSiteIds) {
      const links = await this.prisma.userSite.findMany({
        where: { userId: approverId },
        select: { siteId: true },
      });
      approverSiteIds = new Set(links.map((l) => l.siteId));
    }
    if (approverSiteIds.size === 0) return false;
    const requesterLinks = await this.prisma.userSite.findMany({
      where: { userId: requesterId },
      select: { siteId: true },
    });
    for (const l of requesterLinks) {
      if (approverSiteIds.has(l.siteId)) return true;
    }
    return false;
  }

  private async enforceRateLimits(username: string, ip: string | null) {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Per-IP rate limit — broad anti-spam, applies regardless of which
    // username is being targeted.
    if (ip) {
      const ipCount = await this.prisma.passwordResetRequest.count({
        where: { ipAddress: ip, requestedAt: { gte: oneHourAgo } },
      });
      if (ipCount >= RATE_PER_IP_PER_HOUR) {
        throw new BadRequestException(
          'มีการส่งคำขอบ่อยเกินไปจาก IP นี้ — กรุณารอสักครู่แล้วลองใหม่',
        );
      }
    }

    // Per-user check — block only when there is ALREADY a pending request
    // awaiting the admin. Once it transitions to approved / used / rejected
    // / expired the user is free to submit again (the previous lifecycle is
    // done). Pure count-over-time was too restrictive — a user could be
    // legitimately blocked from re-trying after their first attempt got
    // rejected for a typo.
    const user = await this.prisma.user.findUnique({ where: { username } });
    if (user) {
      const pendingCount = await this.prisma.passwordResetRequest.count({
        where: { userId: user.id, status: 'pending' },
      });
      if (pendingCount > 0) {
        throw new BadRequestException(
          'คุณมีคำขอที่กำลังรออนุมัติอยู่แล้ว — กรุณารอผู้ดูแลพิจารณาก่อนส่งคำขอใหม่',
        );
      }
    }
  }

  private toPendingItem(
    req: Prisma.PasswordResetRequestGetPayload<{ include: { user: true } }>,
    user: User,
  ): PendingResetItem {
    const contact = req.providedContact.trim().toLowerCase();
    return {
      id: Number(req.id),
      userId: Number(req.userId),
      username: user.username,
      fullName: user.fullName ?? null,
      role: user.role,
      providedContact: req.providedContact,
      contactMatchesEmail:
        !!user.email && user.email.toLowerCase() === contact,
      contactMatchesPhone:
        !!user.phoneNumber && normalizePhone(user.phoneNumber) === normalizePhone(contact),
      requestedAt: req.requestedAt.toISOString(),
      ipAddress: req.ipAddress ?? null,
      userAgent: req.userAgent ?? null,
    };
  }
}

function contactMatches(provided: string, user: User): boolean {
  const p = provided.trim().toLowerCase();
  if (user.email && user.email.toLowerCase() === p) return true;
  if (user.phoneNumber && normalizePhone(user.phoneNumber) === normalizePhone(p)) return true;
  return false;
}

function normalizePhone(s: string): string {
  return s.replace(/[^0-9]/g, '');
}

function generateNumericCode(length: number): string {
  // Reject-resample to avoid modulo bias on 10 (256 isn't a multiple of 10).
  let out = '';
  while (out.length < length) {
    const b = crypto.randomBytes(1)[0];
    if (b >= 250) continue;
    out += (b % 10).toString();
  }
  return out;
}
