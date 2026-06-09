import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from './store';

export function AdminRoute() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Navigate to="/login" replace />;
  // /admin/* is super-admin only — site_admin uses /sites/:siteId/* scoped views.
  if (user.role !== 'super_admin') return <Navigate to="/" replace />;
  return <Outlet />;
}
