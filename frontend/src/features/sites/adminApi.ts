import { api } from '@/lib/axios';
import type { CreateSitePayload, Site, UpdateSitePayload } from '@monitor/shared';

export async function listAllSites(): Promise<Site[]> {
  const { data } = await api.get<Site[]>('/api/sites/all');
  return data;
}

export async function createSite(payload: CreateSitePayload): Promise<Site> {
  const { data } = await api.post<Site>('/api/sites', payload);
  return data;
}

export async function updateSite(
  id: number,
  payload: UpdateSitePayload,
): Promise<Site> {
  const { data } = await api.patch<Site>(`/api/sites/${id}`, payload);
  return data;
}

export async function deleteSite(id: number): Promise<void> {
  await api.delete(`/api/sites/${id}`);
}
