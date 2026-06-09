import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/features/auth/store';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (socket) return socket;

  const url = import.meta.env.VITE_WS_URL ?? '/';
  socket = io(url, {
    autoConnect: false,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1_000,
    reconnectionDelayMax: 10_000,
    transports: ['websocket', 'polling'],
    // Auth is re-evaluated on every (re)connection attempt, so it picks up
    // the current token after login.
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken ?? '' }),
  });

  // Diagnostic logging — visible in DevTools console.
  socket.on('connect', () => {
    console.info('[socket] connected', socket?.id);
  });
  socket.on('disconnect', (reason) => {
    console.info('[socket] disconnected:', reason);
  });
  socket.on('connect_error', (err) => {
    console.warn('[socket] connect_error:', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
