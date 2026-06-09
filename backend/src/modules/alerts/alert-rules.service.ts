import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { AlertSeverity } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { AlertsService } from './alerts.service';

/**
 * Alert rules engine. Polls the latest telemetry every 30 s and either
 * raises new alerts or auto-resolves cleared ones. We keep the logic in
 * a single sweep (not per-MQTT-message) so the rules are easy to reason
 * about and there's no risk of the alert table churning under high traffic.
 *
 * Current rule set:
 *   - board_offline        : no telemetry from any sensor on the board for >5 min
 *   - voltage_low / _high  : latest voltage outside [210, 240] V
 *   - temperature_high     : latest temperature ≥ 40 °C (critical at ≥50)
 *
 * Adding a rule = a single `evaluateXxx` helper + an entry in the sweep().
 */
@Injectable()
export class AlertRulesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertRulesService.name);
  private timer?: NodeJS.Timeout;
  private static readonly SWEEP_INTERVAL_MS = 30_000;
  private static readonly OFFLINE_AFTER_MS  = 5 * 60_000;
  private static readonly VOLTAGE_LOW = 210;
  private static readonly VOLTAGE_HIGH = 240;
  private static readonly TEMP_HIGH = 40;
  private static readonly TEMP_CRITICAL = 50;

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
  ) {}

  onModuleInit() {
    // First sweep slightly after boot so it doesn't race other init.
    setTimeout(() => this.sweep().catch(() => null), 10_000);
    this.timer = setInterval(
      () => this.sweep().catch(() => null),
      AlertRulesService.SWEEP_INTERVAL_MS,
    );
    this.logger.log(`Alert rules engine started (sweep every ${AlertRulesService.SWEEP_INTERVAL_MS / 1000}s)`);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Single pass: pull latest telemetry per sensor, evaluate every rule
   *  against it, and open/close alerts as conditions flip. */
  async sweep() {
    const now = new Date();

    // Pull the freshest reading for each active sensor in one query so the
    // sweep stays a constant-time-per-board operation rather than N queries.
    const rows = await this.prisma.$queryRaw<Array<{
      sensor_id: bigint;
      board_id: bigint;
      site_id: bigint;
      zone_id: bigint | null;
      time: Date;
      voltage: number | null;
      temperature: number | null;
    }>>`
      SELECT DISTINCT ON (t.sensor_id)
        t.sensor_id, t.board_id, t.site_id,
        bd.zone_id AS zone_id,
        t.time, t.voltage, t.temperature
      FROM telemetry t
      LEFT JOIN boards bd ON bd.id = t.board_id
      JOIN sensors s ON s.id = t.sensor_id
      WHERE s.is_active = true
      ORDER BY t.sensor_id, t.time DESC
    `;

    // Index by board so we can detect "no sensor on this board has reported
    // in N minutes" in a single pass.
    const perBoard = new Map<string, { latestMs: number; siteId: bigint; zoneId: bigint | null }>();
    for (const r of rows) {
      const key = r.board_id.toString();
      const ts = r.time.getTime();
      const cur = perBoard.get(key);
      if (!cur || cur.latestMs < ts) {
        perBoard.set(key, { latestMs: ts, siteId: r.site_id, zoneId: r.zone_id });
      }
    }

    // Also include boards that have NEVER reported, so we can flag them.
    const allActiveBoards = await this.prisma.board.findMany({
      where: { isActive: true },
      select: { id: true, siteId: true, zoneId: true, code: true },
    });

    // ── board_offline rule ──
    for (const b of allActiveBoards) {
      const key = b.id.toString();
      const seen = perBoard.get(key);
      const offline = !seen || now.getTime() - seen.latestMs > AlertRulesService.OFFLINE_AFTER_MS;
      const target = { siteId: b.siteId, boardId: b.id, zoneId: b.zoneId ?? null, sensorId: null };
      if (offline) {
        await this.alerts.openOrKeep({
          ...target, code: 'board_offline', severity: AlertSeverity.CRITICAL,
          message: seen
            ? `Board ${b.code} ไม่ส่งข้อมูลเกิน ${AlertRulesService.OFFLINE_AFTER_MS / 60_000} นาที`
            : `Board ${b.code} ไม่เคยส่งข้อมูล`,
        });
      } else {
        await this.alerts.resolveFor({ ...target, code: 'board_offline' });
      }
    }

    // ── voltage + temperature rules (per-sensor on latest reading) ──
    for (const r of rows) {
      const target = {
        siteId: r.site_id, zoneId: r.zone_id ?? null,
        boardId: r.board_id, sensorId: r.sensor_id,
      };

      // voltage_low / voltage_high mirror each other; one is open at a time.
      const v = r.voltage;
      if (v != null && v < AlertRulesService.VOLTAGE_LOW) {
        await this.alerts.openOrKeep({
          ...target, code: 'voltage_low', severity: AlertSeverity.WARNING,
          message: `แรงดันต่ำผิดปกติ ${v.toFixed(1)} V (< ${AlertRulesService.VOLTAGE_LOW} V)`,
        });
        await this.alerts.resolveFor({ ...target, code: 'voltage_high' });
      } else if (v != null && v > AlertRulesService.VOLTAGE_HIGH) {
        await this.alerts.openOrKeep({
          ...target, code: 'voltage_high', severity: AlertSeverity.WARNING,
          message: `แรงดันสูงผิดปกติ ${v.toFixed(1)} V (> ${AlertRulesService.VOLTAGE_HIGH} V)`,
        });
        await this.alerts.resolveFor({ ...target, code: 'voltage_low' });
      } else if (v != null) {
        await this.alerts.resolveFor({ ...target, code: 'voltage_low' });
        await this.alerts.resolveFor({ ...target, code: 'voltage_high' });
      }

      // temperature_high gets bumped to CRITICAL above the danger threshold.
      const t = r.temperature;
      if (t != null && t >= AlertRulesService.TEMP_HIGH) {
        await this.alerts.openOrKeep({
          ...target, code: 'temperature_high',
          severity: t >= AlertRulesService.TEMP_CRITICAL ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
          message: `อุณหภูมิสูง ${t.toFixed(1)} °C${t >= AlertRulesService.TEMP_CRITICAL ? ' — อันตราย' : ''}`,
        });
      } else if (t != null) {
        await this.alerts.resolveFor({ ...target, code: 'temperature_high' });
      }
    }
  }
}
