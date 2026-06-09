import { create } from 'zustand';

export type SocketState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected';

interface ConnectionState {
  socketState: SocketState;
  lastUpdateAt: string | null;
  lastUpdateSource: 'ws' | 'http' | null;
  setSocketState: (s: SocketState) => void;
  setLastUpdate: (iso: string, source: 'ws' | 'http') => void;
}

export const useConnectionStore = create<ConnectionState>((set) => ({
  socketState: 'idle',
  lastUpdateAt: null,
  lastUpdateSource: null,
  setSocketState: (socketState) => set({ socketState }),
  setLastUpdate: (iso, source) => set({ lastUpdateAt: iso, lastUpdateSource: source }),
}));
