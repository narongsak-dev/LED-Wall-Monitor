import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu,
  Gauge,
  Wifi,
  Search,
  Plug,
  CircleDot,
  Plus,
  Pencil,
  Trash2,
  Power,
  Info,
  Upload,
} from 'lucide-react';
import { dayjs } from '@/lib/dayjs';
import { PageHeader } from '@/components/layout/PageHeader';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/features/auth/store';
import {
  useBoards,
  useCreateBoard,
  useDeleteBoard,
  useUpdateBoard,
} from '@/features/boards/hooks';
import { useAdminSites } from '@/features/sites/adminHooks';
import { useZones } from '@/features/zones/hooks';
import type {
  BoardWithSensors,
  CreateBoardPayload,
  UpdateBoardPayload,
} from '@monitor/shared';
import { BoardFormModal } from './BoardFormModal';
import { BoardOtaModal } from './BoardOtaModal';

// Mirror the sensor classifier in SensorFormModal so the badges in the
// list line up with what the form accepts.
type SensorKindBadge = 'PZEM' | 'KWS-1P' | 'KWS-3P';
function classifySensor(model: string | null | undefined): SensorKindBadge | null {
  if (!model) return null;
  const m = model.toUpperCase();
  if (m.startsWith('PZEM')) return 'PZEM';
  if (m.includes('3P') || m.includes('THREE')) return 'KWS-3P';
  if (m.startsWith('KWS')) return 'KWS-1P';
  return null;
}
const SENSOR_BADGE_COLOR: Record<SensorKindBadge, string> = {
  'PZEM':   '#06b6d4',
  'KWS-1P': '#a78bfa',
  'KWS-3P': '#facc15',
};

// Three-state freshness per spec:
//   online  ≤ 30 s   → green
//   stale   30 s – 5 m → yellow
//   offline > 5 m     → red
function boardFreshness(lastSeenAt?: string | null): 'online' | 'stale' | 'offline' | 'never' {
  if (!lastSeenAt) return 'never';
  const ageMin = dayjs().diff(lastSeenAt, 'minute', true);
  if (ageMin < 0.5) return 'online';
  if (ageMin < 5)   return 'stale';
  return 'offline';
}

export function DevicesManagementPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const [search, setSearch] = useState('');
  const [filterSite, setFilterSite] = useState<number | 'all'>('all');
  const [filterZone, setFilterZone] = useState<number | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BoardWithSensors | null>(null);
  const [deleting, setDeleting] = useState<BoardWithSensors | null>(null);
  const [otaTarget, setOtaTarget] = useState<BoardWithSensors | null>(null);
  const { data: sites = [] } = useAdminSites();
  const { data: zones = [] } = useZones(filterSite === 'all' ? null : filterSite);
  const { data: boards = [], isLoading } = useBoards(
    filterSite === 'all' ? undefined : filterSite,
  );
  // Reset zone filter when the site changes so we don't keep a stale value.
  useEffect(() => { setFilterZone('all'); }, [filterSite]);
  const zoneById = useMemo(
    () => new Map(zones.map((z) => [z.id, z])),
    [zones],
  );
  const createMut = useCreateBoard();
  const updateMut = useUpdateBoard();
  const deleteMut = useDeleteBoard();

  const filtered = useMemo(() => {
    return boards.filter((b) => {
      if (filterZone !== 'all' && (b.zoneId ?? null) !== filterZone) return false;
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        b.code.toLowerCase().includes(q) ||
        (b.name ?? '').toLowerCase().includes(q) ||
        (b.hardware ?? '').toLowerCase().includes(q) ||
        (b.siteCode ?? '').toLowerCase().includes(q)
      );
    });
  }, [boards, search, filterZone]);

  const stats = useMemo(() => {
    const totalSensors = boards.reduce((acc, b) => acc + (b.sensors?.length ?? 0), 0);
    const online = boards.filter((b) => {
      if (!b.lastSeenAt) return false;
      return dayjs().diff(b.lastSeenAt, 'minute') < 5;
    }).length;
    return {
      total: boards.length,
      online,
      sensors: totalSensors,
      active: boards.filter((b) => b.isActive).length,
    };
  }, [boards]);

  const handleSubmit = async (payload: CreateBoardPayload | UpdateBoardPayload) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload });
        showToast(`อัปเดต ${editing.code} เรียบร้อย`);
      } else {
        await createMut.mutateAsync(payload as CreateBoardPayload);
        showToast('เพิ่มบอร์ดเรียบร้อย');
      }
      setModalOpen(false);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (err as Error).message ??
        'บันทึกไม่สำเร็จ';
      showToast(msg, 'error');
    }
  };

  const handleToggle = async (b: BoardWithSensors) => {
    try {
      await updateMut.mutateAsync({ id: b.id, payload: { isActive: !b.isActive } });
      showToast(b.isActive ? `ปิด ${b.code}` : `เปิด ${b.code}`, 'info');
    } catch (err) {
      showToast((err as Error).message ?? 'เปลี่ยนสถานะไม่สำเร็จ', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      showToast(`ลบ ${deleting.code} แล้ว`, 'info');
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        'ลบไม่สำเร็จ (อาจมีเซ็นเซอร์ผูกอยู่)';
      showToast(msg, 'error');
    }
    setDeleting(null);
  };

  return (
    <div>
      <PageHeader
        title="จัดการอุปกรณ์"
        breadcrumb="บอร์ดควบคุม + เซ็นเซอร์"
        icon={Cpu}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatBox icon={<Cpu size={22} color="#06b6d4" />} label="บอร์ดทั้งหมด" value={stats.total} />
        <StatBox icon={<Wifi size={22} color="#22c55e" />} label="ออนไลน์ (≤5 นาที)" value={stats.online} />
        <StatBox icon={<Gauge size={22} color="#a78bfa" />} label="เซ็นเซอร์รวม" value={stats.sensors} />
        <StatBox icon={<CircleDot size={22} color="#f59e0b" />} label="เปิดใช้งาน" value={stats.active} />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
          <Search
            size={16}
            color="#8b949e"
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="ค้นหา (รหัส, ชื่อ, ฮาร์ดแวร์, ไซต์...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '9px 12px 9px 36px',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={filterSite}
            onChange={(e) =>
              setFilterSite(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '9px 12px',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'inherit',
              cursor: 'pointer',
            }}
          >
            <option value="all">ทุกไซต์</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code} · {s.name}
              </option>
            ))}
          </select>

          {/* Zone filter — only meaningful when a specific site is selected.
              Hidden otherwise so the user isn't picking zones across sites. */}
          {filterSite !== 'all' && zones.length > 0 && (
            <select
              value={filterZone}
              onChange={(e) =>
                setFilterZone(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                color: 'var(--text)',
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              <option value="all">ทุกโซน</option>
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} · {z.name}
                </option>
              ))}
            </select>
          )}

          {/* Firmware catalog — super_admin only. Lives in this header so the
              menu only shows where it's contextually relevant (managing
              boards), not as a sibling tab in the global sidebar. */}
          {isSuperAdmin && (
            <button
              onClick={() => navigate('/admin/firmware')}
              style={{
                padding: '9px 16px',
                background: 'var(--bg-card)',
                color: 'var(--text)',
                border: '1px solid var(--border-color)',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'inherit',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
              title="จัดการคลังไฟล์เฟิร์มแวร์สำหรับบอร์ด"
            >
              <Upload size={16} />
              Firmware
            </button>
          )}
          <button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
            disabled={sites.length === 0}
            style={{
              padding: '9px 18px',
              background: 'var(--cyan)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: sites.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              opacity: sites.length === 0 ? 0.5 : 1,
            }}
            title={sites.length === 0 ? 'สร้างไซต์ก่อนเพิ่มบอร์ด' : 'เพิ่มบอร์ดใหม่'}
          >
            <Plus size={16} />
            เพิ่มบอร์ด
          </button>
        </div>
      </div>

      {sites.length === 0 && (
        <div
          style={{
            padding: 16,
            background: 'rgba(245, 158, 11, 0.08)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderRadius: 10,
            marginBottom: 18,
            color: '#f59e0b',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Info size={16} />
          ยังไม่มีไซต์ — กรุณาสร้างไซต์ในเมนู "จัดการไซต์" ก่อน
        </div>
      )}

      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr>
                <th style={thStyle}>รหัสบอร์ด</th>
                <th style={thStyle}>ชื่อ</th>
                <th style={thStyle}>Firmware</th>
                <th style={thStyle}>IP</th>
                <th style={thStyle}>เซ็นเซอร์</th>
                <th style={thStyle}>โซน</th>
                <th style={thStyle}>ไซต์</th>
                <th style={thStyle}>เห็นล่าสุด</th>
                <th style={thStyle}>สถานะ</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={10} style={emptyStyle}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={emptyStyle}>
                    <Plug size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <div>{boards.length === 0 ? 'ยังไม่มีบอร์ด' : 'ไม่พบที่ค้นหา'}</div>
                  </td>
                </tr>
              ) : (
                filtered.map((b) => {
                  const fresh = boardFreshness(b.lastSeenAt);
                  const zone = b.zoneId != null ? zoneById.get(b.zoneId) : null;
                  // Group sensor models into the three families so the badges
                  // are stable even when the model strings vary slightly.
                  const sensorKinds = (b.sensors ?? [])
                    .map((s) => classifySensor(s.model))
                    .filter(Boolean) as SensorKindBadge[];
                  return (
                    <tr
                      key={b.id}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--hover-bg)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <td
                        style={{ ...tdStyle, fontWeight: 700, color: 'var(--cyan)', cursor: 'pointer' }}
                        onClick={() => navigate(`/admin/devices/${b.id}`)}
                      >
                        {b.code}
                      </td>
                      <td style={{ ...tdStyle, cursor: 'pointer' }} onClick={() => navigate(`/admin/devices/${b.id}`)}>
                        {b.name ?? '-'}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--dim)', fontSize: 12 }}>
                        {b.firmware ?? '-'}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: 'var(--dim)',
                          fontFamily: 'monospace',
                          fontSize: 12,
                        }}
                      >
                        {b.ipAddress ?? '-'}
                      </td>
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {sensorKinds.length === 0 && (
                            <span style={{
                              fontSize: 11, color: 'var(--dim2)', fontStyle: 'italic',
                            }}>ยังไม่มี</span>
                          )}
                          {sensorKinds.map((k, i) => (
                            <span
                              key={`${k}-${i}`}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 6,
                                background: `${SENSOR_BADGE_COLOR[k]}1f`,
                                color: SENSOR_BADGE_COLOR[k],
                                fontSize: 10.5,
                                fontWeight: 700,
                                border: `1px solid ${SENSOR_BADGE_COLOR[k]}40`,
                                letterSpacing: '.03em',
                              }}
                            >{k}</span>
                          ))}
                          <span style={{
                            fontSize: 10, color: 'var(--dim2)',
                            alignSelf: 'center', marginLeft: 2,
                          }}>
                            {sensorKinds.length}/2
                          </span>
                        </div>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--dim)', fontSize: 12 }}>
                        {zone ? (
                          <span>
                            <strong style={{ color: 'var(--text)' }}>{zone.code}</strong>
                            <span style={{ color: 'var(--dim2)' }}> · {zone.name}</span>
                          </span>
                        ) : (
                          <span style={{ color: 'var(--dim2)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--dim)' }}>
                        <div style={{ fontSize: 13 }}>{b.siteName}</div>
                        <div style={{ fontSize: 11, color: 'var(--dim2)' }}>{b.siteCode}</div>
                      </td>
                      <td style={{ ...tdStyle, color: 'var(--dim2)', fontSize: 12 }}>
                        {b.lastSeenAt ? dayjs(b.lastSeenAt).fromNow() : 'ยังไม่เคยส่งข้อมูล'}
                      </td>
                      <td style={tdStyle}>
                        <FreshnessBadge state={fresh} />
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                          <IconBtn
                            title={b.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                            color={b.isActive ? '#22c55e' : '#94a3b8'}
                            onClick={() => handleToggle(b)}
                          >
                            <Power size={14} />
                          </IconBtn>
                          {isSuperAdmin && (
                            <IconBtn
                              title="อัปเดตเฟิร์มแวร์"
                              color="var(--cyan)"
                              onClick={() => setOtaTarget(b)}
                            >
                              <Upload size={14} />
                            </IconBtn>
                          )}
                          <IconBtn
                            title="แก้ไข"
                            onClick={() => {
                              setEditing(b);
                              setModalOpen(true);
                            }}
                          >
                            <Pencil size={14} />
                          </IconBtn>
                          <IconBtn
                            title="ลบ"
                            color="#ef4444"
                            onClick={() => setDeleting(b)}
                          >
                            <Trash2 size={14} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <BoardOtaModal board={otaTarget} onClose={() => setOtaTarget(null)} />

      <BoardFormModal
        open={modalOpen}
        editing={editing}
        sites={sites}
        defaultSiteId={filterSite === 'all' ? undefined : filterSite}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={createMut.isPending || updateMut.isPending}
      />

      {deleting && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={(e) => e.target === e.currentTarget && setDeleting(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: 28,
              width: 420,
              textAlign: 'center',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <Trash2 size={48} color="#ef4444" style={{ marginBottom: 12 }} />
            <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>ยืนยันการลบบอร์ด</h3>
            <p style={{ color: 'var(--dim)', fontSize: 14 }}>
              ลบบอร์ด <strong style={{ color: 'var(--red)' }}>{deleting.code}</strong>
              ?<br />
              {deleting.sensors && deleting.sensors.length > 0 && (
                <span style={{ color: 'var(--yellow)' }}>
                  ⚠ ต้องลบเซ็นเซอร์ {deleting.sensors.length} ตัวก่อน
                </span>
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setDeleting(null)}
                style={{
                  padding: '9px 18px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text)',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                style={{
                  padding: '9px 18px',
                  background: 'var(--red)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ลบเลย
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 10,
          background: 'var(--bg-input)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
      </div>
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        color: color ?? 'var(--text)',
        width: 32,
        height: 32,
        borderRadius: 8,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

const thStyle: React.CSSProperties = {
  background: 'var(--th-bg)',
  color: 'var(--dim)',
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid var(--border-color)',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid var(--border-color)',
  verticalAlign: 'middle',
};

const emptyStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  color: 'var(--dim)',
  padding: '40px 20px',
};

// Three-state freshness pill — matches the rules engine's thresholds so
// the column reads consistently with what triggers backend alerts.
function FreshnessBadge({ state }: { state: 'online' | 'stale' | 'offline' | 'never' }) {
  const v = state === 'online'  ? { c: 'var(--green)',  bg: 'rgba(34,197,94,0.1)',  br: 'rgba(34,197,94,0.3)',  l: 'Online'  }
          : state === 'stale'   ? { c: 'var(--yellow)', bg: 'rgba(250,204,21,0.1)', br: 'rgba(250,204,21,0.3)', l: 'Stale'   }
          : state === 'offline' ? { c: 'var(--red)',    bg: 'rgba(239,68,68,0.1)',  br: 'rgba(239,68,68,0.3)',  l: 'Offline' }
          :                       { c: 'var(--dim)',    bg: 'rgba(148,163,184,0.1)',br: 'rgba(148,163,184,0.3)',l: 'ไม่เคย' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 999,
      background: v.bg, border: `1px solid ${v.br}`, color: v.c,
      fontSize: 11, fontWeight: 700, letterSpacing: '.04em',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: v.c, display: 'inline-block',
      }} />
      {v.l}
    </span>
  );
}
