import { Injectable, NotFoundException } from '@nestjs/common';
import { AlertSeverity } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';

interface AlertCondition {
  siteId: bigint;
  zoneId?: bigint | null;
  boardId?: bigint | null;
  sensorId?: bigint | null;
  code: string;
  severity: AlertSeverity;
  message: string;
}

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Operator-facing list. `open=true` (default) filters to currently-unresolved
   *  alerts, which is what the dashboard shows. The history view passes
   *  `open=false` to include resolved rows too. */
  async list(siteId: bigint, opts: { open?: boolean; limit?: number } = {}) {
    const open = opts.open ?? true;
    const rows = await this.prisma.alert.findMany({
      where: {
        siteId,
        ...(open ? { resolvedAt: null } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 100,
      include: { ackUser: { select: { id: true, username: true, fullName: true } } },
    });
    return rows.map((r) => this.serialize(r));
  }

  /** Mark as acknowledged by `userId`. Idempotent — calling twice is fine. */
  async acknowledge(alertId: bigint, userId: bigint) {
    const a = await this.prisma.alert.findUnique({ where: { id: alertId } });
    if (!a) throw new NotFoundException('Alert not found');
    if (a.acknowledgedAt) return this.serialize(a);
    const updated = await this.prisma.alert.update({
      where: { id: alertId },
      data: { acknowledgedAt: new Date(), acknowledgedBy: userId },
      include: { ackUser: { select: { id: true, username: true, fullName: true } } },
    });
    return this.serialize(updated);
  }

  /** Manually clear an alert (e.g. operator resolved it physically). The
   *  rules engine will keep the row marked resolved unless the condition
   *  re-appears, in which case a brand-new row is created. */
  async resolve(alertId: bigint) {
    const updated = await this.prisma.alert.update({
      where: { id: alertId },
      data: { resolvedAt: new Date() },
      include: { ackUser: { select: { id: true, username: true, fullName: true } } },
    }).catch(() => null);
    if (!updated) throw new NotFoundException('Alert not found');
    return this.serialize(updated);
  }

  // ───────────────────────────────────────────────────────────────
  //  Engine-facing API (called by AlertRulesService)
  // ───────────────────────────────────────────────────────────────

  /** Open or refresh an alert for a (target, code) tuple. If a matching
   *  unresolved row already exists we don't disturb it — preserves the
   *  original createdAt so an operator can tell how long the issue has
   *  been live. */
  async openOrKeep(c: AlertCondition) {
    const existing = await this.prisma.alert.findFirst({
      where: {
        siteId: c.siteId,
        boardId: c.boardId ?? null,
        sensorId: c.sensorId ?? null,
        code: c.code,
        resolvedAt: null,
      },
    });
    if (existing) return existing;
    return this.prisma.alert.create({
      data: {
        siteId: c.siteId,
        zoneId: c.zoneId ?? null,
        boardId: c.boardId ?? null,
        sensorId: c.sensorId ?? null,
        code: c.code,
        severity: c.severity,
        message: c.message,
      },
    }).catch(() => null); // race-safe: another tick may have inserted first
  }

  /** Close any open alert for the (target, code) tuple. Used when a rule's
   *  condition clears, e.g. a board comes back online. */
  async resolveFor(c: Omit<AlertCondition, 'severity' | 'message'>) {
    await this.prisma.alert.updateMany({
      where: {
        siteId: c.siteId,
        boardId: c.boardId ?? null,
        sensorId: c.sensorId ?? null,
        code: c.code,
        resolvedAt: null,
      },
      data: { resolvedAt: new Date() },
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private serialize(a: any) {
    return {
      id: Number(a.id),
      siteId: Number(a.siteId),
      zoneId: a.zoneId != null ? Number(a.zoneId) : null,
      boardId: a.boardId != null ? Number(a.boardId) : null,
      sensorId: a.sensorId != null ? Number(a.sensorId) : null,
      severity: a.severity,
      code: a.code,
      message: a.message,
      createdAt: a.createdAt.toISOString(),
      resolvedAt: a.resolvedAt?.toISOString() ?? null,
      acknowledgedAt: a.acknowledgedAt?.toISOString() ?? null,
      acknowledgedBy: a.acknowledgedBy != null ? Number(a.acknowledgedBy) : null,
      ackUser: a.ackUser ? {
        id: Number(a.ackUser.id),
        username: a.ackUser.username,
        fullName: a.ackUser.fullName,
      } : null,
    };
  }
}
