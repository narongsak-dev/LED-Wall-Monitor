import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateSitePayload, UpdateSitePayload } from '@monitor/shared';
import { createSite, deleteSite, listAllSites, updateSite } from './adminApi';

const SITES_ADMIN_KEY = ['sites', 'admin'];

export function useAdminSites(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: SITES_ADMIN_KEY,
    queryFn: listAllSites,
    // Gate behind `enabled` so non-super-admin callers can skip the 403.
    enabled: options.enabled ?? true,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: SITES_ADMIN_KEY });
  qc.invalidateQueries({ queryKey: ['sites', 'mine'] });
  qc.invalidateQueries({ queryKey: ['sites', 'all'] });
  qc.invalidateQueries({ queryKey: ['users', 'list'] });
  qc.invalidateQueries({ queryKey: ['boards'] });
  qc.invalidateQueries({ queryKey: ['sensors'] });
}

export function useCreateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSitePayload) => createSite(payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useUpdateSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; payload: UpdateSitePayload }) =>
      updateSite(input.id, input.payload),
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDeleteSite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSite(id),
    onSuccess: () => invalidateAll(qc),
  });
}
