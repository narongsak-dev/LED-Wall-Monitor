import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Zap, User, Lock, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { login } from '@/features/auth/api';
import type { AxiosError } from 'axios';

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const from = (location.state as LocationState | null)?.from?.pathname ?? '/';

  const mutation = useMutation({
    mutationFn: login,
    onSuccess: (data, variables) => {
      const transitional = data.mustChangePassword === true;
      setAuth({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        user: data.user,
        // A code-based login should NEVER inherit "remember me" — the session
        // is supposed to be short-lived until they set a real password.
        rememberMe: !transitional && variables.rememberMe === true,
        mustChangePassword: transitional,
      });
      navigate(transitional ? '/first-time-password' : from, { replace: true });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    mutation.mutate({ username, password, rememberMe });
  };

  const errorMessage = (() => {
    if (!mutation.isError) return null;
    const err = mutation.error as AxiosError<{ message?: string }>;
    return err.response?.data?.message ?? err.message ?? 'เข้าสู่ระบบไม่สำเร็จ';
  })();

  return (
    <div
      style={{
        display: 'grid',
        placeItems: 'center',
        minHeight: '100vh',
        background: 'var(--login-bg)',
        padding: 24,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Decorative blur orbs */}
      <div
        style={{
          position: 'absolute',
          top: '-10%',
          left: '-5%',
          width: 360,
          height: 360,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--cyan) 0%, transparent 70%)',
          opacity: 0.08,
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-10%',
          right: '-5%',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, var(--purple) 0%, transparent 70%)',
          opacity: 0.07,
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      <div
        className="fade-in-up"
        style={{
          width: 420,
          maxWidth: '94vw',
          background: 'var(--bg-card)',
          backgroundImage: 'var(--card-gradient)',
          padding: '32px 32px 28px',
          borderRadius: 20,
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background:
                'linear-gradient(135deg, var(--cyan) 0%, var(--cyan-bright) 100%)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 8px 20px var(--cyan-glow-strong)',
            }}
          >
            <Zap size={22} color="#fff" fill="#fff" />
          </div>
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--text)',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              Electric Monitor
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--dim)',
                marginTop: 2,
                fontWeight: 500,
              }}
            >
              ระบบมอนิเตอร์ไฟฟ้าระยะไกล
            </div>
          </div>
        </div>

        <h1
          style={{
            fontSize: 22,
            margin: '0 0 6px',
            color: 'var(--text)',
            fontWeight: 700,
            letterSpacing: '-0.01em',
          }}
        >
          ยินดีต้อนรับกลับมา
        </h1>
        <p style={{ color: 'var(--dim)', fontSize: 13, marginBottom: 22 }}>
          เข้าสู่ระบบเพื่อจัดการและติดตามข้อมูลไฟฟ้าของคุณ
        </p>

        {errorMessage && (
          <div
            className="fade-in"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--red)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              padding: '10px 14px',
              borderRadius: 10,
              marginBottom: 16,
              fontSize: 13,
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <Field label="Username" Icon={User}>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={mutation.isPending}
              required
              style={inputStyle}
            />
          </Field>

          <div style={{ height: 14 }} />

          <Field label="Password" Icon={Lock}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={mutation.isPending}
              required
              style={inputStyle}
            />
          </Field>

          {/* Remember-me: checked → 90-day session, unchecked → idle logout */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 9,
              marginTop: 14,
              padding: '8px 4px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            title="ถ้าเลือก จะอยู่ในระบบจนกว่าจะกดออกเอง — ไม่งั้นระบบจะออกให้อัตโนมัติเมื่อไม่ได้ใช้งาน"
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={mutation.isPending}
              style={{
                width: 16,
                height: 16,
                cursor: 'pointer',
                accentColor: 'var(--cyan)',
              }}
            />
            <span
              style={{
                fontSize: 13,
                color: 'var(--text)',
                fontWeight: 500,
              }}
            >
              จดจำการเข้าใช้งาน
            </span>
            <span style={{ fontSize: 11, color: 'var(--dim)' }}>
              (อยู่ในระบบจนกว่าจะออกเอง)
            </span>
          </label>

          <div style={{ textAlign: 'right', marginTop: 4 }}>
            <button
              type="button"
              onClick={() => navigate('/forgot-password')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--cyan)',
                fontSize: 12.5,
                cursor: 'pointer',
                fontFamily: 'inherit',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              ลืมรหัสผ่าน?
            </button>
          </div>

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
              transition: 'transform 0.15s, box-shadow 0.15s, opacity 0.2s',
              fontFamily: 'inherit',
              letterSpacing: '0.02em',
            }}
            onMouseEnter={(e) => {
              if (!mutation.isPending) {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow =
                  '0 12px 28px var(--cyan-glow-strong)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 8px 20px var(--cyan-glow-strong)';
            }}
          >
            {mutation.isPending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  Icon,
  children,
}: {
  label: string;
  Icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11.5,
          color: 'var(--dim)',
          fontWeight: 600,
          marginBottom: 6,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        <Icon size={12} />
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
  transition: 'border-color 0.2s, box-shadow 0.2s',
};
