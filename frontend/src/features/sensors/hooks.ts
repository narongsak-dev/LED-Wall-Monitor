import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createSensor,
  deleteSensor,
  listSensors,
  updateSensor,
} from './api';
import type { CreateSensorPayload, UpdateSensorPayload } from '@monitor/shared';

export function useSiteSensors(siteId: number | null) {
  return useQuery({
    queryKey: ['sensors', 'site', siteId],
    queryFn: () => listSensors({ siteId: siteId! }),
    enabled: siteId != null,
  });
}

export function useBoardSensors(boardId: number | null) {
  return useQuery({
    queryKey: ['sensors', 'board', boardId],
    queryFn: () => listSensors({ boardId: boardId! }),
    enabled: boardId != null,
  });
}

function invalidateSensorQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['sensors'] });
  qc.invalidateQueries({ queryKey: ['boards'] });
  qc.invalidateQueries({ queryKey: ['board'] });
}

export function useCreateSensor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSensorPayload) => createSensor(payload),
    onSuccess: () => invalidateSensorQueries(qc),
  });
}

export function useUpdateSensor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateSensorPayload }) =>
      updateSensor(id, payload),
    onSuccess: () => invalidateSensorQueries(qc),
  });
}

export function useDeleteSensor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSensor(id),
    onSuccess: () => invalidateSensorQueries(qc),
  });
}
