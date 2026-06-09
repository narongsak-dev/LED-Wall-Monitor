import { api } from '@/lib/axios';
import type {
  ChangePasswordPayload,
  LoginHistoryResponse,
  UpdateProfilePayload,
  User,
} from '@monitor/shared';

export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  const { data } = await api.patch<User>('/api/users/me', payload);
  return data;
}

export async function changePassword(
  payload: ChangePasswordPayload,
): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(
    '/api/users/me/change-password',
    payload,
  );
  return data;
}

export interface LoginHistoryParams {
  limit?: number;
  offset?: number;
  /** When true, fetch every user's history (super_admin only). */
  all?: boolean;
}

export async function fetchLoginHistory(
  params: LoginHistoryParams = {},
): Promise<LoginHistoryResponse> {
  const { all, ...query } = params;
  const url = all ? '/api/users/login-history/all' : '/api/users/me/login-history';
  const { data } = await api.get<LoginHistoryResponse>(url, { params: query });
  return data;
}
