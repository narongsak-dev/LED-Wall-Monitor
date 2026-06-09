import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  approveReset,
  fetchCaptcha,
  fetchPendingResets,
  fetchResetHistory,
  rejectReset,
  submitResetRequest,
} from './api';

const PENDING_KEY = ['password-resets', 'pending'];

export function useCaptcha() {
  return useQuery({
    queryKey: ['password-reset', 'captcha'],
    queryFn: fetchCaptcha,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useSubmitResetRequest() {
  return useMutation({ mutationFn: submitResetRequest });
}

export function usePendingResets(enabled: boolean) {
  return useQuery({
    queryKey: PENDING_KEY,
    queryFn: fetchPendingResets,
    enabled,
    refetchInterval: enabled ? 30_000 : false,
  });
}

export function useResetHistory(params: {
  limit: number;
  offset: number;
  enabled: boolean;
  userId?: number;
}) {
  return useQuery({
    queryKey: ['password-resets', 'history', params.limit, params.offset, params.userId ?? null],
    queryFn: () =>
      fetchResetHistory({
        limit: params.limit,
        offset: params.offset,
        userId: params.userId,
      }),
    enabled: params.enabled,
  });
}

export function useApproveReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => approveReset(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PENDING_KEY });
      qc.invalidateQueries({ queryKey: ['password-resets', 'history'] });
    },
  });
}

export function useRejectReset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      rejectReset(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PENDING_KEY });
      qc.invalidateQueries({ queryKey: ['password-resets', 'history'] });
    },
  });
}
