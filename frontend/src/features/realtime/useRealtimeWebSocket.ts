import { useEffect } from 'react';
import { useRealtimeStore } from './realtimeStore';
import { useConnectionStore } from './connectionStore';
import { getSocket } from '@/lib/socket';
import { api } from '@/lib/axios';
import type { RealtimeUpdate } from '@monitor/shared';
import type { BoardSensorReading } from '@/features/boards/api';

// Slow background poll as fallback when WebSocket is disconnected.
const POLL_INTERVAL_MS = 15_000;

export function useRealtimeWebSocket(siteId: number | null) {
  const pushForSensor = useRealtimeStore((s) => s.pushForSensor);
  const setSocketState = useConnectionStore((s) => s.setSocketState);
  const setLastUpdate = useConnectionStore((s) => s.setLastUpdate);

  useEffect(() => {
    if (!siteId) return;

    let cancelled = false;

    const ingest = (arr: BoardSensorReading[]) => {
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
      if (arr.length > 0) setLastUpdate(new Date().toISOString(), 'http');
    };

    const fetchLatest = () =>
      api
        .get<BoardSensorReading[]>('/api/telemetry/latest', {
          params: { siteId, perSensor: 'true' },
        })
        .then((res) => {
          if (cancelled) return;
          const arr = Array.isArray(res.data)
            ? res.data
            : res.data
              ? [res.data]
              : [];
          ingest(arr);
        })
        .catch((err) => {
          console.warn('latest telemetry fetch failed:', err.message);
        });

    // Initial fetch + low-frequency polling fallback
    fetchLatest();
    const pollHandle = setInterval(fetchLatest, POLL_INTERVAL_MS);

    // WebSocket subscription — primary path
    const socket = getSocket();
    if (!socket.connected) socket.connect();

    const onConnect = () => {
      setSocketState('connected');
      socket.emit('site:subscribe', { siteId });
    };
    const onDisconnect = () => setSocketState('disconnected');
    const onReconnectAttempt = () => setSocketState('reconnecting');
    const onConnectError = () => setSocketState('reconnecting');

    const onUpdate = (update: RealtimeUpdate) => {
      if (update.siteId !== siteId) return;
      const sensorId = update.point.sensorId ?? update.deviceId;
      if (sensorId == null) return;
      pushForSensor(siteId, sensorId, update.point);
      setLastUpdate(new Date().toISOString(), 'ws');
    };

    if (socket.connected) {
      setSocketState('connected');
      socket.emit('site:subscribe', { siteId });
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
      socket.emit('site:unsubscribe', { siteId });
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_attempt', onReconnectAttempt);
      socket.off('connect_error', onConnectError);
      socket.off('telemetry:latest', onUpdate);
    };
  }, [siteId, pushForSensor, setSocketState, setLastUpdate]);
}
