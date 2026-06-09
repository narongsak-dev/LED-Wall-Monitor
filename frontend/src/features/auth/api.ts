import { api } from '@/lib/axios';
import type { LoginRequest, LoginResponse, User } from '@monitor/shared';

export async function login(payload: LoginRequest): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/api/auth/login', payload);
  return data;
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await api.get<User>('/api/users/me');
  return data;
}

export async function finishReset(
  newPassword: string,
): Promise<{ accessToken: string; refreshToken: string; mustChangePassword: boolean }> {
  const { data } = await api.post<{
    accessToken: string;
    refreshToken: string;
    mustChangePassword: boolean;
  }>('/api/auth/finish-reset', { newPassword });
  return data;
}
