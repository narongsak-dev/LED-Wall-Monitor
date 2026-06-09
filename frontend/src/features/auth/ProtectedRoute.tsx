import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from './store';

export function ProtectedRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const location = useLocation();

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Transitional session — they logged in with a one-time reset code. Lock
  // them onto /first-time-password until they set a real password. The page
  // itself opts out of this guard by checking the flag before rendering.
  if (mustChangePassword && location.pathname !== '/first-time-password') {
    return <Navigate to="/first-time-password" replace />;
  }

  return <Outlet />;
}
