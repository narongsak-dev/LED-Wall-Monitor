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
 * Rule set (codes are stable — backend + frontend AlertBell key off them):
 *   - board_offline       : no telemetry from any sensor on the board for >5 min
 *   - voltage_low / _high : reading outside [voltageMin, voltageMax]; for 3P
 *                           sensors checks every wired phase (V > 50V) — the
 *                           message names the worst offender
 *   - current_high        : reading exceeds sensor.currentMax (no system
 *                           default — only fires if operator set a max)
 *   - power_high          : reading exceeds sensor.powerMax (no system default)
 *   - temperature_high    : KWS internal temp ≥ sensor.temperatureMax
 *                           (defaults 40 warning, 50 critical)
 *   - phase_imbalance     : (V_max − V_min) / V_avg > 10 % across wired
 *                           phases (3P only; needs ≥ 2 wired phases)
 *
 * Per-sensor overrides live on the Sensor row; sweep falls back to the
 * defaults below when a threshold is NULL.
 */
@Injectable()
export class AlertRulesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlertRulesService.name);
  private timer?: NodeJS.Timeout;
  private static readonly SWEEP_INTERVAL_MS = 30_000;
  private static readonly OFFLINE_AFTER_MS  = 5 * 60_000;
  // System defaults — used when a sensor row leaves the threshold NULL.
  private static readonly DEFAULT_VOLTAGE_LOW = 200;
  private static readonly DEFAULT_VOLTAGE_HIGH = 240;
  private static readonly DEFAULT_TEMP_HIGH = 40;
  private static readonly TEMP_CRITICAL_BUFFER = 10;   // critical = warning + 10°C
  // Phase imbalance threshold (3P only). Industry-typical 10 %.
  private static readonly IMBALANCE_PCT = 10;
  // Voltage below which we treat a phase as "unwired" rather than "low".
  private static readonly WIRED_PHASE_MIN_V = 50;

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

  /** Single pass: pull latest telemetry per sensor + sensor thresholds,
   *  evaluate every rule against it, and open/close alerts as conditions
   *  flip. Per-sensor `voltageMin/voltageMax/currentMax/powerMax/
   *  temperatureMax` win over the static defaults at the top of the file. */
  async sweep() {
    const now = new Date();

    // Pull the freshest reading per sensor PLUS the sensor's threshold
    // columns + phase mode + raw JSON in one query. Keeps the sweep
    // O(active sensors) regardless of board count.
    const rows = await this.prisma.$queryRaw<Array<{
      sensor_id: bigint;
      board_id: bigint;
      site_id: bigint;
      zone_id: bigint | null;
      time: Date;
      voltage: number | null;
      current: number | null;
      power: number | null;
      temperature: number | null;
      raw: unknown;
      phases: number | null;
      voltage_min: number | null;
      voltage_max: number | null;
      current_max: number | null;
      power_max: number | null;
      temperature_max: number | null;
    }>>`
      SELECT DISTINCT ON (t.sensor_id)
        t.sensor_id, t.board_id, t.site_id,
        bd.zone_id AS zone_id,
        t.time, t.voltage, t.current, t.power, t.temperature, t.raw,
        s.phases,
        s.voltage_min, s.voltage_max,
        s.current_max, s.power_max, s.temperature_max
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

    // ── per-sensor rules ──
    for (const r of rows) {
      const target = {
        siteId: r.site_id, zoneId: r.zone_id ?? null,
        boardId: r.board_id, sensorId: r.sensor_id,
      };
      await this.evaluateSensor(r, target);
    }
  }

  // Reads either an aggregate value (1-phase sensor) or a list of
  // wired-phase values (3-phase sensor). For per-phase the function
  // returns labelled entries so the alert message can name "Phase B".
  private phaseValues(
    sensorPhases: number | null,
    aggregate: number | null,
    raw: unknown,
    keys: [string, string, string],
  ): Array<{ label: string; value: number }> {
    if (sensorPhases === 3 && raw && typeof raw === 'object') {
      const r = raw as Record<string, unknown>;
      const labels: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C'];
      const out: Array<{ label: string; value: number }> = [];
      for (let i = 0; i < 3; i++) {
        const v = r[keys[i]];
        if (typeof v === 'number') out.push({ label: `Phase ${labels[i]}`, value: v });
      }
      if (out.length > 0) return out;
      // Fall through to aggregate if raw didn't carry per-phase data
      // (e.g. firmware predates v0.13.13).
    }
    if (aggregate != null) return [{ label: '', value: aggregate }];
    return [];
  }

  private async evaluateSensor(
    r: {
      voltage: number | null;
      current: number | null;
      power: number | null;
      temperature: number | null;
      raw: unknown;
      phases: number | null;
      voltage_min: number | null;
      voltage_max: number | null;
      current_max: number | null;
      power_max: number | null;
      temperature_max: number | null;
    },
    target: {
      siteId: bigint;
      zoneId: bigint | null;
      boardId: bigint;
      sensorId: bigint;
    },
  ) {
    const vLow  = r.voltage_min ?? AlertRulesService.DEFAULT_VOLTAGE_LOW;
    const vHigh = r.voltage_max ?? AlertRulesService.DEFAULT_VOLTAGE_HIGH;
    const tHigh = r.temperature_max ?? AlertRulesService.DEFAULT_TEMP_HIGH;
    const tCrit = tHigh + AlertRulesService.TEMP_CRITICAL_BUFFER;

    // ── voltage_low / voltage_high ──
    // For 3P sensors we check every wired phase (V > 50). The worst
    // offender drives the alert message so the operator knows which leg
    // failed without scrolling /api/status.
    const voltages = this.phaseValues(r.phases, r.voltage, r.raw, ['vA', 'vB', 'vC'])
      // Drop "unwired" zeros — a 3P meter with only Phase A connected
      // legitimately reports V_B = V_C = 0; flagging that as "voltage low"
      // would spam alerts for every single-phase install on an AC306L.
      .filter((p) => p.label === '' || p.value > AlertRulesService.WIRED_PHASE_MIN_V);

    let worstLow: { label: string; value: number } | null = null;
    let worstHigh: { label: string; value: number } | null = null;
    for (const p of voltages) {
      if (p.value < vLow && (!worstLow || p.value < worstLow.value)) worstLow = p;
      if (p.value > vHigh && (!worstHigh || p.value > worstHigh.value)) worstHigh = p;
    }
    if (worstLow) {
      await this.alerts.openOrKeep({
        ...target, code: 'voltage_low', severity: AlertSeverity.WARNING,
        message: `แรงดันต่ำผิดปกติ ${worstLow.label ? worstLow.label + ' ' : ''}${worstLow.value.toFixed(1)} V (< ${vLow} V)`,
      });
      await this.alerts.resolveFor({ ...target, code: 'voltage_high' });
    } else if (worstHigh) {
      await this.alerts.openOrKeep({
        ...target, code: 'voltage_high', severity: AlertSeverity.WARNING,
        message: `แรงดันสูงผิดปกติ ${worstHigh.label ? worstHigh.label + ' ' : ''}${worstHigh.value.toFixed(1)} V (> ${vHigh} V)`,
      });
      await this.alerts.resolveFor({ ...target, code: 'voltage_low' });
    } else if (voltages.length > 0) {
      // All wired phases in range — clear any previously-open voltage alerts.
      await this.alerts.resolveFor({ ...target, code: 'voltage_low' });
      await this.alerts.resolveFor({ ...target, code: 'voltage_high' });
    }

    // ── current_high (no system default — only fires when operator
    //    sets a sensor.current_max) ──
    if (r.current_max != null) {
      const currents = this.phaseValues(r.phases, r.current, r.raw, ['iA', 'iB', 'iC']);
      let worst: { label: string; value: number } | null = null;
      for (const p of currents) {
        if (p.value > r.current_max && (!worst || p.value > worst.value)) worst = p;
      }
      if (worst) {
        await this.alerts.openOrKeep({
          ...target, code: 'current_high', severity: AlertSeverity.WARNING,
          message: `กระแสสูงผิดปกติ ${worst.label ? worst.label + ' ' : ''}${worst.value.toFixed(2)} A (> ${r.current_max} A)`,
        });
      } else if (currents.length > 0) {
        await this.alerts.resolveFor({ ...target, code: 'current_high' });
      }
    } else {
      // Threshold removed — drop the alert if it was open.
      await this.alerts.resolveFor({ ...target, code: 'current_high' });
    }

    // ── power_high (no system default) ──
    if (r.power_max != null) {
      const powers = this.phaseValues(r.phases, r.power, r.raw, ['pA', 'pB', 'pC']);
      let worst: { label: string; value: number } | null = null;
      for (const p of powers) {
        if (p.value > r.power_max && (!worst || p.value > worst.value)) worst = p;
      }
      if (worst) {
        await this.alerts.openOrKeep({
          ...target, code: 'power_high', severity: AlertSeverity.WARNING,
          message: `กำลังสูงผิดปกติ ${worst.label ? worst.label + ' ' : ''}${worst.value.toFixed(1)} W (> ${r.power_max} W)`,
        });
      } else if (powers.length > 0) {
        await this.alerts.resolveFor({ ...target, code: 'power_high' });
      }
    } else {
      await this.alerts.resolveFor({ ...target, code: 'power_high' });
    }

    // ── temperature_high ──
    // Temperature stays an aggregate single value — KWS reports one
    // internal temp regardless of phase wiring (it's the meter's own
    // body temp). The CRITICAL bump kicks in at tHigh + 10°C.
    const t = r.temperature;
    if (t != null && t >= tHigh) {
      await this.alerts.openOrKeep({
        ...target, code: 'temperature_high',
        severity: t >= tCrit ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        message: `อุณหภูมิสูง ${t.toFixed(1)} °C (≥ ${tHigh} °C)${t >= tCrit ? ' — อันตราย' : ''}`,
      });
    } else if (t != null) {
      await this.alerts.resolveFor({ ...target, code: 'temperature_high' });
    }

    // ── phase_imbalance (3P only, needs at least 2 wired phases) ──
    if (r.phases === 3) {
      const wired = this.phaseValues(r.phases, null, r.raw, ['vA', 'vB', 'vC'])
        .filter((p) => p.value > AlertRulesService.WIRED_PHASE_MIN_V);
      if (wired.length >= 2) {
        const vals = wired.map((p) => p.value);
        const vMin = Math.min(...vals);
        const vMax = Math.max(...vals);
        const vAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const pct = vAvg > 0 ? ((vMax - vMin) / vAvg) * 100 : 0;
        if (pct > AlertRulesService.IMBALANCE_PCT) {
          await this.alerts.openOrKeep({
            ...target, code: 'phase_imbalance', severity: AlertSeverity.WARNING,
            message: `เฟสไม่บาลานซ์ ${pct.toFixed(1)}% (V min ${vMin.toFixed(1)} / max ${vMax.toFixed(1)} V, เกิน ${AlertRulesService.IMBALANCE_PCT}%)`,
          });
        } else {
          await this.alerts.resolveFor({ ...target, code: 'phase_imbalance' });
        }
      } else {
        // Fewer than 2 phases wired — imbalance isn't a meaningful check.
        await this.alerts.resolveFor({ ...target, code: 'phase_imbalance' });
      }
    } else {
      await this.alerts.resolveFor({ ...target, code: 'phase_imbalance' });
    }
  }
}
