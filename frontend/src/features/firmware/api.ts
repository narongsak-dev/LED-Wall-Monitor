import { api } from '@/lib/axios';
import type { FirmwareRelease } from '@monitor/shared';

export async function listFirmware(): Promise<FirmwareRelease[]> {
  const { data } = await api.get<FirmwareRelease[]>('/api/firmware');
  return data;
}

export async function uploadFirmware(input: {
  file: File;
  version: string;
  description?: string;
  onProgress?: (loaded: number, total: number) => void;
}): Promise<FirmwareRelease> {
  const form = new FormData();
  form.append('firmware', input.file);
  form.append('version', input.version);
  if (input.description) form.append('description', input.description);
  const { data } = await api.post<FirmwareRelease>('/api/firmware/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (e) => {
      if (input.onProgress && e.total) input.onProgress(e.loaded, e.total);
    },
  });
  return data;
}

export async function setFirmwareActive(id: number, isActive: boolean): Promise<FirmwareRelease> {
  const { data } = await api.patch<FirmwareRelease>(`/api/firmware/${id}/active`, {
    isActive,
  });
  return data;
}

export async function deleteFirmware(id: number): Promise<{ ok: true }> {
  const { data } = await api.delete<{ ok: true }>(`/api/firmware/${id}`);
  return data;
}
