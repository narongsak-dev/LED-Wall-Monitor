import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTariff, upsertTariff } from './api';

export function useTariff(siteId: number | null) {
  return useQuery({
    queryKey: ['tariff', siteId],
    queryFn: () => fetchTariff(siteId!),
    enabled: siteId != null,
  });
}

export function useUpsertTariff(siteId: number | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { rate: number; currency?: string; name?: string }) =>
      upsertTariff(siteId!, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tariff', siteId] }),
  });
}
