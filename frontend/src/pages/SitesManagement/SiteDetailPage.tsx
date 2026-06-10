import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Cpu,
  Gauge,
  Plus,
  Pencil,
  Trash2,
  Power,
  Wifi,
  Plug,
  MapPin,
  CircleDot,
  Ban,
  ChevronRight,
  Map,
  Sigma,
} from 'lucide-react';
import { useTariff, useUpsertTariff } from '@/features/tariff/hooks';
import { dayjs } from '@/lib/dayjs';
import { PageHeader } from '@/components/layout/PageHeader';
import { showToast } from '@/lib/toast';
import { useSite } from '@/features/sites/detailHooks';
import { useAdminSites } from '@/features/sites/adminHooks';
import { useRole } from '@/features/auth/roles';
import {
  useBoards,
  useCreateBoard,
  useDeleteBoard,
  useUpdateBoard,
} from '@/features/boards/hooks';
import {
  useZones,
  useCreateZone,
  useUpdateZone,
  useDeleteZone,
} from '@/features/zones/hooks';
import type {
  BoardWithSensors,
  CreateBoardPayload,
  UpdateBoardPayload,
  Zone,
  CreateZonePayload,
  UpdateZonePayload,
} from '@monitor/shared';
import { BoardFormModal } from '../DevicesManagement/BoardFormModal';
import { ZoneFormModal } from './ZoneFormModal';

export function SiteDetailPage() {
  const { siteId } = useParams<{ siteId: string }>();
  const navigate = useNavigate();
  const siteIdNum = siteId ? Number(siteId) : NaN;

  const { isSuperAdmin } = useRole();
  // The single-site endpoint is open to any authenticated user; this avoids
  // pulling the whole admin site list (which only super-admin can access).
  const { data: site, isLoading: sitesLoading } = useSite(siteIdNum);
  // The board form needs a sites list for its <select>; super-admin gets the
  // global list, otherwise we synthesize a single-entry list from the site we
  // just loaded so the picker is pre-populated and locked.
  const adminSitesQuery = useAdminSites({ enabled: isSuperAdmin });
  const sites = isSuperAdmin
    ? adminSitesQuery.data ?? []
    : site
      ? [site]
      : [];
  const { data: boards = [], isLoading: boardsLoading } = useBoards(siteIdNum);
  const { data: zones = [] } = useZones(siteIdNum);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<BoardWithSensors | null>(null);
  const [deleting, setDeleting] = useState<BoardWithSensors | null>(null);
  const [zoneModalOpen, setZoneModalOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<Zone | null>(null);
  const [deletingZone, setDeletingZone] = useState<Zone | null>(null);
  const createMut = useCreateBoard();
  const updateMut = useUpdateBoard();
  const deleteMut = useDeleteBoard();
  const createZoneMut = useCreateZone();
  const updateZoneMut = useUpdateZone(siteIdNum);
  const deleteZoneMut = useDeleteZone(siteIdNum);

  const stats = useMemo(() => {
    const totalSensors = boards.reduce((acc, b) => acc + (b.sensors?.length ?? 0), 0);
    const online = boards.filter(
      (b) => b.lastSeenAt && dayjs().diff(b.lastSeenAt, 'minute') < 5,
    ).length;
    return {
      total: boards.length,
      online,
      sensors: totalSensors,
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

  const handleToggleActive = async (b: BoardWithSensors) => {
    try {
      await updateMut.mutateAsync({
        id: b.id,
        payload: { isActive: !b.isActive },
      });
      showToast(b.isActive ? `ปิดใช้งาน ${b.code}` : `เปิดใช้งาน ${b.code}`, 'info');
    } catch (err) {
      showToast((err as Error).message ?? 'เปลี่ยนสถานะไม่สำเร็จ', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMut.mutateAsync(deleting.id);
      showToast('ลบบอร์ดเรียบร้อย', 'info');
    } catch (err) {
      showToast((err as Error).message ?? 'ลบไม่สำเร็จ', 'error');
    }
    setDeleting(null);
  };

  const handleZoneSubmit = async (payload: CreateZonePayload | UpdateZonePayload) => {
    try {
      if (editingZone) {
        await updateZoneMut.mutateAsync({ id: editingZone.id, payload });
        showToast(`อัปเดตโซน ${editingZone.code} เรียบร้อย`);
      } else {
        await createZoneMut.mutateAsync(payload as CreateZonePayload);
        showToast('เพิ่มโซนเรียบร้อย');
      }
      setZoneModalOpen(false);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (err as Error).message ??
        'บันทึกไม่สำเร็จ';
      showToast(msg, 'error');
    }
  };

  const handleZoneDelete = async () => {
    if (!deletingZone) return;
    try {
      await deleteZoneMut.mutateAsync(deletingZone.id);
      showToast(`ลบโซน ${deletingZone.code} เรียบร้อย`, 'info');
    } catch (err) {
      showToast((err as Error).message ?? 'ลบไม่สำเร็จ', 'error');
    }
    setDeletingZone(null);
  };

  if (sitesLoading) {
    return <div style={{ padding: 40, color: 'var(--dim)' }}>กำลังโหลด...</div>;
  }
  if (!site) {
    return (
      <div style={{ padding: 40 }}>
        <PageHeader title="ไม่พบไซต์" breadcrumb="จัดการไซต์" icon={Building2} />
        <button onClick={() => navigate('/admin/sites')} style={primaryBtnStyle}>
          <ArrowLeft size={16} /> กลับไปรายการไซต์
        </button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={site.name}
        breadcrumb={`จัดการไซต์ / ${site.code}`}
        icon={Building2}
      />

      {/* Back link */}
      <button
        onClick={() => navigate('/admin/sites')}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--dim)',
          padding: '4px 0',
          cursor: 'pointer',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          marginBottom: 14,
        }}
      >
        <ArrowLeft size={14} /> รายการไซต์ทั้งหมด
      </button>

      {/* Site info card */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: 20,
          marginBottom: 18,
          boxShadow: 'var(--shadow-sm)',
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 16,
          alignItems: 'start',
        }}
      >
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 10,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontFamily: 'monospace',
                color: 'var(--cyan)',
                background: 'var(--bg-input)',
                padding: '3px 10px',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {site.code}
            </span>
            <span
              className={site.isActive ? 'badge badge-online' : 'badge badge-offline'}
            >
              {site.isActive ? (
                <>
                  <CircleDot size={10} /> Active
                </>
              ) : (
                <>
                  <Ban size={10} /> Inactive
                </>
              )}
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: 20, color: 'var(--text)' }}>{site.name}</h2>
          <div
            style={{
              display: 'flex',
              gap: 18,
              marginTop: 10,
              flexWrap: 'wrap',
              fontSize: 13,
              color: 'var(--dim)',
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <MapPin size={13} /> {site.location ?? '-'}
            </span>
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
              TZ: {site.timezone}
            </span>
            <span>สร้างเมื่อ {dayjs(site.createdAt).format('DD/MM/YYYY')}</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatBox
          icon={<Cpu size={22} color="#06b6d4" />}
          label="บอร์ดในไซต์"
          value={stats.total}
        />
        <StatBox
          icon={<Wifi size={22} color="#22c55e" />}
          label="ออนไลน์ (≤5 นาที)"
          value={stats.online}
        />
        <StatBox
          icon={<Gauge size={22} color="#a78bfa" />}
          label="เซ็นเซอร์รวม"
          value={stats.sensors}
        />
      </div>

      {/* Tariff settings */}
      <TariffSection siteId={siteIdNum} />

      {/* Zones section */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: 18,
          marginBottom: 18,
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              color: 'var(--text)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Map size={16} color="#22d3ee" /> โซนภายในไซต์
            <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}>
              ({zones.length})
            </span>
          </h3>
          <button
            onClick={() => {
              setEditingZone(null);
              setZoneModalOpen(true);
            }}
            style={{ ...primaryBtnStyle, padding: '7px 14px', fontSize: 13 }}
          >
            <Plus size={14} /> เพิ่มโซน
          </button>
        </div>

        {zones.length === 0 ? (
          <div style={{ color: 'var(--dim)', fontSize: 13, padding: '12px 4px' }}>
            ยังไม่มีโซน — เพิ่มโซนเพื่อจัดกลุ่มบอร์ดในไซต์ตามตำแหน่งจริง
            (เช่น ชั้น 1, ฮอลล์ A, โซนผลิต)
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {zones.map((z) => {
              const boardCount = boards.filter((b) => b.zoneId === z.id).length;
              return (
                <div
                  key={z.id}
                  style={{
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    minWidth: 220,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontWeight: 600,
                        color: 'var(--text)',
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ color: 'var(--cyan)', fontFamily: 'monospace' }}>
                        {z.code}
                      </span>
                      {!z.isActive && (
                        <span
                          style={{
                            fontSize: 10,
                            color: 'var(--dim)',
                            background: 'rgba(148,163,184,0.12)',
                            padding: '1px 7px',
                            borderRadius: 99,
                          }}
                        >
                          off
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>
                      {z.name} · {boardCount} บอร์ด
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button
                      onClick={() => {
                        setEditingZone(z);
                        setZoneModalOpen(true);
                      }}
                      style={{ ...iconBtnStyle, width: 28, height: 28 }}
                      title="แก้ไข"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={() => setDeletingZone(z)}
                      style={{ ...iconBtnStyle, width: 28, height: 28 }}
                      title="ลบ"
                    >
                      <Trash2 size={12} color="#ef4444" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Boards header + Add */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, color: 'var(--text)' }}>
          บอร์ดในไซต์นี้
        </h3>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          style={primaryBtnStyle}
        >
          <Plus size={16} /> เพิ่มบอร์ดใหม่
        </button>
      </div>

      {/* Boards table */}
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
                <th style={thStyle}>รหัส</th>
                <th style={thStyle}>ชื่อ</th>
                <th style={thStyle}>Hardware</th>
                <th style={thStyle}>Firmware</th>
                <th style={thStyle}>IP</th>
                <th style={thStyle}>เซ็นเซอร์</th>
                <th style={thStyle}>เห็นล่าสุด</th>
                <th style={thStyle}>สถานะ</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {boardsLoading ? (
                <tr>
                  <td colSpan={9} style={emptyStyle}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : boards.length === 0 ? (
                <tr>
                  <td colSpan={9} style={emptyStyle}>
                    <Plug size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <div>ยังไม่มีบอร์ดในไซต์นี้</div>
                    <button
                      onClick={() => {
                        setEditing(null);
                        setModalOpen(true);
                      }}
                      style={{ ...primaryBtnStyle, marginTop: 14 }}
                    >
                      <Plus size={16} /> เพิ่มบอร์ดแรก
                    </button>
                  </td>
                </tr>
              ) : (
                boards.map((b) => {
                  const online =
                    b.lastSeenAt && dayjs().diff(b.lastSeenAt, 'minute') < 5;
                  return (
                    <tr
                      key={b.id}
                      onClick={() => navigate(`/admin/devices/${b.id}`)}
                      style={{ cursor: 'pointer' }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--hover-bg)')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = 'transparent')
                      }
                    >
                      <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--cyan)' }}>
                        {b.code}
                      </td>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{b.name ?? '-'}</td>
                      <td style={{ ...tdStyle, color: 'var(--dim)', fontSize: 12 }}>
                        {b.hardware ?? '-'}
                      </td>
                      <td
                        style={{
                          ...tdStyle,
                          color: 'var(--dim)',
                          fontFamily: 'monospace',
                          fontSize: 12,
                        }}
                      >
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
                      <td style={{ ...tdStyle, color: 'var(--dim)' }}>
                        {b.sensors?.length ?? 0} ตัว
                      </td>
                      <td style={{ ...tdStyle, fontSize: 12, color: 'var(--dim2)' }}>
                        {b.lastSeenAt ? dayjs(b.lastSeenAt).fromNow() : '-'}
                      </td>
                      <td style={tdStyle}>
                        <span
                          className={online ? 'badge badge-online' : 'badge badge-offline'}
                        >
                          {online ? (
                            <>
                              <CircleDot size={10} /> Online
                            </>
                          ) : (
                            <>
                              <Ban size={10} /> Offline
                            </>
                          )}
                        </span>
                      </td>
                      <td
                        style={{ ...tdStyle, textAlign: 'center' }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                          <button
                            onClick={() => handleToggleActive(b)}
                            style={iconBtnStyle}
                            title={b.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          >
                            <Power
                              size={14}
                              color={b.isActive ? '#22c55e' : '#94a3b8'}
                            />
                          </button>
                          <button
                            onClick={() => {
                              setEditing(b);
                              setModalOpen(true);
                            }}
                            style={iconBtnStyle}
                            title="แก้ไข"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleting(b)}
                            style={iconBtnStyle}
                            title="ลบ"
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </button>
                          <button
                            onClick={() => navigate(`/admin/devices/${b.id}`)}
                            style={iconBtnStyle}
                            title="ดูรายละเอียด"
                          >
                            <ChevronRight size={14} />
                          </button>
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

      <BoardFormModal
        open={modalOpen}
        editing={editing}
        sites={sites}
        defaultSiteId={siteIdNum}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={createMut.isPending || updateMut.isPending}
      />

      <ZoneFormModal
        open={zoneModalOpen}
        siteId={siteIdNum}
        editing={editingZone}
        onClose={() => setZoneModalOpen(false)}
        onSubmit={handleZoneSubmit}
        submitting={createZoneMut.isPending || updateZoneMut.isPending}
      />

      {deletingZone && (
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
          onClick={(e) => e.target === e.currentTarget && setDeletingZone(null)}
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
            <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>ยืนยันการลบโซน</h3>
            <p style={{ color: 'var(--dim)', fontSize: 14 }}>
              ลบโซน <strong style={{ color: 'var(--red)' }}>{deletingZone.code}</strong>?
              <br />
              บอร์ดที่อยู่ในโซนนี้จะถูกย้ายออก (zone = ว่าง)
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setDeletingZone(null)}
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
                onClick={handleZoneDelete}
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

      {/* Delete confirm */}
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
              ลบบอร์ด <strong style={{ color: 'var(--red)' }}>{deleting.code}</strong>?
              <br />
              เซ็นเซอร์และ telemetry ของบอร์ดนี้จะถูกลบด้วย
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

const iconBtnStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  width: 32,
  height: 32,
  borderRadius: 8,
  cursor: 'pointer',
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px',
  background: 'var(--cyan)',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
};

// ─── Tariff section ───────────────────────────────────────────────
// Single flat THB/kWh rate per site. The Dashboard "ประมาณการค่าไฟ" card +
// the Report "ประมาณการค่าไฟ" card multiply this by the energy delta — so
// the value here drives every cost surface in the app. The `enabled`
// toggle lets the operator hide those cards without losing the rate.
function TariffSection({ siteId }: { siteId: number }) {
  const { data: tariff, isLoading } = useTariff(siteId);
  const upsert = useUpsertTariff(siteId);
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState('');
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Sync local form state when the underlying tariff loads / changes.
  const startEdit = () => {
    setRate(tariff?.rate?.toString() ?? '');
    setName(tariff?.name ?? '');
    // New tariffs default to enabled; preserve existing flag on edit.
    setEnabled(tariff?.enabled ?? true);
    setEditing(true);
  };
  const submit = async () => {
    // Blank input → Number("") is 0, but a 0-rate tariff is meaningless
    // (it would silently render a "free electricity" cost card). Treat
    // blank / non-numeric / non-positive as invalid and reject submit.
    const trimmed = rate.trim();
    const r = Number(trimmed);
    if (trimmed === '' || !Number.isFinite(r) || r <= 0) {
      showToast('กรอกอัตราค่าไฟเป็นตัวเลขมากกว่า 0', 'error');
      return;
    }
    try {
      await upsert.mutateAsync({
        rate: r,
        currency: 'THB',
        name: name || undefined,
        enabled,
      });
      showToast('บันทึกอัตราค่าไฟแล้ว', 'success');
      setEditing(false);
    } catch (err) {
      showToast((err as Error).message ?? 'บันทึกไม่สำเร็จ', 'error');
    }
  };
  // Quick toggle directly from read mode — no need to open the editor
  // just to flip enabled. Reuses the existing rate/name.
  const toggleEnabled = async () => {
    if (!tariff || tariff.rate <= 0) return;
    try {
      await upsert.mutateAsync({
        rate: tariff.rate,
        currency: tariff.currency,
        name: tariff.name ?? undefined,
        enabled: !tariff.enabled,
      });
      showToast(
        !tariff.enabled ? 'เปิดประมาณการค่าไฟแล้ว' : 'ปิดประมาณการค่าไฟแล้ว',
        'success',
      );
    } catch (err) {
      showToast((err as Error).message ?? 'บันทึกไม่สำเร็จ', 'error');
    }
  };

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        padding: 18,
        marginBottom: 18,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 12,
      }}>
        <h3 style={{
          margin: 0, fontSize: 14, color: 'var(--text)',
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
          <Sigma size={16} color="#facc15" /> อัตราค่าไฟ (Tariff)
          <span style={{ fontSize: 11, color: 'var(--dim)', fontWeight: 400 }}>
            ใช้คำนวณค่าไฟทั้งใน Dashboard และ Report
          </span>
        </h3>
        {!editing && (
          <button
            onClick={startEdit}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '7px 14px', borderRadius: 8,
              fontSize: 12.5, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <Pencil size={13} /> {tariff ? 'แก้ไข' : 'ตั้งค่า'}
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ color: 'var(--dim)', fontSize: 12 }}>กำลังโหลด...</div>
      ) : editing ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{
              display: 'block', fontSize: 10.5, color: 'var(--dim)',
              fontWeight: 600, marginBottom: 5,
              textTransform: 'uppercase', letterSpacing: 0.4,
            }}>
              ราคาต่อ kWh (บาท)
            </label>
            <input
              type="number" step="0.01" min="0.01" value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="4.50"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text)',
                padding: '8px 12px', borderRadius: 8, fontSize: 14,
                fontFamily: 'inherit', outline: 'none', width: 140,
              }}
            />
          </div>
          <div>
            <label style={{
              display: 'block', fontSize: 10.5, color: 'var(--dim)',
              fontWeight: 600, marginBottom: 5,
              textTransform: 'uppercase', letterSpacing: 0.4,
            }}>
              ชื่อเรียก (optional)
            </label>
            <input
              type="text" value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="TOU peak / off-peak / flat"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text)',
                padding: '8px 12px', borderRadius: 8, fontSize: 14,
                fontFamily: 'inherit', outline: 'none', width: 200,
              }}
            />
          </div>
          <label
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              fontSize: 12.5, color: 'var(--text)', fontWeight: 600,
              padding: '8px 12px', borderRadius: 8,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer', userSelect: 'none',
            }}
          >
            <input
              type="checkbox" checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            แสดงประมาณการค่าไฟ
          </label>
          <button
            onClick={submit}
            disabled={upsert.isPending}
            style={{
              background: 'var(--cyan)', border: 'none', color: '#000',
              padding: '9px 18px', borderRadius: 8,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >บันทึก</button>
          <button
            onClick={() => setEditing(false)}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '9px 14px', borderRadius: 8,
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >ยกเลิก</button>
        </div>
      ) : tariff ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 28, fontWeight: 700, color: 'var(--text)',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {tariff.rate.toFixed(2)}
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--dim)', marginLeft: 6 }}>
              {tariff.currency}/kWh
            </span>
          </span>
          {tariff.name && (
            <span style={{ fontSize: 12, color: 'var(--dim)' }}>· {tariff.name}</span>
          )}
          <button
            onClick={toggleEnabled}
            disabled={upsert.isPending}
            title={tariff.enabled
              ? 'กำลังแสดงการ์ดประมาณการค่าไฟใน Dashboard / Report — กดเพื่อปิด'
              : 'ปิดอยู่ — กดเพื่อเปิดการ์ดประมาณการค่าไฟ'}
            style={{
              marginLeft: 'auto',
              background: tariff.enabled ? 'rgba(34,197,94,0.12)' : 'var(--bg-input)',
              border: `1px solid ${tariff.enabled ? 'rgba(34,197,94,0.45)' : 'var(--border-color)'}`,
              color: tariff.enabled ? '#22c55e' : 'var(--dim)',
              padding: '6px 12px', borderRadius: 999,
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{
              display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
              background: tariff.enabled ? '#22c55e' : 'var(--dim)',
            }} />
            {tariff.enabled ? 'ประมาณการค่าไฟ: เปิด' : 'ประมาณการค่าไฟ: ปิด'}
          </button>
        </div>
      ) : (
        <div style={{
          color: 'var(--dim)', fontSize: 13,
          padding: '6px 0',
        }}>
          ยังไม่ได้ตั้งอัตราค่าไฟ — ตั้งค่าเพื่อให้ Dashboard และ Report แสดงค่าไฟโดยประมาณ
        </div>
      )}
    </div>
  );
}
