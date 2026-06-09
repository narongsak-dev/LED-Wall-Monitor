import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '@/prisma/prisma.service';
import type { LoginLog, User } from '@prisma/client';
import type { LoginLogEntry, User as ApiUser } from '@monitor/shared';
import type { CreateUserDto } from './dto/create-user.dto';
import type { UpdateUserDto } from './dto/update-user.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByUsername(username: string) {
    return this.prisma.user.findUnique({ where: { username } });
  }

  findById(id: bigint) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** List users visible to the actor: super_admin sees everyone, site_admin
   *  sees only viewers in their site overlap plus themselves (super_admin /
   *  other site_admins are hidden — they're not manageable from this list
   *  anyway, so showing them would just be confusing dead weight). */
  async listScoped(actor: User) {
    const ids = await this.manageableUserIds(actor);
    const where =
      ids === null
        ? {}
        : actor.role === 'site_admin'
          ? {
              id: { in: ids },
              OR: [{ role: 'viewer' as const }, { id: actor.id }],
            }
          : { id: { in: ids } };
    const users = await this.prisma.user.findMany({
      where,
      orderBy: { id: 'asc' },
      include: { userSites: { include: { site: true } } },
    });
    return users.map((u) => ({
      ...this.toPublic(u),
      sitePermissions: u.userSites.map((us) => ({
        siteId: Number(us.siteId),
        siteCode: us.site.code,
        siteName: us.site.name,
        permission: us.permission,
      })),
    }));
  }

  /** Returns the set of user IDs `actor` may MANAGE — for filtering lists.
   *  null means "no filter" (super_admin sees all). */
  async manageableUserIds(actor: User): Promise<bigint[] | null> {
    if (actor.role === 'super_admin') return null;
    if (actor.role === 'viewer') return [actor.id];

    // site_admin — everyone sharing a UserSite row with the actor.
    const myLinks = await this.prisma.userSite.findMany({
      where: { userId: actor.id },
      select: { siteId: true },
    });
    if (myLinks.length === 0) return [actor.id];
    const siteIds = myLinks.map((l) => l.siteId);
    const peers = await this.prisma.userSite.findMany({
      where: { siteId: { in: siteIds } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const ids = new Set<bigint>(peers.map((p) => p.userId));
    ids.add(actor.id);
    return Array.from(ids);
  }

  /** Throws Forbidden unless the actor can perform an admin action on target.
   *    super_admin → anyone
   *    site_admin  → viewers in their site overlap only
   *    viewer      → no one
   */
  async assertCanManage(actor: User, target: User) {
    if (actor.role === 'super_admin') return;
    if (actor.role !== 'site_admin') {
      throw new ForbiddenException('สิทธิ์ไม่เพียงพอ');
    }
    if (target.role !== 'viewer') {
      throw new ForbiddenException('site_admin จัดการได้เฉพาะผู้ใช้บทบาท viewer');
    }
    const ids = await this.manageableUserIds(actor);
    const allowed = ids && ids.some((id) => id === target.id);
    if (!allowed) {
      throw new ForbiddenException('ผู้ใช้นี้ไม่อยู่ในไซต์ที่คุณดูแล');
    }
  }

  /** Validate that every site referenced in dto.sitePermissions is one the
   *  actor manages. super_admin can assign any site. */
  private async assertSitesInScope(
    actor: User,
    sitePermissions: { siteId: number }[] | undefined,
  ) {
    if (!sitePermissions?.length) return;
    if (actor.role === 'super_admin') return;
    if (actor.role !== 'site_admin') {
      throw new ForbiddenException('สิทธิ์ไม่เพียงพอ');
    }
    const myLinks = await this.prisma.userSite.findMany({
      where: { userId: actor.id },
      select: { siteId: true },
    });
    const mine = new Set(myLinks.map((l) => Number(l.siteId)));
    for (const sp of sitePermissions) {
      if (!mine.has(sp.siteId)) {
        throw new ForbiddenException(`ไซต์ id=${sp.siteId} ไม่อยู่ในความดูแลของคุณ`);
      }
    }
  }

  async create(dto: CreateUserDto, actor: User) {
    // site_admin may only create viewers — and only attached to their sites.
    if (actor.role === 'site_admin') {
      if (dto.role && dto.role !== 'viewer') {
        throw new ForbiddenException('site_admin สร้างได้เฉพาะผู้ใช้บทบาท viewer');
      }
      dto.role = 'viewer';
      await this.assertSitesInScope(actor, dto.sitePermissions);
    } else if (actor.role !== 'super_admin') {
      throw new ForbiddenException('สิทธิ์ไม่เพียงพอ');
    }

    const exists = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (exists) throw new ConflictException('Username already exists');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        passwordHash,
        fullName: dto.fullName,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        role: dto.role,
        isActive: dto.isActive ?? true,
      },
    });

    if (dto.sitePermissions?.length) {
      await this.prisma.userSite.createMany({
        data: dto.sitePermissions.map((sp) => ({
          userId: user.id,
          siteId: BigInt(sp.siteId),
          permission: sp.permission,
        })),
      });
    }

    return this.findWithPermissions(user.id);
  }

  async update(id: bigint, dto: UpdateUserDto, actor: User) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.assertCanManage(actor, user);

    // site_admin gets a stricter set of allowed fields: no role escalation,
    // no username/password change, and sites are validated against what they
    // actually manage.
    if (actor.role === 'site_admin') {
      if (dto.role && dto.role !== 'viewer') {
        throw new ForbiddenException('site_admin ไม่สามารถเปลี่ยนบทบาทได้');
      }
      if (dto.username) {
        throw new ForbiddenException('site_admin ไม่สามารถเปลี่ยน username');
      }
      if (dto.password) {
        throw new ForbiddenException('site_admin ไม่สามารถตั้งรหัสผ่านโดยตรง — ใช้ปุ่ม "ตั้งรหัสใหม่"');
      }
      await this.assertSitesInScope(actor, dto.sitePermissions);
    }

    if (dto.username && dto.username !== user.username) {
      const dup = await this.prisma.user.findUnique({
        where: { username: dto.username },
      });
      if (dup) throw new ConflictException('Username already exists');
    }

    const data: Record<string, unknown> = {};
    if (dto.username) data.username = dto.username;
    if (dto.fullName !== undefined) data.fullName = dto.fullName;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber || null;
    if (dto.role) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.password) data.passwordHash = await bcrypt.hash(dto.password, 10);

    await this.prisma.user.update({ where: { id }, data });

    if (dto.sitePermissions) {
      await this.prisma.userSite.deleteMany({ where: { userId: id } });
      if (dto.sitePermissions.length > 0) {
        await this.prisma.userSite.createMany({
          data: dto.sitePermissions.map((sp) => ({
            userId: id,
            siteId: BigInt(sp.siteId),
            permission: sp.permission,
          })),
        });
      }
    }

    return this.findWithPermissions(id);
  }

  /** Self-service profile update. Validates email uniqueness; only touches
   *  fullName / email — never role, username or active status. */
  async updateProfile(id: bigint, dto: UpdateProfileDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== user.email) {
      const dup = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });
      if (dup && dup.id !== id) {
        throw new ConflictException('Email already in use');
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.fullName !== undefined) data.fullName = dto.fullName || null;
    if (dto.email !== undefined) data.email = dto.email || null;
    if (dto.phoneNumber !== undefined) data.phoneNumber = dto.phoneNumber || null;

    const updated = await this.prisma.user.update({ where: { id }, data });
    return this.toPublic(updated);
  }

  /** Called from the FirstTimePassword page after a code-based login.
   *  Skips the current-password check — the user already proved identity
   *  via the one-time reset code at login. */
  async setPasswordAfterReset(id: bigint, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (newPassword.length < 6) {
      throw new BadRequestException('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id },
        data: { passwordHash, isActive: true },
      }),
      // Mark the latest approved reset request as `used` — login() leaves it
      // in `approved` so the user can retry the code if they cancel out of
      // the FirstTimePassword page. Once they actually finish, it's spent.
      this.prisma.passwordResetRequest.updateMany({
        where: { userId: id, status: 'approved' },
        data: { status: 'used', usedAt: new Date() },
      }),
    ]);
    return { ok: true };
  }

  /** Self-service password change. Requires the current password to match. */
  async changePassword(id: bigint, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    // Use 400 here (not 401) — a wrong "current password" is a form-validation
    // failure, not an expired session. The frontend's axios interceptor treats
    // every 401 as "log this user out", which would silently boot them while
    // their (unchanged) password is still valid.
    if (!ok) throw new BadRequestException('รหัสผ่านปัจจุบันไม่ถูกต้อง');

    const same = await bcrypt.compare(newPassword, user.passwordHash);
    if (same) {
      throw new BadRequestException('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id }, data: { passwordHash } });
    return { ok: true };
  }

  /** Admin-driven password reset. Generates a random temporary password,
   *  stores its hash, and returns the plain value ONCE so the admin can hand
   *  it to the user. */
  async adminResetPassword(targetId: bigint, actor: User) {
    if (targetId === actor.id) {
      throw new BadRequestException(
        'ไม่สามารถใช้ฟังก์ชันนี้กับตัวเอง — กรุณาใช้หน้า "เปลี่ยนรหัสผ่าน"',
      );
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    await this.assertCanManage(actor, target);

    const newPassword = generateTempPassword(12);
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({ where: { id: targetId }, data: { passwordHash } });
    return { username: target.username, newPassword };
  }

  /** Append one entry to the login audit trail. Best-effort: never throws into
   *  the auth flow (a failed log must not block a valid login). */
  async recordLogin(input: {
    userId: bigint | null;
    username: string;
    success: boolean;
    ipAddress?: string | null;
    userAgent?: string | null;
  }) {
    try {
      await this.prisma.loginLog.create({
        data: {
          userId: input.userId,
          username: input.username.slice(0, 50),
          success: input.success,
          ipAddress: input.ipAddress ?? null,
          userAgent: input.userAgent?.slice(0, 1000) ?? null,
        },
      });
    } catch {
      // swallow — auditing must never break authentication
    }
  }

  /** Paginated login history. When userId is null, returns entries across all
   *  users (admin view); otherwise scoped to that single user. */
  async listLoginHistory(userId: bigint | null, limit = 20, offset = 0) {
    const where = userId === null ? {} : { userId };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.loginLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: { user: { select: { fullName: true, username: true } } },
      }),
      this.prisma.loginLog.count({ where }),
    ]);
    return { rows: rows.map((r) => this.toLoginLog(r)), total };
  }

  async remove(id: bigint, actor: User) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (id === actor.id) {
      throw new BadRequestException('ไม่สามารถลบบัญชีตัวเองได้');
    }
    await this.assertCanManage(actor, user);
    await this.prisma.user.delete({ where: { id } });
    return { ok: true };
  }

  async findWithPermissions(id: bigint) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { userSites: { include: { site: true } } },
    });
    if (!u) throw new NotFoundException('User not found');
    return {
      ...this.toPublic(u),
      sitePermissions: u.userSites.map((us) => ({
        siteId: Number(us.siteId),
        siteCode: us.site.code,
        siteName: us.site.name,
        permission: us.permission,
      })),
    };
  }

  toLoginLog(log: LoginLog & { user?: { fullName: string | null } | null }): LoginLogEntry {
    return {
      id: Number(log.id),
      userId: log.userId === null ? null : Number(log.userId),
      username: log.username,
      fullName: log.user?.fullName ?? null,
      success: log.success,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt.toISOString(),
    };
  }

  toPublic(user: User): ApiUser {
    return {
      id: Number(user.id),
      username: user.username,
      email: user.email,
      phoneNumber: user.phoneNumber,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }
}

// Visually-unambiguous alphabet — drop 0/O, 1/I/l, etc., so a password read
// over the phone or from a screenshot is unambiguous.
const TEMP_PW_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';

function generateTempPassword(length: number): string {
  const buf = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += TEMP_PW_ALPHABET[buf[i] % TEMP_PW_ALPHABET.length];
  }
  return out;
}
