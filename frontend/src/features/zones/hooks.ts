import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateZonePayload, UpdateZonePayload } from '@monitor/shared';
import { createZone, deleteZone, listZones, updateZone } from './api';

const zonesKey = (siteId: number) => ['zones', 'site', siteId] as const;

export function useZones(siteId: number | null | undefined) {
  return useQuery({
    queryKey: ['zones', 'site', siteId ?? 0] as const,
    queryFn: () => listZones(siteId!),
    enabled: siteId != null && !Number.isNaN(siteId),
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>, siteId?: number) {
  if (siteId != null) qc.invalidateQueries({ queryKey: zonesKey(siteId) });
  qc.invalidateQueries({ queryKey: ['zones'] });
  // Boards display zone info, so refresh those too.
  qc.invalidateQueries({ queryKey: ['boards'] });
}

export function useCreateZone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateZonePayload) => createZone(payload),
    onSuccess: (_d, vars) => invalidate(qc, vars.siteId),
  });
}

export function useUpdateZone(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; payload: UpdateZonePayload }) =>
      updateZone(input.id, input.payload),
    onSuccess: () => invalidate(qc, siteId),
  });
}

export function useDeleteZone(siteId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteZone(id),
    onSuccess: () => invalidate(qc, siteId),
  });
}
