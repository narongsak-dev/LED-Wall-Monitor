import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, LogOut, Plug, Settings as SettingsIcon } from 'lucide-react';
import { fetchMySites } from '@/features/sites/api';
import { useAuthStore } from '@/features/auth/store';
import { SiteOverviewGrid } from '@/features/sites/SiteOverviewGrid';
import { ConnectionBadge } from '@/components/layout/ConnectionBadge';
import { AlertBell } from '@/components/layout/AlertBell';

/**
 * Landing route after login.
 *
 * - 0 sites → empty state ("ติดต่อ admin")
 * - 1 site  → auto-jump to that site (fast path)
 * - 2+ sites → render a polished site picker landing page so the user can
 *   see realtime overview before entering.
 *
 * Admins without any sites still get redirected to /admin/sites.
 */
export function SiteEntryRedirect() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const { data, isLoading } = useQuery({
    queryKey: ['sites', 'mine'],
    queryFn: fetchMySites,
  });

  // Single-site users: jump straight to the dashboard.
  useEffect(() => {
    if (!data) return;
    if (data.length === 1) {
      navigate(`/sites/${data[0].site.id}/dashboard`, { replace: true });
    }
  }, [data, navigate]);

  if (isLoading || (data && data.length === 1)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--bg-body)',
          color: 'var(--dim)',
        }}
      >
        กำลังโหลด...
      </div>
    );
  }

  if (data && data.length === 0) {
    // Both super_admin and site_admin can manage sites — bounce them into
    // the management UI even with zero sites (super_admin can create one,
    // site_admin will see an empty list with no actions).
    if (user?.role === 'super_admin' || user?.role === 'site_admin') {
      return <Navigate to="/admin/sites" replace />;
    }
    return (
      <EmptyState
        onLogout={() => {
          clear();
          navigate('/login');
        }}
        onSettings={() => navigate('/settings')}
      />
    );
  }

  // Multiple sites — show the picker as a full landing page.
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-body)',
        padding: '24px 28px 40px',
        overflowY: 'auto',
      }}
    >
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 28,
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background:
                  'linear-gradient(135deg, var(--cyan) 0%, var(--cyan-bright) 100%)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 14px var(--cyan-glow-strong)',
              }}
            >
              <Building2 size={22} color="#fff" />
            </div>
            <div>
              <h1
                style={{
                  color: 'var(--text)',
                  fontSize: 24,
                  margin: 0,
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                }}
              >
                เลือกไซต์งาน
              </h1>
              <div style={{ fontSize: 13, color: 'var(--dim)', marginTop: 2 }}>
                สวัสดี {user?.fullName ?? user?.username} · เลือกไซต์ที่ต้องการดู
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ConnectionBadge />
            <AlertBell />
            <button
              onClick={() => navigate('/settings')}
              title="ตั้งค่า"
              style={iconBtn}
            >
              <SettingsIcon size={16} />
            </button>
            <button
              onClick={() => {
                clear();
                navigate('/login');
              }}
              title="ออกจากระบบ"
              style={{ ...iconBtn, color: '#ef4444' }}
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>

        <SiteOverviewGrid data={data} isLoading={false} error={null} />
      </div>
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
};

function EmptyState({
  onSettings,
  onLogout,
}: {
  onSettings: () => void;
  onLogout: () => void;
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--login-bg)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        className="card fade-in-up"
        style={{
          textAlign: 'center',
          padding: 48,
          maxWidth: 460,
          width: '100%',
        }}
      >
        <Plug size={48} color="var(--dim2)" style={{ marginBottom: 16 }} />
        <h2
          style={{
            color: 'var(--text)',
            fontSize: 20,
            margin: '0 0 8px',
            fontWeight: 700,
          }}
        >
          ยังไม่มีสิทธิ์เข้าถึงไซต์
        </h2>
        <p style={{ color: 'var(--dim)', fontSize: 14, marginBottom: 20 }}>
          กรุณาติดต่อผู้ดูแลระบบเพื่อขอสิทธิ์เข้าถึงไซต์งาน
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button onClick={onSettings} style={emptyBtn}>
            <Building2 size={15} /> ไปหน้าตั้งค่า
          </button>
          <button onClick={onLogout} style={emptyBtn}>
            <LogOut size={15} /> ออกจากระบบ
          </button>
        </div>
      </div>
    </div>
  );
}

const emptyBtn: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 10,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-input)',
  color: 'var(--text)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
};
