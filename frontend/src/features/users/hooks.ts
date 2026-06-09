import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateUserPayload, UpdateUserPayload } from '@monitor/shared';
import {
  createUser,
  deleteUser,
  listAllSites,
  listUsers,
  resetUserPassword,
  updateUser,
} from './api';

const USERS_KEY = ['users', 'list'];
const SITES_ALL_KEY = ['sites', 'all'];

export function useUsers() {
  return useQuery({
    queryKey: USERS_KEY,
    queryFn: listUsers,
  });
}

export function useAllSites() {
  return useQuery({
    queryKey: SITES_ALL_KEY,
    queryFn: listAllSites,
    staleTime: 5 * 60_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateUserPayload) => createUser(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: number; payload: UpdateUserPayload }) =>
      updateUser(input.id, input.payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteUser(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useResetUserPassword() {
  return useMutation({
    mutationFn: (id: number) => resetUserPassword(id),
  });
}
