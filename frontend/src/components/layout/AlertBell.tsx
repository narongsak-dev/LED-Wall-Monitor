import { useEffect, useRef, useState } from 'react';
import { Bell, BellRing, Trash2, Check } from 'lucide-react';
import { useAlertsStore, useUnackedCount } from '@/features/alerts/store';
import { dayjs } from '@/lib/dayjs';

export function AlertBell() {
  const unacked = useUnackedCount();
  const alerts = useAlertsStore((s) => s.alerts);
  const ack = useAlertsStore((s) => s.ack);
  const ackAll = useAlertsStore((s) => s.ackAll);
  const clear = useAlertsStore((s) => s.clear);
  const [open, setOpen] = useState(false);
  const [notifyAllowed, setNotifyAllowed] = useState<boolean>(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifyAllowed(Notification.permission === 'granted');
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const requestPermission = async () => {
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    setNotifyAllowed(perm === 'granted');
  };

  const hasUnacked = unacked > 0;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={`การแจ้งเตือน${hasUnacked ? ` (${unacked} รายการใหม่)` : ''}`}
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: hasUnacked ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-input)',
          border: `1px solid ${hasUnacked ? 'rgba(239, 68, 68, 0.35)' : 'var(--border-color)'}`,
          color: hasUnacked ? '#ef4444' : 'var(--text)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          fontFamily: 'inherit',
        }}
      >
        {hasUnacked ? <BellRing size={16} className="pulse-dot" /> : <Bell size={16} />}
        {hasUnacked && (
          <span
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              borderRadius: 999,
              background: '#ef4444',
              color: '#fff',
              fontSize: 9.5,
              fontWeight: 700,
              padding: '0 4px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--bg-body)',
            }}
          >
            {unacked > 99 ? '99+' : unacked}
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 380,
            maxHeight: 460,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 12,
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
              การแจ้งเตือน {alerts.length > 0 && <span style={{ color: 'var(--dim)', fontWeight: 500 }}>({alerts.length})</span>}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {hasUnacked && (
                <button
                  onClick={ackAll}
                  title="อ่านทั้งหมด"
                  style={iconBtn}
                >
                  <Check size={13} />
                </button>
              )}
              {alerts.length > 0 && (
                <button onClick={clear} title="ล้างประวัติ" style={iconBtn}>
                  <Trash2 size={13} color="#ef4444" />
                </button>
              )}
            </div>
          </div>

          {!notifyAllowed && (
            <button
              onClick={requestPermission}
              style={{
                padding: '10px 16px',
                background: 'rgba(34, 211, 238, 0.08)',
                border: 'none',
                borderBottom: '1px solid var(--border-color)',
                color: 'var(--cyan)',
                cursor: 'pointer',
                fontSize: 12,
                textAlign: 'left',
                fontFamily: 'inherit',
              }}
            >
              🔔 เปิดการแจ้งเตือนผ่านเบราว์เซอร์
            </button>
          )}

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {alerts.length === 0 ? (
              <div
                style={{
                  padding: 30,
                  textAlign: 'center',
                  color: 'var(--dim)',
                  fontSize: 13,
                }}
              >
                ไม่มีการแจ้งเตือน
              </div>
            ) : (
              alerts.map((a) => {
                const color = a.severity === 'critical' ? '#ef4444' : '#f59e0b';
                return (
                  <div
                    key={a.id}
                    onClick={() => ack(a.id)}
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border-color)',
                      borderLeft: `3px solid ${color}`,
                      cursor: 'pointer',
                      background: a.acked ? 'transparent' : 'rgba(239, 68, 68, 0.04)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 3,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: 'var(--text)',
                          letterSpacing: '0.02em',
                        }}
                      >
                        {a.sensorCode}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: 'var(--dim2)',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {dayjs(a.time).fromNow()}
                      </span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.4 }}>
                      {a.message}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = {
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  width: 26,
  height: 26,
  borderRadius: 7,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
};
