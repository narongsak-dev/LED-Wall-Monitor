import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BatteryCharging,
  CheckCircle2,
  ChevronRight,
  Cpu,
  FileText,
  Gauge as GaugeIcon,
  HardDrive,
  Search,
  Server,
  Settings,
  Sigma,
  Thermometer,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useSiteRealtime } from '@/features/realtime/realtimeStore';
import { useConnectionStore } from '@/features/realtime/connectionStore';
import { useSiteSensors } from '@/features/sensors/hooks';
import { useZones } from '@/features/zones/hooks';
import { useBoards } from '@/features/boards/hooks';
import { useTelemetrySummary } from '@/features/telemetry/hooks';
import { useTariff } from '@/features/tariff/hooks';
import { useAckAlert, useAlerts, useZoneSummary } from '@/features/alerts/hooks';
import type { Alert as AlertRow, ZoneSummaryRow } from '@monitor/shared';
import { useTheme } from '@/features/theme/useTheme';
import { CHART_THEMES } from '@/features/theme/chartTheme';
import { dayjs } from '@/lib/dayjs';
import type { BoardWithSensors, SensorWithContext, TelemetryPoint } from '@monitor/shared';

// ────────────────────────────────────────────────────────────────
//  Freshness model
//  Spec:
//    realtime  : 0–10 s
//    delayed   : 10–30 s
//    stale     : 30 s – 2 m
//    offline   : > 2 m
// ────────────────────────────────────────────────────────────────
type Freshness = 'fresh' | 'delayed' | 'stale' | 'offline' | 'never';
const FRESHNESS_BUCKETS: Array<{ max: number; state: Freshness }> = [
  { max: 10_000,   state: 'fresh'    },
  { max: 30_000,   state: 'delayed'  },
  { max: 120_000,  state: 'stale'    },
  { max: Infinity, state: 'offline'  },
];
function freshness(timeMs?: number | null, now = Date.now()): Freshness {
  if (timeMs == null) return 'never';
  const age = now - timeMs;
  for (const b of FRESHNESS_BUCKETS) if (age < b.max) return b.state;
  return 'offline';
}
function freshnessLabel(f: Freshness, ageMs?: number | null): string {
  if (f === 'never') return 'ไม่เคย';
  if (ageMs == null) return '—';
  if (ageMs < 60_000) return `${Math.round(ageMs / 1000)} วินาทีที่แล้ว`;
  if (ageMs < 3_600_000) return `${Math.round(ageMs / 60_000)} นาทีที่แล้ว`;
  return dayjs(Date.now() - ageMs).fromNow();
}
function freshnessColor(f: Freshness): string {
  return f === 'fresh' ? 'var(--green)'
       : f === 'delayed' ? 'var(--yellow)'
       : f === 'stale' ? 'var(--yellow)'
       : 'var(--red)';
}

// ────────────────────────────────────────────────────────────────
//  Sensor type classification
//  Firmware emits one of these models on the sensor record. The UI
//  only switches behavior in three buckets: PZEM, KWS single-phase,
//  KWS three-phase. Anything unrecognised falls back to PZEM-like.
// ────────────────────────────────────────────────────────────────
type SensorKind = 'pzem' | 'kws-1p' | 'kws-3p' | 'unknown';
function sensorKind(
  s: { model?: string | null; code?: string; phases?: 1 | 3 | null },
): SensorKind {
  // `phases` is the source of truth when the operator has set it in
  // the admin form. Falls back to a string-match heuristic on model/
  // code for legacy rows that pre-date the phases column.
  if (s.phases === 3) return 'kws-3p';
  if (s.phases === 1) return 'kws-1p';
  const m = (s.model ?? '').toUpperCase();
  const c = (s.code ?? '').toUpperCase();
  if (m.includes('PZEM') || c.startsWith('PZEM')) return 'pzem';
  if (m.includes('AC306') || m.includes('3P') || m.includes('THREE')) return 'kws-3p';
  if (m.startsWith('KWS') || c.startsWith('KWS')) return 'kws-1p';
  return 'unknown';
}
function sensorKindLabel(k: SensorKind): string {
  return k === 'pzem'   ? 'PZEM'
       : k === 'kws-1p' ? 'KWS 1-phase'
       : k === 'kws-3p' ? 'KWS 3-phase'
       : 'ไม่ทราบรุ่น';
}

// ────────────────────────────────────────────────────────────────
//  Page
// ────────────────────────────────────────────────────────────────
export function DashboardPage() {
  const navigate = useNavigate();
  const { siteId } = useParams();
  const id = siteId ? Number(siteId) : null;

  const themeMode = useTheme();
  const ct = CHART_THEMES[themeMode];

  const socketState = useConnectionStore((s) => s.socketState);

  const site = useSiteRealtime(id ?? 0);
  const { data: sensors = [] } = useSiteSensors(id);
  const { data: zones = [] } = useZones(id);
  const { data: boards = [] } = useBoards(id ?? undefined);

  // Tick once per second so freshness badges and "X seconds ago" stay live.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // ─── Scope (filter cascade) ────────────────────────────────────
  // Sidebar already owns Site. We add: Zone → Board → SensorType → search.
  const [zoneId, setZoneId]     = useState<number | 'all'>('all');
  const [boardId, setBoardId]   = useState<number | 'all'>('all');
  const [kind, setKind]         = useState<SensorKind | 'all'>('all');
  const [search, setSearch]     = useState('');

  // Reset child selections when parent changes so we never sit on an
  // out-of-scope value.
  useEffect(() => { setBoardId('all'); }, [zoneId]);

  const activeSensors = useMemo(
    () => sensors.filter((s) => s.isActive),
    [sensors],
  );

  const boardsByZone = useMemo(() => {
    const m = new Map<number | 'none', BoardWithSensors[]>();
    for (const b of boards) {
      const z = (b.zoneId ?? null) as number | null;
      const k = z ?? 'none';
      const list = m.get(k) ?? [];
      list.push(b);
      m.set(k, list);
    }
    return m;
  }, [boards]);

  const boardsInScope = useMemo(() => {
    return boards.filter((b) =>
      (zoneId === 'all' || (b.zoneId ?? null) === zoneId) &&
      b.isActive,
    );
  }, [boards, zoneId]);

  const sensorsInScope = useMemo<SensorWithContext[]>(() => {
    return activeSensors.filter((s) => {
      if (zoneId !== 'all' && (s.zoneId ?? null) !== zoneId) return false;
      if (boardId !== 'all' && Number(s.boardId) !== boardId) return false;
      if (kind !== 'all' && sensorKind(s) !== kind) return false;
      if (search) {
        const q = search.toLowerCase();
        const hay = `${s.code} ${s.name ?? ''} ${s.boardCode ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [activeSensors, zoneId, boardId, kind, search]);

  const inScopeSensorIds = useMemo(
    () => new Set(sensorsInScope.map((s) => s.id)),
    [sensorsInScope],
  );

  // ─── Realtime aggregates from in-memory store ────────────────────
  // We compute over the in-scope sensors only. Each sensor's latest reading
  // is gated by freshness so a stale row never contributes to "live" metrics.
  const live = useMemo(() => {
    let powerSum = 0;
    let powerCount = 0;
    let voltageSum = 0;
    let voltageCount = 0;
    let currentSum = 0;
    let currentCount = 0;
    let tempMax: number | null = null;
    let voltageMin: number | null = null;
    let voltageMax: number | null = null;
    let freshSensors = 0;
    let totalSensors = 0;
    let mostRecentTime: number | null = null;

    for (const s of sensorsInScope) {
      totalSensors += 1;
      const state = site?.bySensor?.[s.id];
      const latest = state?.latest;
      if (!latest?.time) continue;
      const ts = new Date(latest.time).getTime();
      const f = freshness(ts, now);
      if (f === 'offline' || f === 'never') continue;
      if (f === 'fresh' || f === 'delayed') freshSensors += 1;
      if (mostRecentTime == null || ts > mostRecentTime) mostRecentTime = ts;

      if (latest.power != null)   { powerSum   += latest.power;   powerCount += 1; }
      if (latest.voltage != null) {
        voltageSum += latest.voltage; voltageCount += 1;
        voltageMin = voltageMin == null ? latest.voltage : Math.min(voltageMin, latest.voltage);
        voltageMax = voltageMax == null ? latest.voltage : Math.max(voltageMax, latest.voltage);
      }
      if (latest.current != null) { currentSum += latest.current; currentCount += 1; }
      if (latest.temperature != null) {
        tempMax = tempMax == null ? latest.temperature : Math.max(tempMax, latest.temperature);
      }
    }

    return {
      powerSum,
      voltageAvg: voltageCount ? voltageSum / voltageCount : null,
      voltageMin, voltageMax,
      currentSum: currentCount ? currentSum : null,
      tempMax,
      freshSensors,
      totalSensors,
      mostRecentTime,
    };
  }, [sensorsInScope, site, now]);

  // ─── Today summary (last 24 h via summary endpoint) ──────────────
  // Backend energy.delta returns max-min over the range — close enough to
  // "เพิ่มขึ้นในช่วงนี้". Per-zone numbers are computed from the realtime
  // store (approximation) — a dedicated zone-summary endpoint can replace
  // this in Phase 3 if precision matters.
  const summaryQuery = id != null ? {
    siteId: id,
    range: '24h' as const,
    ...(zoneId !== 'all' ? { zoneId: zoneId as number } : {}),
  } : null;
  const { data: summary } = useTelemetrySummary(summaryQuery);
  const energyToday = summary?.energy?.delta ?? null;
  const peakPower   = summary?.power?.max ?? null;

  // Phase 3 data: live alerts + per-zone energy aggregates + optional
  // tariff. The cost card renders only when the operator has configured
  // a tariff at /admin/sites/:id, otherwise it's omitted entirely.
  const { data: tariff = null }   = useTariff(id);
  const { data: alerts = [] }     = useAlerts(id, true);
  const { data: zoneSummary = [] } = useZoneSummary(id, 'today');
  const ackMut = useAckAlert(id);
  // Cost is only meaningful with a positive rate. Backend currently
  // accepts rate=0 (treated as "configured but free") — guard here so a
  // stray zero never produces a confusing "ค่าไฟ = 0.00 บาท" card.
  // `enabled` is the operator's on/off switch for the whole feature.
  // When false, we hide the cost card entirely even though a rate exists.
  const hasTariff = tariff != null && tariff.rate > 0 && tariff.enabled === true;
  const costToday = energyToday != null && hasTariff
    ? energyToday * tariff.rate
    : null;

  // ─── Realtime chart series ──────────────────────────────────────
  type Window = '5m' | '15m' | '30m' | '1h';
  const [chartWindow, setChartWindow] = useState<Window>('15m');
  const windowMs: Record<Window, number> = {
    '5m':  5 * 60_000,
    '15m': 15 * 60_000,
    '30m': 30 * 60_000,
    '1h':  60 * 60_000,
  };
  const chartData = useMemo(() => {
    if (!site?.bySensor) return [];
    const cutoff = now - windowMs[chartWindow];
    const byTime = new Map<number, { sum: number; count: number }>();
    for (const [sidStr, state] of Object.entries(site.bySensor)) {
      if (!inScopeSensorIds.has(Number(sidStr))) continue;
      for (const p of state.history as TelemetryPoint[]) {
        const ts = new Date(p.time).getTime();
        if (ts < cutoff) continue;
        const bucket = Math.floor(ts / 5_000) * 5_000;
        const e = byTime.get(bucket) ?? { sum: 0, count: 0 };
        e.sum += p.power ?? 0;
        e.count += 1;
        byTime.set(bucket, e);
      }
    }
    return Array.from(byTime.entries())
      .sort(([a], [b]) => a - b)
      .map(([t, e]) => ({ t, power: e.sum })); // Watts
  }, [site, inScopeSensorIds, chartWindow, windowMs, now]);

  const chartOption = useMemo(() => ({
    grid: { left: 50, right: 16, top: 14, bottom: 32 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltipBg,
      borderColor: ct.tooltipBorder,
      textStyle: { color: ct.tooltipText },
      formatter: (params: Array<{ axisValue: string; data: number; seriesName: string }>) => {
        const p = params[0];
        return `${p.axisValue}<br/>กำลังไฟ ${Number(p.data).toFixed(1)} W`;
      },
    },
    xAxis: {
      type: 'category',
      data: chartData.map((p) => dayjs(p.t).format('HH:mm:ss')),
      axisLine: { lineStyle: { color: ct.axis } },
      axisLabel: { color: ct.label, fontSize: 10.5 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'W',
      nameTextStyle: { color: ct.label, padding: [0, 0, 0, -30] },
      axisLine: { lineStyle: { color: ct.axis } },
      axisLabel: { color: ct.label, fontSize: 10.5 },
      splitLine: { lineStyle: { color: ct.grid } },
    },
    series: [{
      type: 'line',
      smooth: true,
      symbol: 'none',
      sampling: 'lttb',
      lineStyle: { color: 'var(--cyan)', width: 2 },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(6, 182, 212, 0.3)' },
            { offset: 1, color: 'rgba(6, 182, 212, 0)' },
          ],
        },
      },
      data: chartData.map((p) => Number(p.power.toFixed(2))),
    }],
  }), [chartData, ct]);

  // ─── Per-zone aggregations (for Zone Overview + Mini Comparison) ─
  type ZoneAgg = {
    id: number | null;
    code: string;
    name: string;
    boardOnline: number;
    boardTotal: number;
    sensorOnline: number;
    sensorTotal: number;
    powerNow: number;
    energyToday: number;
    worstFreshness: Freshness;
  };
  const zoneAggs = useMemo<ZoneAgg[]>(() => {
    const result: ZoneAgg[] = [];
    const list: Array<{ id: number | null; code: string; name: string }> = [
      ...zones.map((z) => ({ id: z.id as number | null, code: z.code, name: z.name })),
    ];
    const unzonedBoards = boardsByZone.get('none') ?? [];
    if (unzonedBoards.length > 0) {
      list.push({ id: null, code: '—', name: 'ไม่ระบุโซน' });
    }
    for (const z of list) {
      const zb = boards.filter((b) => (b.zoneId ?? null) === z.id);
      const zsensors = activeSensors.filter((s) => (s.zoneId ?? null) === z.id);
      let bOnline = 0, sOnline = 0, pNow = 0, eDay = 0;
      let worst: Freshness = 'fresh';
      for (const b of zb) {
        const bs = activeSensors.filter((x) => Number(x.boardId) === b.id);
        const latestForBoard = bs
          .map((s) => site?.bySensor?.[s.id]?.latest?.time)
          .filter(Boolean)
          .map((t) => new Date(t!).getTime());
        const boardTs = latestForBoard.length ? Math.max(...latestForBoard) : null;
        const bf = freshness(boardTs ?? null, now);
        if (bf === 'fresh' || bf === 'delayed') bOnline += 1;
        if (bf === 'offline' || bf === 'stale' || bf === 'never') {
          if (worst !== 'never') worst = bf === 'never' ? 'never' : bf === 'offline' ? 'offline' : worst === 'fresh' ? 'stale' : worst;
        }
      }
      for (const s of zsensors) {
        const state = site?.bySensor?.[s.id];
        const latest = state?.latest;
        if (!latest?.time) continue;
        const ts = new Date(latest.time).getTime();
        const f = freshness(ts, now);
        if (f === 'fresh' || f === 'delayed') sOnline += 1;
        if (f === 'fresh' || f === 'delayed') {
          if (latest.power != null) pNow += latest.power;
        }
        // Approximate "energy today" from the in-memory history (first vs last).
        const h = state?.history ?? [];
        if (h.length > 1) {
          const a = h[0]?.energy ?? null;
          const b = h[h.length - 1]?.energy ?? null;
          if (a != null && b != null) eDay += Math.max(0, b - a);
        }
      }
      result.push({
        id: z.id, code: z.code, name: z.name,
        boardOnline: bOnline, boardTotal: zb.length,
        sensorOnline: sOnline, sensorTotal: zsensors.length,
        // Prefer the backend zone-summary row when available — it's the
        // accurate "today" number from a real SQL aggregate rather than
        // the in-memory history approximation (eDay).
        powerNow: pNow,
        energyToday:
          zoneSummary.find((zs: ZoneSummaryRow) => zs.zoneId === z.id)?.energy
          ?? eDay,
        worstFreshness: worst,
      });
    }
    return result;
  }, [zones, boards, boardsByZone, activeSensors, site, now, zoneSummary]);

  // ─── Render ────────────────────────────────────────────────────
  if (id == null) {
    return (
      <div style={{ padding: 40, color: 'var(--dim)' }}>
        เลือก site จาก sidebar ก่อน
      </div>
    );
  }

  const overallFreshness: Freshness =
    live.totalSensors === 0           ? 'never'
    : live.freshSensors === 0         ? 'offline'
    : live.freshSensors < live.totalSensors ? 'delayed'
    : 'fresh';

  return (
    <div id="dashboard-export-root">
      <PageHeader title="แดชบอร์ดหลัก" breadcrumb="ดูข้อมูลไซต์" />

      {/* ─── 1. System Status Bar ───────────────────────────────────── */}
      <SystemStatusBar
        socketState={socketState}
        mostRecentDataMs={live.mostRecentTime}
        now={now}
        zones={zones.length}
        boardsOnline={zoneAggs.reduce((a, z) => a + z.boardOnline, 0)}
        boardsTotal={boards.length}
        sensorsOnline={live.freshSensors}
        sensorsTotal={live.totalSensors}
      />

      {/* ─── 2. Scope Filter ───────────────────────────────────────── */}
      <ScopeFilter
        zones={zones}
        boards={boardsInScope}
        zoneId={zoneId} setZoneId={setZoneId}
        boardId={boardId} setBoardId={setBoardId}
        kind={kind} setKind={setKind}
        search={search} setSearch={setSearch}
      />

      {/* ─── 3. Realtime Summary Cards ─────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        <SummaryCard
          icon={<Zap size={20} />}
          label="กำลังไฟปัจจุบัน"
          value={live.powerSum >= 1000 ? (live.powerSum / 1000).toFixed(2) : live.powerSum.toFixed(1)}
          unit={live.powerSum >= 1000 ? 'kW' : 'W'}
          scope={scopeLabel(zoneId, boardId, zones, boards)}
          state={overallFreshness}
        />
        <SummaryCard
          icon={<Activity size={20} />}
          label="แรงดันเฉลี่ย"
          value={live.voltageAvg != null ? live.voltageAvg.toFixed(1) : '—'}
          unit="V"
          sub={live.voltageMin != null && live.voltageMax != null
            ? `${live.voltageMin.toFixed(1)} – ${live.voltageMax.toFixed(1)} V`
            : undefined}
          scope={scopeLabel(zoneId, boardId, zones, boards)}
          state={
            live.voltageAvg == null ? 'never'
            : live.voltageAvg < 210 || live.voltageAvg > 240 ? 'stale'  // visual warning, not freshness
            : overallFreshness
          }
        />
        <SummaryCard
          icon={<GaugeIcon size={20} />}
          label="กระแสรวม"
          value={live.currentSum != null ? live.currentSum.toFixed(3) : '—'}
          unit="A"
          scope={scopeLabel(zoneId, boardId, zones, boards)}
          state={overallFreshness}
        />
        <SummaryCard
          icon={<BatteryCharging size={20} />}
          label="พลังงาน 24 ชม."
          value={energyToday != null ? energyToday.toFixed(3) : '—'}
          unit="kWh"
          sub={peakPower != null ? `peak ${peakPower.toFixed(1)} W` : undefined}
          scope={scopeLabel(zoneId, boardId, zones, boards)}
          state={energyToday == null ? 'never' : 'fresh'}
        />
        <SummaryCard
          icon={<Thermometer size={20} />}
          label="อุณหภูมิสูงสุด"
          value={live.tempMax != null ? live.tempMax.toFixed(1) : '—'}
          unit="°C"
          scope={scopeLabel(zoneId, boardId, zones, boards)}
          state={
            live.tempMax == null    ? 'never'
            : live.tempMax >= 50    ? 'offline'  // critical-red mapping
            : live.tempMax >= 40    ? 'stale'    // warning-yellow mapping
            : overallFreshness
          }
        />
        {/* ค่าไฟ 24 ชม. — only renders when a tariff exists for this
            site (configured at /admin/sites/:id). Skipping the card
            entirely is cleaner than a "ยังไม่ได้ตั้งค่า" placeholder. */}
        {hasTariff && costToday != null && (
          <SummaryCard
            icon={<Sigma size={20} />}
            label="ประมาณการค่าไฟ 24 ชม."
            value={costToday.toFixed(2)}
            unit={tariff!.currency}
            sub={`อัตรา ${tariff!.rate.toFixed(2)} ${tariff!.currency}/kWh`}
            scope={scopeLabel(zoneId, boardId, zones, boards)}
            state="fresh"
          />
        )}
      </div>

      {/* ─── 4. Main 2-column section ──────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 16,
          marginBottom: 16,
        }}
      >
        {/* Left: realtime chart + Today summary */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <RealtimeChartCard
            chartOption={chartOption}
            window={chartWindow}
            setWindow={setChartWindow}
            isEmpty={chartData.length === 0}
            scopeLabel={scopeLabel(zoneId, boardId, zones, boards)}
          />
          <TodayUsageCard
            energy={energyToday}
            peakPower={peakPower}
            zoneAggs={zoneAggs}
            tempMax={summary?.temperature?.max ?? null}
          />
        </div>

        {/* Right: Alerts + Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          <AlertPanel
            alerts={alerts}
            onAcknowledge={(alertId) => ackMut.mutate(alertId)}
            navigate={navigate}
          />
          <QuickActions navigate={navigate} siteId={id} />
        </div>
      </div>

      {/* ─── 5. Zone Overview ────────────────────────────────────── */}
      {zoneAggs.length > 0 && (
        <ZoneOverview
          aggs={zoneAggs}
          onJump={(zid) => setZoneId(zid ?? 'all')}
          activeZoneId={zoneId}
        />
      )}

      {/* ─── 6. Board Status (grouped by zone) ────────────────────── */}
      <BoardStatusSection
        zones={zones}
        boards={boardsInScope}
        sensors={activeSensors}
        site={site}
        now={now}
        onJump={(bid) => navigate(`/admin/devices/${bid}`)}
      />

      {/* ─── 7. Mini Comparison ──────────────────────────────────── */}
      {zoneAggs.length > 1 && (
        <MiniComparison aggs={zoneAggs} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
//  Sub-components
// ────────────────────────────────────────────────────────────────

function scopeLabel(
  zoneId: number | 'all',
  boardId: number | 'all',
  zones: Array<{ id: number; code: string }>,
  boards: BoardWithSensors[],
): string {
  if (boardId !== 'all') {
    const b = boards.find((x) => x.id === boardId);
    return b ? `Board ${b.code}` : 'Board ที่เลือก';
  }
  if (zoneId !== 'all') {
    const z = zones.find((x) => x.id === zoneId);
    return z ? `Zone ${z.code}` : 'Zone ที่เลือก';
  }
  return 'ทั้ง Site';
}

function StatusDot({ state }: { state: Freshness }) {
  return (
    <span
      className={state === 'fresh' ? 'pulse-dot' : ''}
      style={{
        width: 8, height: 8, borderRadius: '50%',
        background: freshnessColor(state),
        display: 'inline-block',
        boxShadow: state === 'fresh'
          ? '0 0 0 4px rgba(34, 197, 94, 0.18)'
          : 'none',
      }}
    />
  );
}

function Pill({
  state, label,
}: { state: Freshness; label: string }) {
  const c = freshnessColor(state);
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '2px 8px', borderRadius: 999,
        background: state === 'fresh' ? 'rgba(34, 197, 94, 0.1)'
                  : state === 'delayed' || state === 'stale' ? 'rgba(250, 204, 21, 0.1)'
                  : 'rgba(239, 68, 68, 0.1)',
        border: `1px solid ${c}55`,
        color: c, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.04,
      }}
    >
      <StatusDot state={state} />
      {label}
    </span>
  );
}

// ─── 1. System Status Bar ────────────────────────────────────────
function SystemStatusBar(props: {
  socketState: ReturnType<typeof useConnectionStore.getState>['socketState'];
  mostRecentDataMs: number | null;
  now: number;
  zones: number;
  boardsOnline: number; boardsTotal: number;
  sensorsOnline: number; sensorsTotal: number;
}) {
  const { socketState, mostRecentDataMs, now, zones,
          boardsOnline, boardsTotal, sensorsOnline, sensorsTotal } = props;
  const dataAge = mostRecentDataMs != null ? now - mostRecentDataMs : null;
  const apiOk = socketState === 'connected';
  const mqttOk = dataAge != null && dataAge < 60_000;

  const ItemBox = ({ children, accent }: { children: React.ReactNode; accent?: string }) => (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 14px',
        borderRight: '1px solid var(--border-color)',
        minWidth: 0,
        color: accent ?? 'var(--text)',
      }}
    >
      {children}
    </div>
  );

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        marginBottom: 14,
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        alignItems: 'stretch',
        flexWrap: 'wrap',
        overflow: 'hidden',
      }}
    >
      <ItemBox accent={apiOk ? 'var(--green)' : 'var(--red)'}>
        {apiOk ? <Wifi size={15} /> : <WifiOff size={15} />}
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>API</span>
        <strong style={{ fontSize: 13 }}>{apiOk ? 'Online' : 'Offline'}</strong>
      </ItemBox>
      <ItemBox accent={mqttOk ? 'var(--green)' : 'var(--yellow)'}>
        <Server size={15} />
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>MQTT</span>
        <strong style={{ fontSize: 13 }}>{mqttOk ? 'Connected' : 'Idle'}</strong>
      </ItemBox>
      <ItemBox>
        <HardDrive size={15} color="var(--purple)" />
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>Zones</span>
        <strong style={{ fontSize: 13 }}>{zones}</strong>
      </ItemBox>
      <ItemBox>
        <Cpu size={15} color="var(--cyan)" />
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>Boards</span>
        <strong style={{ fontSize: 13 }}>
          {boardsOnline}/{boardsTotal}
          <span style={{ color: 'var(--dim)', fontWeight: 500, fontSize: 11, marginLeft: 4 }}>online</span>
        </strong>
      </ItemBox>
      <ItemBox>
        <BarChart3 size={15} color="var(--cyan)" />
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>Sensors</span>
        <strong style={{ fontSize: 13 }}>
          {sensorsOnline}/{sensorsTotal}
          <span style={{ color: 'var(--dim)', fontWeight: 500, fontSize: 11, marginLeft: 4 }}>online</span>
        </strong>
      </ItemBox>
      <ItemBox accent={dataAge != null && dataAge > 30_000 ? 'var(--yellow)' : undefined}>
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>Data delay</span>
        <strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {dataAge == null ? '—' : dataAge < 1000 ? '< 1s' : `${Math.round(dataAge / 1000)}s`}
        </strong>
      </ItemBox>
      <ItemBox>
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>Last update</span>
        <strong style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
          {mostRecentDataMs ? dayjs(mostRecentDataMs).format('HH:mm:ss') : '—'}
        </strong>
      </ItemBox>
    </div>
  );
}

// ─── 2. Scope Filter ───────────────────────────────────────────
function ScopeFilter(props: {
  zones: Array<{ id: number; code: string; name: string }>;
  boards: BoardWithSensors[];
  zoneId: number | 'all'; setZoneId: (v: number | 'all') => void;
  boardId: number | 'all'; setBoardId: (v: number | 'all') => void;
  kind: SensorKind | 'all'; setKind: (v: SensorKind | 'all') => void;
  search: string; setSearch: (v: string) => void;
}) {
  const { zones, boards, zoneId, setZoneId, boardId, setBoardId,
          kind, setKind, search, setSearch } = props;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: '14px 16px',
        marginBottom: 14,
        display: 'flex',
        gap: 14,
        flexWrap: 'wrap',
        alignItems: 'flex-end',
      }}
    >
      <Field label="Zone">
        <Select value={String(zoneId)} onChange={(v) => setZoneId(v === 'all' ? 'all' : Number(v))}>
          <option value="all">ทุก Zone</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>{z.code} · {z.name}</option>
          ))}
        </Select>
      </Field>
      <Field label="Board">
        <Select value={String(boardId)} onChange={(v) => setBoardId(v === 'all' ? 'all' : Number(v))}>
          <option value="all">ทุก Board{zoneId !== 'all' ? ' (ใน Zone)' : ''}</option>
          {boards.map((b) => (
            <option key={b.id} value={b.id}>{b.code}{b.name ? ` · ${b.name}` : ''}</option>
          ))}
        </Select>
      </Field>
      <Field label="Sensor type">
        <Select value={kind} onChange={(v) => setKind(v as SensorKind | 'all')}>
          <option value="all">ทุกชนิด</option>
          <option value="pzem">PZEM</option>
          <option value="kws-1p">KWS 1-phase</option>
          <option value="kws-3p">KWS 3-phase</option>
        </Select>
      </Field>
      <Field label="ค้นหา">
        <div style={{ position: 'relative' }}>
          <Search size={14} color="var(--dim)" style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Board / Sensor code"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '7px 10px 7px 30px',
              borderRadius: 8, fontSize: 13,
              fontFamily: 'inherit', width: 200, outline: 'none',
            }}
          />
        </div>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10.5,
        color: 'var(--dim)', fontWeight: 600,
        marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4,
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}
function Select(props: {
  value: string; onChange: (v: string) => void; children: React.ReactNode;
}) {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        color: 'var(--text)',
        padding: '7px 10px', borderRadius: 8, fontSize: 13,
        fontFamily: 'inherit', cursor: 'pointer', minWidth: 160,
      }}
    >
      {props.children}
    </select>
  );
}

// ─── 3. Summary Card ───────────────────────────────────────────
function SummaryCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit: string;
  sub?: string;
  scope: string;
  state: Freshness;
}) {
  const accent = freshnessColor(props.state);
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: 'var(--shadow-sm)',
        opacity: props.state === 'never' || props.state === 'offline' ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 11, color: 'var(--dim)', fontWeight: 600,
          letterSpacing: 0.03,
        }}>
          <span style={{ color: accent }}>{props.icon}</span>
          {props.label}
        </div>
        <StatusDot state={props.state} />
      </div>
      <div style={{
        marginTop: 10,
        fontSize: 22, fontWeight: 700, color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
      }}>
        {props.value}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--dim)', marginLeft: 4 }}>
          {props.unit}
        </span>
      </div>
      <div style={{ marginTop: 6, fontSize: 11, color: 'var(--dim2)' }}>
        {props.scope}{props.sub ? ` · ${props.sub}` : ''}
      </div>
    </div>
  );
}

// ─── 4a. Realtime Chart Card ───────────────────────────────────
function RealtimeChartCard(props: {
  chartOption: object;
  window: '5m' | '15m' | '30m' | '1h';
  setWindow: (w: '5m' | '15m' | '30m' | '1h') => void;
  isEmpty: boolean;
  scopeLabel: string;
}) {
  const windows: Array<{ key: '5m' | '15m' | '30m' | '1h'; label: string }> = [
    { key: '5m', label: '5 นาที' },
    { key: '15m', label: '15 นาที' },
    { key: '30m', label: '30 นาที' },
    { key: '1h', label: '1 ชั่วโมง' },
  ];
  return (
    <section className="card" style={{ padding: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 10, marginBottom: 12,
      }}>
        <div>
          <span className="card-title">กำลังไฟปัจจุบันย้อนหลัง</span>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
            {props.scopeLabel} · อัปเดตทุก ~3 วินาที
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {windows.map((w) => {
            const active = w.key === props.window;
            return (
              <button
                key={w.key}
                onClick={() => props.setWindow(w.key)}
                style={{
                  background: active ? 'var(--cyan)' : 'var(--bg-input)',
                  border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-color)'}`,
                  color: active ? '#000' : 'var(--text)',
                  padding: '5px 10px', borderRadius: 6,
                  cursor: 'pointer', fontSize: 11.5,
                  fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                }}
              >
                {w.label}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ height: 280 }}>
        {props.isEmpty ? (
          <div style={{
            height: '100%', display: 'grid', placeItems: 'center',
            color: 'var(--dim)', fontSize: 13,
          }}>
            กำลังรอข้อมูล realtime...
          </div>
        ) : (
          <ReactECharts option={props.chartOption} style={{ height: '100%' }} notMerge />
        )}
      </div>
    </section>
  );
}

// ─── 4b. Today Usage ───────────────────────────────────────────
function TodayUsageCard(props: {
  energy: number | null;
  peakPower: number | null;
  zoneAggs: Array<{ name: string; code: string; energyToday: number }>;
  tempMax: number | null;
}) {
  const topZone = props.zoneAggs.length
    ? [...props.zoneAggs].sort((a, b) => b.energyToday - a.energyToday)[0]
    : null;
  return (
    <section className="card" style={{ padding: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <span className="card-title">สรุป 24 ชม. ที่ผ่านมา</span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 14,
      }}>
        <MiniStat label="พลังงาน" value={props.energy != null ? props.energy.toFixed(3) : '—'} unit="kWh" />
        <MiniStat label="Peak Power" value={props.peakPower != null ? props.peakPower.toFixed(1) : '—'} unit="W" />
        <MiniStat
          label="Top Zone"
          value={topZone && topZone.energyToday > 0 ? topZone.code : '—'}
          unit={topZone && topZone.energyToday > 0 ? `${topZone.energyToday.toFixed(2)} kWh` : ''}
        />
        <MiniStat
          label="อุณหภูมิสูงสุด"
          value={props.tempMax != null ? props.tempMax.toFixed(1) : '—'}
          unit="°C"
        />
      </div>
    </section>
  );
}
function MiniStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, color: 'var(--dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.04 }}>
        {label}
      </div>
      <div style={{
        marginTop: 4, fontSize: 18, fontWeight: 700,
        color: 'var(--text)', fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginLeft: 4 }}>
          {unit}
        </span>
      </div>
    </div>
  );
}

// ─── 4c. Alert Panel (server-backed) ────────────────────────────
function AlertPanel(props: {
  alerts: AlertRow[];
  onAcknowledge: (alertId: number) => void;
  navigate: ReturnType<typeof useNavigate>;
}) {
  const { alerts, onAcknowledge, navigate } = props;
  return (
    <section className="card" style={{ padding: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span className="card-title">แจ้งเตือนที่ยังไม่ปิด</span>
        <span style={{ fontSize: 11, color: 'var(--dim)' }}>
          {alerts.length === 0 ? 'ไม่พบ' : `${alerts.length} รายการ`}
        </span>
      </div>
      {alerts.length === 0 ? (
        <div style={{
          padding: '24px 0', textAlign: 'center', color: 'var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <CheckCircle2 size={18} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>ไม่พบความผิดปกติ</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.slice(0, 6).map((a) => {
            const color = a.severity === 'CRITICAL' ? 'var(--red)' : 'var(--yellow)';
            const acked = a.acknowledgedAt != null;
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: a.severity === 'CRITICAL'
                  ? 'rgba(239, 68, 68, 0.06)'
                  : 'rgba(250, 204, 21, 0.06)',
                border: `1px solid ${color}33`,
                opacity: acked ? 0.7 : 1,
              }}>
                <AlertTriangle size={14} color={color} style={{ marginTop: 2 }} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                    display: 'flex', alignItems: 'center', gap: 8,
                  }}>
                    <span>{a.message}</span>
                    {acked && (
                      <span style={{
                        fontSize: 9, padding: '1px 6px', borderRadius: 4,
                        background: 'rgba(148, 163, 184, 0.15)', color: 'var(--dim)',
                        fontWeight: 700, letterSpacing: 0.04,
                      }}>ACKED</span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--dim2)', marginTop: 2,
                    display: 'flex', gap: 8,
                  }}>
                    <span>{a.code}</span>
                    <span>·</span>
                    <span>{dayjs(a.createdAt).fromNow()}</span>
                    {a.boardId && (
                      <>
                        <span>·</span>
                        <button
                          onClick={() => navigate(`/admin/devices/${a.boardId}`)}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            color: 'var(--cyan)', cursor: 'pointer',
                            fontSize: 11, fontFamily: 'inherit',
                          }}
                        >ดูบอร์ด</button>
                      </>
                    )}
                  </div>
                </div>
                {!acked && (
                  <button
                    onClick={() => onAcknowledge(a.id)}
                    title="รับทราบ"
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-color)',
                      color: 'var(--dim)',
                      padding: '2px 8px', borderRadius: 6,
                      fontSize: 10.5, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >ACK</button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ─── 4d. Quick Actions ─────────────────────────────────────────
function QuickActions(props: { navigate: ReturnType<typeof useNavigate>; siteId: number }) {
  const items = [
    { label: 'รายงาน', icon: <FileText size={15} />, to: `/sites/${props.siteId}/reports` },
    { label: 'จัดการ Board', icon: <Cpu size={15} />, to: '/admin/devices' },
    { label: 'จัดการ Site', icon: <Settings size={15} />, to: '/admin/sites' },
  ];
  return (
    <section className="card" style={{ padding: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <span className="card-title">ทางลัด</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => props.navigate(it.to)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 12px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span style={{ color: 'var(--cyan)' }}>{it.icon}</span>
            <span style={{ flex: 1 }}>{it.label}</span>
            <ChevronRight size={14} color="var(--dim)" />
          </button>
        ))}
      </div>
    </section>
  );
}

// ─── 5. Zone Overview ──────────────────────────────────────────
function ZoneOverview(props: {
  aggs: Array<{
    id: number | null; code: string; name: string;
    boardOnline: number; boardTotal: number;
    sensorOnline: number; sensorTotal: number;
    powerNow: number; energyToday: number;
    worstFreshness: Freshness;
  }>;
  onJump: (zoneId: number | null) => void;
  activeZoneId: number | 'all';
}) {
  return (
    <section className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <span className="card-title">Zone Overview</span>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
          ภาพรวมแต่ละโซน
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 260px), 1fr))',
        gap: 12,
      }}>
        {props.aggs.map((z) => {
          const isActive = props.activeZoneId === z.id;
          return (
            <div
              key={String(z.id)}
              style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${isActive ? 'var(--cyan)' : 'var(--border-color)'}`,
                borderRadius: 10, padding: '14px 16px',
                cursor: 'pointer', transition: 'border-color .15s',
              }}
              onClick={() => z.id != null && props.onJump(z.id)}
            >
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'flex-start', gap: 10,
              }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 600 }}>
                    {z.code}
                  </div>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: 'var(--text)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {z.name}
                  </div>
                </div>
                <Pill
                  state={z.worstFreshness}
                  label={z.worstFreshness === 'fresh' ? 'OK'
                       : z.worstFreshness === 'delayed' ? 'DELAYED'
                       : z.worstFreshness === 'stale' ? 'STALE'
                       : z.worstFreshness === 'offline' ? 'OFFLINE' : 'NO DATA'}
                />
              </div>
              <div style={{
                marginTop: 12,
                display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10,
                fontSize: 12,
              }}>
                <div>
                  <div style={{ color: 'var(--dim)', fontSize: 10.5 }}>Boards</div>
                  <div style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {z.boardOnline}<span style={{ color: 'var(--dim)' }}>/{z.boardTotal}</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--dim)', fontSize: 10.5 }}>Sensors</div>
                  <div style={{ color: 'var(--text)', fontWeight: 600 }}>
                    {z.sensorOnline}<span style={{ color: 'var(--dim)' }}>/{z.sensorTotal}</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--dim)', fontSize: 10.5 }}>Power</div>
                  <div style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {z.powerNow.toFixed(1)} <span style={{ color: 'var(--dim)' }}>W</span>
                  </div>
                </div>
                <div>
                  <div style={{ color: 'var(--dim)', fontSize: 10.5 }}>Energy 24h</div>
                  <div style={{ color: 'var(--text)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                    {z.energyToday.toFixed(3)} <span style={{ color: 'var(--dim)' }}>kWh</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ─── 6. Board Status ──────────────────────────────────────────
function BoardStatusSection(props: {
  zones: Array<{ id: number; code: string; name: string }>;
  boards: BoardWithSensors[];
  sensors: SensorWithContext[];
  site: ReturnType<typeof useSiteRealtime>;
  now: number;
  onJump: (boardId: number) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<number | 'none', BoardWithSensors[]>();
    for (const b of props.boards) {
      const k = (b.zoneId ?? 'none') as number | 'none';
      const list = m.get(k) ?? [];
      list.push(b);
      m.set(k, list);
    }
    return m;
  }, [props.boards]);

  const zoneLabel = (k: number | 'none'): string => {
    if (k === 'none') return 'ไม่ระบุโซน';
    const z = props.zones.find((x) => x.id === k);
    return z ? `${z.code} · ${z.name}` : `Zone ${k}`;
  };

  if (props.boards.length === 0) {
    return (
      <section className="card" style={{ padding: 24, marginBottom: 16, textAlign: 'center', color: 'var(--dim)' }}>
        ยังไม่มี Board ใน scope ที่เลือก
      </section>
    );
  }

  return (
    <section className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <span className="card-title">Board Status</span>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
          จัดกลุ่มตามโซน · คลิก board เพื่อดูรายละเอียด
        </div>
      </div>

      {Array.from(groups.entries()).map(([k, list]) => (
        <div key={String(k)} style={{ marginBottom: 14 }}>
          <div style={{
            fontSize: 11, color: 'var(--dim)', fontWeight: 700,
            textTransform: 'uppercase', letterSpacing: 0.06,
            marginBottom: 8,
          }}>
            {zoneLabel(k)}
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
            gap: 12,
          }}>
            {list.map((b) => (
              <BoardCard
                key={b.id}
                board={b}
                sensors={props.sensors.filter((s) => Number(s.boardId) === b.id)}
                site={props.site}
                now={props.now}
                onJump={() => props.onJump(b.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function BoardCard(props: {
  board: BoardWithSensors;
  sensors: SensorWithContext[];
  site: ReturnType<typeof useSiteRealtime>;
  now: number;
  onJump: () => void;
}) {
  // Roll the board's freshness up from its sensors. If any sensor has fresh
  // data, the board is considered alive — the per-sensor pill still tells
  // the operator exactly which one's late.
  const sensorTimes = props.sensors
    .map((s) => props.site?.bySensor?.[s.id]?.latest?.time)
    .filter(Boolean)
    .map((t) => new Date(t!).getTime());
  const lastSeen = sensorTimes.length ? Math.max(...sensorTimes) : null;
  const boardFresh = freshness(lastSeen, props.now);
  const isOffline = boardFresh === 'offline' || boardFresh === 'never';

  // Aggregate power across sensors that are currently fresh.
  let power = 0;
  for (const s of props.sensors) {
    const latest = props.site?.bySensor?.[s.id]?.latest;
    if (!latest?.time) continue;
    const f = freshness(new Date(latest.time).getTime(), props.now);
    if (f === 'fresh' || f === 'delayed') {
      power += latest.power ?? 0;
    }
  }

  return (
    <div
      style={{
        background: isOffline ? 'var(--bg-input)' : 'var(--bg-elevated)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: 14,
        opacity: isOffline ? 0.75 : 1,
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', gap: 10,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: 'var(--cyan)',
          }}>
            {props.board.code}
          </div>
          {props.board.name && (
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 1 }}>
              {props.board.name}
            </div>
          )}
        </div>
        <Pill
          state={boardFresh}
          label={boardFresh === 'fresh' ? 'ONLINE'
               : boardFresh === 'delayed' ? 'DELAYED'
               : boardFresh === 'stale' ? 'STALE'
               : boardFresh === 'offline' ? 'OFFLINE' : 'NO DATA'}
        />
      </div>

      <div style={{
        marginTop: 10, display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', fontSize: 11.5, color: 'var(--dim)',
      }}>
        <span>
          {props.sensors.length}/2 sensor{props.sensors.length !== 1 ? 's' : ''} ต่ออยู่
        </span>
        <span>
          {lastSeen ? `เห็นล่าสุด ${freshnessLabel(boardFresh, props.now - lastSeen)}`
                    : 'ยังไม่เคยส่งข้อมูล'}
        </span>
      </div>

      <div style={{
        marginTop: 8,
        fontSize: 13, fontWeight: 700, color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {power.toFixed(1)}<span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginLeft: 3 }}>W</span>
      </div>

      <div style={{
        marginTop: 12, paddingTop: 10,
        borderTop: '1px solid var(--border-color)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {props.sensors.length === 0 ? (
          <div style={{ fontSize: 11.5, color: 'var(--dim2)', fontStyle: 'italic' }}>
            ยังไม่มี sensor ผูกกับ board นี้
          </div>
        ) : (
          props.sensors.map((s) => (
            <SensorRow key={s.id} sensor={s} site={props.site} now={props.now} />
          ))
        )}
      </div>

      <button
        onClick={props.onJump}
        style={{
          marginTop: 10,
          background: 'transparent',
          border: '1px solid var(--border-color)',
          color: 'var(--text)',
          padding: '6px 10px', borderRadius: 6,
          cursor: 'pointer', fontSize: 12, fontFamily: 'inherit',
          width: '100%',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        ดูรายละเอียด <ChevronRight size={13} />
      </button>
    </div>
  );
}

function SensorRow(props: {
  sensor: SensorWithContext;
  site: ReturnType<typeof useSiteRealtime>;
  now: number;
}) {
  const state = props.site?.bySensor?.[props.sensor.id];
  const latest = state?.latest;
  const ts = latest?.time ? new Date(latest.time).getTime() : null;
  const f = freshness(ts, props.now);
  const isLive = f === 'fresh' || f === 'delayed';
  const kind = sensorKind(props.sensor);

  // Per spec: only show fields the sensor actually reports. Temp is only on
  // PZEM/KWS-1P boards in some hardware revs — hide if null even when live.
  const fields: Array<{ label: string; value: string; show: boolean }> = [
    {
      label: 'V', show: true,
      value: isLive && latest?.voltage != null ? latest.voltage.toFixed(1) : '—',
    },
    {
      label: 'A', show: true,
      value: isLive && latest?.current != null ? latest.current.toFixed(3) : '—',
    },
    {
      label: 'W', show: true,
      value: isLive && latest?.power != null ? latest.power.toFixed(1) : '—',
    },
    {
      label: '°C', show: kind !== 'kws-3p' && latest?.temperature != null,
      value: isLive && latest?.temperature != null ? latest.temperature.toFixed(1) : '—',
    },
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 4,
      padding: '6px 0',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, fontSize: 12,
      }}>
        <Pill
          state={f}
          label={f === 'fresh' ? 'LIVE'
               : f === 'delayed' ? 'DELAYED'
               : f === 'stale' ? 'STALE'
               : f === 'offline' ? 'OFFLINE' : 'NO DATA'}
        />
        <strong style={{ color: 'var(--text)' }}>{props.sensor.code}</strong>
        <span style={{
          fontSize: 10.5, color: 'var(--purple)',
          background: 'rgba(167, 139, 250, 0.12)',
          padding: '1px 6px', borderRadius: 6, fontWeight: 600,
        }}>
          {sensorKindLabel(kind)}
        </span>
      </div>
      <div style={{
        display: 'flex', gap: 12, fontSize: 11.5,
        color: isLive ? 'var(--text)' : 'var(--dim)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {fields.filter((f) => f.show).map((f) => (
          <span key={f.label}>
            <span style={{ color: 'var(--dim)' }}>{f.label}</span>{' '}
            <strong>{f.value}</strong>
          </span>
        ))}
      </div>
      {/* Per-phase breakdown for any KWS sensor (1-phase or 3-phase).
          The row above shows aggregates; this grid lists all three
          phases — Phase A is the active one for 1-phase wiring,
          B/C stay at zero. Operators consistently want to see all
          three rows so an unbalanced 3-phase load is obvious at a
          glance, instead of "did the firmware report B/C or not?". */}
      {(kind === 'kws-1p' || kind === 'kws-3p') && isLive && latest?.raw && (
        <PerPhaseGrid raw={latest.raw} />
      )}
    </div>
  );
}

function PerPhaseGrid({ raw }: { raw: Record<string, unknown> }) {
  // Older firmware (pre-v0.13.13) doesn't publish vA/vB/vC at all —
  // skip the grid entirely in that case so we don't render "Phase A:
  // 0/0/0" misleadingly. Once any per-phase key is present the
  // firmware is on the new format and unwired phases legitimately
  // report 0 from the meter.
  const hasPerPhase =
    raw.vA !== undefined ||
    raw.iA !== undefined ||
    raw.pA !== undefined;
  if (!hasPerPhase) return null;
  const num = (k: string) => {
    const v = raw[k];
    return typeof v === 'number' ? v : 0;
  };
  const phases = [
    { label: 'A', v: num('vA'), i: num('iA'), p: num('pA') },
    { label: 'B', v: num('vB'), i: num('iB'), p: num('pB') },
    { label: 'C', v: num('vC'), i: num('iC'), p: num('pC') },
  ];
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '14px 1fr 1fr 1fr',
      gap: '2px 8px',
      fontSize: 10.5,
      fontVariantNumeric: 'tabular-nums',
      marginTop: 4,
      paddingLeft: 4,
      color: 'var(--dim)',
    }}>
      {phases.map((p) => (
        <Fragment key={p.label}>
          <span style={{ fontWeight: 700, color: 'var(--text)' }}>{p.label}</span>
          <span>{`${p.v.toFixed(1)} V`}</span>
          <span>{`${p.i.toFixed(3)} A`}</span>
          <span>{`${p.p.toFixed(1)} W`}</span>
        </Fragment>
      ))}
    </div>
  );
}

// ─── 7. Mini Comparison ──────────────────────────────────────────
function MiniComparison(props: {
  aggs: Array<{ code: string; name: string; energyToday: number; powerNow: number }>;
}) {
  const top = [...props.aggs]
    .filter((z) => z.energyToday > 0 || z.powerNow > 0)
    .sort((a, b) => b.energyToday - a.energyToday)
    .slice(0, 5);
  if (top.length === 0) return null;

  const maxE = Math.max(...top.map((z) => z.energyToday), 0.0001);

  return (
    <section className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{ marginBottom: 12 }}>
        <span className="card-title">เปรียบเทียบโซน — พลังงาน 24 ชม.</span>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
          ประมาณการจากข้อมูล realtime ที่อยู่ในหน่วยความจำ
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {top.map((z) => {
          const pct = (z.energyToday / maxE) * 100;
          return (
            <div key={z.code}>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: 12, marginBottom: 4,
              }}>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>
                  {z.code} · {z.name}
                </span>
                <span style={{ color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>
                  {z.energyToday.toFixed(3)} kWh
                </span>
              </div>
              <div style={{
                height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`,
                  background: 'linear-gradient(90deg, var(--cyan), var(--cyan-bright))',
                  borderRadius: 4,
                }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
