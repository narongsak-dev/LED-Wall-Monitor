import { api } from '@/lib/axios';
import type { Tariff } from '@monitor/shared';

export async function fetchTariff(siteId: number): Promise<Tariff | null> {
  try {
    const { data } = await api.get<Tariff | null>(`/api/sites/${siteId}/tariff`);
    // NestJS sends an empty body when the handler returns null. axios then
    // surfaces that as "" (empty string) — NOT null — which would slip past
    // `tariff != null` checks downstream and blow up on `tariff.rate.toFixed()`.
    // Normalise anything that isn't a real Tariff object into null.
    if (data == null || typeof data !== 'object' || typeof (data as Tariff).rate !== 'number') {
      return null;
    }
    return data as Tariff;
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
