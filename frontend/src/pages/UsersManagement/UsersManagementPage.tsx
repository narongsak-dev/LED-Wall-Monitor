import { useMemo, useState } from 'react';
import {
  Users,
  Crown,
  CheckCircle,
  Eye,
  Search,
  Plus,
  Pencil,
  Trash2,
  Plug,
  User,
  CircleDot,
  Ban,
  KeyRound,
  History,
  ShieldQuestion,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dayjs } from '@/lib/dayjs';
import { PageHeader } from '@/components/layout/PageHeader';
import { showToast } from '@/lib/toast';
import { useAuthStore } from '@/features/auth/store';
import {
  useAllSites,
  useCreateUser,
  useDeleteUser,
  useResetUserPassword,
  useUpdateUser,
  useUsers,
} from '@/features/users/hooks';
import { usePendingResets } from '@/features/password-reset/hooks';
import { copyToClipboard } from '@/lib/clipboard';
import type {
  CreateUserPayload,
  UpdateUserPayload,
  UserRole,
  UserWithPermissions,
} from '@monitor/shared';
import { UserFormModal } from './UserFormModal';
import { UserDetailModal } from './UserDetailModal';

export function UsersManagementPage() {
  const currentUser = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<UserRole | ''>('');
  const [page, setPage] = useState(1);
  const perPage = 8;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserWithPermissions | null>(null);
  const [viewing, setViewing] = useState<UserWithPermissions | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [resettingUser, setResettingUser] = useState<UserWithPermissions | null>(
    null,
  );
  const [resetResult, setResetResult] = useState<{ username: string; newPassword: string } | null>(
    null,
  );

  const { data: users = [], isLoading } = useUsers();
  const { data: sites = [] } = useAllSites();
  // Pending reset-approvals count — drives the badge on the "คำขอตั้งรหัสผ่าน" button.
  const canApprove = !!currentUser && currentUser.role !== 'viewer';
  const { data: pendingResets = [] } = usePendingResets(canApprove);
  const createMut = useCreateUser();
  const updateMut = useUpdateUser();
  const deleteMut = useDeleteUser();
  const resetMut = useResetUserPassword();

  const filtered = useMemo(() => {
    let data = users;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (u) =>
          u.username.toLowerCase().includes(q) ||
          (u.fullName ?? '').toLowerCase().includes(q) ||
          (u.email ?? '').toLowerCase().includes(q),
      );
    }
    if (filterRole) data = data.filter((u) => u.role === filterRole);
    return data;
  }, [users, search, filterRole]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageRows = filtered.slice((page - 1) * perPage, page * perPage);

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(
      (u) => u.role === 'super_admin' || u.role === 'site_admin',
    ).length;
    const active = users.filter((u) => u.isActive).length;
    const viewers = users.filter((u) => u.role === 'viewer').length;
    return { total, admins, active, viewers };
  }, [users]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (user: UserWithPermissions) => {
    setEditing(user);
    setModalOpen(true);
  };

  const handleSubmit = async (payload: CreateUserPayload | UpdateUserPayload) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload });
        showToast(`อัปเดต ${editing.username} เรียบร้อย`);
      } else {
        await createMut.mutateAsync(payload as CreateUserPayload);
        showToast('เพิ่มผู้ใช้เรียบร้อย');
      }
      setModalOpen(false);
    } catch (err) {
      showToast((err as Error).message ?? 'บันทึกไม่สำเร็จ', 'error');
    }
  };

  const handleDelete = async () => {
    if (deletingId == null) return;
    try {
      await deleteMut.mutateAsync(deletingId);
      showToast('ลบผู้ใช้เรียบร้อย', 'info');
    } catch (err) {
      showToast((err as Error).message ?? 'ลบไม่สำเร็จ', 'error');
    }
    setDeletingId(null);
  };

  const handleResetPassword = async () => {
    if (!resettingUser) return;
    try {
      const { newPassword } = await resetMut.mutateAsync(resettingUser.id);
      setResetResult({ username: resettingUser.username, newPassword });
      setResettingUser(null);
    } catch (err) {
      const e = err as { response?: { data?: { message?: string } } };
      showToast(e?.response?.data?.message ?? 'ตั้งรหัสใหม่ไม่สำเร็จ', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="จัดการผู้ใช้"
        breadcrumb={
          currentUser?.role === 'site_admin'
            ? 'จัดการผู้ใช้ในไซต์ที่คุณดูแล'
            : 'จัดการผู้ใช้และสิทธิ์'
        }
        icon={Users}
      />

      {/* Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 180px), 1fr))',
          gap: 14,
          marginBottom: 22,
        }}
      >
        <StatBox
          icon={<Users size={26} color="#22d3ee" />}
          label="ผู้ใช้ทั้งหมด"
          value={stats.total}
          color="var(--cyan)"
        />
        <StatBox
          icon={<Crown size={26} color="#facc15" />}
          label="Admin"
          value={stats.admins}
          color="var(--yellow)"
        />
        <StatBox
          icon={<CheckCircle size={26} color="#4ade80" />}
          label="Active"
          value={stats.active}
          color="var(--green)"
        />
        <StatBox
          icon={<Eye size={26} color="#a78bfa" />}
          label="Viewer"
          value={stats.viewers}
          color="#a78bfa"
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
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
            }}
          />
          <input
            type="text"
            placeholder="ค้นหาผู้ใช้ (ชื่อ, อีเมล...)"
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
              fontFamily: 'Sarabun, sans-serif',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            value={filterRole}
            onChange={(e) => {
              setFilterRole(e.target.value as UserRole | '');
              setPage(1);
            }}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '9px 12px',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'Sarabun, sans-serif',
              cursor: 'pointer',
            }}
          >
            <option value="">ทุกบทบาท</option>
            <option value="super_admin">Super Admin</option>
            <option value="site_admin">Site Admin</option>
            <option value="viewer">Viewer</option>
          </select>
          {canApprove && (
            <button
              onClick={() => navigate('/admin/password-resets')}
              style={{
                position: 'relative',
                padding: '9px 16px',
                background:
                  pendingResets.length > 0
                    ? 'rgba(250, 204, 21, 0.10)'
                    : 'var(--bg-card)',
                color: 'var(--text)',
                border: `1px solid ${
                  pendingResets.length > 0 ? 'var(--yellow)' : 'var(--border-color)'
                }`,
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                fontFamily: 'Sarabun, sans-serif',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
              title="ดูคำขอที่รออนุมัติและประวัติทั้งหมด"
            >
              <ShieldQuestion size={16} />
              คำขอตั้งรหัสผ่าน
              {pendingResets.length > 0 && (
                <span
                  style={{
                    background: 'var(--yellow)',
                    color: '#000',
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '1px 8px',
                    borderRadius: 10,
                  }}
                >
                  {pendingResets.length}
                </span>
              )}
            </button>
          )}
          <button
            onClick={openCreate}
            style={{
              padding: '9px 18px',
              background: 'var(--cyan)',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'Sarabun, sans-serif',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Plus size={16} />
            เพิ่มผู้ใช้ใหม่
          </button>
        </div>
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
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
            <thead>
              <tr>
                <th style={thStyle}>#</th>
                <th style={thStyle}>ชื่อผู้ใช้</th>
                <th style={thStyle}>ชื่อ-นามสกุล</th>
                <th style={thStyle}>อีเมล</th>
                <th style={thStyle}>เบอร์โทร</th>
                <th style={thStyle}>บทบาท</th>
                <th style={thStyle}>สถานะ</th>
                <th style={thStyle}>สิทธิ์ไซต์</th>
                <th style={thStyle}>อัปเดต</th>
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
              ) : pageRows.length === 0 ? (
                <tr>
                  <td colSpan={10} style={emptyStyle}>
                    <Plug
                      size={32}
                      color="#8b949e"
                      style={{ marginBottom: 8, display: 'inline-block' }}
                    />
                    <div>ไม่พบข้อมูลผู้ใช้</div>
                  </td>
                </tr>
              ) : (
                pageRows.map((u, i) => (
                  <tr
                    key={u.id}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, color: 'var(--dim)' }}>
                      {(page - 1) * perPage + i + 1}
                    </td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: 'var(--cyan)' }}>
                      <button
                        type="button"
                        onClick={() => setViewing(u)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--cyan)',
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                          fontSize: 'inherit',
                          fontWeight: 600,
                        }}
                        title="ดูรายละเอียดผู้ใช้"
                      >
                        {u.username}
                      </button>
                      {u.id === currentUser?.id && (
                        <span
                          style={{
                            fontSize: 10,
                            marginLeft: 6,
                            padding: '1px 6px',
                            borderRadius: 8,
                            border: '1px solid var(--yellow)',
                            color: 'var(--yellow)',
                          }}
                        >
                          คุณ
                        </span>
                      )}
                    </td>
                    <td style={tdStyle}>{u.fullName ?? '-'}</td>
                    <td style={{ ...tdStyle, color: 'var(--dim)' }}>{u.email ?? '-'}</td>
                    <td style={{ ...tdStyle, color: 'var(--dim)', fontFamily: 'monospace', fontSize: 12.5 }}>
                      {u.phoneNumber ?? '-'}
                    </td>
                    <td style={tdStyle}>{roleBadge(u.role)}</td>
                    <td style={tdStyle}>
                      <span
                        className={u.isActive ? 'badge badge-online' : 'badge badge-offline'}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {u.isActive ? (
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
                    <td style={{ ...tdStyle, color: 'var(--dim)', fontSize: 12 }}>
                      {u.sitePermissions.length === 0 ? (
                        <span style={{ color: 'var(--dim2)' }}>ไม่มี</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {u.sitePermissions.slice(0, 3).map((p) => (
                            <span
                              key={p.siteId}
                              style={{
                                padding: '2px 8px',
                                borderRadius: 10,
                                border: '1px solid var(--border-color)',
                                fontSize: 11,
                                color: 'var(--cyan)',
                              }}
                              title={`${p.siteCode}: ${p.permission}`}
                            >
                              {p.siteCode}
                            </span>
                          ))}
                          {u.sitePermissions.length > 3 && (
                            <span style={{ fontSize: 11 }}>
                              +{u.sitePermissions.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--dim2)', fontSize: 12 }}>
                      {dayjs(u.updatedAt).format('DD/MM/YYYY HH:mm')}
                    </td>
                    <td style={{ ...tdStyle, textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
                        <button
                          onClick={() => openEdit(u)}
                          style={iconBtnStyle('var(--cyan)')}
                          title="แก้ไข"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          onClick={() =>
                            navigate(`/admin/password-resets?userId=${u.id}`)
                          }
                          style={iconBtnStyle('var(--cyan)')}
                          title="ดูประวัติคำขอตั้งรหัสผ่าน"
                        >
                          <History size={14} />
                        </button>
                        <button
                          onClick={() => u.id !== currentUser?.id && setResettingUser(u)}
                          disabled={u.id === currentUser?.id}
                          style={{
                            ...iconBtnStyle('var(--yellow)'),
                            opacity: u.id === currentUser?.id ? 0.3 : 1,
                            cursor:
                              u.id === currentUser?.id ? 'not-allowed' : 'pointer',
                          }}
                          title={
                            u.id === currentUser?.id
                              ? 'ใช้หน้าตั้งค่าเพื่อเปลี่ยนรหัสตัวเอง'
                              : 'ตั้งรหัสผ่านใหม่ (สุ่มทันที)'
                          }
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          onClick={() => u.id !== currentUser?.id && setDeletingId(u.id)}
                          disabled={u.id === currentUser?.id}
                          style={{
                            ...iconBtnStyle('var(--red)'),
                            opacity: u.id === currentUser?.id ? 0.3 : 1,
                            cursor:
                              u.id === currentUser?.id ? 'not-allowed' : 'pointer',
                          }}
                          title={u.id === currentUser?.id ? 'ไม่สามารถลบตัวเองได้' : 'ลบ'}
                        >
                          <Trash2 size={14} />
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
                  color: p === page ? '#000' : 'var(--text)',
                  fontWeight: p === page ? 700 : 400,
                  cursor: 'pointer',
                  fontFamily: 'Sarabun, sans-serif',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Detail modal — opens when username is clicked. Has its own
          Edit / Reset buttons that flip into the relevant flow. */}
      <UserDetailModal
        user={viewing}
        actorRole={currentUser?.role ?? 'viewer'}
        isSelf={viewing?.id === currentUser?.id}
        onClose={() => setViewing(null)}
        onEdit={() => {
          if (viewing) {
            openEdit(viewing);
            setViewing(null);
          }
        }}
        onResetPassword={() => {
          if (viewing) {
            setResettingUser(viewing);
            setViewing(null);
          }
        }}
      />

      {/* Form modal */}
      <UserFormModal
        open={modalOpen}
        editing={editing}
        sites={sites}
        actorRole={currentUser?.role ?? 'viewer'}
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
              width: 400,
              textAlign: 'center',
            }}
          >
            <Trash2 size={48} color="#f87171" style={{ marginBottom: 12 }} />
            <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>ยืนยันการลบ</h3>
            <p style={{ color: 'var(--dim)', fontSize: 14 }}>
              คุณแน่ใจหรือไม่ที่จะลบผู้ใช้ <br />
              <strong style={{ color: 'var(--red)' }}>
                {users.find((u) => u.id === deletingId)?.username}
              </strong>
              ? ข้อมูลจะถูกลบและไม่สามารถกู้คืนได้
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setDeletingId(null)}
                style={{
                  padding: '9px 18px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text)',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Sarabun, sans-serif',
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
                  color: '#000',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Sarabun, sans-serif',
                }}
              >
                ลบเลย
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset password confirm */}
      {resettingUser && (
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
          onClick={(e) => e.target === e.currentTarget && setResettingUser(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: 28,
              width: 420,
              textAlign: 'center',
            }}
          >
            <KeyRound size={44} color="#facc15" style={{ marginBottom: 12 }} />
            <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>
              ตั้งรหัสผ่านใหม่
            </h3>
            <p style={{ color: 'var(--dim)', fontSize: 14, lineHeight: 1.55 }}>
              ระบบจะสุ่มรหัสผ่านใหม่ให้กับ
              <br />
              <strong style={{ color: 'var(--cyan)' }}>{resettingUser.username}</strong>
              <br />
              รหัสเดิมจะใช้ไม่ได้ทันที — แสดงครั้งเดียวเท่านั้น
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setResettingUser(null)}
                disabled={resetMut.isPending}
                style={{
                  padding: '9px 18px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text)',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Sarabun, sans-serif',
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetMut.isPending}
                style={{
                  padding: '9px 18px',
                  background: 'var(--yellow)',
                  border: 'none',
                  color: '#000',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Sarabun, sans-serif',
                }}
              >
                {resetMut.isPending ? 'กำลังตั้งรหัสใหม่...' : 'ตั้งรหัสใหม่'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset result modal (shows the generated password once) */}
      {resetResult && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            backdropFilter: 'blur(4px)',
            zIndex: 1001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: 28,
              width: 460,
              textAlign: 'center',
            }}
          >
            <KeyRound size={44} color="#4ade80" style={{ marginBottom: 12 }} />
            <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>
              ตั้งรหัสผ่านใหม่สำเร็จ
            </h3>
            <p style={{ color: 'var(--dim)', fontSize: 13, marginBottom: 14 }}>
              คัดลอกและส่งให้{' '}
              <strong style={{ color: 'var(--cyan)' }}>{resetResult.username}</strong>{' '}
              ทันที — ไม่สามารถดูซ้ำได้
            </p>
            <div
              style={{
                background: 'var(--bg-input)',
                border: '1px dashed var(--border-color)',
                padding: '14px 16px',
                borderRadius: 10,
                fontFamily: 'monospace',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--yellow)',
                letterSpacing: 1.5,
                marginBottom: 18,
                userSelect: 'all',
              }}
            >
              {resetResult.newPassword}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              <button
                onClick={async () => {
                  const ok = await copyToClipboard(resetResult.newPassword);
                  showToast(
                    ok ? 'คัดลอกรหัสผ่านแล้ว' : 'คัดลอกไม่สำเร็จ — กรุณาคัดลอกด้วยตนเอง',
                    ok ? 'success' : 'error',
                  );
                }}
                style={{
                  padding: '9px 18px',
                  background: 'var(--cyan)',
                  border: 'none',
                  color: '#000',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Sarabun, sans-serif',
                }}
              >
                คัดลอกรหัสผ่าน
              </button>
              <button
                onClick={() => setResetResult(null)}
                style={{
                  padding: '9px 18px',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text)',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'Sarabun, sans-serif',
                }}
              >
                เสร็จสิ้น
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
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
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
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>{icon}</div>
      <div>
        <div style={{ fontSize: 12, color: 'var(--dim)' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      </div>
    </div>
  );
}

function roleBadge(role: UserRole) {
  const config: Record<UserRole, { bg: string; text: string; Icon: typeof Crown; label: string }> = {
    super_admin: { bg: 'rgba(250, 204, 21, 0.15)', text: 'var(--yellow)', Icon: Crown, label: 'Super Admin' },
    site_admin: { bg: 'rgba(34, 211, 238, 0.15)', text: 'var(--cyan)', Icon: User, label: 'Site Admin' },
    viewer: { bg: 'rgba(167, 139, 250, 0.15)', text: '#a78bfa', Icon: Eye, label: 'Viewer' },
  };
  const c = config[role];
  return (
    <span
      style={{
        padding: '3px 10px',
        borderRadius: 20,
        background: c.bg,
        color: c.text,
        fontSize: 12,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
      }}
    >
      <c.Icon size={12} />
      {c.label}
    </span>
  );
}

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
  verticalAlign: 'middle',
};

const emptyStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'center',
  color: 'var(--dim)',
  padding: '40px 20px',
};

const iconBtnStyle = (_hoverColor: string): React.CSSProperties => ({
  background: 'none',
  border: '1px solid var(--border-color)',
  color: 'var(--dim)',
  width: 32,
  height: 32,
  borderRadius: 6,
  cursor: 'pointer',
  fontSize: 14,
  // hover handled by inline style would need state; using simple bg change
  transition: 'all 0.2s',
});
