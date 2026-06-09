import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '@monitor/shared';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route handler to one or more roles. Combine with `RolesGuard`
 * in a `@UseGuards(JwtAuthGuard, RolesGuard)` decorator.
 *
 * Example:
 *   @Roles('super_admin')                       // super admin only
 *   @Roles('super_admin', 'site_admin')         // either of those
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
