import { api } from '@/lib/axios';
import type {
  ApproveResetResponse,
  CaptchaChallenge,
  PendingResetItem,
  ResetHistoryResponse,
  SubmitResetRequestPayload,
} from '@monitor/shared';

export async function fetchCaptcha(): Promise<CaptchaChallenge> {
  const { data } = await api.get<CaptchaChallenge>('/api/auth/password-reset/captcha');
  return data;
}

export async function submitResetRequest(
  payload: SubmitResetRequestPayload,
): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>(
    '/api/auth/password-reset/request',
    payload,
  );
  return data;
}

export async function fetchPendingResets(): Promise<PendingResetItem[]> {
  const { data } = await api.get<PendingResetItem[]>('/api/users/me/pending-resets');
  return data;
}

export async function approveReset(id: number): Promise<ApproveResetResponse> {
  const { data } = await api.post<ApproveResetResponse>(
    `/api/users/password-resets/${id}/approve`,
  );
  return data;
}

export async function rejectReset(
  id: number,
  reason?: string,
): Promise<{ ok: true }> {
  const { data } = await api.post<{ ok: true }>(
    `/api/users/password-resets/${id}/reject`,
    { reason },
  );
  return data;
}

export async function fetchResetHistory(params: {
  limit?: number;
  offset?: number;
  userId?: number;
}): Promise<ResetHistoryResponse> {
  const { data } = await api.get<ResetHistoryResponse>(
    '/api/users/password-resets/history',
    { params },
  );
  return data;
}
