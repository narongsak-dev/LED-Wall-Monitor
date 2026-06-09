export type SitePermission = 'read' | 'write' | 'admin';

export interface Site {
  id: number;
  groupId: number | null;
  code: string;
  name: string;
  location: string | null;
  timezone: string;
  isActive: boolean;
  createdAt: string;
}

export interface Group {
  id: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateGroupPayload {
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateGroupPayload {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface Zone {
  id: number;
  siteId: number;
  code: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface CreateZonePayload {
  siteId: number;
  code: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateZonePayload {
  code?: string;
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface UserSiteAccess {
  site: Site;
  permission: SitePermission;
}

export interface SitePermissionAssignment {
  siteId: number;
  siteCode?: string;
  siteName?: string;
  permission: SitePermission;
}

export interface CreateSitePayload {
  code: string;
  name: string;
  groupId?: number | null;
  location?: string;
  timezone?: string;
  isActive?: boolean;
}

export interface UpdateSitePayload {
  code?: string;
  name?: string;
  groupId?: number | null;
  location?: string;
  timezone?: string;
  isActive?: boolean;
}
