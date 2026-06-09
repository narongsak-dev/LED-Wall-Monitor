import { api } from '@/lib/axios';
import type {
  CreateUserPayload,
  Site,
  UpdateUserPayload,
  UserWithPermissions,
} from '@monitor/shared';

export async function listUsers(): Promise<UserWithPermissions[]> {
  const { data } = await api.get<UserWithPermissions[]>('/api/users');
  return data;
}

export async function createUser(
  payload: CreateUserPayload,
): Promise<UserWithPermissions> {
  const { data } = await api.post<UserWithPermissions>('/api/users', payload);
  return data;
}

export async function updateUser(
  id: number,
  payload: UpdateUserPayload,
): Promise<UserWithPermissions> {
  const { data } = await api.patch<UserWithPermissions>(`/api/users/${id}`, payload);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await api.delete(`/api/users/${id}`);
}

export async function resetUserPassword(
  id: number,
): Promise<{ username: string; newPassword: string }> {
  const { data } = await api.post<{ username: string; newPassword: string }>(
    `/api/users/${id}/reset-password`,
  );
  return data;
}

export async function listAllSites(): Promise<Site[]> {
  const { data } = await api.get<Site[]>('/api/sites/all');
  return data;
}
