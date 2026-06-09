import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listBoards,
  findBoard,
  fetchBoardLatest,
  createBoard,
  updateBoard,
  deleteBoard,
} from './api';
import type { CreateBoardPayload, UpdateBoardPayload } from '@monitor/shared';

export function useBoards(siteId?: number) {
  return useQuery({
    queryKey: ['boards', siteId ?? 'all'],
    queryFn: () => listBoards(siteId),
  });
}

export function useBoard(boardId: number | null) {
  return useQuery({
    queryKey: ['board', boardId],
    queryFn: () => findBoard(boardId!),
    enabled: boardId != null,
  });
}

export function useBoardLatest(siteId: number | null, boardId: number | null) {
  return useQuery({
    queryKey: ['board-latest', siteId, boardId],
    queryFn: () => fetchBoardLatest(siteId!, boardId!),
    enabled: siteId != null && boardId != null,
    refetchInterval: 3000,
  });
}

function invalidateBoardQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['boards'] });
  qc.invalidateQueries({ queryKey: ['board'] });
  qc.invalidateQueries({ queryKey: ['sensors'] });
}

export function useCreateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateBoardPayload) => createBoard(payload),
    onSuccess: () => invalidateBoardQueries(qc),
  });
}

export function useUpdateBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: UpdateBoardPayload }) =>
      updateBoard(id, payload),
    onSuccess: () => invalidateBoardQueries(qc),
  });
}

export function useDeleteBoard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBoard(id),
    onSuccess: () => invalidateBoardQueries(qc),
  });
}
