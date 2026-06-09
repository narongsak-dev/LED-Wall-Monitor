import { useState } from 'react';
import {
  ShieldQuestion,
  Check,
  X,
  Clock,
  Mail,
  Phone,
  Globe,
  CircleAlert,
  KeyRound,
  Copy,
} from 'lucide-react';
import { dayjs } from '@/lib/dayjs';
import {
  useApproveReset,
  usePendingResets,
  useRejectReset,
} from '@/features/password-reset/hooks';
import { extractApiError, showToast } from '@/lib/toast';
import { copyToClipboard } from '@/lib/clipboard';
import type { PendingResetItem } from '@monitor/shared';

/** Inbox of password-reset requests this user is allowed to approve.
 *  Renders nothing (empty state hidden) when the actor has no pending items.
 *  Use `showWhenEmpty` to keep the empty state visible. */
export function PendingResetsInbox({
  enabled,
  showWhenEmpty = false,
}: {
  enabled: boolean;
  showWhenEmpty?: boolean;
}) {
  const { data: pending = [], isLoading } = usePendingResets(enabled);
  const approveMut = useApproveReset();
  const rejectMut = useRejectReset();

  const [rejecting, setRejecting] = useState<PendingResetItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [approved, setApproved] = useState<{
    username: string;
    code: string;
    expiresAt: string;
  } | null>(null);

  const onApprove = async (item: PendingResetItem) => {
    try {
      const res = await approveMut.mutateAsync(item.id);
      setApproved({ username: res.username, code: res.code, expiresAt: res.expiresAt });
    } catch (err) {
      showToast(extractApiError(err, 'อนุมัติไม่สำเร็จ'), 'error');
    }
  };

  const onReject = async () => {
    if (!rejecting) return;
    try {
      await rejectMut.mutateAsync({ id: rejecting.id, reason: rejectReason });
      showToast('ปฏิเสธคำขอแล้ว', 'info');
      setRejecting(null);
      setRejectReason('');
    } catch (err) {
      showToast(extractApiError(err, 'ปฏิเสธไม่สำเร็จ'), 'error');
    }
  };

  // Section visibility is independent of modal visibility. Otherwise, when
  // the approver clears the LAST pending item, the section unmounts as soon
  // as the refetch returns an empty list — and takes the ApprovedModal
  // (which has the one-time code in it!) with it. Keep the modals as
  // top-level siblings so they survive the section's empty-state collapse.
  const showSection =
    enabled && !(isLoading && pending.length === 0) && (pending.length > 0 || showWhenEmpty);

  if (!showSection && !approved && !rejecting) return null;

  return (
    <>
      {showSection && (
        <section
          style={{
            marginBottom: 22,
            background: 'var(--bg-card)',
            border: `1px solid ${
              pending.length > 0 ? 'var(--yellow)' : 'var(--border-color)'
            }`,
            borderRadius: 12,
            padding: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: pending.length > 0 ? 14 : 0,
            }}
          >
            <ShieldQuestion size={18} color="#facc15" />
            <strong style={{ color: 'var(--text)', fontSize: 15 }}>
              คำขอตั้งรหัสผ่านใหม่
            </strong>
            {pending.length > 0 && (
              <span
                style={{
                  background: 'var(--yellow)',
                  color: '#000',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 10,
                }}
              >
                {pending.length} รออนุมัติ
              </span>
            )}
          </div>

          {pending.length === 0 ? (
            <div style={{ color: 'var(--dim)', fontSize: 13 }}>ยังไม่มีคำขอใหม่</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {pending.map((p) => (
                <RequestRow
                  key={p.id}
                  item={p}
                  busy={approveMut.isPending || rejectMut.isPending}
                  onApprove={() => onApprove(p)}
                  onReject={() => setRejecting(p)}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {approved && (
        <ApprovedModal
          username={approved.username}
          code={approved.code}
          expiresAt={approved.expiresAt}
          onClose={() => setApproved(null)}
        />
      )}

      {rejecting && (
        <RejectModal
          item={rejecting}
          reason={rejectReason}
          setReason={setRejectReason}
          busy={rejectMut.isPending}
          onCancel={() => {
            setRejecting(null);
            setRejectReason('');
          }}
          onConfirm={onReject}
        />
      )}
    </>
  );
}

function RequestRow({
  item,
  busy,
  onApprove,
  onReject,
}: {
  item: PendingResetItem;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const matched = item.contactMatchesEmail || item.contactMatchesPhone;
  const matchType = item.contactMatchesEmail
    ? 'email'
    : item.contactMatchesPhone
      ? 'phone'
      : null;
  return (
    <div
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <strong style={{ color: 'var(--cyan)' }}>{item.username}</strong>
          <RoleBadge role={item.role} />
          <span
            style={{
              fontSize: 11,
              color: 'var(--dim)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 3,
            }}
          >
            <Clock size={10} /> {dayjs(item.requestedAt).fromNow()}
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12.5,
            color: matched ? 'var(--green)' : 'var(--red)',
          }}
        >
          {matchType === 'email' ? (
            <Mail size={12} />
          ) : matchType === 'phone' ? (
            <Phone size={12} />
          ) : (
            <CircleAlert size={12} />
          )}
          <span style={{ fontFamily: 'monospace' }}>{item.providedContact}</span>
          <span style={{ marginLeft: 4 }}>
            {matched
              ? `· ตรงกับ${matchType === 'email' ? 'อีเมล' : 'เบอร์โทร'}ในระบบ`
              : '· ไม่ตรงกับข้อมูลในระบบ'}
          </span>
        </div>
        {item.ipAddress && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--dim2)',
              marginTop: 3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <Globe size={10} /> {item.ipAddress}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={onReject} disabled={busy} style={smallBtn('reject', busy)}>
          <X size={12} /> ปฏิเสธ
        </button>
        <button onClick={onApprove} disabled={busy} style={smallBtn('approve', busy)}>
          <Check size={12} /> อนุมัติ
        </button>
      </div>
    </div>
  );
}

function ApprovedModal({
  username,
  code,
  expiresAt,
  onClose,
}: {
  username: string;
  code: string;
  expiresAt: string;
  onClose: () => void;
}) {
  const copyCode = async () => {
    const ok = await copyToClipboard(code);
    showToast(
      ok ? 'คัดลอกรหัสยืนยันแล้ว' : 'คัดลอกไม่สำเร็จ — กรุณาคัดลอกด้วยตนเอง',
      ok ? 'success' : 'error',
    );
  };
  return (
    <div style={overlay}>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          padding: 28,
          width: 460,
          textAlign: 'center',
        }}
      >
        <KeyRound size={44} color="#4ade80" style={{ marginBottom: 12 }} />
        <h3 style={{ color: 'var(--text)', marginBottom: 6 }}>อนุมัติเรียบร้อย</h3>
        <p style={{ color: 'var(--dim)', fontSize: 13, marginBottom: 14 }}>
          ส่งรหัสยืนยันนี้ให้ <strong style={{ color: 'var(--cyan)' }}>{username}</strong>{' '}
          ทาง LINE / โทรศัพท์ / พบหน้า
        </p>
        <div
          style={{
            background: 'var(--bg-input)',
            border: '1px dashed var(--border-color)',
            padding: '18px 16px',
            borderRadius: 10,
            fontFamily: 'monospace',
            fontSize: 28,
            fontWeight: 700,
            color: 'var(--yellow)',
            letterSpacing: 8,
            marginBottom: 12,
            userSelect: 'all',
          }}
        >
          {code}
        </div>
        <div style={{ fontSize: 12, color: 'var(--dim2)', marginBottom: 18 }}>
          หมดอายุ {dayjs(expiresAt).format('DD/MM/YYYY HH:mm')} (~30 นาที)
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <button onClick={copyCode} style={primaryBtn}>
            <Copy size={14} /> คัดลอกรหัส
          </button>
          <button onClick={onClose} style={secondaryBtn}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}

function RejectModal({
  item,
  reason,
  setReason,
  busy,
  onCancel,
  onConfirm,
}: {
  item: PendingResetItem;
  reason: string;
  setReason: (s: string) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          padding: 26,
          width: 440,
        }}
      >
        <h3 style={{ color: 'var(--text)', marginTop: 0 }}>
          ปฏิเสธคำขอของ {item.username}
        </h3>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="เหตุผล (ทางเลือก)"
          rows={3}
          style={{
            width: '100%',
            padding: 10,
            background: 'var(--bg-input)',
            color: 'var(--text)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            fontFamily: 'inherit',
            fontSize: 13,
            outline: 'none',
            resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
          <button onClick={onCancel} disabled={busy} style={secondaryBtn}>
            ยกเลิก
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            style={{ ...primaryBtn, background: 'var(--red)' }}
          >
            {busy ? 'กำลังปฏิเสธ...' : 'ยืนยันปฏิเสธ'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: PendingResetItem['role'] }) {
  const cfg =
    role === 'super_admin'
      ? { bg: 'rgba(250, 204, 21, 0.15)', text: 'var(--yellow)', label: 'Super Admin' }
      : role === 'site_admin'
        ? { bg: 'rgba(34, 211, 238, 0.15)', text: 'var(--cyan)', label: 'Site Admin' }
        : { bg: 'rgba(167, 139, 250, 0.15)', text: '#a78bfa', label: 'Viewer' };
  return (
    <span
      style={{
        padding: '1px 8px',
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.text,
        fontSize: 10,
        fontWeight: 600,
      }}
    >
      {cfg.label}
    </span>
  );
}

function smallBtn(kind: 'approve' | 'reject', busy: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 7,
    border: kind === 'reject' ? '1px solid var(--red)' : 'none',
    background: kind === 'approve' ? 'var(--cyan)' : 'transparent',
    color: kind === 'approve' ? '#000' : 'var(--red)',
    fontWeight: 600,
    fontSize: 12,
    cursor: busy ? 'not-allowed' : 'pointer',
    opacity: busy ? 0.5 : 1,
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
  };
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
