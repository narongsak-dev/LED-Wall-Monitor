import { useState } from 'react';
import {
  History,
  CheckCircle2,
  XCircle,
  Monitor,
  User as UserIcon,
  Globe,
  Plug,
} from 'lucide-react';
import { dayjs } from '@/lib/dayjs';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRole } from '@/features/auth/roles';
import { useLoginHistory } from '@/features/account/hooks';

const PER_PAGE = 15;

export function LoginHistoryPage() {
  const { isSuperAdmin } = useRole();
  const [scope, setScope] = useState<'me' | 'all'>('me');
  const [page, setPage] = useState(1);

  const all = isSuperAdmin && scope === 'all';
  const { data, isLoading, isError } = useLoginHistory({
    all,
    limit: PER_PAGE,
    offset: (page - 1) * PER_PAGE,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const switchScope = (next: 'me' | 'all') => {
    setScope(next);
    setPage(1);
  };

  return (
    <div>
      <PageHeader
        title="ประวัติการเข้าใช้งานระบบ"
        breadcrumb="ตั้งค่า / ประวัติการเข้าใช้งาน"
        icon={History}
      />

      {isSuperAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <ScopeTab
            active={scope === 'me'}
            label="ของฉัน"
            icon={<UserIcon size={14} />}
            onClick={() => switchScope('me')}
          />
          <ScopeTab
            active={scope === 'all'}
            label="ผู้ใช้ทั้งหมด"
            icon={<Globe size={14} />}
            onClick={() => switchScope('all')}
          />
        </div>
      )}

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
                <th style={thStyle}>สถานะ</th>
                {all && <th style={thStyle}>ผู้ใช้</th>}
                <th style={thStyle}>วันเวลา</th>
                <th style={thStyle}>ที่อยู่ IP</th>
                <th style={thStyle}>อุปกรณ์ / เบราว์เซอร์</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={all ? 6 : 5} style={emptyStyle}>
                    กำลังโหลด...
                  </td>
                </tr>
              ) : isError ? (
                <tr>
                  <td colSpan={all ? 6 : 5} style={emptyStyle}>
                    โหลดข้อมูลไม่สำเร็จ
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={all ? 6 : 5} style={emptyStyle}>
                    <Plug
                      size={32}
                      color="#8b949e"
                      style={{ marginBottom: 8, display: 'inline-block' }}
                    />
                    <div>ยังไม่มีประวัติการเข้าใช้งาน</div>
                  </td>
                </tr>
              ) : (
                rows.map((r, i) => (
                  <tr
                    key={r.id}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ ...tdStyle, color: 'var(--dim)' }}>
                      {(page - 1) * PER_PAGE + i + 1}
                    </td>
                    <td style={tdStyle}>{statusBadge(r.success)}</td>
                    {all && (
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: 'var(--cyan)' }}>
                          {r.username}
                        </div>
                        {r.fullName && (
                          <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                            {r.fullName}
                          </div>
                        )}
                      </td>
                    )}
                    <td style={tdStyle}>
                      <div>{dayjs(r.createdAt).format('DD/MM/YYYY HH:mm:ss')}</div>
                      <div style={{ fontSize: 11, color: 'var(--dim2)' }}>
                        {dayjs(r.createdAt).fromNow()}
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--dim)', fontFamily: 'monospace' }}>
                      {r.ipAddress ?? '-'}
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--dim)', maxWidth: 320 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12,
                        }}
                        title={r.userAgent ?? ''}
                      >
                        <Monitor size={13} style={{ flexShrink: 0 }} />
                        <span
                          style={{
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {formatUserAgent(r.userAgent)}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

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
            แสดง {total === 0 ? 0 : (page - 1) * PER_PAGE + 1} –{' '}
            {Math.min(page * PER_PAGE, total)} จาก {total} รายการ
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <PagerButton
              label="ก่อนหน้า"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            />
            <span style={{ padding: '0 6px' }}>
              {page} / {totalPages}
            </span>
            <PagerButton
              label="ถัดไป"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScopeTab({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 16px',
        borderRadius: 8,
        border: `1px solid ${active ? 'var(--cyan)' : 'var(--border-color)'}`,
        background: active ? 'var(--cyan-glow)' : 'var(--bg-card)',
        color: active ? 'var(--cyan)' : 'var(--dim)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'Sarabun, sans-serif',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        border: '1px solid var(--border-color)',
        background: 'var(--bg-input)',
        color: disabled ? 'var(--dim2)' : 'var(--text)',
        fontSize: 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        fontFamily: 'Sarabun, sans-serif',
      }}
    >
      {label}
    </button>
  );
}

function statusBadge(success: boolean) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 20,
        fontSize: 12,
        fontWeight: 600,
        background: success ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
        color: success ? 'var(--green)' : 'var(--red)',
      }}
    >
      {success ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
      {success ? 'สำเร็จ' : 'ล้มเหลว'}
    </span>
  );
}

/** Best-effort, dependency-free user-agent summary (e.g. "Chrome · Windows"). */
function formatUserAgent(ua: string | null): string {
  if (!ua) return '-';
  const browser = BROWSERS.find((b) => b.re.test(ua))?.name ?? 'เบราว์เซอร์อื่น';
  const os = OSES.find((o) => o.re.test(ua))?.name;
  return os ? `${browser} · ${os}` : browser;
}

const BROWSERS: { name: string; re: RegExp }[] = [
  { name: 'Edge', re: /Edg\//i },
  { name: 'Opera', re: /OPR\/|Opera/i },
  { name: 'Chrome', re: /Chrome\//i },
  { name: 'Firefox', re: /Firefox\//i },
  { name: 'Safari', re: /Safari\//i },
];

const OSES: { name: string; re: RegExp }[] = [
  { name: 'Windows', re: /Windows/i },
  { name: 'Android', re: /Android/i },
  { name: 'iOS', re: /iPhone|iPad|iPod/i },
  { name: 'macOS', re: /Macintosh|Mac OS X/i },
  { name: 'Linux', re: /Linux/i },
];

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
