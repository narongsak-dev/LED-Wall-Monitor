import { useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldQuestion, ArrowLeft, X } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useAuthStore } from '@/features/auth/store';
import { PendingResetsInbox } from '@/features/password-reset/PendingResetsInbox';
import { ResetHistoryTable } from '@/features/password-reset/ResetHistoryTable';
import { useUsers } from '@/features/users/hooks';

/** Dedicated approval-inbox + history page. Accepts an optional `?userId=N`
 *  query param — when present the history table is filtered to that single
 *  user. The pending inbox always shows whatever's actually pending, since
 *  filtering it would just hide the queue. */
export function PasswordResetsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const enabled = !!user && user.role !== 'viewer';

  const userIdParam = searchParams.get('userId');
  const filterUserId = userIdParam ? Number(userIdParam) : undefined;

  // Look up the username when filtering so the header reads naturally.
  // It's fine if the lookup is empty — we still pass the userId through.
  const { data: users = [] } = useUsers();
  const filterUser = useMemo(
    () => (filterUserId ? users.find((u) => u.id === filterUserId) : undefined),
    [users, filterUserId],
  );

  if (!enabled) {
    return (
      <div>
        <PageHeader
          title="คำขอตั้งรหัสผ่านใหม่"
          breadcrumb="ผู้ที่มีสิทธิ์อนุมัติเท่านั้น"
          icon={ShieldQuestion}
        />
        <div style={{ color: 'var(--dim)' }}>
          บัญชีของคุณไม่มีสิทธิ์ดูคำขอเหล่านี้
        </div>
      </div>
    );
  }

  const clearFilter = () => {
    setSearchParams({});
  };

  return (
    <div>
      <PageHeader
        title="คำขอตั้งรหัสผ่านใหม่"
        breadcrumb={
          filterUser
            ? `ประวัติของ ${filterUser.username}`
            : 'อนุมัติคำขอและตรวจสอบประวัติ'
        }
        icon={ShieldQuestion}
      />

      {/* Back link when navigated in from somewhere else */}
      <button
        onClick={() => navigate('/admin/users')}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--cyan)',
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: 'inherit',
          padding: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 14,
        }}
      >
        <ArrowLeft size={14} /> กลับไปจัดการผู้ใช้
      </button>

      {/* Pending inbox — always full scope; filtering it would hide work */}
      <PendingResetsInbox enabled showWhenEmpty />

      {/* Filter chip (only when ?userId is set) */}
      {filterUserId && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 12px',
            background: 'rgba(34, 211, 238, 0.10)',
            border: '1px solid var(--cyan)',
            borderRadius: 20,
            fontSize: 12.5,
            color: 'var(--text)',
            marginBottom: 12,
          }}
        >
          <span style={{ color: 'var(--dim)' }}>กรอง:</span>
          <strong style={{ color: 'var(--cyan)' }}>
            {filterUser?.username ?? `user #${filterUserId}`}
          </strong>
          <button
            onClick={clearFilter}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--dim)',
              cursor: 'pointer',
              padding: 0,
              display: 'inline-flex',
              alignItems: 'center',
            }}
            title="ล้างตัวกรอง"
          >
            <X size={13} />
          </button>
        </div>
      )}

      {/* History — always-open table on this page, filtered when ?userId set */}
      <ResetHistoryTable
        enabled
        defaultOpen
        userId={filterUserId}
        title={
          filterUserId
            ? `ประวัติของ ${filterUser?.username ?? `user #${filterUserId}`}`
            : 'ประวัติคำขอทั้งหมด'
        }
      />
    </div>
  );
}
