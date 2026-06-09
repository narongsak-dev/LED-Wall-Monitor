import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { KeyRound, ShieldCheck, Zap, LogOut } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { finishReset } from '@/features/auth/api';
import { extractApiError, showToast } from '@/lib/toast';

/**
 * Mandatory password-set page shown after a code-based login. The router
 * gate (`ProtectedRoute`) sends every navigation here while
 * `mustChangePassword` is set, so this page is the one and only thing the
 * user can interact with until they pick a real password.
 */
export function FirstTimePasswordPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword);
  const accessToken = useAuthStore((s) => s.accessToken);
  const setTokens = useAuthStore((s) => s.setTokens);
  const clear = useAuthStore((s) => s.clear);

  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useMutation({
    mutationFn: (newPassword: string) => finishReset(newPassword),
    onSuccess: (data) => {
      setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        mustChangePassword: false,
      });
      showToast('ตั้งรหัสผ่านใหม่สำเร็จ — ยินดีต้อนรับ', 'success');
      navigate('/', { replace: true });
    },
  });

  // If somebody navigates here without a transitional session, just send them
  // to the right place — no point showing the locked-down UI.
  if (!accessToken) {
    navigate('/login', { replace: true });
    return null;
  }
  if (!mustChangePassword) {
    navigate('/', { replace: true });
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 6) {
      showToast('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร', 'error');
      return;
    }
    if (next !== confirm) {
      showToast('ยืนยันรหัสผ่านไม่ตรงกัน', 'error');
      return;
    }
    mutation.mutate(next, {
      onError: (err) => showToast(extractApiError(err, 'ตั้งรหัสไม่สำเร็จ'), 'error'),
    });
  };

  const handleCancel = () => {
    clear();
    navigate('/login', { replace: true });
  };

  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        background: 'var(--login-bg)',
        padding: 24,
      }}
    >
      <div
        className="fade-in-up"
        style={{
          width: 440,
          maxWidth: '95vw',
          background: 'var(--bg-card)',
          backgroundImage: 'var(--card-gradient)',
          padding: '28px 30px',
          borderRadius: 20,
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background:
                'linear-gradient(135deg, var(--cyan) 0%, var(--cyan-bright) 100%)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <Zap size={22} color="#fff" fill="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              ตั้งรหัสผ่านใหม่
            </div>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>
              บัญชี: <strong style={{ color: 'var(--cyan)' }}>{user?.username}</strong>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            background: 'rgba(250, 204, 21, 0.08)',
            border: '1px solid rgba(250, 204, 21, 0.35)',
            borderRadius: 10,
            fontSize: 13,
            color: 'var(--text)',
            marginBottom: 18,
            lineHeight: 1.55,
          }}
        >
          <ShieldCheck size={18} color="#facc15" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>
            คุณเข้าสู่ระบบด้วย <strong>รหัสยืนยันชั่วคราว</strong> —
            กรุณาตั้งรหัสผ่านใหม่ก่อนใช้งานระบบ
          </span>
        </div>

        <form onSubmit={handleSubmit}>
          <Field label="รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)">
            <input
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              required
              autoFocus
              style={inputStyle}
            />
          </Field>
          <div style={{ height: 14 }} />
          <Field label="ยืนยันรหัสผ่านใหม่">
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              style={inputStyle}
            />
          </Field>

          <button
            type="submit"
            disabled={mutation.isPending}
            style={{
              width: '100%',
              marginTop: 22,
              padding: '12px 16px',
              background:
                'linear-gradient(135deg, var(--cyan) 0%, var(--cyan-bright) 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: mutation.isPending ? 'not-allowed' : 'pointer',
              opacity: mutation.isPending ? 0.7 : 1,
              boxShadow: '0 8px 20px var(--cyan-glow-strong)',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {mutation.isPending ? (
              'กำลังบันทึก...'
            ) : (
              <>
                <KeyRound size={15} /> ตั้งรหัสผ่านใหม่และเข้าสู่ระบบ
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCancel}
            disabled={mutation.isPending}
            style={{
              width: '100%',
              marginTop: 10,
              padding: '10px 16px',
              background: 'transparent',
              color: 'var(--dim)',
              border: '1px solid var(--border-color)',
              borderRadius: 10,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <LogOut size={13} /> ยกเลิกและออกจากระบบ
          </button>
        </form>
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
          fontSize: 11.5,
          color: 'var(--dim)',
          fontWeight: 600,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  borderRadius: 10,
  border: '1px solid var(--border-color)',
  background: 'var(--bg-input)',
  color: 'var(--text)',
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
};
