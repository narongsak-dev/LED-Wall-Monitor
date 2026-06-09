import { api } from '@/lib/axios';
import type { Tariff } from '@monitor/shared';

export async function fetchTariff(siteId: number): Promise<Tariff | null> {
  try {
    const { data } = await api.get<Tariff | null>(`/api/sites/${siteId}/tariff`);
    return data;
  } catch (e) {
    if ((e as { response?: { status?: number } }).response?.status === 404) {
      return null;
    }
    throw e;
  }
}

export async function upsertTariff(
  siteId: number, payload: { rate: number; currency?: string; name?: string },
): Promise<Tariff> {
  const { data } = await api.put<Tariff>(`/api/sites/${siteId}/tariff`, payload);
  return data;
}
