import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from './store';

/**
 * Default idle window before auto-logout: 30 minutes of no user activity.
 * Activity = mouse move, keypress, click, scroll, or touch.
 */
const DEFAULT_IDLE_MS = 30 * 60 * 1000;

const ACTIVITY_EVENTS: (keyof DocumentEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'wheel',
  'touchstart',
  'scroll',
];

/**
 * Auto-logout the user after a period of inactivity — but only when they
 * did NOT tick "remember me" at login. Remembered sessions stay alive until
 * the user explicitly logs out (or their 90-day refresh token expires).
 */
export function useIdleLogout(idleMs: number = DEFAULT_IDLE_MS) {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const rememberMe = useAuthStore((s) => s.rememberMe);
  const clear = useAuthStore((s) => s.clear);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    // No active session, or user opted into a persistent session → no timer.
    if (!user || rememberMe) return;

    const reset = () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        clear();
        navigate('/login', { replace: true });
      }, idleMs);
    };
    reset();

    // Passive listeners — we don't need to interfere with the events, just
    // observe them to know the user is still around.
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev as string, reset, { passive: true });
    }

    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev as string, reset);
      }
    };
  }, [user, rememberMe, idleMs, clear, navigate]);
}
