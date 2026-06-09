import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BatteryCharging,
  Building2,
  Clock,
  MapPin,
  Plug,
  Search,
  Thermometer,
  Zap,
} from 'lucide-react';
import type { TelemetryPoint, UserSiteAccess } from '@monitor/shared';
import { useSitesOverview } from '@/features/telemetry/useSitesOverview';
import { useAlertsStore } from '@/features/alerts/store';
import { dayjs } from '@/lib/dayjs';

interface SiteOverviewGridProps {
  data: UserSiteAccess[] | undefined;
  isLoading: boolean;
  error: Error | null;
  /** ถ้าไม่ส่ง จะ navigate ไป /sites/:id/dashboard อัตโนมัติ */
  onSelectSite?: (siteId: number) => void;
  /** ซ่อน stats row */
  hideStats?: boolean;
}

interface OverviewSnapshot {
  latest: TelemetryPoint | null;
  totalPower: number;
  totalEnergy: number;
  maxTemp: number;
  liveSensorCount: number;
  lastSeenAt: string | null;
  online: boolean;
}

export function SiteOverviewGrid({
  data,
  isLoading,
  error,
  onSelectSite,
  hideStats,
}: SiteOverviewGridProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const siteIds = useMemo(() => (data ?? []).map((s) => s.site.id), [data]);
  const { byId: overviews } = useSitesOverview(siteIds);

  const alertCountBySite = useAlertsStore((s) => {
    const counts: Record<number, number> = {};
    for (const a of s.alerts) {
      if (a.acked) continue;
      counts[a.siteId] = (counts[a.siteId] ?? 0) + 1;
    }
    return counts;
  });

  const filtered = useMemo(() => {
    if (!data) return [];
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter(
      ({ site }) =>
        site.code.toLowerCase().includes(q) ||
        site.name.toLowerCase().includes(q) ||
        (site.location ?? '').toLowerCase().includes(q),
    );
  }, [data, search]);

  const aggregate = useMemo(() => {
    const snapshots = siteIds
      .map((id) => overviews[id])
      .filter((s): s is NonNullable<typeof s> => s != null);
    if (snapshots.length === 0) {
      return {
        totalSites: siteIds.length,
        onlineSites: 0,
        totalPowerKw: 0,
        totalEnergy: 0,
        avgTemp: 0,
        maxTemp: 0,
        warnings: 0,
      };
    }
    const onlineSites = snapshots.filter((s) => s.online).length;
    const totalPowerKw = snapshots.reduce((s, p) => s + (p.totalPower ?? 0), 0) / 1000;
    const totalEnergy = snapshots.reduce((s, p) => s + (p.totalEnergy ?? 0), 0);
    const temps = snapshots.map((p) => p.maxTemp).filter((t) => t > 0);
    return {
      totalSites: siteIds.length,
      onlineSites,
      totalPowerKw,
      totalEnergy,
      avgTemp: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 0,
      maxTemp: temps.length ? Math.max(...temps) : 0,
      warnings: temps.filter((t) => t >= 40).length,
    };
  }, [overviews, siteIds]);

  const handleSelect = (siteId: number) => {
    if (onSelectSite) onSelectSite(siteId);
    else navigate(`/sites/${siteId}/dashboard`);
  };

  return (
    <div>
      {!hideStats && data && data.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 14,
            marginBottom: 24,
          }}
        >
          <SummaryStat
            Icon={Building2}
            iconColor="#06b6d4"
            label="ไซต์ที่เข้าถึงได้"
            value={String(aggregate.totalSites)}
            sub={`${aggregate.onlineSites}/${aggregate.totalSites} ออนไลน์`}
            accent="#06b6d4"
          />
          <SummaryStat
            Icon={Activity}
            iconColor="#a78bfa"
            label="กำลังไฟฟ้ารวม"
            value={aggregate.totalPowerKw.toFixed(3)}
            unit="kW"
            sub="โหลดปัจจุบันทั้งระบบ"
            accent="#a78bfa"
          />
          <SummaryStat
            Icon={BatteryCharging}
            iconColor="#22c55e"
            label="พลังงานสะสมรวม"
            value={aggregate.totalEnergy.toLocaleString('en-US', {
              minimumFractionDigits: 3,
              maximumFractionDigits: 3,
            })}
            unit="kWh"
            sub="ผลรวมจากทุก sensor"
            accent="#22c55e"
          />
          <SummaryStat
            Icon={aggregate.warnings > 0 ? AlertTriangle : Thermometer}
            iconColor={aggregate.warnings > 0 ? '#facc15' : '#22c55e'}
            label={aggregate.warnings > 0 ? 'แจ้งเตือน' : 'อุณหภูมิสูงสุด'}
            value={
              aggregate.warnings > 0
                ? String(aggregate.warnings)
                : aggregate.maxTemp.toFixed(1)
            }
            unit={aggregate.warnings > 0 ? 'ไซต์' : '°C'}
            sub={
              aggregate.warnings > 0
                ? 'มีอุณหภูมิเกิน 40°C'
                : `เฉลี่ย ${aggregate.avgTemp.toFixed(1)}°C`
            }
            accent={aggregate.warnings > 0 ? '#facc15' : '#22c55e'}
          />
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h2
          style={{
            color: 'var(--text)',
            fontSize: 16,
            margin: 0,
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }}
        >
          ไซต์งาน
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {data && data.length > 3 && (
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                color="var(--dim2)"
                style={{
                  position: 'absolute',
                  left: 11,
                  top: '50%',
                  transform: 'translateY(-50%)',
                }}
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ค้นหา (code, ชื่อ, ที่ตั้ง...)"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text)',
                  padding: '7px 12px 7px 32px',
                  borderRadius: 8,
                  fontSize: 12.5,
                  fontFamily: 'inherit',
                  outline: 'none',
                  width: 220,
                }}
              />
            </div>
          )}
          {data && (
            <span style={{ fontSize: 13, color: 'var(--dim)' }}>
              {filtered.length}/{data.length} ไซต์
            </span>
          )}
        </div>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--dim)' }}>
          กำลังโหลด...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 16,
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 12,
            color: 'var(--red)',
            fontSize: 13,
          }}
        >
          โหลดรายการไซต์ไม่สำเร็จ: {error.message}
        </div>
      )}

      {data && data.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 56 }}>
          <Plug
            size={48}
            color="var(--dim2)"
            style={{ marginBottom: 12, display: 'inline-block' }}
          />
          <div style={{ color: 'var(--dim)', fontSize: 14 }}>
            คุณยังไม่มีสิทธิ์เข้าถึงไซต์ใดๆ
          </div>
        </div>
      )}

      {data && data.length > 0 && filtered.length === 0 && (
        <div
          style={{
            padding: 32,
            textAlign: 'center',
            color: 'var(--dim)',
            fontSize: 13,
          }}
        >
          ไม่พบไซต์ที่ตรงกับ "{search}"
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {filtered.map(({ site, permission }, idx) => {
          const snapshot = overviews[site.id];
          const alerts = alertCountBySite[site.id] ?? 0;
          const isOnline = !!snapshot?.online;

          return (
            <div
              key={site.id}
              onClick={() => handleSelect(site.id)}
              className="card fade-in-up"
              style={{
                cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
                overflow: 'hidden',
                animationDelay: `${idx * 50}ms`,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--cyan)';
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = 'var(--shadow-glow)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 3,
                  background: isOnline
                    ? 'linear-gradient(90deg, var(--cyan) 0%, var(--purple) 100%)'
                    : 'linear-gradient(90deg, var(--dim2) 0%, transparent 100%)',
                  opacity: 0.6,
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'var(--cyan-glow)',
                    border: '1px solid rgba(6, 182, 212, 0.25)',
                    color: 'var(--cyan)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                  }}
                >
                  {site.code}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {alerts > 0 && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '3px 8px',
                        borderRadius: 999,
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.35)',
                        color: '#ef4444',
                        fontSize: 10.5,
                        fontWeight: 700,
                      }}
                    >
                      <AlertTriangle size={10} />
                      {alerts}
                    </span>
                  )}
                  <span
                    className={isOnline ? 'badge badge-online' : 'badge badge-offline'}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                  >
                    <span
                      className={isOnline ? 'pulse-dot' : ''}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: isOnline ? 'var(--green)' : 'var(--dim2)',
                        display: 'inline-block',
                      }}
                    />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: 'var(--text)',
                  marginBottom: 4,
                  letterSpacing: '-0.01em',
                }}
              >
                {site.name}
              </div>

              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--dim)',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <MapPin size={13} />
                {site.location ?? '-'}
              </div>

              <SiteOverview snapshot={snapshot ?? null} />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: 12,
                  marginTop: 12,
                  borderTop: '1px solid var(--border-color)',
                  fontSize: 12,
                  color: 'var(--dim2)',
                }}
              >
                <span>
                  สิทธิ์{' '}
                  <span
                    style={{
                      color: 'var(--text)',
                      fontWeight: 600,
                      textTransform: 'capitalize',
                    }}
                  >
                    {permission}
                  </span>
                </span>
                <span
                  style={{
                    color: 'var(--cyan)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    fontWeight: 600,
                  }}
                >
                  เข้าใช้งาน <ArrowRight size={14} />
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SummaryStat({
  Icon,
  iconColor,
  label,
  value,
  unit,
  sub,
  accent,
}: {
  Icon: typeof Zap;
  iconColor: string;
  label: string;
  value: string;
  unit?: string;
  sub: string;
  accent: string;
}) {
  return (
    <div
      className="fade-in-up"
      style={{
        position: 'relative',
        padding: 18,
        borderRadius: 16,
        background: 'var(--bg-card)',
        backgroundImage: 'var(--card-gradient)',
        border: '1px solid var(--border-color)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, ${accent}cc, transparent)`,
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: `${accent}1a`,
            border: `1px solid ${accent}33`,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon size={18} color={iconColor} />
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--dim)',
            fontWeight: 600,
            letterSpacing: '0.02em',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          fontSize: 26,
          fontWeight: 800,
          color: 'var(--text)',
          lineHeight: 1.1,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--dim)',
              marginLeft: 6,
            }}
          >
            {unit}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 11.5,
          color: 'var(--dim2)',
          marginTop: 6,
          fontWeight: 500,
        }}
      >
        {sub}
      </div>
    </div>
  );
}

function SiteOverview({ snapshot }: { snapshot: OverviewSnapshot | null }) {
  if (!snapshot || !snapshot.latest) {
    return (
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 10,
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          color: 'var(--dim2)',
          fontSize: 12,
          textAlign: 'center',
        }}
      >
        ยังไม่มีข้อมูล
      </div>
    );
  }

  const latest = snapshot.latest;
  const powerKw = snapshot.totalPower / 1000;
  const tempWarning = snapshot.maxTemp >= 40;
  const ago = dayjs(snapshot.lastSeenAt!).fromNow();

  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
          marginBottom: 8,
        }}
      >
        <Metric
          Icon={Zap}
          color="#facc15"
          label="แรงดัน"
          value={latest.voltage?.toFixed(1) ?? '-'}
          unit="V"
        />
        <Metric
          Icon={Activity}
          color="#06b6d4"
          label="กำลังรวม"
          value={powerKw.toFixed(3)}
          unit="kW"
        />
        <Metric
          Icon={Thermometer}
          color={tempWarning ? '#facc15' : '#22c55e'}
          label="อุณหภูมิ"
          value={snapshot.maxTemp > 0 ? snapshot.maxTemp.toFixed(1) : '-'}
          unit="°C"
          warning={tempWarning}
        />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 7,
          borderTop: '1px dashed var(--border-color)',
          fontSize: 11,
          color: 'var(--dim2)',
          fontWeight: 500,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Clock size={11} />
          {ago}
        </span>
        <span>{snapshot.liveSensorCount} sensor active</span>
      </div>
    </div>
  );
}

function Metric({
  Icon,
  color,
  label,
  value,
  unit,
  warning,
}: {
  Icon: typeof Zap;
  color: string;
  label: string;
  value: string;
  unit: string;
  warning?: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 10,
          color: 'var(--dim2)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
        }}
      >
        <Icon size={11} color={color} />
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 700,
          color: warning ? 'var(--yellow)' : 'var(--text)',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
        <span
          style={{
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--dim2)',
            marginLeft: 2,
          }}
        >
          {unit}
        </span>
      </div>
    </div>
  );
}
