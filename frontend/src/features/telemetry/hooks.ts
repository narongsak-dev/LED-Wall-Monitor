import { useQuery } from '@tanstack/react-query';
import type { TelemetryQuery } from '@monitor/shared';
import {
  fetchLatestTelemetry,
  fetchTelemetryReport,
  fetchTelemetrySeries,
  fetchTelemetrySummary,
} from './api';

export function useLatestTelemetry(siteId: number | null) {
  return useQuery({
    queryKey: ['telemetry', 'latest', siteId],
    queryFn: () => fetchLatestTelemetry(siteId!),
    enabled: siteId != null,
    refetchInterval: 60_000,
  });
}

// In realtime mode we auto-refresh every 10 s so the dashboard feels live
// without the user touching the filter. Other ranges don't auto-refresh —
// re-rendering year-long aggregates every 10 s is wasteful.
const realtimeRefetchMs = (q: TelemetryQuery | null): number | false =>
  q?.range === 'realtime' ? 10_000 : false;

export function useTelemetrySeries(query: TelemetryQuery | null) {
  return useQuery({
    queryKey: ['telemetry', 'series', query],
    queryFn: () => fetchTelemetrySeries(query!),
    enabled: query != null,
    refetchInterval: realtimeRefetchMs(query),
    placeholderData: (previous) => previous,
  });
}

export function useTelemetryReport(
  query: (TelemetryQuery & { page: number; pageSize: number }) | null,
) {
  return useQuery({
    queryKey: ['telemetry', 'report', query],
    queryFn: () => fetchTelemetryReport(query!),
    enabled: query != null,
    refetchInterval: realtimeRefetchMs(query),
    placeholderData: (previous) => previous,
  });
}

export function useTelemetrySummary(query: TelemetryQuery | null) {
  return useQuery({
    queryKey: ['telemetry', 'summary', query],
    queryFn: () => fetchTelemetrySummary(query!),
    enabled: query != null,
    refetchInterval: realtimeRefetchMs(query),
    placeholderData: (previous) => previous,
  });
}
