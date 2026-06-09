import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Upload, Cpu, AlertCircle } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { BoardOtaStatus, BoardWithSensors } from '@monitor/shared';
import { useFirmwareList } from '@/features/firmware/hooks';
import {
  fetchBoardOtaStatus,
  triggerBoardOta,
} from '@/features/boards/otaApi';
import { getSocket } from '@/lib/socket';
import { extractApiError, showToast } from '@/lib/toast';

interface BoardOtaModalProps {
  board: BoardWithSensors | null;
  onClose: () => void;
}

const STATE_LABELS: Record<BoardOtaStatus['state'], string> = {
  idle: 'Preparing',
  downloading: 'Downloading',
  applying: 'Writing flash',
  success: 'Success',
  failed: 'Failed',
};

const STATE_COLORS: Record<BoardOtaStatus['state'], string> = {
  idle: 'var(--cyan)',
  downloading: 'var(--cyan)',
  applying: 'var(--yellow)',
  success: 'var(--green)',
  failed: 'var(--red)',
};

export function BoardOtaModal({ board, onClose }: BoardOtaModalProps) {
  const queryClient = useQueryClient();
  const { data: releases = [], isLoading } = useFirmwareList();
  const [picked, setPicked] = useState('');
  const [status, setStatus] = useState<BoardOtaStatus | null>(null);
  const [triggering, setTriggering] = useState(false);
  // Track the previous state so we can fire side-effects on edge transitions
  // (e.g. invalidate board queries the moment OTA flips to success — that
  // refreshes `board.firmware` in every list/detail view without a manual
  // reload).
  const prevStateRef = useRef<BoardOtaStatus['state'] | null>(null);

  // Pre-select the latest active release for convenience.
  const activeReleases = useMemo(
    () => releases.filter((r) => r.isActive),
    [releases],
  );
  useEffect(() => {
    if (!picked && activeReleases[0]) setPicked(activeReleases[0].version);
  }, [picked, activeReleases]);

  // Seed status from REST snapshot when the modal opens, then subscribe to
  // live updates via Socket.IO. Backend emits one global `board:ota_status`
  // event; we filter by boardId here.
  useEffect(() => {
    if (!board) {
      setStatus(null);
      return;
    }
    let alive = true;
    fetchBoardOtaStatus(board.id).then((s) => {
      if (alive) setStatus(s);
    });
    const socket = getSocket();
    if (!socket.connected) socket.connect();
    const handler = (s: BoardOtaStatus) => {
      if (s.boardId === board.id) setStatus(s);
    };
    socket.on('board:ota_status', handler);
    return () => {
      alive = false;
      socket.off('board:ota_status', handler);
    };
  }, [board]);

  // On state transitions, refresh dependent queries so the new firmware
  // version propagates everywhere (board list, board detail, sensor pages).
  useEffect(() => {
    const cur = status?.state ?? null;
    const prev = prevStateRef.current;
    if (cur !== prev) {
      prevStateRef.current = cur;
      if (cur === 'success') {
        queryClient.invalidateQueries({ queryKey: ['boards'] });
        queryClient.invalidateQueries({ queryKey: ['board'] });
      }
    }
  }, [status?.state, queryClient]);

  if (!board) return null;

  const handleTrigger = async () => {
    if (!picked) return;
    setTriggering(true);
    try {
      await triggerBoardOta(board.id, picked);
      showToast(`สั่งอัปเดต ${board.code} → ${picked}`, 'success');
    } catch (err) {
      showToast(extractApiError(err, 'สั่งอัปเดตไม่สำเร็จ'), 'error');
    } finally {
      setTriggering(false);
    }
  };

  const inProgress =
    status &&
    (status.state === 'idle' ||
      status.state === 'downloading' ||
      status.state === 'applying');
  const pct =
    status && status.total > 0
      ? Math.min(100, (status.done * 100) / status.total)
      : 0;

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={20} color="var(--cyan)" />
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
                อัปเดตเฟิร์มแวร์ — {board.code}
              </div>
              <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>
                เวอร์ชันปัจจุบัน: <strong>{board.firmware ?? 'unknown'}</strong>
              </div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 22 }}>
          <Field label="เลือกเวอร์ชันใหม่">
            <select
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
              disabled={isLoading || triggering || !!inProgress}
              style={inputStyle}
            >
              {activeReleases.length === 0 && (
                <option value="">— ยังไม่มีไฟล์ใน catalog —</option>
              )}
              {activeReleases.map((r) => (
                <option key={r.id} value={r.version}>
                  {r.version}
                  {r.description ? ` — ${r.description.slice(0, 60)}` : ''}
                </option>
              ))}
            </select>
          </Field>

          {!status && (
            <div
              style={{
                marginTop: 16,
                padding: '12px 14px',
                background: 'rgba(34, 211, 238, 0.06)',
                border: '1px solid rgba(34, 211, 238, 0.25)',
                borderRadius: 10,
                fontSize: 12.5,
                color: 'var(--dim)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertCircle size={14} style={{ marginTop: 2 }} />
              <span>
                Backend จะ publish คำสั่งผ่าน MQTT — บอร์ดจะดาวน์โหลดและ flash
                อัตโนมัติ ใช้เวลา ~10-15 วินาที จากนั้นรีสตาร์ทเอง
              </span>
            </div>
          )}

          {status && (
            <div
              style={{
                marginTop: 16,
                padding: 14,
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    padding: '2px 10px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.06)',
                    color: STATE_COLORS[status.state],
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '.06em',
                  }}
                >
                  {STATE_LABELS[status.state]}
                </span>
                {status.targetVersion && (
                  <span style={{ fontSize: 12, color: 'var(--dim)' }}>
                    → <strong>{status.targetVersion}</strong>
                  </span>
                )}
              </div>
              <div
                style={{
                  height: 8,
                  background: 'var(--bg-card)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, var(--cyan), var(--cyan-bright))`,
                    transition: 'width 0.3s',
                  }}
                />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--dim)' }}>
                {status.total > 0
                  ? `${(status.done / 1024).toFixed(0)} / ${(status.total / 1024).toFixed(0)} KB (${pct.toFixed(0)}%)`
                  : status.message || '—'}
              </div>
              {status.message && status.total > 0 && (
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 4 }}>
                  {status.message}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={footer}>
          <button onClick={onClose} style={secondaryBtn}>
            ปิด
          </button>
          <button
            onClick={handleTrigger}
            disabled={!picked || triggering || !!inProgress}
            style={{
              ...primaryBtn,
              opacity: !picked || triggering || !!inProgress ? 0.5 : 1,
              cursor:
                !picked || triggering || !!inProgress
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            <Upload size={14} />
            {triggering
              ? 'กำลังส่งคำสั่ง...'
              : inProgress
                ? 'กำลังอัปเดตอยู่...'
                : 'สั่งอัปเดต'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          color: 'var(--dim)',
          fontWeight: 600,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const modal: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 14,
  width: '100%',
  maxWidth: 540,
  boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
};

const header: React.CSSProperties = {
  padding: '18px 22px',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  borderBottom: '1px solid var(--border-color)',
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--dim)',
  cursor: 'pointer',
};

const footer: React.CSSProperties = {
  padding: '14px 22px',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  borderTop: '1px solid var(--border-color)',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 18px',
  background: 'var(--cyan)',
  color: '#000',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const secondaryBtn: React.CSSProperties = {
  padding: '9px 18px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
