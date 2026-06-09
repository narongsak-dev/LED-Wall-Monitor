import { useState } from 'react';
import { History, ChevronDown, ChevronRight } from 'lucide-react';
import { dayjs } from '@/lib/dayjs';
import { useResetHistory } from './hooks';
import type { PasswordResetStatus, ResetHistoryItem } from '@monitor/shared';

interface ResetHistoryTableProps {
  enabled: boolean;
  /** When set, only show history for this user. */
  userId?: number;
  /** When true, render expanded inline (no toggle header) — used on the
   *  dedicated password-resets page. Default: collapsible. */
  defaultOpen?: boolean;
  /** Override the header title — useful when filtering by user. */
  title?: string;
}

/** Paginated audit log of password-reset requests visible to the current
 *  user (same scope as the pending inbox). When `userId` is given, scoped
 *  to that single user; otherwise shows all visible history. */
export function ResetHistoryTable({
  enabled,
  userId,
  defaultOpen = false,
  title = 'ประวัติคำขอตั้งรหัสผ่านใหม่',
}: ResetHistoryTableProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [page, setPage] = useState(0);
  const perPage = 10;
  const { data, isLoading } = useResetHistory({
    limit: perPage,
    offset: page * perPage,
    enabled: enabled && open,
    userId,
  });

  if (!enabled) return null;

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <section
      style={{
        marginBottom: 22,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      {defaultOpen ? (
        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            borderBottom: '1px solid var(--border-color)',
            fontSize: 14,
          }}
        >
          <History size={16} color="#8b949e" />
          <strong style={{ color: 'var(--text)' }}>{title}</strong>
          {total > 0 && (
            <span style={{ color: 'var(--dim)', fontSize: 12 }}>
              ทั้งหมด {total} รายการ
            </span>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            width: '100%',
            padding: '12px 18px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: 14,
            fontFamily: 'inherit',
            textAlign: 'left',
          }}
        >
          <History size={16} color="#8b949e" />
          <strong>{title}</strong>
          {total > 0 && (
            <span style={{ color: 'var(--dim)', fontSize: 12 }}>
              ทั้งหมด {total} รายการ
            </span>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--dim)' }}>
            {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </span>
        </button>
      )}

      {open && (
        <div style={defaultOpen ? undefined : { borderTop: '1px solid var(--border-color)' }}>
          {isLoading ? (
            <div style={{ padding: 18, color: 'var(--dim)', fontSize: 13 }}>
              กำลังโหลด...
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: 18, color: 'var(--dim)', fontSize: 13 }}>
              ยังไม่มีคำขอในประวัติ
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: 13,
                  }}
                >
                  <thead>
                    <tr>
                      <th style={th}>เวลาขอ</th>
                      <th style={th}>ผู้ขอ</th>
                      <th style={th}>ติดต่อ</th>
                      <th style={th}>สถานะ</th>
                      <th style={th}>ผู้อนุมัติ</th>
                      <th style={th}>หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <HistoryRow key={r.id} row={r} />
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 18px',
                    borderTop: '1px solid var(--border-color)',
                    fontSize: 12,
                    color: 'var(--dim)',
                  }}
                >
                  <div>
                    หน้า {page + 1} / {totalPages}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => setPage((p) => Math.max(0, p - 1))}
                      disabled={page === 0}
                      style={pageBtn(page === 0)}
                    >
                      ก่อนหน้า
                    </button>
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages - 1, p + 1))
                      }
                      disabled={page >= totalPages - 1}
                      style={pageBtn(page >= totalPages - 1)}
                    >
                      ถัดไป
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

function HistoryRow({ row }: { row: ResetHistoryItem }) {
  return (
    <tr>
      <td style={{ ...td, color: 'var(--dim)', fontSize: 12 }}>
        {dayjs(row.requestedAt).format('DD/MM/YY HH:mm')}
      </td>
      <td style={td}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <strong style={{ color: 'var(--cyan)' }}>{row.username}</strong>
          <RoleBadge role={row.role} />
        </div>
        {row.fullName && (
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>{row.fullName}</div>
        )}
      </td>
      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--dim)' }}>
        {row.providedContact}
      </td>
      <td style={td}>
        <StatusBadge status={row.status} />
      </td>
      <td style={td}>
        {row.approverUsername ? (
          <>
            <div>{row.approverUsername}</div>
            {row.approvedAt && (
              <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                {dayjs(row.approvedAt).format('DD/MM/YY HH:mm')}
              </div>
            )}
          </>
        ) : (
          <span style={{ color: 'var(--dim2)' }}>—</span>
        )}
      </td>
      <td style={{ ...td, fontSize: 11.5, color: 'var(--dim)' }}>
        {row.status === 'rejected' && row.rejectedReason
          ? row.rejectedReason
          : row.status === 'used' && row.usedAt
            ? `ใช้เมื่อ ${dayjs(row.usedAt).format('DD/MM HH:mm')}`
            : ''}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: PasswordResetStatus }) {
  const cfg: Record<
    PasswordResetStatus,
    { bg: string; text: string; label: string }
  > = {
    pending: {
      bg: 'rgba(250, 204, 21, 0.15)',
      text: 'var(--yellow)',
      label: 'รออนุมัติ',
    },
    approved: {
      bg: 'rgba(34, 211, 238, 0.15)',
      text: 'var(--cyan)',
      label: 'อนุมัติแล้ว',
    },
    used: {
      bg: 'rgba(74, 222, 128, 0.15)',
      text: 'var(--green)',
      label: 'ตั้งรหัสใหม่แล้ว',
    },
    rejected: {
      bg: 'rgba(248, 113, 113, 0.15)',
      text: 'var(--red)',
      label: 'ปฏิเสธ',
    },
    expired: {
      bg: 'rgba(139, 148, 158, 0.15)',
      text: 'var(--dim)',
      label: 'หมดอายุ',
    },
  };
  const c = cfg[status];
  return (
    <span
      style={{
        padding: '2px 10px',
        borderRadius: 20,
        background: c.bg,
        color: c.text,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {c.label}
    </span>
  );
}

function RoleBadge({ role }: { role: ResetHistoryItem['role'] }) {
  const cfg =
    role === 'super_admin'
      ? { c: 'var(--yellow)', label: 'SA' }
      : role === 'site_admin'
        ? { c: 'var(--cyan)', label: 'Site' }
        : { c: '#a78bfa', label: 'V' };
  return (
    <span
      style={{
        padding: '0px 6px',
        borderRadius: 6,
        background: 'transparent',
        border: `1px solid ${cfg.c}`,
        color: cfg.c,
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {cfg.label}
    </span>
  );
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  background: 'rgba(34, 211, 238, 0.05)',
  color: 'var(--dim)',
  fontWeight: 600,
  fontSize: 11.5,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: '1px solid var(--border-color)',
  whiteSpace: 'nowrap',
};

const td: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-color)',
  verticalAlign: 'top',
};

const pageBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '5px 12px',
  borderRadius: 6,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-input)',
  color: 'var(--text)',
  cursor: disabled ? 'not-allowed' : 'pointer',
  opacity: disabled ? 0.4 : 1,
  fontSize: 12,
  fontFamily: 'inherit',
});
