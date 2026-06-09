import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TimeRange } from '@monitor/shared';
import {
  acknowledgeAlert, fetchAlerts, fetchZoneSummary, resolveAlert,
} from './api';

export function useAlerts(siteId: number | null, open = true) {
  return useQuery({
    queryKey: ['alerts', siteId, open],
    queryFn: () => fetchAlerts(siteId!, open),
    enabled: siteId != null,
    refetchInterval: 30_000, // Match the rules-engine sweep cadence.
  });
}

export function useAckAlert(siteId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', siteId] }),
  });
}

export function useResolveAlert(siteId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: resolveAlert,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts', siteId] }),
  });
}

export function useZoneSummary(siteId: number | null, range: TimeRange) {
  return useQuery({
    queryKey: ['zone-summary', siteId, range],
    queryFn: () => fetchZoneSummary(siteId!, range),
    enabled: siteId != null,
    refetchInterval: 30_000,
  });
}
