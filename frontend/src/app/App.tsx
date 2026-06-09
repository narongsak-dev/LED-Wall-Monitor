import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppRouter } from './router';
import { listSensors } from '@/features/sensors/api';
import { fetchMySites } from '@/features/sites/api';
import { useAlertEngine } from '@/features/alerts/engine';
import { useGlobalRealtime } from '@/features/realtime/useGlobalRealtime';
import { useAuthStore } from '@/features/auth/store';

export function App() {
  const token = useAuthStore((s) => s.accessToken);

  // Sites the user has access to — subscribe to all of them globally
  // so alerts and the live indicator keep working regardless of page.
  const { data: mySites = [] } = useQuery({
    queryKey: ['sites', 'mine'],
    queryFn: fetchMySites,
    staleTime: 60_000,
    enabled: !!token,
  });
  const siteIds = useMemo(() => mySites.map((s) => s.site.id), [mySites]);
  useGlobalRealtime(siteIds);

  const { data: allSensors = [] } = useQuery({
    queryKey: ['sensors', 'site', 'all-for-alerts'],
    queryFn: () => listSensors(),
    enabled: !!token,
    staleTime: 60_000,
  });
  const sensorsForAlerts = useMemo(
    () =>
      allSensors.map((s) => ({
        id: s.id,
        code: s.code,
        siteId: s.siteId,
        voltageMin: s.voltageMin,
        voltageMax: s.voltageMax,
        currentMax: s.currentMax,
        powerMax: s.powerMax,
        temperatureMax: s.temperatureMax,
      })),
    [allSensors],
  );
  useAlertEngine(sensorsForAlerts);

  return <AppRouter />;
}
