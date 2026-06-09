import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  Cpu,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { useRole } from '@/features/auth/roles';
import { SiteQuickPicker } from './SiteQuickPicker';
import { usePendingResets } from '@/features/password-reset/hooks';

interface MenuItem {
  key: string;
  Icon: LucideIcon;
  label: string;
}

const SITE_MENU: MenuItem[] = [
  { key: 'dashboard', Icon: LayoutDashboard, label: 'แดชบอร์ดหลัก' },
  { key: 'reports', Icon: FileText, label: 'รายงาน' },
];

const ADMIN_MENU: MenuItem[] = [
  { key: 'sites', Icon: Building2, label: 'จัดการไซต์' },
  { key: 'devices', Icon: Cpu, label: 'จัดการอุปกรณ์' },
  { key: 'users', Icon: Users, label: 'ผู้ใช้ + สิทธิ์' },
];

interface AppSiderProps {
  mobileOpen?: boolean;
  onClose?: () => void;
}

export function AppSider({ mobileOpen = false }: AppSiderProps = {}) {
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const { isSuperAdmin, isSiteAdmin, isViewer } = useRole();
  // Number of password-reset approvals waiting for THIS user. Used to put
  // a badge on the "ผู้ใช้ + สิทธิ์" menu item.
  const { data: pendingResets = [] } = usePendingResets(
    !!user && user.role !== 'viewer',
  );
  const pendingCount = pendingResets.length;

  const siteMatch = location.pathname.match(/\/sites\/(\d+)\/(\w+)/);
  // `[\w-]+` so hyphenated segments like "password-resets" register as the
  // active admin key (raw `\w+` matches up to the dash and reports the wrong
  // selection on the sidebar).
  const adminMatch = location.pathname.match(/\/admin\/([\w-]+)/);
  const isSettingsSection = location.pathname.startsWith('/settings');
  const siteId = siteMatch?.[1];
  const currentSiteKey = siteMatch?.[2];
  const currentAdminKey = adminMatch?.[1];
  const isAdminSection = !!adminMatch;

  return (
    <aside
      className={'app-sidebar' + (mobileOpen ? ' open' : '')}
      style={{
        width: 250,
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 14px',
        flexShrink: 0,
        overflowY: 'auto',
      }}
    >
      {/* Brand */}
      <div
        onClick={() => navigate('/')}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '6px 8px 18px',
          marginBottom: 8,
          borderBottom: '1px solid var(--border-color)',
          cursor: 'pointer',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background:
              'linear-gradient(135deg, var(--cyan) 0%, var(--cyan-bright) 100%)',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 4px 14px var(--cyan-glow-strong)',
          }}
        >
          <Zap size={20} color="#fff" fill="#fff" />
        </div>
        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
            }}
          >
            Electric Monitor
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--dim)',
              marginTop: 2,
              fontWeight: 500,
            }}
          >
            Remote monitoring
          </div>
        </div>
      </div>

      {/* Site quick picker dropdown */}
      <SiteQuickPicker />

      {/* Settings + login history are reachable from the user card at the
          bottom of the sidebar (clicks → /settings) and from the Settings
          page itself ("แสดงประวัติทั้งหมด" button), so no top-level group
          here. */}

      {siteId && !isAdminSection && !isSettingsSection && (
        <NavGroup label="ข้อมูลไซต์">
          {SITE_MENU.map((item) => (
            <NavItem
              key={item.key}
              Icon={item.Icon}
              label={item.label}
              active={currentSiteKey === item.key}
              onClick={() => navigate(`/sites/${siteId}/${item.key}`)}
            />
          ))}
        </NavGroup>
      )}

      {isSuperAdmin && (
        <NavGroup label="ผู้ดูแลระบบ">
          {ADMIN_MENU.map((item) => (
            <NavItem
              key={item.key}
              Icon={item.Icon}
              label={item.label}
              active={isAdminSection && currentAdminKey === item.key}
              onClick={() => navigate(`/admin/${item.key}`)}
              badge={item.key === 'users' ? pendingCount : undefined}
            />
          ))}
        </NavGroup>
      )}

      {isSiteAdmin && (
        <NavGroup label="ไซต์ของฉัน">
          <NavItem
            Icon={Building2}
            label="จัดการไซต์"
            active={isAdminSection && currentAdminKey === 'sites'}
            onClick={() => navigate('/admin/sites')}
          />
          <NavItem
            Icon={Users}
            label="ผู้ใช้ + สิทธิ์"
            active={isAdminSection && currentAdminKey === 'users'}
            onClick={() => navigate('/admin/users')}
            badge={pendingCount}
          />
        </NavGroup>
      )}

      {/* Footer user card — avatar + name + role badge in a single tidy
          card pinned to the bottom of the sidebar. Clicking opens Settings. */}
      {user && (() => {
        const accent = isSuperAdmin
          ? { bg: 'rgba(250, 204, 21, 0.12)', fg: 'var(--yellow)', border: 'rgba(250, 204, 21, 0.3)' }
          : isSiteAdmin
            ? { bg: 'rgba(34, 211, 238, 0.12)', fg: 'var(--cyan)', border: 'rgba(34, 211, 238, 0.3)' }
            : { bg: 'rgba(167, 139, 250, 0.12)', fg: '#a78bfa', border: 'rgba(167, 139, 250, 0.3)' };
        const roleLabel = isSuperAdmin ? 'Super Admin' : isSiteAdmin ? 'Site Admin' : isViewer ? 'Viewer' : '';
        const initial = (user.fullName ?? user.username).slice(0, 1).toUpperCase();
        return (
          <div
            onClick={() => navigate('/settings')}
            style={{
              marginTop: 'auto',
              marginBottom: 12,
              padding: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              transition: 'border-color 0.15s, background 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = accent.border;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
            }}
            title="ไปยังหน้าตั้งค่า"
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: accent.bg,
                color: accent.fg,
                border: `1px solid ${accent.border}`,
                display: 'grid',
                placeItems: 'center',
                fontSize: 15,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {user.fullName ?? user.username}
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: accent.fg,
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                  marginTop: 2,
                }}
              >
                {roleLabel}
              </div>
            </div>
          </div>
        );
      })()}

    </aside>
  );
}

function NavGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          color: 'var(--dim2)',
          padding: '0 12px 8px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </div>
    </div>
  );
}

function NavItem({
  Icon,
  label,
  active,
  onClick,
  badge,
}: {
  Icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
  /** When > 0, draws a yellow pill on the right side of the row. */
  badge?: number;
}) {
  return (
    <a
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 12px',
        color: active ? 'var(--cyan)' : 'var(--dim)',
        textDecoration: 'none',
        borderRadius: 10,
        fontSize: 13.5,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        background: active ? 'var(--cyan-glow)' : 'transparent',
        transition: 'background 0.15s, color 0.15s',
        fontFamily: 'inherit',
        gap: 12,
        position: 'relative',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'var(--hover-bg)';
          e.currentTarget.style.color = 'var(--text)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = 'var(--dim)';
        }
      }}
    >
      <Icon size={17} strokeWidth={active ? 2.4 : 2} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge != null && badge > 0 && (
        <span
          style={{
            background: 'var(--yellow)',
            color: '#000',
            fontSize: 10.5,
            fontWeight: 700,
            padding: '1px 8px',
            borderRadius: 10,
            lineHeight: 1.4,
          }}
        >
          {badge}
        </span>
      )}
    </a>
  );
}
