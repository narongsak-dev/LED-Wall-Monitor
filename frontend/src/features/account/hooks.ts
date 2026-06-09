import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import type {
  ChangePasswordPayload,
  UpdateProfilePayload,
} from '@monitor/shared';
import { useAuthStore } from '@/features/auth/store';
import {
  changePassword,
  fetchLoginHistory,
  updateProfile,
  type LoginHistoryParams,
} from './api';

export function useUpdateProfile() {
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (payload: UpdateProfilePayload) => updateProfile(payload),
    onSuccess: (user) => setUser(user),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (payload: ChangePasswordPayload) => changePassword(payload),
  });
}

export function useLoginHistory(params: LoginHistoryParams) {
  return useQuery({
    queryKey: ['login-history', params],
    queryFn: () => fetchLoginHistory(params),
    placeholderData: keepPreviousData,
  });
}
