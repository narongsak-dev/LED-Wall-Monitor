import { api } from '@/lib/axios';
import type { Alert, ZoneSummaryRow, TimeRange } from '@monitor/shared';

export async function fetchAlerts(siteId: number, open = true): Promise<Alert[]> {
  const { data } = await api.get<Alert[]>('/api/alerts', {
    params: { siteId, open: open ? 'true' : 'false' },
  });
  return data;
}

export async function acknowledgeAlert(id: number): Promise<Alert> {
  const { data } = await api.post<Alert>(`/api/alerts/${id}/acknowledge`);
  return data;
}

export async function resolveAlert(id: number): Promise<Alert> {
  const { data } = await api.post<Alert>(`/api/alerts/${id}/resolve`);
  return data;
}

export async function fetchZoneSummary(
  siteId: number, range: TimeRange,
): Promise<ZoneSummaryRow[]> {
  const { data } = await api.get<ZoneSummaryRow[]>('/api/telemetry/zone-summary', {
    params: { siteId, range },
  });
  return data;
}
