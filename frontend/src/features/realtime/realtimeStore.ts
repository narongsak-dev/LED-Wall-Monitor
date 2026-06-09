import { create } from 'zustand';
import type { TelemetryPoint } from '@monitor/shared';

interface SensorRealtimeState {
  latest: TelemetryPoint | null;
  history: TelemetryPoint[];
}

interface SiteRealtimeState {
  bySensor: Record<number, SensorRealtimeState>;
  lastUpdatedAt: string | null;
}

interface RealtimeState {
  bySite: Record<number, SiteRealtimeState>;
  push: (siteId: number, point: TelemetryPoint) => void;
  pushForSensor: (siteId: number, sensorId: number, point: TelemetryPoint) => void;
  reset: (siteId: number) => void;
}

const HISTORY_LIMIT = 60;

export const useRealtimeStore = create<RealtimeState>((set) => ({
  bySite: {},

  // Legacy entry point - figures out sensor from the point itself.
  push: (siteId, point) => {
    const sensorId = point.sensorId ?? point.deviceId ?? 0;
    set((state) => updateState(state, siteId, sensorId, point));
  },

  pushForSensor: (siteId, sensorId, point) =>
    set((state) => updateState(state, siteId, sensorId, point)),

  reset: (siteId) =>
    set((state) => ({
      bySite: {
        ...state.bySite,
        [siteId]: { bySensor: {}, lastUpdatedAt: null },
      },
    })),
}));

function updateState(
  state: RealtimeState,
  siteId: number,
  sensorId: number,
  point: TelemetryPoint,
): Partial<RealtimeState> {
  const prevSite = state.bySite[siteId] ?? { bySensor: {}, lastUpdatedAt: null };
  const prevSensor = prevSite.bySensor[sensorId] ?? { latest: null, history: [] };
  const history = [...prevSensor.history, point].slice(-HISTORY_LIMIT);
  return {
    bySite: {
      ...state.bySite,
      [siteId]: {
        bySensor: {
          ...prevSite.bySensor,
          [sensorId]: { latest: point, history },
        },
        lastUpdatedAt: new Date().toISOString(),
      },
    },
  };
}

// Returns map of sensorId -> { latest, history }
export const useSiteRealtime = (siteId: number) =>
  useRealtimeStore((s) => s.bySite[siteId]);

export const useSensorRealtime = (siteId: number, sensorId: number | null) =>
  useRealtimeStore((s) =>
    sensorId != null ? s.bySite[siteId]?.bySensor[sensorId] : undefined,
  );
