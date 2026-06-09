import { api } from '@/lib/axios';
import type { UserSiteAccess } from '@monitor/shared';

export async function fetchMySites(): Promise<UserSiteAccess[]> {
  const { data } = await api.get<UserSiteAccess[]>('/api/sites');
  return data;
}
