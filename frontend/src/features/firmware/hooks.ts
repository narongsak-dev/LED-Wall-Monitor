import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  deleteFirmware,
  listFirmware,
  setFirmwareActive,
  uploadFirmware,
} from './api';

const KEY = ['firmware', 'list'];

export function useFirmwareList() {
  return useQuery({
    queryKey: KEY,
    queryFn: listFirmware,
  });
}

export function useUploadFirmware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadFirmware,
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useSetFirmwareActive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      setFirmwareActive(id, isActive),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteFirmware() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteFirmware(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
