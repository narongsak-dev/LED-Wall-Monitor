import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  Pencil,
  Trash2,
  Plug,
  MapPin,
  CircleDot,
  Ban,
  Power,
  ChevronRight,
} from 'lucide-react';
import { dayjs } from '@/lib/dayjs';
import { PageHeader } from '@/components/layout/PageHeader';
import { showToast } from '@/lib/toast';
import {
  useAdminSites,
  useCreateSite,
  useDeleteSite,
  useUpdateSite,
} from '@/features/sites/adminHooks';
import { useQuery } from '@tanstack/react-query';
import { fetchMySites } from '@/features/sites/api';
import { useRole } from '@/features/auth/roles';
import type {
  CreateSitePayload,
  Site,
  UpdateSitePayload,
} from '@monitor/shared';
import { SiteFormModal } from './SiteFormModal';

export function SitesManagementPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>(
    'all',
  );
  const [page, setPage] = useState(1);
  const perPage = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Site | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { isSuperAdmin } = useRole();

  // Super-admin gets every site through the admin endpoint; site-admin gets
  // their own assigned sites through the regular user endpoint (already
  // scoped by UserSite on the backend) and we flatten the wrapper here.
  const adminSitesQuery = useAdminSites({ enabled: isSuperAdmin });
  const mySitesQuery = useQuery({
    queryKey: ['sites', 'mine'],
    queryFn: fetchMySites,
    enabled: !isSuperAdmin,
  });
  const sites: Site[] = isSuperAdmin
    ? adminSitesQuery.data ?? []
    : (mySitesQuery.data ?? []).map((row) => row.site);
  const isLoading = isSuperAdmin ? adminSitesQuery.isLoading : mySitesQuery.isLoading;

  const createMut = useCreateSite();
  const updateMut = useUpdateSite();
  const deleteMut = useDeleteSite();

  const filtered = useMemo(() => {
    let data = sites;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (s) =>
          s.code.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.location ?? '').toLowerCase().includes(q),
      );
    }
    if (filterStatus === 'active') data = data.filter((s) => s.isActive);
    if (filterStatus === 'inactive') data = data.filter((s) => !s.isActive);
    return data;
  }, [sites, search, filterStatus]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  const stats = useMemo(() => {
    const total = sites.length;
    const active = sites.filter((s) => s.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [sites]);

  const handleSubmit = async (payload: CreateSitePayload | UpdateSitePayload) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload });
        showToast(`อัปเดต ${editing.code} เรียบร้อย`);
      } else {
        await createMut.mutateAsync(payload as CreateSitePayload);
        showToast('เพิ่มไซต์เรียบร้อย');
      }
      setModalOpen(false);
    } catch (err) {
      showToast((err as Error).message ?? 'บันทึกไม่สำเร็จ', 'error');
    }
  };

  const handleToggleActive = async (site: Site) => {
    try {
      await updateMut.mutateAsync({
        id: site.id,
        payload: { isActive: !site.isActive },
      });
      showToast(
        site.isActive ? `ปิดใช้งาน ${site.code}` : `เปิดใช้งาน ${site.code}`,
        'info',
      );
    } catch (err) {
      showToast((err as Error).message ?? 'เปลี่ยนสถานะไม่สำเร็จ', 'error');
    }
  };

  const handleDelete = async () => {
    if (deletingId == null) return;
    try {
      await deleteMut.mutateAsync(deletingId);
      showToast('ลบไซต์เรียบร้อย', 'info');
    } catch (err) {
      showToast((err as Error).message ?? 'ลบไม่สำเร็จ', 'error');
    }
    setDeletingId(null);
  };

  return (
    <div>
      <PageHeader
        title={isSuperAdmin ? 'จัดการไซต์ทั้งหมด' : 'ไซต์ของฉัน'}
        breadcrumb={isSuperAdmin ? 'จัดการไซต์' : 'ไซต์ของฉัน'}
        icon={Building2}
      />

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatBox
          icon={<Building2 size={22} color="#06b6d4" />}
          label="ไซต์ทั้งหมด"
          value={stats.total}
        />
        <StatBox
          icon={<CircleDot size={22} color="#22c55e" />}
          label="เปิดใช้งาน"
          value={stats.active}
        />
        <StatBox
          icon={<Ban size={22} color="#94a3b8" />}
          label="ปิดใช้งาน"
          value={stats.inactive}
        />
      </div>

      {/* Toolbar */}
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
            placeholder="ค้นหา (รหัส, ชื่อ, สถานที่...)"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
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
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as 'all' | 'active' | 'inactive');
              setPage(1);
            }}
            style={selectStyle}
          >
            <option value="all">ทุกสถานะ</option>
            <option value="active">เปิดใช้งาน</option>
            <option value="inactive">ปิดใช้งาน</option>
          </select>
          {isSuperAdmin && (
            <button
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              style={primaryBtnStyle}
            >
              <Plus size={16} />
              เพิ่มไซต์ใหม่
            </button>
          )}
        </div>
      </div>

      {/* Table */}
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
                <th style={thStyle}>#</th>
                <th style={thStyle}>รหัส</th>
                <th style={thStyle}>ชื่อไซต์</th>
                <th style={thStyle}>สถานที่</th>
                <th style={thStyle}>Timezone</th>
                <th style={thStyle}>สถานะ</th>
                <th style={thStyle}>วันที่สร้าง</th>
                <th style={{ ...thStyle, textAlign: 'center' }}>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={8} style={emptyStyle}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={emptyStyle}>
                    <Plug size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                    <div>ไม่พบไซต์</div>
                  </td>
                </tr>
              ) : (
                pageRows.map((s, i) => (
                  <tr
                    key={s.id}
                    onClick={() => navigate(`/admin/sites/${s.id}`)}
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--hover-bg)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, color: 'var(--dim)' }}>
                      {(page - 1) * perPage + i + 1}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--cyan)' }}>
                      {s.code}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{s.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--dim)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <MapPin size={13} />
                        {s.location ?? '-'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--dim)', fontSize: 12, fontFamily: 'monospace' }}>
                      {s.timezone}
                    </td>
                    <td style={tdStyle}>
                      <span
                        className={s.isActive ? 'badge badge-online' : 'badge badge-offline'}
                      >
                        {s.isActive ? (
                          <>
                            <CircleDot size={10} /> Active
                          </>
                        ) : (
                          <>
                            <Ban size={10} /> Inactive
                          </>
                        )}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--dim2)', fontSize: 12 }}>
                      {dayjs(s.createdAt).format('DD/MM/YYYY')}
                    </td>
                    <td
                      style={{ ...tdStyle, textAlign: 'center' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        {/* Toggle active + delete = super_admin only */}
                        {isSuperAdmin && (
                          <button
                            onClick={() => handleToggleActive(s)}
                            style={iconBtnStyle}
                            title={s.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                          >
                            <Power size={14} color={s.isActive ? '#22c55e' : '#94a3b8'} />
                          </button>
                        )}
                        {/* Edit = super_admin OR site_admin (own site) */}
                        <button
                          onClick={() => {
                            setEditing(s);
                            setModalOpen(true);
                          }}
                          style={iconBtnStyle}
                          title="แก้ไข"
                        >
                          <Pencil size={14} />
                        </button>
                        {isSuperAdmin && (
                          <button
                            onClick={() => setDeletingId(s.id)}
                            style={iconBtnStyle}
                            title="ลบ"
                          >
                            <Trash2 size={14} color="#ef4444" />
                          </button>
                        )}
                        <button
                          onClick={() => navigate(`/admin/sites/${s.id}`)}
                          style={iconBtnStyle}
                          title="ดูรายละเอียด"
                        >
                          <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
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
            แสดง {filtered.length === 0 ? 0 : (page - 1) * perPage + 1} –{' '}
            {Math.min(page * perPage, filtered.length)} จาก {filtered.length} รายการ
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 6,
                  border: `1px solid ${p === page ? 'var(--cyan)' : 'var(--border-color)'}`,
                  background: p === page ? 'var(--cyan)' : 'var(--bg-input)',
                  color: p === page ? '#fff' : 'var(--text)',
                  fontWeight: p === page ? 700 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <SiteFormModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={createMut.isPending || updateMut.isPending}
      />

      {/* Delete confirm */}
      {deletingId != null && (
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
          onClick={(e) => e.target === e.currentTarget && setDeletingId(null)}
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
            <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>ยืนยันการลบ</h3>
            <p style={{ color: 'var(--dim)', fontSize: 14 }}>
              ลบไซต์{' '}
              <strong style={{ color: 'var(--red)' }}>
                {sites.find((s) => s.id === deletingId)?.code}
              </strong>
              ?
              <br />
              อุปกรณ์และสิทธิ์ผู้ใช้ของไซต์นี้จะถูกลบด้วย
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setDeletingId(null)}
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

const selectStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  padding: '9px 12px',
  borderRadius: 8,
  fontSize: 14,
  fontFamily: 'inherit',
  cursor: 'pointer',
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
