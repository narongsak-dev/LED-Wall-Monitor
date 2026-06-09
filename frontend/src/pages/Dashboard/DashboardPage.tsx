import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import {
  Zap,
  BatteryCharging,
  BarChart3,
  Thermometer,
  Camera,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { GaugeChart } from '@/components/charts/GaugeChart';
import { StatCard } from '@/components/cards/StatCard';
import { useSiteRealtime } from '@/features/realtime/realtimeStore';
import { useSiteSensors } from '@/features/sensors/hooks';
import { useZones } from '@/features/zones/hooks';
import { exportElementToImage } from '@/features/export/exportImage';
import { useTheme } from '@/features/theme/useTheme';
import { CHART_THEMES } from '@/features/theme/chartTheme';
import { dayjs } from '@/lib/dayjs';
import type { TelemetryPoint } from '@monitor/shared';

interface GaugeBoxProps {
  title: string;
  value: number;
  max: number;
  unit: string;
  color?: string;
  warningThreshold?: number;
  isWarning?: boolean;
  fromSensorCode?: string;
}

function GaugeBox({
  title,
  value,
  max,
  unit,
  color = '#22d3ee',
  warningThreshold,
  isWarning,
  fromSensorCode,
}: GaugeBoxProps) {
  return (
    <div
      style={{
        border: `1px solid ${isWarning ? 'rgba(250, 204, 21, 0.35)' : 'var(--border-color)'}`,
        background: isWarning
          ? 'linear-gradient(180deg, rgba(250, 204, 21, 0.05), transparent)'
          : 'var(--bg-input)',
        borderRadius: 14,
        padding: '14px 12px 12px',
        textAlign: 'center',
        position: 'relative',
      }}
    >
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--dim)',
          marginBottom: 4,
          fontWeight: 500,
          letterSpacing: '0.01em',
        }}
      >
        {title}
      </div>
      <GaugeChart
        value={value}
        max={max}
        unit={unit}
        color={color}
        warningThreshold={warningThreshold}
      />
      {fromSensorCode && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            right: 10,
            fontSize: 9.5,
            color: 'var(--dim2)',
            fontWeight: 600,
            letterSpacing: '0.03em',
          }}
        >
          {fromSensorCode}
        </div>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { siteId } = useParams();
  const id = siteId ? Number(siteId) : null;
  const themeMode = useTheme();
  const ct = CHART_THEMES[themeMode];

  const site = useSiteRealtime(id ?? 0);
  const { data: sensors = [] } = useSiteSensors(id);
  const { data: zones = [] } = useZones(id);

  // ─── Zone selector ──────────────────────────────────────────────
  // Drives every downstream aggregation (KPI cards, gauge selector,
  // trend chart, sensor table). 'all' = whole site, otherwise a specific
  // zone — sensors whose board doesn't belong to that zone are filtered out.
  const [zoneId, setZoneId] = useState<number | 'all'>('all');

  const sensorsList = useMemo(
    () =>
      sensors
        .filter((s) => s.isActive)
        .filter((s) => zoneId === 'all' || (s.zoneId ?? null) === zoneId),
    [sensors, zoneId],
  );

  // ─── Sensor selector ────────────────────────────────────────────
  const [selectedSensorId, setSelectedSensorId] = useState<number | null>(null);
  useEffect(() => {
    // Switch to the first in-scope sensor if (a) nothing's selected yet, or
    // (b) the previously-selected sensor was scoped out by the zone change.
    const stillVisible = sensorsList.some((s) => s.id === selectedSensorId);
    if (!stillVisible && sensorsList.length > 0) {
      setSelectedSensorId(sensorsList[0].id);
    }
  }, [sensorsList, selectedSensorId]);

  const selectedSensor = sensorsList.find((s) => s.id === selectedSensorId);
  const selectedState = selectedSensorId != null
    ? site?.bySensor?.[selectedSensorId]
    : undefined;
  const selectedLatest = selectedState?.latest;

  // ─── Temperature fallback: any in-scope sensor that has temperature ──
  // `sensorsList` is already zone-filtered so we don't need a separate check.
  const tempLatest: { code?: string; value: number | null } = useMemo(() => {
    if (!site?.bySensor) return { value: null };
    for (const sensor of sensorsList) {
      const v = site.bySensor[sensor.id]?.latest?.temperature;
      if (v != null) return { code: sensor.code, value: v };
    }
    return { value: null };
  }, [site, sensorsList]);

  // Sensor IDs visible to the current zone scope — used to filter the
  // site-wide realtime store down to the relevant subset.
  const inScopeIds = useMemo(
    () => new Set(sensorsList.map((s) => s.id)),
    [sensorsList],
  );

  // ─── Aggregate trend across in-scope sensors (sum power, by minute) ──
  const trend = useMemo(() => {
    if (!site?.bySensor) return [];
    const byMinute = new Map<string, { sum: number; count: number }>();
    for (const [sidStr, state] of Object.entries(site.bySensor)) {
      if (!inScopeIds.has(Number(sidStr))) continue;
      for (const p of state.history) {
        const key = dayjs(p.time).format('HH:mm');
        const w = p.power ?? 0;
        const entry = byMinute.get(key) ?? { sum: 0, count: 0 };
        entry.sum += w;
        entry.count += 1;
        byMinute.set(key, entry);
      }
    }
    return Array.from(byMinute.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([time, e]) => ({ time, power: e.sum / 1000 })); // kW
  }, [site, inScopeIds]);

  // ─── Stats from aggregate ───────────────────────────────────────
  const stats = useMemo(() => {
    let totalEnergy = 0;
    let firstEnergy = 0;
    const powers: number[] = [];
    const temps: number[] = [];
    if (site?.bySensor) {
      for (const [sidStr, state] of Object.entries(site.bySensor)) {
        if (!inScopeIds.has(Number(sidStr))) continue;
        const latest = state.latest;
        if (latest?.energy != null) totalEnergy += latest.energy;
        if (state.history.length > 0 && state.history[0].energy != null) {
          firstEnergy += state.history[0].energy;
        }
        for (const p of state.history) {
          if (p.power != null) powers.push(p.power / 1000);
          if (p.temperature != null) temps.push(p.temperature);
        }
      }
    }
    return {
      energyNow: totalEnergy,
      energyDelta: totalEnergy - firstEnergy,
      powerMax: powers.length ? Math.max(...powers) : 0,
      powerAvg: powers.length ? powers.reduce((a, b) => a + b, 0) / powers.length : 0,
      tempAvg: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 0,
      tempMax: temps.length ? Math.max(...temps) : 0,
    };
  }, [site]);

  const lineOption = {
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: ct.tooltipBg,
      borderColor: ct.tooltipBorder,
      textStyle: { color: ct.tooltipText },
    },
    xAxis: {
      type: 'category',
      data: trend.map((p) => p.time),
      axisLine: { lineStyle: { color: ct.axis } },
      axisLabel: { color: ct.label, fontSize: 11 },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      name: 'kW',
      nameTextStyle: { color: ct.label },
      axisLine: { lineStyle: { color: ct.axis } },
      axisLabel: { color: ct.label, fontSize: 11 },
      splitLine: { lineStyle: { color: ct.grid } },
    },
    series: [
      {
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#22d3ee', width: 2 },
        areaStyle: { color: 'rgba(34, 211, 238, 0.1)' },
        data: trend.map((p) => p.power.toFixed(3)),
      },
    ],
  };

  return (
    <div id="dashboard-export-root">
      <PageHeader title="แดชบอร์ดหลัก" breadcrumb="ดูข้อมูลไซต์" />

      {/* Zone tabs — sit at the top of the page so the choice clearly
          controls every card below. Hidden on sites without zones to keep
          the dashboard uncluttered for simple single-zone deployments. */}
      {zones.length > 0 && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 14,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flexWrap: 'wrap',
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: 'var(--dim)',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '.06em',
              marginRight: 6,
            }}
          >
            โซน
          </span>
          {(
            [
              { id: 'all' as const, label: 'ทุกโซน (รวม)', code: '' },
              ...zones.map((z) => ({ id: z.id as number | 'all', label: z.name, code: z.code })),
            ]
          ).map((opt) => {
            const active = opt.id === zoneId;
            const sensorCount =
              opt.id === 'all'
                ? sensors.filter((s) => s.isActive).length
                : sensors.filter((s) => s.isActive && (s.zoneId ?? null) === opt.id).length;
            return (
              <button
                key={String(opt.id)}
                onClick={() => setZoneId(opt.id)}
                style={{
                  background: active ? 'var(--cyan)' : 'var(--bg-input)',
                  border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-color)'}`,
                  color: active ? '#000' : 'var(--text)',
                  padding: '7px 14px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  fontFamily: 'inherit',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {opt.code && (
                  <span
                    style={{
                      fontSize: 10,
                      opacity: 0.7,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {opt.code}
                  </span>
                )}
                {opt.label}
                <span
                  style={{
                    fontSize: 10.5,
                    opacity: 0.65,
                    fontWeight: 500,
                    marginLeft: 2,
                  }}
                >
                  · {sensorCount} sensor
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <StatCard
          icon={<Zap size={20} color="#06b6d4" />}
          iconBg="rgba(6, 182, 212, 0.12)"
          label="พลังงานสะสม (รวมทุก sensor)"
          value={stats.energyNow.toFixed(3)}
          unit="kWh"
          sub="ค่าสะสมล่าสุด"
          valueColor="var(--text)"
        />
        <StatCard
          icon={<BatteryCharging size={20} color="#22c55e" />}
          iconBg="rgba(34, 197, 94, 0.12)"
          label="เพิ่มขึ้นในช่วงนี้"
          value={`+${stats.energyDelta.toFixed(3)}`}
          unit="kWh"
          sub="vs จุดเริ่มต้น"
          valueColor="var(--text)"
        />
        {/* Smart unit: tiny idle loads (e.g. 4W) read as "0.004 kW" which
            visually looks like "no data". Show W when the value is < 1 kW. */}
        {(() => {
          const useKw = stats.powerAvg >= 1;
          const fmt = (kw: number) =>
            useKw ? kw.toFixed(3) : (kw * 1000).toFixed(1);
          return (
            <StatCard
              icon={<BarChart3 size={20} color="#a78bfa" />}
              iconBg="rgba(167, 139, 250, 0.12)"
              label="กำลังเฉลี่ย"
              value={fmt(stats.powerAvg)}
              unit={useKw ? 'kW' : 'W'}
              sub={`peak ${fmt(stats.powerMax)} ${useKw ? 'kW' : 'W'}`}
              valueColor="var(--text)"
            />
          );
        })()}
        <StatCard
          icon={
            <Thermometer
              size={20}
              color={stats.tempMax >= 40 ? '#facc15' : '#f87171'}
            />
          }
          iconBg={
            stats.tempMax >= 40
              ? 'rgba(250, 204, 21, 0.12)'
              : 'rgba(239, 68, 68, 0.1)'
          }
          label="อุณหภูมิเฉลี่ย"
          value={stats.tempAvg.toFixed(1)}
          unit="°C"
          sub={`peak ${stats.tempMax.toFixed(1)}°C`}
          valueColor={stats.tempMax >= 40 ? 'var(--yellow)' : 'var(--text)'}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))',
          gap: 18,
          marginBottom: 18,
        }}
      >
        {/* Realtime gauges with sensor selector */}
        <section className="card fade-in-up">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              gap: 12,
            }}
          >
            <div>
              <span className="card-title">Real-time Data</span>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--dim)',
                  marginTop: 2,
                  fontWeight: 500,
                }}
              >
                ทุก 3 วินาที
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <select
                value={selectedSensorId ?? ''}
                onChange={(e) => setSelectedSensorId(Number(e.target.value))}
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text)',
                  padding: '6px 10px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                {sensorsList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} {s.model ? `(${s.model})` : ''}
                  </option>
                ))}
              </select>
              <SignalBadge latestTime={selectedLatest?.time} />
            </div>
          </div>
          {(() => {
            const ageMs = selectedLatest?.time
              ? Date.now() - new Date(selectedLatest.time).getTime()
              : null;
            const isStale = ageMs == null || ageMs > 60_000;
            return isStale ? (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.07)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 10,
                  padding: '10px 14px',
                  marginBottom: 12,
                  fontSize: 12.5,
                  color: 'var(--red)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 600 }}>หยุดรับข้อมูล</span>
                <span style={{ color: 'var(--dim)', marginLeft: 'auto', fontSize: 11 }}>
                  {ageMs == null
                    ? 'ยังไม่เคยมีข้อมูล — ตรวจสอบบอร์ดที่ /admin/devices'
                    : `ข้อมูลล่าสุด ${dayjs(selectedLatest!.time).fromNow()} · ค่าด้านล่างเป็นค่าเก่า`}
                </span>
              </div>
            ) : null;
          })()}
          {(() => {
            const ageMs = selectedLatest?.time
              ? Date.now() - new Date(selectedLatest.time).getTime()
              : Infinity;
            const isStale = ageMs > 60_000;
            return (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              opacity: isStale ? 0.5 : 1,
              filter: isStale ? 'grayscale(0.4)' : 'none',
              transition: 'opacity .2s, filter .2s',
            }}
          >
            <GaugeBox
              title="แรงดันไฟฟ้า"
              value={selectedLatest?.voltage ?? 0}
              max={300}
              unit="V"
              fromSensorCode={selectedSensor?.code}
            />
            <GaugeBox
              title="กระแสไฟฟ้า"
              value={selectedLatest?.current ?? 0}
              max={50}
              unit="A"
              fromSensorCode={selectedSensor?.code}
            />
            {(() => {
              // Smart unit: under 1kW show as W (more readable for idle/small
              // loads like 4W), 1kW+ shows as kW. Scale max accordingly so
              // the needle has room to move at small loads.
              const watts = selectedLatest?.power ?? 0;
              const useKw = watts >= 1000;
              return (
                <GaugeBox
                  title="กำลังไฟฟ้า"
                  value={useKw ? watts / 1000 : watts}
                  max={useKw ? 10 : 2000}
                  unit={useKw ? 'kW' : 'W'}
                  fromSensorCode={selectedSensor?.code}
                />
              );
            })()}
            <GaugeBox
              title="อุณหภูมิเบรกเกอร์"
              value={tempLatest.value ?? 0}
              max={100}
              unit="°C"
              color="#facc15"
              warningThreshold={45}
              isWarning={(tempLatest.value ?? 0) >= 40}
              fromSensorCode={tempLatest.code}
            />
          </div>
            );
          })()}
        </section>

        {/* Line chart */}
        <section className="card fade-in-up">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 14,
            }}
          >
            <div>
              <span className="card-title">แนวโน้มกำลังไฟฟ้ารวม</span>
              <div
                style={{
                  fontSize: 11.5,
                  color: 'var(--dim)',
                  marginTop: 2,
                  fontWeight: 500,
                }}
              >
                รวมจากทุก sensor (kW)
              </div>
            </div>
            <button
              onClick={() =>
                exportElementToImage(
                  'dashboard-export-root',
                  `dashboard-site${id}-${dayjs().format('YYYYMMDD-HHmmss')}.png`,
                )
              }
              style={{
                background: 'var(--bg-input)',
                color: 'var(--text)',
                border: '1px solid var(--border-color)',
                padding: '7px 14px',
                borderRadius: 10,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'inherit',
              }}
            >
              <Camera size={14} />
              บันทึกภาพ
            </button>
          </div>
          <div style={{ height: 280 }}>
            {trend.length > 0 ? (
              <ReactECharts
                option={lineOption}
                style={{ height: '100%' }}
                notMerge
              />
            ) : (
              <div
                style={{
                  height: '100%',
                  display: 'grid',
                  placeItems: 'center',
                  color: 'var(--dim)',
                }}
              >
                รอข้อมูล...
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Per-sensor data table */}
      <section className="card fade-in-up">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 14,
          }}
        >
          <div>
            <span className="card-title">บันทึกข้อมูลล่าสุดต่อ sensor</span>
            <div
              style={{
                fontSize: 11.5,
                color: 'var(--dim)',
                marginTop: 2,
                fontWeight: 500,
              }}
            >
              ค่าล่าสุดของแต่ละ sensor
            </div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>Sensor</th>
              <th style={thStyle}>เวลา</th>
              <th style={thStyle}>Voltage (V)</th>
              <th style={thStyle}>Current (A)</th>
              <th style={thStyle}>Power (W)</th>
              <th style={thStyle}>Energy (kWh)</th>
              <th style={thStyle}>Temp (°C)</th>
            </tr>
          </thead>
          <tbody>
            {sensorsList.map((s) => {
              const latest: TelemetryPoint | null = site?.bySensor?.[s.id]?.latest ?? null;
              return (
                <tr key={s.id}>
                  <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--cyan)' }}>
                    {s.code}
                    <div style={{ fontSize: 11, color: 'var(--dim2)', fontWeight: 400 }}>
                      {s.model ?? '-'}
                    </div>
                  </td>
                  <td style={{ ...tdStyle, color: 'var(--dim)', fontSize: 12 }}>
                    {latest ? dayjs(latest.time).fromNow() : '-'}
                  </td>
                  <td style={tdStyle}>{latest?.voltage?.toFixed(1) ?? '-'}</td>
                  <td style={tdStyle}>{latest?.current?.toFixed(3) ?? '-'}</td>
                  <td style={tdStyle}>{latest?.power?.toFixed(2) ?? '-'}</td>
                  <td style={tdStyle}>{latest?.energy?.toFixed(3) ?? '-'}</td>
                  <td
                    style={{
                      ...tdStyle,
                      color:
                        (latest?.temperature ?? 0) >= 40
                          ? 'var(--yellow)'
                          : 'var(--text)',
                      fontWeight: (latest?.temperature ?? 0) >= 40 ? 600 : 400,
                    }}
                  >
                    {latest?.temperature?.toFixed(1) ?? '-'}
                  </td>
                </tr>
              );
            })}
            {sensorsList.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    ...tdStyle,
                    textAlign: 'center',
                    color: 'var(--dim)',
                    padding: 24,
                  }}
                >
                  ยังไม่มี sensor ในไซต์นี้
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

/** Sensor-specific freshness badge. Replaces the old purely-decorative
 *  LiveDot that said "LIVE" no matter what. The three states match the
 *  realistic cadence of board telemetry (one tick every ~3 s):
 *    fresh  (<15 s)  → green, pulsing — board is actively reporting
 *    slow   (15-60s) → yellow — link may have hiccupped, still recoverable
 *    silent (>60s)   → red — board has not reported in over a minute,
 *                            operator should investigate. */
function SignalBadge({ latestTime }: { latestTime?: string | null }) {
  // Re-render every second so the "Xs ago" stays current even without
  // upstream changes — otherwise the badge could lie for minutes.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const ageMs = latestTime ? Date.now() - new Date(latestTime).getTime() : null;
  const state: 'fresh' | 'slow' | 'silent' | 'none' =
    ageMs == null ? 'none'
    : ageMs < 15_000 ? 'fresh'
    : ageMs < 60_000 ? 'slow'
    : 'silent';

  const visual = {
    fresh:  { color: '#22c55e', bg: 'rgba(34,197,94,0.1)',  border: 'rgba(34,197,94,0.3)',  label: 'LIVE',     pulse: true },
    slow:   { color: '#facc15', bg: 'rgba(250,204,21,0.1)', border: 'rgba(250,204,21,0.3)', label: 'DELAYED',  pulse: false },
    silent: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  label: 'NO SIGNAL',pulse: false },
    none:   { color: '#94a3b8', bg: 'rgba(148,163,184,0.1)',border: 'rgba(148,163,184,0.3)',label: 'NO DATA',  pulse: false },
  }[state];

  const ageLabel = ageMs == null
    ? 'ไม่เคย'
    : ageMs < 60_000  ? `${Math.round(ageMs / 1000)}s ago`
    : ageMs < 3600_000? `${Math.round(ageMs / 60_000)}m ago`
    : dayjs(latestTime!).fromNow();

  return (
    <div
      title={latestTime ? `Last reading: ${dayjs(latestTime).format('HH:mm:ss')}` : 'No reading yet'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        background: visual.bg,
        border: `1px solid ${visual.border}`,
        color: visual.color,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.06em',
      }}
    >
      <span
        className={visual.pulse ? 'pulse-dot' : ''}
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: visual.color,
          display: 'inline-block',
        }}
      />
      {visual.label}
      <span style={{ fontWeight: 500, opacity: 0.8, fontSize: 9.5, marginLeft: 2 }}>
        {ageLabel}
      </span>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  color: 'var(--dim)',
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-color)',
  background: 'transparent',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderBottom: '1px solid var(--border-color)',
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
};
