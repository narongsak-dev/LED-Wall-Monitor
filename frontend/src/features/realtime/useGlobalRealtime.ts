import { useEffect } from 'react';
import { useRealtimeStore } from './realtimeStore';
import { useConnectionStore } from './connectionStore';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/axios';
import type { RealtimeUpdate } from '@monitor/shared';
import type { BoardSensorReading } from '@/features/boards/api';

const POLL_INTERVAL_MS = 30_000;

/**
 * Subscribes to telemetry for *all* given site IDs at once and keeps the
 * realtime store + connection store in sync. Mount once at the app root so
 * alerts and the connection badge work regardless of the active page.
 */
export function useGlobalRealtime(siteIds: number[]) {
  const pushForSensor = useRealtimeStore((s) => s.pushForSensor);
  const setSocketState = useConnectionStore((s) => s.setSocketState);
  const setLastUpdate = useConnectionStore((s) => s.setLastUpdate);

  // Stable key so the effect re-runs only when the set of sites changes.
  const siteKey = siteIds.slice().sort((a, b) => a - b).join(',');

  useEffect(() => {
    if (siteIds.length === 0) return;

    let cancelled = false;

    const ingest = (siteId: number, arr: BoardSensorReading[]) => {
      for (const r of arr) {
        if (r.sensorId == null) continue;
        pushForSensor(siteId, r.sensorId, {
          time: r.time,
          sensorId: r.sensorId,
          siteId,
          voltage: r.voltage,
          current: r.current,
          power: r.power,
          energy: r.energy,
          temperature: r.temperature,
          humidity: r.humidity ?? null,
          raw: r.raw as Record<string, unknown> | undefined,
        });
      }
    };

    const fetchAll = async () => {
      let touched = false;
      for (const siteId of siteIds) {
        try {
          const res = await api.get<BoardSensorReading[]>('/api/telemetry/latest', {
            params: { siteId, perSensor: 'true' },
          });
          if (cancelled) return;
          const arr = Array.isArray(res.data) ? res.data : res.data ? [res.data] : [];
          if (arr.length > 0) {
            ingest(siteId, arr);
            touched = true;
          }
        } catch {
          // ignore individual failures
        }
      }
      if (touched) setLastUpdate(new Date().toISOString(), 'http');
    };

    fetchAll();
    const pollHandle = setInterval(fetchAll, POLL_INTERVAL_MS);

    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const subscribeAll = () => {
      for (const siteId of siteIds) socket.emit('site:subscribe', { siteId });
    };
    const unsubscribeAll = () => {
      for (const siteId of siteIds) socket.emit('site:unsubscribe', { siteId });
    };

    const onConnect = () => {
      setSocketState('connected');
      subscribeAll();
    };
    const onDisconnect = () => setSocketState('disconnected');
    const onReconnectAttempt = () => setSocketState('reconnecting');
    const onConnectError = () => setSocketState('reconnecting');

    const onUpdate = (update: RealtimeUpdate) => {
      if (!siteIds.includes(update.siteId)) return;
      const sensorId = update.point.sensorId ?? update.deviceId;
      if (sensorId == null) return;
      pushForSensor(update.siteId, sensorId, update.point);
      setLastUpdate(new Date().toISOString(), 'ws');
    };

    if (socket.connected) {
      setSocketState('connected');
      subscribeAll();
    } else {
      setSocketState('connecting');
    }
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_attempt', onReconnectAttempt);
    socket.on('connect_error', onConnectError);
    socket.on('telemetry:latest', onUpdate);

    return () => {
      cancelled = true;
      clearInterval(pollHandle);
      unsubscribeAll();
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('connect_error', onConnectError);
      socket.off('telemetry:latest', onUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteKey, pushForSensor, setSocketState, setLastUpdate]);
}
