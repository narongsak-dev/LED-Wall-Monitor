import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AlertSeverity = 'warning' | 'critical';

export interface AlertThresholds {
  voltageMin: number;     // V — below = warning
  voltageMax: number;     // V — above = warning
  currentMax: number;     // A — above = warning
  powerMax: number;       // W — above = warning
  temperatureMax: number; // °C — above = warning
  temperatureCritical: number; // °C — above = critical
}

export const DEFAULT_THRESHOLDS: AlertThresholds = {
  voltageMin: 210,
  voltageMax: 240,
  currentMax: 25,
  powerMax: 5500,
  temperatureMax: 40,
  temperatureCritical: 55,
};

export interface AlertEntry {
  id: string;
  time: string;
  sensorId: number;
  sensorCode: string;
  siteId: number;
  severity: AlertSeverity;
  metric: 'voltage' | 'current' | 'power' | 'temperature';
  value: number;
  thresholdMin?: number;
  thresholdMax?: number;
  message: string;
  acked: boolean;
}

interface AlertsState {
  thresholds: AlertThresholds;
  alerts: AlertEntry[];          // newest first
  setThresholds: (t: Partial<AlertThresholds>) => void;
  add: (a: Omit<AlertEntry, 'id' | 'acked'>) => AlertEntry | null;
  ack: (id: string) => void;
  ackAll: () => void;
  clear: () => void;
}

const HISTORY_LIMIT = 100;
// Once an alarm fires, suppress duplicates of the same (sensor + metric) for
// this many seconds so a single sustained problem doesn't spam the list.
const DEDUPE_WINDOW_S = 60;

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set, get) => ({
      thresholds: DEFAULT_THRESHOLDS,
      alerts: [],
      setThresholds: (t) =>
        set((s) => ({ thresholds: { ...s.thresholds, ...t } })),
      add: (a) => {
        const recent = get().alerts.find(
          (x) =>
            x.sensorId === a.sensorId &&
            x.metric === a.metric &&
            new Date(a.time).getTime() - new Date(x.time).getTime() <
              DEDUPE_WINDOW_S * 1000,
        );
        if (recent) return null;
        const entry: AlertEntry = {
          id: `${a.sensorId}-${a.metric}-${a.time}`,
          acked: false,
          ...a,
        };
        set((s) => ({ alerts: [entry, ...s.alerts].slice(0, HISTORY_LIMIT) }));
        return entry;
      },
      ack: (id) =>
        set((s) => ({
          alerts: s.alerts.map((a) => (a.id === id ? { ...a, acked: true } : a)),
        })),
      ackAll: () =>
        set((s) => ({ alerts: s.alerts.map((a) => ({ ...a, acked: true })) })),
      clear: () => set({ alerts: [] }),
    }),
    {
      name: 'alerts-store',
      partialize: (s) => ({ thresholds: s.thresholds, alerts: s.alerts }),
    },
  ),
);

export const useUnackedCount = () =>
  useAlertsStore((s) => s.alerts.filter((a) => !a.acked).length);
