import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  Download,
  ChevronLeft,
  ChevronRight,
  Zap,
  BatteryCharging,
  Activity,
  Thermometer,
  Gauge,
  Hash,
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
import { exportToCsv } from '@/features/export/exportCsv';
import { fetchTelemetryReport } from '@/features/telemetry/api';
import { useTheme } from '@/features/theme/useTheme';
import { CHART_THEMES } from '@/features/theme/chartTheme';
import { dayjs } from '@/lib/dayjs';

const RANGES: { label: string; value: TimeRange; hint?: string }[] = [
  { label: 'Realtime', value: 'realtime', hint: 'รีเฟรชสด ทุก 10 วินาที' },
  { label: '24 ชม.', value: '24h' },
  { label: '7 วัน', value: '7d' },
  { label: 'เดือนนี้', value: 'month_cal', hint: 'ตั้งแต่วันที่ 1 ของเดือนถึงวันนี้' },
  { label: 'ย้อน 30 วัน', value: 'month' },
  { label: 'ปีนี้', value: 'year_cal', hint: 'ตั้งแต่ 1 ม.ค. ถึงวันนี้' },
  { label: 'ย้อน 365 วัน', value: 'year' },
  { label: 'กำหนดเอง', value: 'custom' },
];

// Pick an x-axis date format suited to the bucket size of the range so a
// 7-day chart doesn't show "14:00, 14:00, 14:00..." for three buckets that
// each came from a different day. For year-scale views the bucket is daily
// (continuous aggregate `telemetry_daily`), so DD/MM is the natural label —
// using MM/YYYY would collapse multiple daily buckets within the same month
// to one repeated label (the original bug the user hit).
function formatAxis(time: string, range: TimeRange): string {
  switch (range) {
    case 'realtime':
    case '24h':
      return dayjs(time).format('HH:mm');
    case '7d':
      return dayjs(time).format('DD/MM HH:00');
    case 'month':
    case 'month_cal':
    case 'year_cal':
      return dayjs(time).format('DD/MM');
    case 'year':
      return dayjs(time).format('DD/MM/YY');
    case 'custom':
      return dayjs(time).format('DD/MM HH:mm');
  }
}

export function DataReportPage() {
  const { siteId } = useParams();
  const id = siteId ? Number(siteId) : null;

  const [range, setRange] = useState<TimeRange>('24h');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sensorId, setSensorId] = useState<number | 'all'>('all');
  const [zoneId, setZoneId] = useState<number | 'all'>('all');

  const { data: sensors = [] } = useSiteSensors(id);
  const { data: zones = [] } = useZones(id);
  // Filter the sensor list down to sensors on boards in the selected zone so
  // the sensor dropdown only shows relevant options after picking a zone.
  const sensorsInScope = useMemo(() => {
    if (zoneId === 'all') return sensors;
    return sensors.filter((s) => (s.zoneId ?? null) === zoneId);
  }, [sensors, zoneId]);
  const sensorById = useMemo(() => new Map(sensors.map((s) => [s.id, s])), [sensors]);
  const themeMode = useTheme();
  const ct = CHART_THEMES[themeMode];

  const query = useMemo(() => {
    if (!id) return null;
    const base: TelemetryQuery & { page: number; pageSize: number } = {
      siteId: id,
      range,
      page,
      pageSize,
    };
    if (zoneId !== 'all') base.zoneId = zoneId;
    if (sensorId !== 'all') base.sensorId = sensorId;
    if (range === 'custom' && from && to) {
      base.from = new Date(from).toISOString();
      base.to = new Date(to).toISOString();
    }
    return base;
  }, [id, range, from, to, page, pageSize, sensorId, zoneId]);

  const { data, isFetching } = useTelemetryReport(query);
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  // Summary query — only the filter part, no pagination
  const summaryQuery = useMemo(() => {
    if (!query) return null;
    return {
      siteId: query.siteId,
      sensorId: query.sensorId,
      range: query.range,
      from: query.from,
      to: query.to,
    } as TelemetryQuery;
  }, [query]);
  const { data: summary } = useTelemetrySummary(summaryQuery);
  const { data: series = [] } = useTelemetrySeries(summaryQuery);

  // ─── Tabbed line chart ─────────────────────────────────────────────
  type LineMetric = 'power' | 'voltage' | 'current' | 'temperature';
  const [lineMetric, setLineMetric] = useState<LineMetric>('power');
  const lineMeta: Record<LineMetric, { label: string; unit: string; color: string }> = {
    power: { label: 'กำลัง', unit: 'W', color: '#22d3ee' },
    voltage: { label: 'แรงดัน', unit: 'V', color: '#facc15' },
    current: { label: 'กระแส', unit: 'A', color: '#4ade80' },
    temperature: { label: 'อุณหภูมิ', unit: '°C', color: '#f87171' },
  };

  // Detect "no recent data" so the realtime view can flag dead boards clearly.
  // We treat 5 minutes of silence as a stop in the live stream.
  const lastTimeMs = summary?.lastTime
    ? new Date(summary.lastTime).getTime()
    : null;
  const noRecentData =
    range === 'realtime' &&
    (lastTimeMs == null || Date.now() - lastTimeMs > 5 * 60 * 1000);
  const lastSeenLabel = lastTimeMs ? dayjs(lastTimeMs).fromNow() : 'ไม่เคย';

  const lineChartOption = useMemo(() => {
    const meta = lineMeta[lineMetric];
    return {
      grid: { left: 50, right: 20, top: 20, bottom: 40 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        textStyle: { color: ct.tooltipText },
      },
      xAxis: {
        type: 'category',
        // Format depends on the active range so daily/monthly buckets show
        // the day/month, not just "14:00" repeating across rows.
        data: series.map((p) => formatAxis(p.time, range)),
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 11 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: meta.unit,
        nameTextStyle: { color: ct.label },
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 11 },
        splitLine: { lineStyle: { color: ct.grid } },
      },
      series: [
        {
          name: meta.label,
          type: 'line',
          smooth: true,
          symbol: 'none',
          sampling: 'lttb',
          lineStyle: { color: meta.color, width: 2 },
          areaStyle: { color: `${meta.color}15` },
          data: series.map((p) => p[lineMetric] ?? 0),
        },
      ],
    };
  }, [series, ct, lineMetric]);

  // ─── Donut chart: energy share per sensor ──────────────────────────
  const donutOption = useMemo(() => {
    const data = (summary?.bySensor ?? []).map((s) => {
      const sensor = sensorById.get(s.sensorId);
      const label = sensor?.code ?? `Sensor ${s.sensorId}`;
      return {
        name: label,
        value: Number((s.energyDelta ?? 0).toFixed(4)),
      };
    });
    return {
      tooltip: {
        trigger: 'item',
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        textStyle: { color: ct.tooltipText },
        formatter: (p: { name: string; value: number; percent: number }) =>
          `${p.name}<br/>${p.value.toFixed(3)} kWh (${p.percent.toFixed(1)}%)`,
      },
      legend: {
        bottom: 0,
        textStyle: { color: ct.label, fontSize: 11 },
      },
      series: [
        {
          type: 'pie',
          radius: ['58%', '82%'],
          center: ['50%', '45%'],
          avoidLabelOverlap: false,
          label: { show: false },
          labelLine: { show: false },
          data: data.length > 0 ? data : [{ name: 'no data', value: 1 }],
          color: ['#22d3ee', '#a78bfa', '#facc15', '#4ade80', '#f87171'],
        },
      ],
    };
  }, [summary, sensorById, ct]);

  const donutTotal = summary?.energy.delta ?? 0;

  // ─── Daily aggregates for small bar charts ─────────────────────────
  type DailyBucket = {
    day: string;
    avgPower: number;
    maxTemp: number;
    warnCount: number;
  };
  const daily: DailyBucket[] = useMemo(() => {
    if (series.length === 0) return [];
    const map = new Map<string, { p: number[]; t: number[]; warn: number }>();
    for (const p of series) {
      const day = dayjs(p.time).format('DD/MM');
      const e = map.get(day) ?? { p: [], t: [], warn: 0 };
      if (p.power != null) e.p.push(p.power);
      if (p.temperature != null) e.t.push(p.temperature);
      if (p.voltage != null && (p.voltage < 210 || p.voltage > 240)) e.warn += 1;
      if (p.temperature != null && p.temperature >= 40) e.warn += 1;
      map.set(day, e);
    }
    return Array.from(map.entries()).map(([day, e]) => ({
      day,
      avgPower: e.p.length ? e.p.reduce((a, b) => a + b, 0) / e.p.length : 0,
      maxTemp: e.t.length ? Math.max(...e.t) : 0,
      warnCount: e.warn,
    }));
  }, [series]);

  const dailyPowerOption = useMemo(
    () => ({
      grid: { left: 40, right: 12, top: 14, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        textStyle: { color: ct.tooltipText },
      },
      xAxis: {
        type: 'category',
        data: daily.map((d) => d.day),
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 10 },
        splitLine: { lineStyle: { color: ct.grid } },
      },
      series: [
        {
          name: 'W เฉลี่ย',
          type: 'bar',
          itemStyle: { color: 'rgba(34,211,238,0.55)', borderColor: '#22d3ee', borderWidth: 1, borderRadius: 4 },
          data: daily.map((d) => Number(d.avgPower.toFixed(2))),
        },
      ],
    }),
    [daily, ct],
  );

  const dailyTempOption = useMemo(
    () => ({
      grid: { left: 40, right: 12, top: 14, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        textStyle: { color: ct.tooltipText },
      },
      xAxis: {
        type: 'category',
        data: daily.map((d) => d.day),
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 10 },
        splitLine: { lineStyle: { color: ct.grid } },
      },
      series: [
        {
          name: '°C สูงสุด',
          type: 'bar',
          itemStyle: {
            color: (params: { value: number }) =>
              params.value >= 40 ? 'rgba(248,113,113,0.6)' : 'rgba(250,204,21,0.45)',
            borderColor: 'transparent',
            borderRadius: 4,
          },
          data: daily.map((d) => Number(d.maxTemp.toFixed(1))),
        },
      ],
    }),
    [daily, ct],
  );

  const dailyWarnOption = useMemo(
    () => ({
      grid: { left: 36, right: 12, top: 14, bottom: 28 },
      tooltip: {
        trigger: 'axis',
        backgroundColor: ct.tooltipBg,
        borderColor: ct.tooltipBorder,
        textStyle: { color: ct.tooltipText },
      },
      xAxis: {
        type: 'category',
        data: daily.map((d) => d.day),
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 10 },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        axisLine: { lineStyle: { color: ct.axis } },
        axisLabel: { color: ct.label, fontSize: 10 },
        splitLine: { lineStyle: { color: ct.grid } },
      },
      series: [
        {
          name: 'การแจ้งเตือน',
          type: 'bar',
          itemStyle: { color: 'rgba(167,139,250,0.6)', borderColor: '#a78bfa', borderWidth: 1, borderRadius: 4 },
          data: daily.map((d) => d.warnCount),
        },
      ],
    }),
    [daily, ct],
  );

  const handleExportCsv = async () => {
    if (!query) return;
    const all = await fetchTelemetryReport({
      ...query,
      page: 1,
      pageSize: 100_000,
    });
    exportToCsv(
      all.data.map((p) => {
        const sensor = p.sensorId != null ? sensorById.get(p.sensorId) : undefined;
        return {
          time: dayjs(p.time).format('YYYY-MM-DD HH:mm:ss'),
          sensor: sensor?.code ?? '-',
          model: sensor?.model ?? '-',
          voltage: p.voltage,
          current: p.current,
          power: p.power,
          energy: p.energy,
          temperature: p.temperature,
        };
      }),
      [
        { key: 'time', label: 'Time' },
        { key: 'sensor', label: 'Sensor' },
        { key: 'model', label: 'Model' },
        { key: 'voltage', label: 'Voltage (V)' },
        { key: 'current', label: 'Current (A)' },
        { key: 'power', label: 'Power (W)' },
        { key: 'energy', label: 'Energy (kWh)' },
        { key: 'temperature', label: 'Temperature (°C)' },
      ],
      `report-site${id}-${range}-${dayjs().format('YYYYMMDD-HHmmss')}.csv`,
    );
  };

  return (
    <div>
      <PageHeader title="รายงาน" breadcrumb="รายงานข้อมูล" />

      {/* Filter bar */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: '16px 20px',
          marginBottom: 18,
          display: 'flex',
          alignItems: 'flex-end',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 220 }}>
          <label style={filterLabelStyle}>ช่วงเวลา</label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {RANGES.map((r) => {
              const active = r.value === range;
              return (
                <button
                  key={r.value}
                  onClick={() => {
                    setRange(r.value);
                    setPage(1);
                  }}
                  style={{
                    background: active ? 'var(--cyan)' : 'var(--bg-input)',
                    border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-color)'}`,
                    color: active ? '#000' : 'var(--text)',
                    padding: '6px 12px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                    fontFamily: 'Sarabun, sans-serif',
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          {/* Show the actual queried window so the user can confirm the date
              range is what they expected. With limited historical data many
              ranges look identical at first glance; this is the proof that
              the filter is doing the right thing under the hood. */}
          {summary?.range && (
            <div
              style={{
                marginTop: 8,
                fontSize: 11.5,
                color: 'var(--dim)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              ดึงข้อมูล{' '}
              <strong style={{ color: 'var(--text)' }}>
                {dayjs(summary.range.from).format('DD/MM/YYYY HH:mm')}
              </strong>
              {' → '}
              <strong style={{ color: 'var(--text)' }}>
                {dayjs(summary.range.to).format('DD/MM/YYYY HH:mm')}
              </strong>
              <span style={{ marginLeft: 8 }}>
                (
                {(() => {
                  const ms =
                    new Date(summary.range.to).getTime() -
                    new Date(summary.range.from).getTime();
                  const days = ms / 86_400_000;
                  if (days >= 1)   return `${days.toFixed(1)} วัน`;
                  const hours = ms / 3_600_000;
                  if (hours >= 1)  return `${hours.toFixed(1)} ชม.`;
                  return `${Math.round(ms / 60_000)} นาที`;
                })()}
                )
              </span>
            </div>
          )}
        </div>

        {zones.length > 0 && (
          <div>
            <label style={filterLabelStyle}>โซน</label>
            <select
              value={zoneId}
              onChange={(e) => {
                setZoneId(e.target.value === 'all' ? 'all' : Number(e.target.value));
                // Reset sensor when zone changes so we don't keep a sensor
                // that's no longer in scope.
                setSensorId('all');
                setPage(1);
              }}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                minWidth: 160,
              }}
            >
              <option value="all">ทุกโซน (ภาพรวม)</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} · {z.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label style={filterLabelStyle}>เซ็นเซอร์</label>
          <select
            value={sensorId}
            onChange={(e) => {
              setSensorId(e.target.value === 'all' ? 'all' : Number(e.target.value));
              setPage(1);
            }}
            style={{
              ...inputStyle,
              cursor: 'pointer',
              minWidth: 200,
            }}
          >
            <option value="all">ทุก sensor</option>
            {sensorsInScope.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} {s.model ? `(${s.model})` : ''}
              </option>
            ))}
          </select>
        </div>

        {range === 'custom' && (
          <>
            <div>
              <label style={filterLabelStyle}>จาก</label>
              <input
                type="datetime-local"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPage(1);
                }}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={filterLabelStyle}>ถึง</label>
              <input
                type="datetime-local"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPage(1);
                }}
                style={inputStyle}
              />
            </div>
          </>
        )}

        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={handleExportCsv}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '9px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Sarabun, sans-serif',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--green)';
              e.currentTarget.style.color = 'var(--green)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--text)';
            }}
          >
            <Download size={16} />
            ดาวน์โหลด CSV
          </button>
        </div>
      </div>

      {/* Live-stream status banner — only meaningful in realtime mode where
          the user expects new readings every few seconds. Helps the operator
          tell apart "filter returned nothing" vs. "board went silent". */}
      {range === 'realtime' && (
        <div
          style={{
            background: noRecentData
              ? 'rgba(248, 113, 113, 0.08)'
              : 'rgba(74, 222, 128, 0.08)',
            border: `1px solid ${noRecentData ? 'rgba(248,113,113,0.35)' : 'rgba(74,222,128,0.35)'}`,
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 13,
            color: noRecentData ? 'var(--red)' : 'var(--green)',
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: '50%',
              background: noRecentData ? '#f87171' : '#4ade80',
              boxShadow: noRecentData
                ? '0 0 0 4px rgba(248,113,113,0.18)'
                : '0 0 0 4px rgba(74,222,128,0.18)',
              animation: noRecentData ? 'none' : 'pulse 1.6s infinite',
            }}
          />
          <span style={{ fontWeight: 600 }}>
            {noRecentData
              ? `ยังไม่ได้รับข้อมูลใหม่ (${lastSeenLabel})`
              : 'รับข้อมูลสดอยู่'}
          </span>
          <span style={{ color: 'var(--dim)', marginLeft: 'auto', fontSize: 11 }}>
            {noRecentData
              ? 'อาจจะ board offline / สาย MQTT ขาด / sensor ไม่ตอบ — ตรวจสอบ /admin/devices'
              : `รีเฟรชอัตโนมัติทุก 10 วินาที · ล่าสุด ${lastSeenLabel}`}
          </span>
        </div>
      )}

      {/* KPI cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <KpiCard
          icon={<BatteryCharging size={20} color="#22c55e" />}
          color="#22c55e"
          label="พลังงานในช่วงนี้"
          value={summary?.energy.delta != null ? summary.energy.delta.toFixed(3) : '—'}
          unit="kWh"
          sub={
            summary?.energy.max != null && summary.energy.min != null
              ? `${summary.energy.min.toFixed(3)} → ${summary.energy.max.toFixed(3)}`
              : undefined
          }
        />
        <KpiCard
          icon={<Gauge size={20} color="#a78bfa" />}
          color="#a78bfa"
          label="กำลังเฉลี่ย"
          value={summary?.power.avg != null ? summary.power.avg.toFixed(1) : '—'}
          unit="W"
          sub={
            summary?.power.max != null
              ? `peak ${summary.power.max.toFixed(1)} W`
              : undefined
          }
        />
        <KpiCard
          icon={<Zap size={20} color="#06b6d4" />}
          color="#06b6d4"
          label="แรงดันเฉลี่ย"
          value={summary?.voltage.avg != null ? summary.voltage.avg.toFixed(1) : '—'}
          unit="V"
          sub={
            summary?.voltage.min != null && summary.voltage.max != null
              ? `${summary.voltage.min.toFixed(1)} – ${summary.voltage.max.toFixed(1)}`
              : undefined
          }
        />
        <KpiCard
          icon={<Activity size={20} color="#22d3ee" />}
          color="#22d3ee"
          label="กระแสเฉลี่ย"
          value={summary?.current.avg != null ? summary.current.avg.toFixed(3) : '—'}
          unit="A"
          sub={
            summary?.current.max != null
              ? `peak ${summary.current.max.toFixed(3)} A`
              : undefined
          }
        />
        {summary?.temperature.avg != null && (
          <KpiCard
            icon={
              <Thermometer
                size={20}
                color={(summary.temperature.max ?? 0) >= 40 ? '#facc15' : '#f87171'}
              />
            }
            color={(summary.temperature.max ?? 0) >= 40 ? '#facc15' : '#f87171'}
            label="อุณหภูมิเฉลี่ย"
            value={summary.temperature.avg.toFixed(1)}
            unit="°C"
            sub={
              summary.temperature.max != null
                ? `peak ${summary.temperature.max.toFixed(1)}°C`
                : undefined
            }
          />
        )}
        <KpiCard
          icon={<Hash size={20} color="#94a3b8" />}
          color="#94a3b8"
          label="จำนวนข้อมูล"
          value={summary?.rowCount?.toLocaleString() ?? '—'}
          unit="rows"
          sub={
            summary?.bySensor && summary.bySensor.length > 0
              ? `${summary.bySensor.length} sensor`
              : undefined
          }
        />
      </div>

      {/* Charts row: Line (tabbed) + Donut */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <section className="card" style={{ padding: 18 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 8,
            }}
          >
            <div>
              <span className="card-title">📉 แนวโน้มค่าพลังงาน</span>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
                {sensorId === 'all' ? 'เฉลี่ยทุก sensor' : sensorById.get(Number(sensorId))?.code}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['power', 'voltage', 'current', 'temperature'] as const).map((m) => {
                const active = lineMetric === m;
                return (
                  <button
                    key={m}
                    onClick={() => setLineMetric(m)}
                    style={{
                      background: active ? 'var(--cyan-glow)' : 'var(--bg-input)',
                      border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-color)'}`,
                      color: active ? 'var(--cyan)' : 'var(--dim)',
                      padding: '5px 12px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: active ? 700 : 500,
                      fontFamily: 'inherit',
                    }}
                  >
                    {lineMeta[m].label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ height: 300 }}>
            {series.length > 0 ? (
              <ReactECharts option={lineChartOption} style={{ height: '100%' }} notMerge />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--dim)',
                }}
              >
                ไม่มีข้อมูล
              </div>
            )}
          </div>
        </section>

        <section className="card" style={{ padding: 18 }}>
          <div style={{ marginBottom: 14 }}>
            <span className="card-title">🔋 สัดส่วนการใช้พลังงาน</span>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
              แยกตาม sensor (kWh)
            </div>
          </div>
          <div style={{ height: 300, position: 'relative' }}>
            <ReactECharts option={donutOption} style={{ height: '100%' }} notMerge />
            <div
              style={{
                position: 'absolute',
                top: '45%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--cyan)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {donutTotal.toFixed(3)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>kWh รวม</div>
            </div>
          </div>
        </section>
      </div>

      {/* Small charts row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 16,
          marginBottom: 18,
        }}
      >
        <section className="card" style={{ padding: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <span className="card-title" style={{ fontSize: 13 }}>📊 กำลังเฉลี่ยรายวัน (W)</span>
          </div>
          <div style={{ height: 160 }}>
            {daily.length > 0 ? (
              <ReactECharts option={dailyPowerOption} style={{ height: '100%' }} notMerge />
            ) : (
              <Empty />
            )}
          </div>
        </section>
        <section className="card" style={{ padding: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <span className="card-title" style={{ fontSize: 13 }}>🌡️ อุณหภูมิสูงสุดรายวัน</span>
          </div>
          <div style={{ height: 160 }}>
            {daily.length > 0 ? (
              <ReactECharts option={dailyTempOption} style={{ height: '100%' }} notMerge />
            ) : (
              <Empty />
            )}
          </div>
        </section>
        <section className="card" style={{ padding: 16 }}>
          <div style={{ marginBottom: 8 }}>
            <span className="card-title" style={{ fontSize: 13 }}>🚨 การแจ้งเตือนสะสม</span>
          </div>
          <div style={{ height: 160 }}>
            {daily.length > 0 ? (
              <ReactECharts option={dailyWarnOption} style={{ height: '100%' }} notMerge />
            ) : (
              <Empty />
            )}
          </div>
        </section>
      </div>

      {/* Table */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 13.5,
            }}
          >
            <thead>
              <tr>
                <th style={thStyle}>วันที่/เวลา</th>
                <th style={thStyle}>Sensor</th>
                <th style={thStyle}>Voltage (V)</th>
                <th style={thStyle}>Current (A)</th>
                <th style={thStyle}>Power (W)</th>
                <th style={thStyle}>Energy (kWh)</th>
                <th style={thStyle}>Temp (°C)</th>
              </tr>
            </thead>
            <tbody>
              {isFetching && rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={emptyStyle}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={emptyStyle}>
                    ไม่พบข้อมูล
                  </td>
                </tr>
              ) : (
                rows.map((p, idx) => {
                  const sensor = p.sensorId != null ? sensorById.get(p.sensorId) : undefined;
                  const isPzem = sensor?.code?.startsWith('PZEM');
                  const isKws = sensor?.code?.startsWith('KWS');
                  const badgeColor = isPzem ? '#06b6d4' : isKws ? '#a78bfa' : '#94a3b8';
                  return (
                    <tr
                      key={`${p.sensorId ?? 'x'}-${p.time}-${idx}`}
                      style={{ transition: 'background 0.15s' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          'rgba(255,255,255,0.03)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <td style={tdStyle}>
                        {dayjs(p.time).format('DD/MM/YYYY HH:mm:ss')}
                      </td>
                      <td style={tdStyle}>
                        {sensor ? (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '2px 10px',
                              borderRadius: 999,
                              background: `${badgeColor}1f`,
                              color: badgeColor,
                              fontSize: 11.5,
                              fontWeight: 700,
                              border: `1px solid ${badgeColor}55`,
                              letterSpacing: '0.04em',
                            }}
                          >
                            {sensor.code}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={tdStyle}>{p.voltage?.toFixed(1) ?? '-'}</td>
                      <td style={tdStyle}>{p.current?.toFixed(3) ?? '-'}</td>
                      <td style={tdStyle}>{p.power?.toFixed(1) ?? '-'}</td>
                      <td style={tdStyle}>{p.energy?.toFixed(3) ?? '-'}</td>
                      <td
                        style={{
                          ...tdStyle,
                          color:
                            (p.temperature ?? 0) >= 40
                              ? 'var(--yellow)'
                              : 'var(--text)',
                          fontWeight: (p.temperature ?? 0) >= 40 ? 600 : 400,
                        }}
                      >
                        {p.temperature?.toFixed(1) ?? '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            fontSize: 13,
            color: 'var(--dim)',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <div>
            แสดง {total === 0 ? 0 : (page - 1) * pageSize + 1} –{' '}
            {Math.min(page * pageSize, total)} จาก {total.toLocaleString()} รายการ
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              style={{
                marginLeft: 12,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text)',
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'Sarabun, sans-serif',
              }}
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n}>
                  {n}/หน้า
                </option>
              ))}
            </select>
          </div>
          <Pagination
            current={page}
            total={totalPages}
            onChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}

function Pagination({
  current,
  total,
  onChange,
}: {
  current: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = (() => {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    if (current <= 4) return [1, 2, 3, 4, 5, -1, total];
    if (current >= total - 3)
      return [1, -1, total - 4, total - 3, total - 2, total - 1, total];
    return [1, -1, current - 1, current, current + 1, -1, total];
  })();

  return (
    <div style={{ display: 'flex', gap: 5 }}>
      <button
        onClick={() => onChange(Math.max(1, current - 1))}
        disabled={current === 1}
        style={pageBtnStyle(false)}
      >
        <ChevronLeft size={14} />
      </button>
      {pages.map((p, i) =>
        p === -1 ? (
          <span key={`gap-${i}`} style={{ color: 'var(--dim)', padding: '0 4px' }}>
            …
          </span>
        ) : (
          <button
            key={p}
            onClick={() => onChange(p)}
            style={pageBtnStyle(p === current)}
          >
            {p}
          </button>
        ),
      )}
      <button
        onClick={() => onChange(Math.min(total, current + 1))}
        disabled={current === total}
        style={pageBtnStyle(false)}
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}

const filterLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--dim)',
  fontWeight: 600,
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
};

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  padding: '7px 10px',
  borderRadius: 8,
  fontSize: 13,
  fontFamily: 'Sarabun, sans-serif',
  outline: 'none',
};

const thStyle: React.CSSProperties = {
  background: 'rgba(34, 211, 238, 0.06)',
  color: 'var(--dim)',
  padding: '13px 16px',
  textAlign: 'left',
  fontWeight: 600,
  borderBottom: '1px solid var(--border-color)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--border-color)',
};

const emptyStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  color: 'var(--dim)',
  padding: '40px 20px',
};

const pageBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? 'var(--cyan)' : 'var(--bg-input)',
  border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-color)'}`,
  color: active ? '#000' : 'var(--text)',
  width: 32,
  height: 32,
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: active ? 700 : 400,
  fontFamily: 'Sarabun, sans-serif',
});

function Empty() {
  return (
    <div
      style={{
        height: '100%',
        display: 'grid',
        placeItems: 'center',
        color: 'var(--dim)',
        fontSize: 12,
      }}
    >
      ไม่มีข้อมูล
    </div>
  );
}

function KpiCard({
  icon,
  color,
  label,
  value,
  unit,
  sub,
}: {
  icon: React.ReactNode;
  color: string;
  label: string;
  value: string;
  unit: string;
  sub?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: '14px 16px',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 8,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'var(--bg-input)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {icon}
        </div>
        <div
          style={{
            fontSize: 11,
            color: 'var(--dim)',
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          color: 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.2,
        }}
      >
        {value}
        <span
          style={{
            fontSize: 12,
            fontWeight: 500,
            color: 'var(--dim)',
            marginLeft: 4,
          }}
        >
          {unit}
        </span>
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--dim2)', marginTop: 4 }}>{sub}</div>
      )}
    </div>
  );
}
