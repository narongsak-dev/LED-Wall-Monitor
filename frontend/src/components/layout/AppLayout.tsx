import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { AppSider } from './AppSider';
import { useIdleLogout } from '@/features/auth/useIdleLogout';
import { useResetNotifications } from '@/features/password-reset/useResetNotifications';

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Auto-logout after 30 min of inactivity unless the user ticked
  // "remember me" — keeps casual logins from staying open on shared screens.
  useIdleLogout();
  // Pop a toast whenever a new password-reset request lands in the
  // approver's inbox; also drives the sidebar badge via React Query cache.
  useResetNotifications();

  // Close drawer when route changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <AppSider mobileOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      <div
        className={'mobile-menu-backdrop' + (drawerOpen ? ' open' : '')}
        onClick={() => setDrawerOpen(false)}
      />
      <main
        className="app-main"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 25,
          background: 'var(--bg-body)',
        }}
      >
        <button
          className="mobile-menu-btn mobile-only"
          onClick={() => setDrawerOpen(true)}
          style={{ marginBottom: 14 }}
          aria-label="Open menu"
        >
          <Menu size={18} />
        </button>
        <Outlet />
      </main>
    </div>
  );
}
