import { Fragment, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  AlertCircle,
  BarChart3,
  BatteryCharging,
  Calendar,
  ChevronDown,
  ChevronUp,
  Download,
  Filter,
  Gauge as GaugeIcon,
  Hash,
  Info,
  Lightbulb,
  Sigma,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import type { TelemetryQuery, TimeRange } from '@monitor/shared';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  useTelemetryReport,
  useTelemetrySeries,
  useTelemetrySummary,
} from '@/features/telemetry/hooks';
import { useSiteSensors } from '@/features/sensors/hooks';
import { useZones } from '@/features/zones/hooks';
import { useBoards } from '@/features/boards/hooks';
import { useTariff } from '@/features/tariff/hooks';
import { exportToCsv } from '@/features/export/exportCsv';
import { fetchTelemetryReport, fetchTelemetrySummary } from '@/features/telemetry/api';
import type { TelemetrySummary } from '@/features/telemetry/api';
import { useTheme } from '@/features/theme/useTheme';
import { CHART_THEMES } from '@/features/theme/chartTheme';
import { dayjs } from '@/lib/dayjs';

// ────────────────────────────────────────────────────────────────
//  Range presets
// ────────────────────────────────────────────────────────────────
type RangeOpt = { value: TimeRange; label: string; hint?: string };
// Grouped layout: calendar-bounded ranges, then rolling ranges, then
// the custom escape-hatch. Visual dividers between groups in the UI.
const RANGE_GROUPS: RangeOpt[][] = [
  // 1) Calendar-bounded (start of period -> end of period, future is null)
  [
    { value: 'today',     label: 'วันนี้',     hint: 'ตั้งแต่ 00:00 ถึง 24:00 ของวันนี้' },
    { value: 'week_cal',  label: 'สัปดาห์นี้', hint: 'จันทร์ – อาทิตย์ ของสัปดาห์นี้' },
    { value: 'month_cal', label: 'เดือนนี้',   hint: 'ตั้งแต่วันที่ 1 ถึงวันสุดท้ายของเดือน' },
    { value: 'year_cal',  label: 'ปีนี้',      hint: 'มกราคม – ธันวาคม ของปีนี้' },
  ],
  // 2) Rolling (N units back from now → now)
  [
    { value: '7d',       label: '7 วันล่าสุด' },
    { value: 'month',    label: '30 วันล่าสุด' },
    { value: 'last_60d', label: '60 วันล่าสุด', hint: 'group รายวัน' },
    { value: 'last_90d', label: '90 วันล่าสุด', hint: 'group รายวัน' },
    { value: 'last_6m',  label: '6 เดือนล่าสุด', hint: 'group รายเดือน' },
    { value: 'year',     label: '12 เดือนล่าสุด' },
  ],
  // 3) Custom escape hatch
  [
    { value: 'custom',   label: 'กำหนดเอง' },
  ],
];

type SensorKind = 'pzem' | 'kws-1p' | 'kws-3p';
function sensorKind(
  s: { model?: string | null; code?: string; phases?: 1 | 3 | null },
): SensorKind | null {
  if (s.phases === 3) return 'kws-3p';
  if (s.phases === 1) return 'kws-1p';
  const m = (s.model ?? '').toUpperCase();
  const c = (s.code ?? '').toUpperCase();
  if (m.includes('PZEM') || c.startsWith('PZEM')) return 'pzem';
  if (m.includes('AC306') || m.includes('3P') || m.includes('THREE')) return 'kws-3p';
  if (m.startsWith('KWS') || c.startsWith('KWS')) return 'kws-1p';
  return null;
}
function sensorKindLabel(k: SensorKind): string {
  return k === 'pzem' ? 'PZEM' : k === 'kws-1p' ? 'KWS 1-phase' : 'KWS 3-phase';
}

// Spec rule: bucket by range. Used both for the x-axis formatter and for
// labelling the energy main chart.
function bucketKind(range: TimeRange, customDays = 0): 'minute' | 'hour' | 'day' | 'month' {
  switch (range) {
    case 'realtime':
    case '24h':
      return 'minute';
    case 'today':
      return 'hour';
    case 'week_cal':
    case '7d':
    case 'month':
    case 'month_cal':
    case 'last_60d':
    case 'last_90d':
      return 'day';
    case 'last_6m':
    case 'year':
    case 'year_cal':
      return 'month';
    case 'custom':
      if (customDays <= 1)  return 'hour';
      if (customDays <= 90) return 'day';
      return 'month';
  }
}
const THAI_DOW_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

function formatAxis(time: string, range: TimeRange, customDays = 0): string {
  switch (bucketKind(range, customDays)) {
    case 'minute': return dayjs(time).format('HH:mm');
    case 'hour':   return dayjs(time).format('HH:00');
    case 'day': {
      const d = dayjs(time);
      // Week-scoped views (week_cal, 7d) only have 7 bars — adding the
      // Thai weekday short prefix doesn't crowd the axis and lets the
      // operator see "นี่คือวันจันทร์" at a glance. Longer daily ranges
      // (30/60/90d, month_cal) stay DD/MM to keep their dense axis clean.
      if (range === 'week_cal' || range === '7d') {
        return `${THAI_DOW_SHORT[d.day()]} ${d.format('DD/MM')}`;
      }
      return d.format('DD/MM');
    }
    case 'month':  return dayjs(time).format('MM/YYYY');
  }
}

// ────────────────────────────────────────────────────────────────
//  Page
// ────────────────────────────────────────────────────────────────
export function DataReportPage() {
  const { siteId } = useParams();
  const id = siteId ? Number(siteId) : null;
  const themeMode = useTheme();
  const ct = CHART_THEMES[themeMode];

  // ─── Filters ───────────────────────────────────────────────────
  const [range, setRange]       = useState<TimeRange>('today');
  const [from, setFrom]         = useState('');
  const [to, setTo]             = useState('');
  const [zoneId, setZoneId]     = useState<number | 'all'>('all');
  const [boardId, setBoardId]   = useState<number | 'all'>('all');
  const [sensorId, setSensorId] = useState<number | 'all'>('all');
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [tableOpen, setTableOpen] = useState(false);

  const { data: sensors = [] }  = useSiteSensors(id);
  const { data: zones = [] }    = useZones(id);
  const { data: boards = [] }   = useBoards(id ?? undefined);
  const { data: tariff = null } = useTariff(id);

  // Filter cascade — selecting Zone trims Board; selecting Board trims Sensor.
  useEffect(() => { setBoardId('all'); setSensorId('all'); }, [zoneId]);
  useEffect(() => { setSensorId('all'); }, [boardId]);

  const boardsInScope = useMemo(
    () => boards.filter((b) =>
      (zoneId === 'all' || (b.zoneId ?? null) === zoneId) && b.isActive,
    ),
    [boards, zoneId],
  );
  const sensorsInScope = useMemo(
    () => sensors
      .filter((s) => s.isActive)
      .filter((s) => zoneId === 'all'  || (s.zoneId ?? null) === zoneId)
      .filter((s) => boardId === 'all' || Number(s.boardId) === boardId),
    [sensors, zoneId, boardId],
  );

  // Custom range in days (used by the bucket picker + the "X day" hint).
  const customDays = useMemo(() => {
    if (range !== 'custom' || !from || !to) return 0;
    return (new Date(to).getTime() - new Date(from).getTime()) / 86_400_000;
  }, [range, from, to]);

  // ─── Compose query ─────────────────────────────────────────────
  const query = useMemo(() => {
    if (!id) return null;
    const base: TelemetryQuery & { page: number; pageSize: number } = {
      siteId: id, range, page, pageSize,
    };
    if (zoneId !== 'all') base.zoneId = zoneId;
    if (boardId !== 'all') base.boardId = boardId;
    if (sensorId !== 'all') base.sensorId = sensorId;
    if (range === 'custom' && from && to) {
      base.from = new Date(from).toISOString();
      base.to = new Date(to).toISOString();
    }
    return base;
  }, [id, range, from, to, page, pageSize, sensorId, boardId, zoneId]);

  const summaryQuery = useMemo<TelemetryQuery | null>(() => {
    if (!query) return null;
    return {
      siteId: query.siteId, zoneId: query.zoneId,
      boardId: query.boardId, sensorId: query.sensorId,
      range: query.range,
      from: query.from, to: query.to,
    };
  }, [query]);

  const { data: summary }       = useTelemetrySummary(summaryQuery);
  const { data: series = [] }   = useTelemetrySeries(summaryQuery);
  const { data: tableData, isFetching: tableLoading } = useTelemetryReport(query);

  // ─── Previous-period comparison (for trend deltas) ─────────────
  const [prevSummary, setPrevSummary] = useState<TelemetrySummary | null>(null);
  useEffect(() => {
    if (!summary?.range) { setPrevSummary(null); return; }
    const span = new Date(summary.range.to).getTime()
               - new Date(summary.range.from).getTime();
    if (span <= 0 || !id) { setPrevSummary(null); return; }
    const prevFrom = new Date(new Date(summary.range.from).getTime() - span).toISOString();
    const prevTo = summary.range.from;
    let cancelled = false;
    fetchTelemetrySummary({
      siteId: id, range: 'custom', from: prevFrom, to: prevTo,
      zoneId: summaryQuery?.zoneId,
      boardId: summaryQuery?.boardId,
      sensorId: summaryQuery?.sensorId,
    }).then((r) => { if (!cancelled) setPrevSummary(r); })
      .catch(() => { if (!cancelled) setPrevSummary(null); });
    return () => { cancelled = true; };
  }, [summary?.range, summaryQuery?.zoneId, summaryQuery?.boardId,
      summaryQuery?.sensorId, id]);

  // ─── Scope label (shown on every card so the user always knows the
  //     slice the numbers describe) ─────────────────────────────────
  const scopeLabel = useMemo(() => {
    if (sensorId !== 'all') {
      const s = sensors.find((x) => x.id === sensorId);
      return s ? `Sensor ${s.code}` : 'Sensor ที่เลือก';
    }
    if (boardId !== 'all') {
      const b = boards.find((x) => x.id === boardId);
      return b ? `Board ${b.code}` : 'Board ที่เลือก';
    }
    if (zoneId !== 'all') {
      const z = zones.find((x) => x.id === zoneId);
      return z ? `Zone ${z.code}` : 'Zone ที่เลือก';
    }
    return 'ทั้ง Site';
  }, [sensorId, boardId, zoneId, sensors, boards, zones]);

  // Sensor lookup for the table + comparison breakdown.
  const sensorById = useMemo(
    () => new Map(sensors.map((s) => [s.id, s])),
    [sensors],
  );

  // ─── Comparison: scope-aware breakdown ─────────────────────────
  // Site-wide  → break down by Zone
  // Zone scope → break down by Board within that zone
  // Board scope → break down by Sensor within that board
  // Sensor scope → no comparison (the simple summary already shows it)
  const compMode: 'zone' | 'board' | 'sensor' | 'none' =
    sensorId !== 'all' ? 'none'
    : boardId !== 'all' ? 'sensor'
    : zoneId !== 'all' ? 'board'
    : 'zone';

  const comparison = useMemo(() => {
    if (compMode === 'none') return [];
    const bySensor = summary?.bySensor ?? [];
    type Bucket = { key: string; label: string; energy: number; sensorIds: number[] };
    const grouped = new Map<string, Bucket>();
    for (const row of bySensor) {
      const s = sensorById.get(row.sensorId);
      if (!s) continue;
      let key: string, label: string;
      if (compMode === 'zone') {
        const z = zones.find((x) => x.id === (s.zoneId ?? -1));
        key = `z:${s.zoneId ?? 'none'}`;
        label = z ? `${z.code} · ${z.name}` : 'ไม่ระบุโซน';
      } else if (compMode === 'board') {
        const b = boards.find((x) => x.id === Number(s.boardId));
        key = `b:${s.boardId}`;
        label = b ? b.code : `Board ${s.boardId}`;
      } else {
        key = `s:${s.id}`;
        label = `${s.code}${s.model ? ` (${s.model})` : ''}`;
      }
      const bucket = grouped.get(key) ?? { key, label, energy: 0, sensorIds: [] };
      bucket.energy += row.energyDelta ?? 0;
      bucket.sensorIds.push(row.sensorId);
      grouped.set(key, bucket);
    }
    return Array.from(grouped.values())
      .sort((a, b) => b.energy - a.energy);
  }, [compMode, summary, sensorById, zones, boards]);

  // ─── Charts ────────────────────────────────────────────────────
  // Main: energy delta per bucket (kWh). Series carries averages; we
  // approximate per-bucket energy from the running counter's delta. The
  // sql layer already does this in summary; here we just sum the value
  // when grouping into wider buckets isn't needed.
  const mainChartOption = useMemo(() => {
    const xLabels = series.map((p) => formatAxis(p.time, range, customDays));
    // Use the "power" proxy multiplied by bucket-hours when we lack a
    // precise per-bucket energy stream. Bucket size in hours: 1/60 for
    // 1-min, 1 for hour, 24 for day, ~720 for month. Power AVG × hours
    // ≈ kWh in that bucket.
    const bucketHours = (() => {
      switch (bucketKind(range, customDays)) {
        case 'minute': return 1 / 60;
        case 'hour':   return 1;
        case 'day':    return 24;
        case 'month':  return 24 * 30;
      }
    })();
    // Preserve null for missing buckets so ECharts skips the bar entirely
    // (a missing bar reads as "no data"; a 0-height bar reads as "measured
    // 0 kWh" — completely different meanings).
    const data = series.map((p) => {
      if (p.power == null) return null;
      return Number(((p.power * bucketHours) / 1000).toFixed(4)); // kWh
    });
    return {
      grid: { left: 50, right: 16, top: 14, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        textStyle: { color: ct.tooltipText },
        formatter: (params: Array<{ axisValue: string; data: number | null }>) => {
          const p = params[0];
          const v = p.data;
          return `${p.axisValue}<br/>${v == null ? '<span style="color:#94a3b8">ไม่มีข้อมูล</span>' : `${v.toFixed(4)} kWh`}`;
        },
      },
      xAxis: {
        type: 'category', data: xLabels,
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value', name: 'kWh',
        nameTextStyle: { color: ct.label },
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 11 },
        splitLine: { lineStyle: { color: ct.grid } },
      },
      series: [{
        type: 'bar',
        itemStyle: {
          color: 'var(--cyan)',
          borderRadius: [4, 4, 0, 0],
        },
        data,
      }],
    };
  }, [series, range, customDays, ct]);

  // Trend chart with metric tabs (Power/V/A/Temp).
  type Metric = 'power' | 'voltage' | 'current' | 'temperature';
  const [metric, setMetric] = useState<Metric>('power');
  const metricMeta: Record<Metric, { label: string; unit: string; color: string }> = {
    power:       { label: 'กำลัง',     unit: 'W',  color: '#22d3ee' },
    voltage:     { label: 'แรงดัน',    unit: 'V',  color: '#facc15' },
    current:     { label: 'กระแส',     unit: 'A',  color: '#4ade80' },
    temperature: { label: 'อุณหภูมิ',  unit: '°C', color: '#f87171' },
  };

  const hasTempData = useMemo(
    () => series.some((p) => p.temperature != null),
    [series],
  );
  // Auto-flip away from a metric that has no data so the chart isn't empty.
  useEffect(() => {
    if (metric === 'temperature' && !hasTempData && series.length > 0) {
      setMetric('power');
    }
  }, [metric, hasTempData, series.length]);

  const trendOption = useMemo(() => {
    const meta = metricMeta[metric];
    const data = series.map((p) => p[metric] ?? null);
    return {
      grid: { left: 50, right: 16, top: 14, bottom: 32 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        textStyle: { color: ct.tooltipText },
        formatter: (params: Array<{ axisValue: string; data: number | null; seriesName: string }>) => {
          const p = params[0];
          return `${p.axisValue}<br/>${p.data == null
            ? '<span style="color:#94a3b8">ไม่มีข้อมูล</span>'
            : `${meta.label} ${Number(p.data).toFixed(2)} ${meta.unit}`}`;
        },
      },
      xAxis: {
        type: 'category',
        data: series.map((p) => formatAxis(p.time, range, customDays)),
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value', name: meta.unit,
        nameTextStyle: { color: ct.label },
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 11 },
        splitLine: { lineStyle: { color: ct.grid } },
      },
      series: [{
        type: 'line', smooth: true, symbol: 'none', sampling: 'lttb',
        lineStyle: { color: meta.color, width: 2 },
        areaStyle: { color: `${meta.color}1f` },
        data,
      }],
    };
  }, [series, metric, metricMeta, range, customDays, ct]);

  // ─── CSV export ────────────────────────────────────────────────
  // Grouped CSV: one row per bucket in the active range, including buckets
  // with no measurements (value = empty). Useful when the user wants to
  // graph the report data externally without losing the time axis.
  const handleExportGroupedCsv = () => {
    if (series.length === 0) return;
    const bucketHours = (() => {
      switch (bucketKind(range, customDays)) {
        case 'minute': return 1 / 60;
        case 'hour':   return 1;
        case 'day':    return 24;
        case 'month':  return 24 * 30;
      }
    })();
    exportToCsv(
      series.map((p) => ({
        time: dayjs(p.time).format('YYYY-MM-DD HH:mm'),
        voltage: p.voltage,
        current: p.current,
        power: p.power,
        energy_kwh: p.power == null ? null : Number(((p.power * bucketHours) / 1000).toFixed(4)),
        temperature: p.temperature,
      })),
      [
        { key: 'time',        label: 'Time' },
        { key: 'voltage',     label: 'Voltage avg (V)' },
        { key: 'current',     label: 'Current avg (A)' },
        { key: 'power',       label: 'Power avg (W)' },
        { key: 'energy_kwh',  label: 'Energy bucket (kWh)' },
        { key: 'temperature', label: 'Temperature avg (°C)' },
      ],
      `report-grouped-site${id}-${range}-${dayjs().format('YYYYMMDD-HHmmss')}.csv`,
    );
  };

  const handleExportCsv = async () => {
    if (!query) return;
    const all = await fetchTelemetryReport({ ...query, page: 1, pageSize: 100_000 });
    // Pull per-phase numbers off `raw` when present so 3-phase rows
    // export their full per-phase breakdown alongside the aggregates.
    // 1-phase rows leave the per-phase columns blank — spreadsheet
    // software handles the gaps gracefully.
    const numOrEmpty = (raw: unknown, k: string) => {
      if (raw && typeof raw === 'object') {
        const v = (raw as Record<string, unknown>)[k];
        if (typeof v === 'number') return v;
      }
      return '';
    };
    exportToCsv(
      all.data.map((p) => {
        const s = p.sensorId != null ? sensorById.get(p.sensorId) : undefined;
        const z = s ? zones.find((x) => x.id === (s.zoneId ?? -1)) : undefined;
        const b = s ? boards.find((x) => x.id === Number(s.boardId)) : undefined;
        const raw = (p as { raw?: unknown }).raw;
        return {
          time: dayjs(p.time).format('YYYY-MM-DD HH:mm:ss'),
          zone: z?.code ?? '-',
          board: b?.code ?? s?.boardCode ?? '-',
          sensor: s?.code ?? '-',
          model: s?.model ?? '-',
          phases: s?.phases ?? '',
          voltage: p.voltage, current: p.current,
          power: p.power, energy: p.energy, temperature: p.temperature,
          vA: numOrEmpty(raw, 'vA'), vB: numOrEmpty(raw, 'vB'), vC: numOrEmpty(raw, 'vC'),
          iA: numOrEmpty(raw, 'iA'), iB: numOrEmpty(raw, 'iB'), iC: numOrEmpty(raw, 'iC'),
          pA: numOrEmpty(raw, 'pA'), pB: numOrEmpty(raw, 'pB'), pC: numOrEmpty(raw, 'pC'),
        };
      }),
      [
        { key: 'time',        label: 'Time' },
        { key: 'zone',        label: 'Zone' },
        { key: 'board',       label: 'Board' },
        { key: 'sensor',      label: 'Sensor' },
        { key: 'model',       label: 'Model' },
        { key: 'phases',      label: 'Phases' },
        { key: 'voltage',     label: 'Voltage (V)' },
        { key: 'current',     label: 'Current (A)' },
        { key: 'power',       label: 'Power (W)' },
        { key: 'energy',      label: 'Energy (kWh)' },
        { key: 'temperature', label: 'Temperature (°C)' },
        { key: 'vA',          label: 'V Phase A' },
        { key: 'vB',          label: 'V Phase B' },
        { key: 'vC',          label: 'V Phase C' },
        { key: 'iA',          label: 'I Phase A' },
        { key: 'iB',          label: 'I Phase B' },
        { key: 'iC',          label: 'I Phase C' },
        { key: 'pA',          label: 'P Phase A' },
        { key: 'pB',          label: 'P Phase B' },
        { key: 'pC',          label: 'P Phase C' },
      ],
      `report-site${id}-${range}-${dayjs().format('YYYYMMDD-HHmmss')}.csv`,
    );
  };

  // ─── Render ────────────────────────────────────────────────────
  if (id == null) {
    return <div style={{ padding: 40, color: 'var(--dim)' }}>เลือก site จาก sidebar ก่อน</div>;
  }

  return (
    <div>
      <PageHeader title="รายงาน" breadcrumb="รายงานข้อมูล" />

      {/* ─── Filter Bar ───────────────────────────────────────────── */}
      <FilterBar
        range={range} setRange={setRange}
        from={from} setFrom={setFrom}
        to={to} setTo={setTo}
        zones={zones} zoneId={zoneId} setZoneId={setZoneId}
        boards={boardsInScope} boardId={boardId} setBoardId={setBoardId}
        sensors={sensorsInScope} sensorId={sensorId} setSensorId={setSensorId}
        onExport={handleExportCsv}
        onExportGrouped={handleExportGroupedCsv}
        actualRange={summary?.range}
      />

      {/* ─── Summary Cards (with trend vs previous period) ───────── */}
      <SummaryCards
        summary={summary} prev={prevSummary}
        scopeLabel={scopeLabel}
        tariff={tariff}
      />

      {/* ─── Main Energy chart ──────────────────────────────────── */}
      <section className="card" style={{ padding: 18, marginBottom: 16 }}>
        <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <span className="card-title">การใช้พลังงานตามเวลา</span>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
              {scopeLabel} · group ตาม{(() => {
                switch (bucketKind(range, customDays)) {
                  case 'minute': return ' นาที';
                  case 'hour':   return ' ชั่วโมง';
                  case 'day':    return ' วัน';
                  case 'month':  return ' เดือน';
                }
              })()}
            </div>
          </div>
        </div>
        <div style={{ height: 280 }}>
          {series.length > 0 ? (
            <ReactECharts option={mainChartOption} style={{ height: '100%' }} notMerge />
          ) : (
            <EmptyChart label="ยังไม่มีข้อมูลในช่วงเวลานี้" />
          )}
        </div>
      </section>

      {/* ─── Trend + Comparison row ──────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: 16, marginBottom: 16,
        }}
      >
        <section className="card" style={{ padding: 18 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            flexWrap: 'wrap', gap: 10, marginBottom: 12,
          }}>
            <div>
              <span className="card-title">แนวโน้ม</span>
              <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
                เลือกค่าที่จะดู
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {(['power', 'voltage', 'current', 'temperature'] as Metric[]).map((m) => {
                const active = m === metric;
                const disabled = m === 'temperature' && !hasTempData;
                return (
                  <button
                    key={m}
                    onClick={() => !disabled && setMetric(m)}
                    disabled={disabled}
                    title={disabled ? 'ไม่มีข้อมูลอุณหภูมิในช่วงนี้' : undefined}
                    style={{
                      background: active ? 'var(--cyan-glow-strong)' : 'var(--bg-input)',
                      border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-color)'}`,
                      color: disabled ? 'var(--dim2)' : active ? 'var(--cyan)' : 'var(--text)',
                      padding: '5px 10px', borderRadius: 6,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontSize: 11.5, fontWeight: active ? 700 : 500,
                      fontFamily: 'inherit', opacity: disabled ? 0.5 : 1,
                    }}
                  >
                    {metricMeta[m].label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ height: 240 }}>
            {series.length > 0 ? (
              <ReactECharts option={trendOption} style={{ height: '100%' }} notMerge />
            ) : (
              <EmptyChart label="ไม่มีข้อมูล" />
            )}
          </div>
        </section>

        <ComparisonCard
          mode={compMode}
          items={comparison}
          totalSummary={summary}
        />
      </div>

      {/* ─── Auto Insight ───────────────────────────────────────── */}
      <InsightCard
        summary={summary} prev={prevSummary}
        comparison={comparison} compMode={compMode}
        scopeLabel={scopeLabel}
        range={range}
      />

      {/* ─── Raw Data Table (collapsed by default — historical evidence,
              not the headline) ───────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 16 }}>
        <button
          onClick={() => setTableOpen((v) => !v)}
          style={{
            width: '100%', background: 'transparent', border: 'none',
            padding: '16px 18px', display: 'flex',
            justifyContent: 'space-between', alignItems: 'center',
            cursor: 'pointer', color: 'var(--text)',
            fontFamily: 'inherit',
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <span className="card-title">ข้อมูลดิบ (raw data)</span>
            <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
              {tableData?.total != null
                ? `${tableData.total.toLocaleString()} รายการในช่วงเวลานี้`
                : 'รวบรวม...'}
              {tableData?.total ? ' · คลิกเพื่อดู' : ''}
            </div>
          </div>
          {tableOpen ? <ChevronUp size={18} color="var(--dim)" /> : <ChevronDown size={18} color="var(--dim)" />}
        </button>

        {tableOpen && (
          <div style={{ borderTop: '1px solid var(--border-color)' }}>
            <RawDataTable
              data={tableData}
              loading={tableLoading}
              sensorById={sensorById}
              zones={zones}
              boards={boards}
              page={page} setPage={setPage}
              pageSize={pageSize} setPageSize={setPageSize}
            />
          </div>
        )}
      </section>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
//  Filter Bar
// ────────────────────────────────────────────────────────────────
function FilterBar(props: {
  range: TimeRange; setRange: (r: TimeRange) => void;
  from: string; setFrom: (v: string) => void;
  to: string; setTo: (v: string) => void;
  zones: Array<{ id: number; code: string; name: string }>;
  zoneId: number | 'all'; setZoneId: (v: number | 'all') => void;
  boards: Array<{ id: number; code: string; name?: string | null }>;
  boardId: number | 'all'; setBoardId: (v: number | 'all') => void;
  sensors: Array<{ id: number; code: string; model?: string | null }>;
  sensorId: number | 'all'; setSensorId: (v: number | 'all') => void;
  onExport: () => void;
  onExportGrouped: () => void;
  actualRange?: { from: string; to: string };
}) {
  const { range, setRange, from, setFrom, to, setTo,
          zones, zoneId, setZoneId, boards, boardId, setBoardId,
          sensors, sensorId, setSensorId,
          onExport, onExportGrouped, actualRange } = props;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: '16px 18px',
        marginBottom: 14,
      }}
    >
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
        color: 'var(--dim)', fontSize: 11, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: 0.04,
      }}>
        <Filter size={13} /> ช่วงเวลา
      </div>
      {/* 3 groups split by a vertical divider so the operator can scan
          calendar-bounded vs rolling vs custom at a glance. */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {RANGE_GROUPS.map((group, gi) => (
          <div key={gi} style={{ display: 'contents' }}>
            {gi > 0 && (
              <span
                aria-hidden
                style={{
                  width: 1,
                  alignSelf: 'stretch',
                  background: 'var(--border-color)',
                  margin: '0 4px',
                }}
              />
            )}
            {group.map((r) => {
              const active = r.value === range;
              return (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  title={r.hint}
                  style={{
                    background: active ? 'var(--cyan)' : 'var(--bg-input)',
                    border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-color)'}`,
                    color: active ? '#000' : 'var(--text)',
                    padding: '7px 14px', borderRadius: 8,
                    cursor: 'pointer', fontSize: 12.5,
                    fontWeight: active ? 700 : 500, fontFamily: 'inherit',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <FBField label="Zone">
          <FBSelect value={String(zoneId)} onChange={(v) => setZoneId(v === 'all' ? 'all' : Number(v))}>
            <option value="all">ทุก Zone</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.code} · {z.name}</option>)}
          </FBSelect>
        </FBField>
        <FBField label="Board">
          <FBSelect value={String(boardId)} onChange={(v) => setBoardId(v === 'all' ? 'all' : Number(v))}>
            <option value="all">ทุก Board</option>
            {boards.map((b) => <option key={b.id} value={b.id}>{b.code}{b.name ? ` · ${b.name}` : ''}</option>)}
          </FBSelect>
        </FBField>
        <FBField label="Sensor">
          <FBSelect value={String(sensorId)} onChange={(v) => setSensorId(v === 'all' ? 'all' : Number(v))}>
            <option value="all">ทุก sensor</option>
            {sensors.map((s) => <option key={s.id} value={s.id}>{s.code}{s.model ? ` (${s.model})` : ''}</option>)}
          </FBSelect>
        </FBField>

        {range === 'custom' && (
          <>
            <FBField label="จาก">
              <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} style={fbInput} />
            </FBField>
            <FBField label="ถึง">
              <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} style={fbInput} />
            </FBField>
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={onExportGrouped}
            title="ส่งออกข้อมูลที่ group ตามช่วงเวลา (ครบทุก bucket รวมช่วงที่ไม่มีข้อมูล)"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '9px 14px', borderRadius: 8,
              fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Download size={13} /> CSV (กราฟ)
          </button>
          <button
            onClick={onExport}
            title="ส่งออกข้อมูลดิบทุก record"
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '9px 14px', borderRadius: 8,
              fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Download size={13} /> CSV (Raw)
          </button>
        </div>
      </div>

      {actualRange && (
        <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--dim)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Calendar size={12} />
          ดึงข้อมูล{' '}
          <strong style={{ color: 'var(--text)' }}>
            {dayjs(actualRange.from).format('DD/MM/YYYY HH:mm')}
          </strong>
          {' → '}
          <strong style={{ color: 'var(--text)' }}>
            {dayjs(actualRange.to).format('DD/MM/YYYY HH:mm')}
          </strong>
          <span style={{ marginLeft: 6 }}>
            ({(() => {
              const ms = new Date(actualRange.to).getTime() - new Date(actualRange.from).getTime();
              const days = ms / 86_400_000;
              if (days >= 1) return `${days.toFixed(1)} วัน`;
              const hours = ms / 3_600_000;
              if (hours >= 1) return `${hours.toFixed(1)} ชม.`;
              return `${Math.round(ms / 60_000)} นาที`;
            })()})
          </span>
        </div>
      )}
    </div>
  );
}
function FBField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10.5, color: 'var(--dim)',
        fontWeight: 600, marginBottom: 5,
        textTransform: 'uppercase', letterSpacing: 0.4,
      }}>{label}</label>
      {children}
    </div>
  );
}
function FBSelect(props: { value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <select
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      style={fbInput}
    >{props.children}</select>
  );
}
const fbInput: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  padding: '7px 10px', borderRadius: 8, fontSize: 13,
  fontFamily: 'inherit', cursor: 'pointer', minWidth: 160,
};

// ────────────────────────────────────────────────────────────────
//  Summary Cards (5 + period-trend deltas)
// ────────────────────────────────────────────────────────────────
function SummaryCards(props: {
  summary?: TelemetrySummary | null;
  prev?: TelemetrySummary | null;
  scopeLabel: string;
  tariff?: { rate: number; currency: string; enabled: boolean } | null;
}) {
  const { summary, prev, scopeLabel, tariff } = props;
  const delta = (cur: number | null | undefined, p: number | null | undefined) => {
    if (cur == null || p == null || p === 0) return null;
    return ((cur - p) / p) * 100;
  };

  const energyTrend  = delta(summary?.energy.delta, prev?.energy.delta);
  const powerTrend   = delta(summary?.power.max, prev?.power.max);
  const voltageTrend = delta(summary?.voltage.avg, prev?.voltage.avg);
  const tempTrend    = delta(summary?.temperature.max, prev?.temperature.max);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
        gap: 12, marginBottom: 14,
      }}
    >
      <SumCard
        icon={<BatteryCharging size={20} />}
        label="พลังงานรวม"
        value={summary?.energy.delta != null ? summary.energy.delta.toFixed(3) : '—'}
        unit="kWh"
        scope={scopeLabel} trend={energyTrend}
      />
      {/* ประมาณการค่าไฟ — rendered only when the operator has both
          configured a positive rate AND left the feature enabled at
          /admin/sites/:id. The toggle lets them hide this card without
          deleting the rate. */}
      {tariff != null
        && tariff.rate > 0
        && tariff.enabled === true
        && summary?.energy.delta != null && (
        <SumCard
          icon={<Sigma size={20} />}
          label="ประมาณการค่าไฟ"
          value={(summary.energy.delta * tariff.rate).toFixed(2)}
          unit={tariff.currency}
          scope={scopeLabel}
          sub={`อัตรา ${tariff.rate.toFixed(2)} ${tariff.currency}/kWh`}
        />
      )}
      <SumCard
        icon={<Zap size={20} />}
        label="กำลังสูงสุด"
        value={summary?.power.max != null ? summary.power.max.toFixed(1) : '—'}
        unit="W"
        scope={scopeLabel} trend={powerTrend}
      />
      <SumCard
        icon={<GaugeIcon size={20} />}
        label="แรงดันเฉลี่ย"
        value={summary?.voltage.avg != null ? summary.voltage.avg.toFixed(1) : '—'}
        unit="V"
        scope={scopeLabel} trend={voltageTrend}
        sub={summary?.voltage.min != null && summary?.voltage.max != null
          ? `${summary.voltage.min.toFixed(1)} – ${summary.voltage.max.toFixed(1)}`
          : undefined}
      />
      <SumCard
        icon={<Thermometer size={20} />}
        label="อุณหภูมิสูงสุด"
        value={summary?.temperature.max != null ? summary.temperature.max.toFixed(1) : '—'}
        unit="°C"
        scope={scopeLabel} trend={tempTrend}
      />
      <SumCard
        icon={<Hash size={20} />}
        label="จำนวนข้อมูล"
        value={summary?.rowCount?.toLocaleString() ?? '—'}
        unit="rows"
        scope={scopeLabel}
        sub={summary?.bySensor?.length ? `${summary.bySensor.length} sensor` : undefined}
      />
    </div>
  );
}
function SumCard(props: {
  icon: React.ReactNode; label: string; value: string; unit: string;
  scope: string; sub?: string; trend?: number | null;
}) {
  const trendUp = props.trend != null && props.trend > 0;
  const trendColor = props.trend == null ? 'var(--dim)'
                   : trendUp ? 'var(--red)' : 'var(--green)';
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderLeft: '3px solid var(--cyan)',
      borderRadius: 12, padding: '14px 16px',
      boxShadow: 'var(--shadow-sm)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ color: 'var(--cyan)' }}>{props.icon}</span>
        <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 600 }}>
          {props.label}
        </span>
      </div>
      <div style={{
        marginTop: 8, fontSize: 22, fontWeight: 700, color: 'var(--text)',
        fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
      }}>
        {props.value}
        <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--dim)', marginLeft: 4 }}>
          {props.unit}
        </span>
      </div>
      <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
        <span style={{ color: 'var(--dim2)' }}>{props.scope}</span>
        {props.sub && (
          <span style={{ color: 'var(--dim2)' }}>· {props.sub}</span>
        )}
        {props.trend != null && Math.abs(props.trend) >= 0.1 && (
          <span style={{
            marginLeft: 'auto',
            display: 'inline-flex', alignItems: 'center', gap: 2,
            color: trendColor, fontWeight: 600,
          }}>
            {trendUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {props.trend > 0 ? '+' : ''}{props.trend.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
//  Comparison Card (horizontal bars, scope-aware)
// ────────────────────────────────────────────────────────────────
function ComparisonCard(props: {
  mode: 'zone' | 'board' | 'sensor' | 'none';
  items: Array<{ key: string; label: string; energy: number }>;
  totalSummary?: TelemetrySummary | null;
}) {
  if (props.mode === 'none') {
    return (
      <section className="card" style={{ padding: 18 }}>
        <div style={{ marginBottom: 12 }}>
          <span className="card-title">สรุปการใช้พลังงาน</span>
          <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
            sensor เดี่ยว ไม่มี comparison
          </div>
        </div>
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)' }}>
          <Info size={20} style={{ opacity: 0.5 }} />
          <div style={{ marginTop: 8, fontSize: 13 }}>
            เลือก scope ที่กว้างขึ้นเพื่อดู comparison
          </div>
        </div>
      </section>
    );
  }
  const title = props.mode === 'zone' ? 'เปรียบเทียบโซน'
              : props.mode === 'board' ? 'เปรียบเทียบ Board'
              : 'เปรียบเทียบ Sensor';
  const total = props.items.reduce((a, it) => a + it.energy, 0);
  return (
    <section className="card" style={{ padding: 18 }}>
      <div style={{ marginBottom: 12 }}>
        <span className="card-title">{title}</span>
        <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 2 }}>
          พลังงานสะสมในช่วงเวลาที่เลือก
        </div>
      </div>
      {props.items.length === 0 ? (
        <EmptyChart label="ไม่มีข้อมูลให้เปรียบเทียบ" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {props.items.slice(0, 8).map((it, idx) => {
            const pct = total > 0 ? (it.energy / total) * 100 : 0;
            return (
              <div key={it.key}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 12, marginBottom: 4,
                }}>
                  <span style={{
                    color: 'var(--text)', fontWeight: 600,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: '70%',
                  }}>
                    {idx === 0 && '🏆 '}{it.label}
                  </span>
                  <span style={{
                    color: 'var(--dim)', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {it.energy.toFixed(3)} kWh · {pct.toFixed(1)}%
                  </span>
                </div>
                <div style={{
                  height: 8, background: 'var(--bg-input)',
                  borderRadius: 4, overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${pct}%`,
                    background: idx === 0
                      ? 'linear-gradient(90deg, var(--cyan), var(--cyan-bright))'
                      : 'var(--cyan-dark)',
                    borderRadius: 4,
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
//  Insight Summary
// ────────────────────────────────────────────────────────────────
function InsightCard(props: {
  summary?: TelemetrySummary | null;
  prev?: TelemetrySummary | null;
  comparison: Array<{ label: string; energy: number }>;
  compMode: 'zone' | 'board' | 'sensor' | 'none';
  scopeLabel: string;
  range: TimeRange;
}) {
  const { summary, prev, comparison, compMode } = props;
  if (!summary) {
    return null;
  }
  type Line = { tone: 'info' | 'warning'; text: string };
  const lines: Line[] = [];

  if (summary.energy.delta != null) {
    lines.push({
      tone: 'info',
      text: `ใช้พลังงานรวม ${summary.energy.delta.toFixed(3)} kWh`,
    });
  }
  if (summary.power.max != null) {
    lines.push({
      tone: 'info',
      text: `กำลังสูงสุด ${summary.power.max.toFixed(1)} W`,
    });
  }
  if (summary.voltage.min != null && summary.voltage.max != null) {
    lines.push({
      tone: 'info',
      text: `แรงดันอยู่ในช่วง ${summary.voltage.min.toFixed(1)}–${summary.voltage.max.toFixed(1)} V`,
    });
    if (summary.voltage.min < 210) {
      lines.push({
        tone: 'warning',
        text: `แรงดันต่ำสุด ${summary.voltage.min.toFixed(1)} V อยู่นอกช่วงปกติ (≥ 210 V)`,
      });
    }
    if (summary.voltage.max > 240) {
      lines.push({
        tone: 'warning',
        text: `แรงดันสูงสุด ${summary.voltage.max.toFixed(1)} V อยู่นอกช่วงปกติ (≤ 240 V)`,
      });
    }
  }
  if (summary.temperature.max != null) {
    lines.push({
      tone: summary.temperature.max >= 40 ? 'warning' : 'info',
      text: summary.temperature.max >= 40
        ? `อุณหภูมิสูงสุด ${summary.temperature.max.toFixed(1)} °C — สูงผิดปกติ`
        : `อุณหภูมิสูงสุด ${summary.temperature.max.toFixed(1)} °C`,
    });
  }

  if (compMode !== 'none' && comparison.length > 0) {
    const top = comparison[0];
    const lbl = compMode === 'zone' ? 'Zone' : compMode === 'board' ? 'Board' : 'Sensor';
    lines.push({
      tone: 'info',
      text: `${lbl}ที่ใช้พลังงานสูงสุดคือ ${top.label} (${top.energy.toFixed(3)} kWh)`,
    });
  }

  if (prev?.energy.delta != null && summary.energy.delta != null && prev.energy.delta > 0) {
    const pct = ((summary.energy.delta - prev.energy.delta) / prev.energy.delta) * 100;
    if (Math.abs(pct) >= 1) {
      lines.push({
        tone: pct > 30 ? 'warning' : 'info',
        text: pct > 0
          ? `เพิ่มขึ้น ${pct.toFixed(1)}% จากช่วงก่อนหน้า`
          : `ลดลง ${Math.abs(pct).toFixed(1)}% จากช่วงก่อนหน้า`,
      });
    }
  }

  if (lines.length === 0) {
    lines.push({
      tone: 'info',
      text: 'ข้อมูลในช่วงเวลานี้ยังมีน้อย — อาจยังไม่เห็นแนวโน้มชัดเจน',
    });
  }

  return (
    <section className="card" style={{ padding: 18, marginBottom: 16 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
      }}>
        <Lightbulb size={18} color="var(--yellow)" />
        <span className="card-title">สรุปอัตโนมัติ</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lines.map((l, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            fontSize: 13, color: 'var(--text)',
            padding: '8px 12px', borderRadius: 8,
            background: l.tone === 'warning'
              ? 'rgba(250, 204, 21, 0.06)'
              : 'rgba(34, 211, 238, 0.04)',
            border: l.tone === 'warning'
              ? '1px solid rgba(250, 204, 21, 0.2)'
              : '1px solid var(--border-color)',
          }}>
            {l.tone === 'warning'
              ? <AlertCircle size={14} color="var(--yellow)" style={{ marginTop: 2, flexShrink: 0 }} />
              : <Info size={14} color="var(--cyan)" style={{ marginTop: 2, flexShrink: 0 }} />}
            <span>{l.text}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
//  Raw Data Table
// ────────────────────────────────────────────────────────────────
type TableData = {
  data: Array<{
    time: string;
    sensorId?: number; boardId?: number; siteId: number;
    voltage: number | null; current: number | null;
    power: number | null; energy: number | null;
    temperature: number | null;
    raw?: Record<string, unknown> | null;
  }>;
  total: number; totalPages: number;
} | undefined;

function RawDataTable(props: {
  data: TableData;
  loading: boolean;
  sensorById: Map<number, {
    code: string;
    model?: string | null;
    boardId?: number | bigint;
    zoneId?: number | null;
    phases?: 1 | 3 | null;
  }>;
  zones: Array<{ id: number; code: string }>;
  boards: Array<{ id: number; code: string }>;
  page: number; setPage: (n: number) => void;
  pageSize: number; setPageSize: (n: number) => void;
}) {
  const rows = props.data?.data ?? [];
  const total = props.data?.total ?? 0;
  const totalPages = props.data?.totalPages ?? 1;
  // Track which rows the operator has expanded. Each entry is the row's
  // composite key (sensorId|time|idx). Only KWS-3P rows are clickable.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (key: string) => setExpanded((s) => {
    const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n;
  });

  return (
    <>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              {['วันที่/เวลา', 'Zone', 'Board', 'Sensor', 'V', 'A', 'W', 'kWh', '°C'].map((h) => (
                <th key={h} style={thRaw}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {props.loading && rows.length === 0 ? (
              <tr><td colSpan={9} style={emptyRaw}>กำลังโหลด...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} style={emptyRaw}>ไม่พบข้อมูล</td></tr>
            ) : rows.map((r, idx) => {
              const s = r.sensorId != null ? props.sensorById.get(r.sensorId) : undefined;
              const zone = s ? props.zones.find((x) => x.id === (s.zoneId ?? -1)) : undefined;
              const board = s ? props.boards.find((x) => x.id === Number(s.boardId ?? 0)) : undefined;
              const kind = s ? sensorKind(s) : null;
              const key = `${r.sensorId}-${r.time}-${idx}`;
              // Only 3-phase rows are expandable — there's no extra
              // detail to show for PZEM or AC301L.
              const isExpandable = kind === 'kws-3p' && r.raw != null;
              const isOpen = expanded.has(key);
              const raw = r.raw as Record<string, unknown> | undefined;
              const numFrom = (k: string) => {
                const v = raw?.[k];
                return typeof v === 'number' ? v : 0;
              };
              return (
                <Fragment key={key}>
                <tr
                  onClick={isExpandable ? () => toggle(key) : undefined}
                  style={isExpandable ? { cursor: 'pointer' } : undefined}
                >
                  <td style={tdRaw}>
                    {isExpandable && (
                      <span style={{
                        display: 'inline-block', width: 12, marginRight: 4,
                        color: 'var(--cyan)', transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.15s',
                      }}>›</span>
                    )}
                    {dayjs(r.time).format('DD/MM HH:mm:ss')}
                  </td>
                  <td style={{ ...tdRaw, color: 'var(--dim)' }}>{zone?.code ?? '-'}</td>
                  <td style={{ ...tdRaw, color: 'var(--dim)' }}>{board?.code ?? '-'}</td>
                  <td style={tdRaw}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <strong>{s?.code ?? '-'}</strong>
                      {kind && (
                        <span style={{
                          fontSize: 9.5, color: 'var(--purple)',
                          background: 'rgba(167, 139, 250, 0.12)',
                          padding: '1px 5px', borderRadius: 4, fontWeight: 600,
                        }}>{sensorKindLabel(kind)}</span>
                      )}
                    </div>
                  </td>
                  <td style={tdRaw}>{r.voltage?.toFixed(1) ?? '-'}</td>
                  <td style={tdRaw}>{r.current?.toFixed(3) ?? '-'}</td>
                  <td style={tdRaw}>{r.power?.toFixed(1) ?? '-'}</td>
                  <td style={tdRaw}>{r.energy?.toFixed(3) ?? '-'}</td>
                  <td style={{
                    ...tdRaw,
                    color: (r.temperature ?? 0) >= 40 ? 'var(--yellow)' : 'var(--text)',
                  }}>
                    {r.temperature != null ? r.temperature.toFixed(1) : '-'}
                  </td>
                </tr>
                {isExpandable && isOpen && (
                  <tr key={`${key}-x`} style={{ background: 'var(--bg-input)' }}>
                    <td colSpan={9} style={{ padding: '10px 18px', borderBottom: '1px solid var(--border-color)' }}>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto repeat(3, 1fr)',
                        gap: '4px 18px',
                        fontSize: 12,
                        fontVariantNumeric: 'tabular-nums',
                        maxWidth: 520,
                      }}>
                        <span style={{ color: 'var(--dim)', fontWeight: 600 }} />
                        <span style={{ color: 'var(--dim)', fontWeight: 600 }}>V</span>
                        <span style={{ color: 'var(--dim)', fontWeight: 600 }}>A</span>
                        <span style={{ color: 'var(--dim)', fontWeight: 600 }}>W</span>
                        {(['A','B','C'] as const).map((ph) => (
                          <Fragment key={ph}>
                            <span style={{ fontWeight: 700, color: 'var(--cyan)' }}>Phase {ph}</span>
                            <span>{numFrom(`v${ph}`).toFixed(1)}</span>
                            <span>{numFrom(`i${ph}`).toFixed(3)}</span>
                            <span>{numFrom(`p${ph}`).toFixed(1)}</span>
                          </Fragment>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 18px', fontSize: 12, color: 'var(--dim)',
        borderTop: '1px solid var(--border-color)',
      }}>
        <div>
          แสดง {total === 0 ? 0 : (props.page - 1) * props.pageSize + 1}–
          {Math.min(props.page * props.pageSize, total)} จาก {total.toLocaleString()}
          <select
            value={props.pageSize}
            onChange={(e) => { props.setPageSize(Number(e.target.value)); props.setPage(1); }}
            style={{
              marginLeft: 10, background: 'var(--bg-input)',
              border: '1px solid var(--border-color)', color: 'var(--text)',
              padding: '4px 8px', borderRadius: 6, fontSize: 11,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >{[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}/หน้า</option>)}</select>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <PaginationBtn label="←" disabled={props.page === 1} onClick={() => props.setPage(props.page - 1)} />
          <span style={{ padding: '4px 10px', fontSize: 12 }}>
            {props.page} / {totalPages}
          </span>
          <PaginationBtn label="→" disabled={props.page === totalPages} onClick={() => props.setPage(props.page + 1)} />
        </div>
      </div>
    </>
  );
}
function PaginationBtn(props: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button onClick={props.onClick} disabled={props.disabled} style={{
      background: 'var(--bg-input)', border: '1px solid var(--border-color)',
      color: props.disabled ? 'var(--dim2)' : 'var(--text)',
      width: 30, height: 26, borderRadius: 6,
      cursor: props.disabled ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', fontSize: 13,
    }}>{props.label}</button>
  );
}
const thRaw: React.CSSProperties = {
  background: 'var(--th-bg)', color: 'var(--dim)',
  padding: '11px 14px', textAlign: 'left',
  fontWeight: 600, fontSize: 10.5,
  textTransform: 'uppercase', letterSpacing: 0.06,
  borderBottom: '1px solid var(--border-color)',
  whiteSpace: 'nowrap',
};
const tdRaw: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-color)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
};
const emptyRaw: React.CSSProperties = {
  ...tdRaw, textAlign: 'center', color: 'var(--dim)',
  padding: '30px 14px',
};

// ────────────────────────────────────────────────────────────────
//  Small helpers
// ────────────────────────────────────────────────────────────────
function EmptyChart({ label }: { label: string }) {
  return (
    <div style={{
      height: '100%', display: 'grid', placeItems: 'center',
      color: 'var(--dim)', fontSize: 13,
    }}>
      <div style={{ textAlign: 'center' }}>
        <BarChart3 size={28} style={{ opacity: 0.4 }} />
        <div style={{ marginTop: 8 }}>{label}</div>
      </div>
    </div>
  );
}
