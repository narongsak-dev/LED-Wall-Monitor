import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import {
  PaginatedReportDto,
  QueryTelemetryDto,
  TimeRangeDto,
} from './dto/query-telemetry.dto';

interface TimeBoundary {
  from: Date;
  to: Date;
  bucket: '1 minute' | '1 hour' | '1 day' | '1 month';
  source: 'telemetry' | 'telemetry_hourly' | 'telemetry_daily';
}

@Injectable()
export class TelemetryService {
  constructor(private readonly prisma: PrismaService) {}

  async insert(point: {
    time: Date;
    sensorId: bigint;
    boardId: bigint;
    siteId: bigint;
    voltage?: number;
    current?: number;
    power?: number;
    energy?: number;
    temperature?: number;
    humidity?: number;
    raw?: unknown;
  }) {
    return this.prisma.telemetry.create({
      data: {
        time: point.time,
        sensorId: point.sensorId,
        boardId: point.boardId,
        siteId: point.siteId,
        voltage: point.voltage,
        current: point.current,
        power: point.power,
        energy: point.energy,
        temperature: point.temperature,
        humidity: point.humidity,
        raw: point.raw as never,
      },
    });
  }

  async latestForSensor(sensorId: number) {
    const row = await this.prisma.telemetry.findFirst({
      where: { sensorId: BigInt(sensorId) },
      orderBy: { time: 'desc' },
    });
    if (!row) return null;
    return {
      time: row.time.toISOString(),
      sensorId: Number(row.sensorId),
      boardId: Number(row.boardId),
      siteId: Number(row.siteId),
      voltage: row.voltage,
      current: row.current,
      power: row.power,
      energy: row.energy,
      temperature: row.temperature,
      humidity: row.humidity,
      raw: row.raw,
    };
  }

  async latestPerSensorForSite(siteId: number) {
    const rows = await this.prisma.$queryRaw<Array<{
      sensor_id: bigint;
      board_id: bigint;
      time: Date;
      voltage: number | null;
      current: number | null;
      power: number | null;
      energy: number | null;
      temperature: number | null;
      humidity: number | null;
      raw: unknown;
    }>>`
      SELECT DISTINCT ON (sensor_id)
        sensor_id, board_id, time, voltage, current, power, energy, temperature, humidity, raw
      FROM telemetry
      WHERE site_id = ${BigInt(siteId)}
      ORDER BY sensor_id, time DESC
    `;
    return rows.map((r) => ({
      sensorId: Number(r.sensor_id),
      boardId: Number(r.board_id),
      siteId,
      time: r.time.toISOString(),
      voltage: r.voltage,
      current: r.current,
      power: r.power,
      energy: r.energy,
      temperature: r.temperature,
      humidity: r.humidity,
      raw: r.raw,
    }));
  }

  async latestForBoard(boardId: number) {
    const rows = await this.prisma.$queryRaw<Array<{
      sensor_id: bigint;
      time: Date;
      voltage: number | null;
      current: number | null;
      power: number | null;
      energy: number | null;
      temperature: number | null;
      humidity: number | null;
      raw: unknown;
    }>>`
      SELECT DISTINCT ON (sensor_id)
        sensor_id, time, voltage, current, power, energy, temperature, humidity, raw
      FROM telemetry
      WHERE board_id = ${BigInt(boardId)}
      ORDER BY sensor_id, time DESC
    `;
    return rows.map((r) => ({
      sensorId: Number(r.sensor_id),
      time: r.time.toISOString(),
      voltage: r.voltage,
      current: r.current,
      power: r.power,
      energy: r.energy,
      temperature: r.temperature,
      humidity: r.humidity,
      raw: r.raw,
    }));
  }

  async latestForSite(siteId: number) {
    const row = await this.prisma.telemetry.findFirst({
      where: { siteId: BigInt(siteId) },
      orderBy: { time: 'desc' },
    });
    if (!row) return null;
    return {
      time: row.time.toISOString(),
      sensorId: Number(row.sensorId),
      boardId: Number(row.boardId),
      siteId: Number(row.siteId),
      voltage: row.voltage,
      current: row.current,
      power: row.power,
      energy: row.energy,
      temperature: row.temperature,
      humidity: row.humidity,
      raw: row.raw,
    };
  }

  async series(query: QueryTelemetryDto) {
    const bounds = this.resolveBounds(query);
    const timeCol = bounds.source === 'telemetry' ? 'time' : 'bucket';
    const t = bounds.source === 'telemetry' ? 't' : 'b'; // table alias
    const c = bounds.source === 'telemetry'
      ? { v: 'voltage', a: 'current', p: 'power', e: 'energy', t: 'temperature', h: 'humidity' }
      : { v: 'voltage_avg', a: 'current_avg', p: 'power_avg', e: 'energy_max', t: 'temperature_avg', h: 'humidity_avg' };
    const sensorFilter = query.sensorId
      ? `AND ${t}.sensor_id = ${BigInt(query.sensorId)}`
      : '';
    // Zone filter: join boards to get zone_id. Continuous aggregates
    // (telemetry_hourly/_daily) carry board_id so the same join works.
    const zoneJoin = query.zoneId
      ? `JOIN boards bd ON bd.id = ${t}.board_id`
      : '';
    const zoneFilter = query.zoneId
      ? `AND bd.zone_id = ${BigInt(query.zoneId)}`
      : '';
    const sql = `
      SELECT time_bucket($1::interval, ${t}.${timeCol}) AS bucket,
             AVG(${t}.${c.v}) AS voltage,
             AVG(${t}.${c.a}) AS current,
             AVG(${t}.${c.p}) AS power,
             MAX(${t}.${c.e}) AS energy,
             AVG(${t}.${c.t}) AS temperature,
             AVG(${t}.${c.h}) AS humidity
      FROM ${bounds.source} ${t}
      ${zoneJoin}
      WHERE ${t}.site_id = $2 AND ${t}.${timeCol} >= $3 AND ${t}.${timeCol} < $4
        ${sensorFilter}
        ${zoneFilter}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;
    const rows = await this.prisma.$queryRawUnsafe<Array<{
      bucket: Date;
      voltage: number | null;
      current: number | null;
      power: number | null;
      energy: number | null;
      temperature: number | null;
      humidity: number | null;
    }>>(
      sql,
      bounds.bucket,
      BigInt(query.siteId),
      bounds.from,
      bounds.to,
    );

    // Gap-fill: the chart needs every expected bucket present so the
    // x-axis is continuous. SQL only returns buckets that had at least one
    // row, so we stitch together the full sequence here and use `null` for
    // gaps. The frontend uses `null` (not `0`) to render an explicit "no
    // data" marker — preserving the distinction between "we measured zero"
    // and "we have no measurement".
    const byBucket = new Map<number, typeof rows[number]>();
    for (const r of rows) byBucket.set(r.bucket.getTime(), r);

    const expected = this.expectedBuckets(bounds);
    const out: Array<{
      time: string; siteId: number;
      voltage: number | null; current: number | null; power: number | null;
      energy: number | null; temperature: number | null; humidity: number | null;
    }> = [];
    for (const ts of expected) {
      const r = byBucket.get(ts);
      out.push({
        time: new Date(ts).toISOString(),
        siteId: query.siteId,
        voltage:     r ? r.voltage     : null,
        current:     r ? r.current     : null,
        power:       r ? r.power       : null,
        energy:      r ? r.energy      : null,
        temperature: r ? r.temperature : null,
        humidity:    r ? r.humidity    : null,
      });
    }
    return out;
  }

  /** Generate the timestamps for every expected bucket in [from, to)
   *  aligned the same way TimescaleDB's `time_bucket()` aligns them.
   *  '1 month' needs calendar-aware stepping because months aren't
   *  fixed-length; the others step by a constant millisecond delta. */
  private expectedBuckets(bounds: TimeBoundary): number[] {
    const endMs = bounds.to.getTime();
    const out: number[] = [];

    if (bounds.bucket === '1 month') {
      // Align DOWN to the first UTC day of the month containing bounds.from.
      const d = new Date(bounds.from);
      d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0);
      while (d.getTime() < endMs) {
        out.push(d.getTime());
        d.setUTCMonth(d.getUTCMonth() + 1);
      }
      return out;
    }

    const stepMs =
      bounds.bucket === '1 minute' ? 60_000
      : bounds.bucket === '1 hour' ? 3_600_000
      : 86_400_000;
    const start = Math.floor(bounds.from.getTime() / stepMs) * stepMs;
    for (let ts = start; ts < endMs; ts += stepMs) out.push(ts);
    return out;
  }

  async summary(query: QueryTelemetryDto) {
    const bounds = this.resolveBounds(query);
    const sensorFilter = query.sensorId
      ? `AND t.sensor_id = ${BigInt(query.sensorId)}`
      : '';
    const zoneJoin = query.zoneId
      ? `JOIN boards bd ON bd.id = t.board_id`
      : '';
    const zoneFilter = query.zoneId
      ? `AND bd.zone_id = ${BigInt(query.zoneId)}`
      : '';

    const sql = `
      SELECT
        COUNT(*)::bigint        AS row_count,
        MIN(t.time)             AS first_time,
        MAX(t.time)             AS last_time,
        MIN(t.energy)           AS energy_min,
        MAX(t.energy)           AS energy_max,
        AVG(t.voltage)::float   AS voltage_avg,
        MIN(t.voltage)::float   AS voltage_min,
        MAX(t.voltage)::float   AS voltage_max,
        AVG(t.current)::float   AS current_avg,
        MIN(t.current)::float   AS current_min,
        MAX(t.current)::float   AS current_max,
        AVG(t.power)::float     AS power_avg,
        MIN(t.power)::float     AS power_min,
        MAX(t.power)::float     AS power_max,
        AVG(t.temperature)::float AS temp_avg,
        MIN(t.temperature)::float AS temp_min,
        MAX(t.temperature)::float AS temp_max
      FROM telemetry t
      ${zoneJoin}
      WHERE t.site_id = $1
        AND t.time >= $2 AND t.time < $3
        ${sensorFilter}
        ${zoneFilter}
    `;
    const result = await this.prisma.$queryRawUnsafe<Array<{
      row_count: bigint;
      first_time: Date | null;
      last_time: Date | null;
      energy_min: number | null;
      energy_max: number | null;
      voltage_avg: number | null;
      voltage_min: number | null;
      voltage_max: number | null;
      current_avg: number | null;
      current_min: number | null;
      current_max: number | null;
      power_avg: number | null;
      power_min: number | null;
      power_max: number | null;
      temp_avg: number | null;
      temp_min: number | null;
      temp_max: number | null;
    }>>(sql, BigInt(query.siteId), bounds.from, bounds.to);

    const r = result[0];
    const rowCount = Number(r.row_count);
    const energyDelta =
      r.energy_max != null && r.energy_min != null
        ? Math.max(0, r.energy_max - r.energy_min)
        : 0;

    // Distribution by sensor in the same range
    const distSql = `
      SELECT t.sensor_id,
             COUNT(*)::bigint AS count,
             AVG(t.power)::float AS avg_power,
             MAX(t.power)::float AS max_power,
             COALESCE(MAX(t.energy) - MIN(t.energy), 0)::float AS energy_delta
      FROM telemetry t
      ${zoneJoin}
      WHERE t.site_id = $1
        AND t.time >= $2 AND t.time < $3
        ${sensorFilter}
        ${zoneFilter}
      GROUP BY t.sensor_id
      ORDER BY t.sensor_id
    `;
    const dist = await this.prisma.$queryRawUnsafe<Array<{
      sensor_id: bigint;
      count: bigint;
      avg_power: number | null;
      max_power: number | null;
      energy_delta: number | null;
    }>>(distSql, BigInt(query.siteId), bounds.from, bounds.to);

    return {
      range: { from: bounds.from.toISOString(), to: bounds.to.toISOString() },
      rowCount,
      firstTime: r.first_time?.toISOString() ?? null,
      lastTime: r.last_time?.toISOString() ?? null,
      energy: { delta: energyDelta, min: r.energy_min, max: r.energy_max },
      voltage: { avg: r.voltage_avg, min: r.voltage_min, max: r.voltage_max },
      current: { avg: r.current_avg, min: r.current_min, max: r.current_max },
      power: { avg: r.power_avg, min: r.power_min, max: r.power_max },
      temperature: { avg: r.temp_avg, min: r.temp_min, max: r.temp_max },
      bySensor: dist.map((d) => ({
        sensorId: Number(d.sensor_id),
        count: Number(d.count),
        avgPower: d.avg_power,
        maxPower: d.max_power,
        energyDelta: d.energy_delta,
      })),
    };
  }

  async report(query: PaginatedReportDto) {
    const bounds = this.resolveBounds(query);
    const skip = (query.page - 1) * query.pageSize;

    const where: {
      siteId: bigint;
      sensorId?: bigint;
      board?: { zoneId: bigint };
      time: { gte: Date; lt: Date };
    } = {
      siteId: BigInt(query.siteId),
      time: { gte: bounds.from, lt: bounds.to },
    };
    if (query.sensorId != null) where.sensorId = BigInt(query.sensorId);
    // Zone filter via the board relation. Prisma generates a sub-query so
    // this stays a single round-trip on the count + page.
    if (query.zoneId != null) where.board = { zoneId: BigInt(query.zoneId) };

    const [rows, total] = await Promise.all([
      this.prisma.telemetry.findMany({
        where,
        orderBy: { time: 'desc' },
        skip,
        take: query.pageSize,
      }),
      this.prisma.telemetry.count({ where }),
    ]);

    return {
      data: rows.map((r) => ({
        time: r.time.toISOString(),
        sensorId: Number(r.sensorId),
        boardId: Number(r.boardId),
        siteId: Number(r.siteId),
        voltage: r.voltage,
        current: r.current,
        power: r.power,
        energy: r.energy,
        temperature: r.temperature,
        humidity: r.humidity,
        raw: r.raw,
      })),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  /** Per-zone aggregates for the Dashboard's Zone Overview card. Returns
   *  one row per zone (plus a `null` row for boards not assigned to any
   *  zone) covering the same time bounds the report endpoint uses. */
  async zoneSummary(query: QueryTelemetryDto) {
    const bounds = this.resolveBounds(query);
    const rows = await this.prisma.$queryRaw<Array<{
      zone_id: bigint | null;
      zone_code: string | null;
      zone_name: string | null;
      board_count: bigint;
      sensor_count: bigint;
      energy: number | null;
      power_avg: number | null;
      power_max: number | null;
    }>>`
      SELECT
        bd.zone_id                                  AS zone_id,
        z.code                                      AS zone_code,
        z.name                                      AS zone_name,
        COUNT(DISTINCT bd.id)                       AS board_count,
        COUNT(DISTINCT t.sensor_id)                 AS sensor_count,
        COALESCE(MAX(t.energy) - MIN(t.energy), 0)::float AS energy,
        AVG(t.power)::float                         AS power_avg,
        MAX(t.power)::float                         AS power_max
      FROM telemetry t
      JOIN boards bd ON bd.id = t.board_id
      LEFT JOIN zones z ON z.id = bd.zone_id
      WHERE t.site_id = ${BigInt(query.siteId)}
        AND t.time >= ${bounds.from}
        AND t.time <  ${bounds.to}
      GROUP BY bd.zone_id, z.code, z.name
      ORDER BY energy DESC NULLS LAST
    `;
    return rows.map((r) => ({
      zoneId: r.zone_id != null ? Number(r.zone_id) : null,
      zoneCode: r.zone_code,
      zoneName: r.zone_name,
      boardCount: Number(r.board_count),
      sensorCount: Number(r.sensor_count),
      energy: r.energy ?? 0,
      powerAvg: r.power_avg ?? 0,
      powerMax: r.power_max ?? 0,
    }));
  }

  /** Asia/Bangkok is UTC+7 with no DST, so "midnight Bangkok" is just
   *  midnight UTC minus 7 hours. We use this for the calendar-aware ranges
   *  (MONTH_CAL, YEAR_CAL) since the user reads reports in local time. */
  private static readonly TZ_OFFSET_MIN = 7 * 60;

  /** Returns the Date that represents 00:00 local time (Asia/Bangkok) of the
   *  day containing `now`, expressed as a UTC Date. */
  private startOfLocalDay(now: Date): Date {
    const localMs = now.getTime() + TelemetryService.TZ_OFFSET_MIN * 60_000;
    const localMidnight = Math.floor(localMs / 86_400_000) * 86_400_000;
    return new Date(localMidnight - TelemetryService.TZ_OFFSET_MIN * 60_000);
  }

  /** Pick a bucket size + source table that gives a useful resolution for
   *  the given span. Used by CUSTOM. Aligns with the spec's grouping rules:
   *    span ≤ 1 d   →  1 hour  on the hourly aggregate (24 buckets max)
   *    span ≤ 60 d  →  1 day   on the daily aggregate
   *    otherwise    →  1 month on the daily aggregate (rolled up SQL-side) */
  private autoBucket(spanMs: number): Pick<TimeBoundary, 'bucket' | 'source'> {
    const HOUR = 3_600_000;
    const DAY  = 86_400_000;
    if (spanMs <= 1 * DAY + HOUR) return { bucket: '1 hour', source: 'telemetry_hourly' };
    if (spanMs <= 60 * DAY)       return { bucket: '1 day',  source: 'telemetry_daily' };
    return { bucket: '1 month', source: 'telemetry_daily' };
  }

  private resolveBounds(query: QueryTelemetryDto): TimeBoundary {
    const now = new Date();
    if (query.range === TimeRangeDto.CUSTOM && query.from && query.to) {
      const from = new Date(query.from);
      const to   = new Date(query.to);
      return { from, to, ...this.autoBucket(to.getTime() - from.getTime()) };
    }
    switch (query.range) {
      case TimeRangeDto.REALTIME:
        return {
          from: new Date(now.getTime() - 60 * 60 * 1000),
          to: now,
          bucket: '1 minute',
          source: 'telemetry',
        };
      case TimeRangeDto.TODAY:
        // From midnight local time (Asia/Bangkok) to now. Hour bucket gives
        // 24 points max — a clean "energy by hour today" view.
        return {
          from: this.startOfLocalDay(now),
          to: now,
          bucket: '1 hour',
          source: 'telemetry_hourly',
        };
      case TimeRangeDto.H24:
        return {
          from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          to: now,
          bucket: '1 minute',
          source: 'telemetry',
        };
      case TimeRangeDto.D7:
        // 7 days of daily buckets — 1 bar per day, clean DD/MM x-axis.
        return {
          from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          to: now,
          bucket: '1 day',
          source: 'telemetry_daily',
        };
      case TimeRangeDto.MONTH:
        // Rolling 30 days, daily buckets so the x-axis stays at one bar
        // per day (the previous 1-hour bucket produced 720 bars labelled
        // DD/MM repeating 24× per day — the "เบิ้ล" bug).
        return {
          from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          to: now,
          bucket: '1 day',
          source: 'telemetry_daily',
        };
      case TimeRangeDto.MONTH_CAL: {
        // First day of the current calendar month, Asia/Bangkok local time.
        const today = this.startOfLocalDay(now);
        const localToday = new Date(today.getTime() + TelemetryService.TZ_OFFSET_MIN * 60_000);
        const firstOfMonth = new Date(Date.UTC(
          localToday.getUTCFullYear(),
          localToday.getUTCMonth(),
          1,
        ));
        const from = new Date(firstOfMonth.getTime() - TelemetryService.TZ_OFFSET_MIN * 60_000);
        return { from, to: now, bucket: '1 day', source: 'telemetry_daily' };
      }
      case TimeRangeDto.YEAR_CAL: {
        // Spec says year-range views should bucket by month. We use the
        // daily continuous aggregate as source and let time_bucket() roll
        // it up into months SQL-side. Aligns to calendar months UTC.
        const today = this.startOfLocalDay(now);
        const localToday = new Date(today.getTime() + TelemetryService.TZ_OFFSET_MIN * 60_000);
        const firstOfYear = new Date(Date.UTC(localToday.getUTCFullYear(), 0, 1));
        const from = new Date(firstOfYear.getTime() - TelemetryService.TZ_OFFSET_MIN * 60_000);
        return { from, to: now, bucket: '1 month', source: 'telemetry_daily' };
      }
      case TimeRangeDto.YEAR:
      default:
        return {
          from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
          to: now,
          bucket: '1 month',
          source: 'telemetry_daily',
        };
    }
  }
}
