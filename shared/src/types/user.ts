import type { SitePermissionAssignment } from './site';

export type UserRole = 'super_admin' | 'site_admin' | 'viewer';

export interface User {
  id: number;
  username: string;
  email: string | null;
  phoneNumber: string | null;
  fullName: string | null;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserWithPermissions extends User {
  sitePermissions: SitePermissionAssignment[];
}

export interface CreateUserPayload {
  username: string;
  password: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  role: UserRole;
  isActive?: boolean;
  sitePermissions?: Pick<SitePermissionAssignment, 'siteId' | 'permission'>[];
}

export interface UpdateUserPayload {
  username?: string;
  password?: string;
  fullName?: string;
  email?: string;
  phoneNumber?: string;
  role?: UserRole;
  isActive?: boolean;
  sitePermissions?: Pick<SitePermissionAssignment, 'siteId' | 'permission'>[];
}

/** Self-service profile update (PATCH /api/users/me). */
export interface UpdateProfilePayload {
  fullName?: string;
  email?: string;
  phoneNumber?: string;
}

/** Self-service password change (POST /api/users/me/change-password). */
export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

/** A single row in the login audit trail. */
export interface LoginLogEntry {
  id: number;
  userId: number | null;
  username: string;
  fullName: string | null;
  success: boolean;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface LoginHistoryResponse {
  rows: LoginLogEntry[];
  total: number;
}
