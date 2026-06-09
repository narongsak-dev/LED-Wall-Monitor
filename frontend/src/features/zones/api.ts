import { api } from '@/lib/axios';
import type {
  Zone,
  CreateZonePayload,
  UpdateZonePayload,
} from '@monitor/shared';

export async function listZones(siteId: number): Promise<Zone[]> {
  const { data } = await api.get<Zone[]>('/api/zones', { params: { siteId } });
  return data;
}

export async function createZone(payload: CreateZonePayload): Promise<Zone> {
  const { data } = await api.post<Zone>('/api/zones', payload);
  return data;
}

export async function updateZone(id: number, payload: UpdateZonePayload): Promise<Zone> {
  const { data } = await api.patch<Zone>(`/api/zones/${id}`, payload);
  return data;
}

export async function deleteZone(id: number): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(`/api/zones/${id}`);
  return data;
}
