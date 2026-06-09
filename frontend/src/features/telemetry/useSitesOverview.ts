import { useMemo } from 'react';
import { useRealtimeStore } from '@/features/realtime/realtimeStore';
import type { TelemetryPoint } from '@monitor/shared';

interface SiteSnapshot {
  latest: TelemetryPoint | null;
  /** Highest power across all sensors at this site (W) */
  totalPower: number;
  /** Sum of latest energy across sensors (kWh) */
  totalEnergy: number;
  /** Max temperature across sensors (°C) */
  maxTemp: number;
  /** Number of sensors that have any data */
  liveSensorCount: number;
  /** ISO time of most recent reading across sensors */
  lastSeenAt: string | null;
  /** True when last reading is within 60s */
  online: boolean;
}

interface Result {
  byId: Record<number, SiteSnapshot | null>;
  isLoading: boolean;
}

/**
 * Aggregates per-site snapshots from the global realtime store.
 * Replaces HTTP polling — relies on `useGlobalRealtime` to keep the store fresh.
 */
export function useSitesOverview(siteIds: number[]): Result {
  const bySite = useRealtimeStore((s) => s.bySite);

  const byId = useMemo<Record<number, SiteSnapshot | null>>(() => {
    const map: Record<number, SiteSnapshot | null> = {};
    const now = Date.now();
    for (const siteId of siteIds) {
      const site = bySite[siteId];
      if (!site || Object.keys(site.bySensor).length === 0) {
        map[siteId] = null;
        continue;
      }
      let totalPower = 0;
      let totalEnergy = 0;
      let maxTemp = 0;
      let liveSensorCount = 0;
      let latestTime: number | null = null;
      let latestPoint: TelemetryPoint | null = null;

      for (const sensor of Object.values(site.bySensor)) {
        const p = sensor.latest;
        if (!p) continue;
        liveSensorCount += 1;
        if (p.power != null) totalPower += p.power;
        if (p.energy != null) totalEnergy += p.energy;
        if (p.temperature != null && p.temperature > maxTemp) maxTemp = p.temperature;
        const t = new Date(p.time).getTime();
        if (latestTime == null || t > latestTime) {
          latestTime = t;
          latestPoint = p;
        }
      }

      if (liveSensorCount === 0) {
        map[siteId] = null;
        continue;
      }

      map[siteId] = {
        latest: latestPoint,
        totalPower,
        totalEnergy,
        maxTemp,
        liveSensorCount,
        lastSeenAt: latestPoint?.time ?? null,
        online: latestTime != null && now - latestTime < 60_000,
      };
    }
    return map;
  }, [bySite, siteIds]);

  return { byId, isLoading: false };
}
