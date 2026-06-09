import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store';
import { canManageSites } from './roles';

/**
 * Wraps routes that both super_admin and site_admin are allowed to enter —
 * specifically the per-site management pages under /admin/sites/:siteId
 * and /admin/devices/:boardId. Viewers and unauthenticated users bounce
 * back to the entry redirect.
 */
export function SiteManagerRoute() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  if (!canManageSites(user.role)) return <Navigate to="/" replace />;
  return <Outlet />;
}
