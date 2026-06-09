import type { ReactNode } from 'react';
import type { UserRole } from '@monitor/shared';
import { useAuthStore } from './store';

interface Props {
  /** Show children when the user's role is in this list. */
  allow: UserRole[];
  /** Optional fallback when the role is not allowed. */
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Conditional renderer that gates a slice of UI on the user's role. Useful for
 * wrapping action buttons (delete, edit, create) so viewers / site_admins
 * don't see them at all.
 */
export function RoleGate({ allow, fallback = null, children }: Props) {
  const role = useAuthStore((s) => s.user?.role);
  if (!role || !allow.includes(role)) return <>{fallback}</>;
  return <>{children}</>;
}
