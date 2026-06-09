import { api } from '@/lib/axios';
import type {
  PaginatedResponse,
  TelemetryPoint,
  TelemetryQuery,
} from '@monitor/shared';

export interface TelemetrySummary {
  range: { from: string; to: string };
  rowCount: number;
  firstTime: string | null;
  lastTime: string | null;
  energy: { delta: number; min: number | null; max: number | null };
  voltage: { avg: number | null; min: number | null; max: number | null };
  current: { avg: number | null; min: number | null; max: number | null };
  power: { avg: number | null; min: number | null; max: number | null };
  temperature: { avg: number | null; min: number | null; max: number | null };
  bySensor: {
    sensorId: number;
    count: number;
    avgPower: number | null;
    maxPower: number | null;
    energyDelta: number | null;
  }[];
}

export async function fetchTelemetrySummary(
  query: TelemetryQuery,
): Promise<TelemetrySummary> {
  const { data } = await api.get<TelemetrySummary>('/api/telemetry/summary', {
    params: query,
  });
  return data;
}

export async function fetchLatestTelemetry(siteId: number): Promise<TelemetryPoint> {
  const { data } = await api.get<TelemetryPoint>('/api/telemetry/latest', {
    params: { siteId },
  });
  return data;
}

export async function fetchTelemetrySeries(
  query: TelemetryQuery,
): Promise<TelemetryPoint[]> {
  const { data } = await api.get<TelemetryPoint[]>('/api/telemetry/series', {
    params: query,
  });
  return data;
}

export async function fetchTelemetryReport(
  query: TelemetryQuery & { page: number; pageSize: number },
): Promise<PaginatedResponse<TelemetryPoint>> {
  const { data } = await api.get<PaginatedResponse<TelemetryPoint>>(
    '/api/telemetry/report',
    { params: query },
  );
  return data;
}
