import type { UserRole } from '@monitor/shared';
import { useAuthStore } from './store';

/**
 * Small helpers around the three user tiers — keeps role string literals out
 * of components, and gives one place to bump the semantics if the role names
 * ever change again.
 */

export function isSuperAdmin(role: UserRole | undefined | null): boolean {
  return role === 'super_admin';
}

export function isSiteAdmin(role: UserRole | undefined | null): boolean {
  return role === 'site_admin';
}

/** Can manage CRUD on sites/zones/boards (super_admin OR site_admin). */
export function canManageSites(role: UserRole | undefined | null): boolean {
  return role === 'super_admin' || role === 'site_admin';
}

/** Can manage central platform — users, groups, cross-site moves. */
export function canManagePlatform(role: UserRole | undefined | null): boolean {
  return role === 'super_admin';
}

/** Hook that returns the current user's role + the predicates above. */
export function useRole() {
  const role = useAuthStore((s) => s.user?.role);
  return {
    role,
    isSuperAdmin: isSuperAdmin(role),
    isSiteAdmin: isSiteAdmin(role),
    isViewer: role === 'viewer',
    canManageSites: canManageSites(role),
    canManagePlatform: canManagePlatform(role),
  };
}
