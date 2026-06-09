import { api } from '@/lib/axios';
import type { BoardOtaStatus } from '@monitor/shared';

export async function triggerBoardOta(
  boardId: number,
  version: string,
): Promise<{ ok: true; version: string }> {
  const { data } = await api.post<{ ok: true; version: string }>(
    `/api/boards/${boardId}/firmware-update`,
    { version },
  );
  return data;
}

/** Pulls the latest cached OTA status. Returns null when the backend has
 *  never received a status event for this board — i.e. no OTA in progress. */
export async function fetchBoardOtaStatus(
  boardId: number,
): Promise<BoardOtaStatus | null> {
  try {
    const { data } = await api.get<BoardOtaStatus>(
      `/api/boards/${boardId}/ota-status`,
    );
    return data;
  } catch (e) {
    if ((e as { response?: { status?: number } }).response?.status === 404) {
      return null;
    }
    throw e;
  }
}
