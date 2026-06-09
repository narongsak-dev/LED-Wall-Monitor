import { api } from '@/lib/axios';
import type {
  BoardWithSensors,
  CreateBoardPayload,
  TelemetryPoint,
  UpdateBoardPayload,
} from '@monitor/shared';

export async function listBoards(siteId?: number): Promise<BoardWithSensors[]> {
  const { data } = await api.get<BoardWithSensors[]>('/api/boards', {
    params: siteId != null ? { siteId } : undefined,
  });
  return data;
}

export async function findBoard(id: number): Promise<BoardWithSensors> {
  const { data } = await api.get<BoardWithSensors>(`/api/boards/${id}`);
  return data;
}

export async function createBoard(
  payload: CreateBoardPayload,
): Promise<BoardWithSensors> {
  const { data } = await api.post<BoardWithSensors>('/api/boards', payload);
  return data;
}

export async function updateBoard(
  id: number,
  payload: UpdateBoardPayload,
): Promise<BoardWithSensors> {
  const { data } = await api.patch<BoardWithSensors>(`/api/boards/${id}`, payload);
  return data;
}

export async function deleteBoard(id: number): Promise<void> {
  await api.delete(`/api/boards/${id}`);
}

export interface BoardSensorReading {
  sensorId: number;
  time: string;
  voltage: number | null;
  current: number | null;
  power: number | null;
  energy: number | null;
  temperature: number | null;
  humidity: number | null;
  raw: unknown;
}

export async function fetchBoardLatest(
  siteId: number,
  boardId: number,
): Promise<BoardSensorReading[]> {
  const { data } = await api.get<BoardSensorReading[]>('/api/telemetry/latest', {
    params: { siteId, boardId },
  });
  return data ?? [];
}

export async function fetchSensorLatest(
  siteId: number,
  sensorId: number,
): Promise<TelemetryPoint | null> {
  const { data } = await api.get<TelemetryPoint | null>('/api/telemetry/latest', {
    params: { siteId, sensorId },
  });
  return data;
}
