import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { usePendingResets } from './hooks';
import { toast } from '@/lib/toast';

/**
 * Global notifier that fires a toast whenever the number of pending
 * password-reset requests increases. Mounted in AppLayout so it runs once
 * per authenticated session and silently no-ops for viewers.
 *
 * Returns the current pending list so the caller can also show a badge if
 * it likes — saves a duplicate query.
 */
export function useResetNotifications() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const canApprove = !!user && user.role !== 'viewer';
  const { data: pending = [] } = usePendingResets(canApprove);

  // We persist the "seen" count across re-mounts so a quick page transition
  // doesn't re-fire the toast for a request the user has already seen.
  const seenRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canApprove) return;
    if (seenRef.current === null) {
      // First load — adopt the current count silently. Anything that arrives
      // AFTER this should fire a toast.
      seenRef.current = pending.length;
      return;
    }
    if (pending.length > seenRef.current) {
      const delta = pending.length - seenRef.current;
      toast(
        (t) => (
          <button
            type="button"
            onClick={() => {
              toast.dismiss(t.id);
              navigate('/admin/users');
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              padding: 0,
              textAlign: 'left',
            }}
          >
            <strong>คำขอตั้งรหัสผ่านใหม่</strong>
            <div style={{ color: 'var(--dim)', fontSize: 12, marginTop: 2 }}>
              {delta > 1 ? `+${delta} รายการ — ` : ''}คลิกเพื่อตรวจสอบ
            </div>
          </button>
        ),
        { icon: '🔔', duration: 8000 },
      );
    }
    seenRef.current = pending.length;
  }, [pending.length, canApprove, navigate]);

  return pending;
}
