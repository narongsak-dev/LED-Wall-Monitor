import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import type { Site } from '@monitor/shared';

async function fetchSite(id: number): Promise<Site> {
  const { data } = await api.get<Site>(`/api/sites/${id}`);
  return data;
}

export function useSite(id: number | null | undefined) {
  return useQuery({
    queryKey: ['sites', 'detail', id] as const,
    queryFn: () => fetchSite(id!),
    enabled: id != null && !Number.isNaN(id),
  });
}
