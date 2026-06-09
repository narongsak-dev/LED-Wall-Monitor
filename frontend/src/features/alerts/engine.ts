import { useEffect } from 'react';
import { useAlertsStore, type AlertEntry } from './store';
import { useRealtimeStore } from '@/features/realtime/realtimeStore';
import type { TelemetryPoint } from '@monitor/shared';

interface SensorMeta {
  id: number;
  code: string;
  siteId: number;
  // Per-sensor overrides — null means use the global default.
  voltageMin?: number | null;
  voltageMax?: number | null;
  currentMax?: number | null;
  powerMax?: number | null;
  temperatureMax?: number | null;
}

/**
 * Watches realtime store and emits alarms when readings cross thresholds.
 * Per-sensor overrides win over the global defaults.
 */
export function useAlertEngine(sensors: SensorMeta[]) {
  const defaults = useAlertsStore((s) => s.thresholds);
  const addAlert = useAlertsStore((s) => s.add);
  const subscribeRealtime = useRealtimeStore.subscribe;

  useEffect(() => {
    if (sensors.length === 0) return;
    const byId = new Map(sensors.map((s) => [s.id, s]));
    const seen = new Map<number, string>(); // sensorId -> last point time

    const unsub = subscribeRealtime((state) => {
      for (const site of Object.values(state.bySite)) {
        for (const [sensorIdStr, sensor] of Object.entries(site.bySensor)) {
          const sensorId = Number(sensorIdStr);
          const meta = byId.get(sensorId);
          if (!meta) continue;
          const latest = sensor.latest;
          if (!latest) continue;

          const lastSeenTime = seen.get(sensorId);
          if (lastSeenTime === latest.time) continue;
          seen.set(sensorId, latest.time);

          const effective = {
            voltageMin: meta.voltageMin ?? defaults.voltageMin,
            voltageMax: meta.voltageMax ?? defaults.voltageMax,
            currentMax: meta.currentMax ?? defaults.currentMax,
            powerMax: meta.powerMax ?? defaults.powerMax,
            temperatureMax: meta.temperatureMax ?? defaults.temperatureMax,
            temperatureCritical: defaults.temperatureCritical,
          };
          checkPoint(latest, meta, effective, addAlert);
        }
      }
    });

    return unsub;
  }, [sensors, defaults, addAlert, subscribeRealtime]);
}

interface EffectiveThresholds {
  voltageMin: number;
  voltageMax: number;
  currentMax: number;
  powerMax: number;
  temperatureMax: number;
  temperatureCritical: number;
}

function checkPoint(
  p: TelemetryPoint,
  meta: SensorMeta,
  t: EffectiveThresholds,
  addAlert: ReturnType<typeof useAlertsStore.getState>['add'],
) {
  const emit = (
    metric: AlertEntry['metric'],
    value: number,
    severity: AlertEntry['severity'],
    message: string,
    thresholdMin?: number,
    thresholdMax?: number,
  ): AlertEntry | null =>
    addAlert({
      time: p.time,
      sensorId: meta.id,
      sensorCode: meta.code,
      siteId: meta.siteId,
      severity,
      metric,
      value,
      thresholdMin,
      thresholdMax,
      message,
    });

  if (p.voltage != null) {
    if (p.voltage < t.voltageMin) {
      const e = emit(
        'voltage',
        p.voltage,
        'warning',
        `แรงดันต่ำกว่าเกณฑ์ (${p.voltage.toFixed(1)}V < ${t.voltageMin}V)`,
        t.voltageMin,
      );
      if (e) maybeNotify(e);
    } else if (p.voltage > t.voltageMax) {
      const e = emit(
        'voltage',
        p.voltage,
        'warning',
        `แรงดันสูงกว่าเกณฑ์ (${p.voltage.toFixed(1)}V > ${t.voltageMax}V)`,
        undefined,
        t.voltageMax,
      );
      if (e) maybeNotify(e);
    }
  }

  if (p.current != null && p.current > t.currentMax) {
    const e = emit(
      'current',
      p.current,
      'warning',
      `กระแสสูงเกิน (${p.current.toFixed(2)}A > ${t.currentMax}A)`,
      undefined,
      t.currentMax,
    );
    if (e) maybeNotify(e);
  }

  if (p.power != null && p.power > t.powerMax) {
    const e = emit(
      'power',
      p.power,
      'warning',
      `กำลังสูงเกิน (${p.power.toFixed(0)}W > ${t.powerMax}W)`,
      undefined,
      t.powerMax,
    );
    if (e) maybeNotify(e);
  }

  if (p.temperature != null) {
    if (p.temperature >= t.temperatureCritical) {
      const e = emit(
        'temperature',
        p.temperature,
        'critical',
        `อุณหภูมิวิกฤต (${p.temperature.toFixed(1)}°C ≥ ${t.temperatureCritical}°C)`,
        undefined,
        t.temperatureCritical,
      );
      if (e) maybeNotify(e);
    } else if (p.temperature >= t.temperatureMax) {
      const e = emit(
        'temperature',
        p.temperature,
        'warning',
        `อุณหภูมิสูง (${p.temperature.toFixed(1)}°C ≥ ${t.temperatureMax}°C)`,
        undefined,
        t.temperatureMax,
      );
      if (e) maybeNotify(e);
    }
  }
}

function maybeNotify(alert: AlertEntry) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(`⚠ ${alert.sensorCode}`, {
      body: alert.message,
      tag: alert.id,
      requireInteraction: alert.severity === 'critical',
    });
  } catch {
    // ignore
  }
}
