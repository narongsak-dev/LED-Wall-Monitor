import { api } from '@/lib/axios';
import type {
  CreateSensorPayload,
  SensorWithContext,
  UpdateSensorPayload,
} from '@monitor/shared';

export async function listSensors(filter?: {
  siteId?: number;
  boardId?: number;
}): Promise<SensorWithContext[]> {
  const { data } = await api.get<SensorWithContext[]>('/api/sensors', {
    params: filter,
  });
  return data;
}

export async function findSensor(id: number): Promise<SensorWithContext> {
  const { data } = await api.get<SensorWithContext>(`/api/sensors/${id}`);
  return data;
}

export async function createSensor(
  payload: CreateSensorPayload,
): Promise<SensorWithContext> {
  const { data } = await api.post<SensorWithContext>('/api/sensors', payload);
  return data;
}

export async function updateSensor(
  id: number,
  payload: UpdateSensorPayload,
): Promise<SensorWithContext> {
  const { data } = await api.patch<SensorWithContext>(`/api/sensors/${id}`, payload);
  return data;
}

export async function deleteSensor(id: number): Promise<void> {
  await api.delete(`/api/sensors/${id}`);
}
