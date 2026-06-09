import { Wifi, WifiOff, RefreshCw, Loader2 } from 'lucide-react';
import { useConnectionStore } from '@/features/realtime/connectionStore';
import { dayjs } from '@/lib/dayjs';
import { useEffect, useState } from 'react';

export function ConnectionBadge() {
  const socketState = useConnectionStore((s) => s.socketState);
  const lastUpdateAt = useConnectionStore((s) => s.lastUpdateAt);
  const lastUpdateSource = useConnectionStore((s) => s.lastUpdateSource);

  // Tick every second so the relative time updates.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const visual = (() => {
    switch (socketState) {
      case 'connected':
        return {
          icon: <Wifi size={12} />,
          label: 'LIVE',
          color: '#22c55e',
          bg: 'rgba(34, 197, 94, 0.12)',
          border: 'rgba(34, 197, 94, 0.35)',
        };
      case 'connecting':
        return {
          icon: <Loader2 size={12} className="spin" />,
          label: 'CONNECTING',
          color: '#facc15',
          bg: 'rgba(250, 204, 21, 0.12)',
          border: 'rgba(250, 204, 21, 0.35)',
        };
      case 'reconnecting':
        return {
          icon: <RefreshCw size={12} className="spin" />,
          label: 'RECONNECT',
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.35)',
        };
      case 'disconnected':
        return {
          icon: <WifiOff size={12} />,
          label: 'OFFLINE',
          color: '#ef4444',
          bg: 'rgba(239, 68, 68, 0.12)',
          border: 'rgba(239, 68, 68, 0.35)',
        };
      default:
        return {
          icon: <WifiOff size={12} />,
          label: 'IDLE',
          color: '#94a3b8',
          bg: 'rgba(148, 163, 184, 0.12)',
          border: 'rgba(148, 163, 184, 0.25)',
        };
    }
  })();

  const lastUpdateLabel = lastUpdateAt
    ? `${dayjs(lastUpdateAt).fromNow()}${
        lastUpdateSource === 'http' ? ' (poll)' : ''
      }`
    : 'no data';

  return (
    <div
      title={`WebSocket: ${socketState}\nLast update: ${
        lastUpdateAt ? dayjs(lastUpdateAt).format('HH:mm:ss') : '—'
      }`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 12px',
        borderRadius: 999,
        background: visual.bg,
        border: `1px solid ${visual.border}`,
        color: visual.color,
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.05em',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
      }}
    >
      {visual.icon}
      <span>{visual.label}</span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 500,
          color: 'var(--dim)',
          letterSpacing: 0,
          textTransform: 'none',
          paddingLeft: 4,
          borderLeft: `1px solid ${visual.border}`,
        }}
      >
        {lastUpdateLabel}
      </span>
    </div>
  );
}
