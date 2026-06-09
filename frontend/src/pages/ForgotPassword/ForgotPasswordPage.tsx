import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Send, ShieldCheck, Zap } from 'lucide-react';
import {
  useCaptcha,
  useSubmitResetRequest,
} from '@/features/password-reset/hooks';
import { extractApiError, showToast } from '@/lib/toast';

/**
 * Public forgot-password form. Submits a request that an admin will see in
 * their approval inbox. The admin generates a 6-digit verification code and
 * delivers it out-of-band; the user then comes back to the login page and
 * types that code as their password — that's the verification step.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();

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
          width: 460,
          maxWidth: '95vw',
          background: 'var(--bg-card)',
          backgroundImage: 'var(--card-gradient)',
          padding: '28px 30px 26px',
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
              ลืมรหัสผ่าน
            </div>
            <div style={{ fontSize: 12, color: 'var(--dim)' }}>
              ขอรหัสยืนยันจากผู้ดูแล แล้วเข้าสู่ระบบด้วยรหัสนั้นเพื่อตั้งรหัสใหม่
            </div>
          </div>
        </div>

        <Steps />

        <RequestForm />

        <button
          onClick={() => navigate('/login')}
          style={{
            marginTop: 22,
            background: 'none',
            border: 'none',
            color: 'var(--dim)',
            cursor: 'pointer',
            fontSize: 13,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={14} /> กลับไปหน้าเข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}

function Steps() {
  return (
    <ol
      style={{
        margin: '0 0 22px',
        padding: '12px 14px 12px 34px',
        background: 'rgba(34, 211, 238, 0.06)',
        border: '1px solid rgba(34, 211, 238, 0.2)',
        borderRadius: 10,
        color: 'var(--dim)',
        fontSize: 12.5,
        lineHeight: 1.7,
      }}
    >
      <li>กรอกข้อมูลด้านล่างเพื่อส่งคำขอ</li>
      <li>รอผู้ดูแลอนุมัติ — จะส่ง <strong>รหัสยืนยัน 6 หลัก</strong> ให้คุณ</li>
      <li>
        กลับไปหน้าเข้าสู่ระบบ → ใช้ <strong>รหัสยืนยัน</strong>{' '}
        แทนรหัสผ่าน ระบบจะให้คุณตั้งรหัสใหม่ทันที
      </li>
    </ol>
  );
}

function RequestForm() {
  const [username, setUsername] = useState('');
  const [contact, setContact] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [hp, setHp] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const captcha = useCaptcha();
  const mutation = useSubmitResetRequest();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!captcha.data) {
      showToast('Captcha ยังไม่พร้อม กรุณารอสักครู่', 'error');
      return;
    }
    try {
      await mutation.mutateAsync({
        username: username.trim(),
        contact: contact.trim(),
        captchaId: captcha.data.id,
        captchaAnswer: captchaAnswer.trim(),
        hp,
      });
      setSubmitted(true);
      showToast('ส่งคำขอแล้ว', 'success');
    } catch (err) {
      showToast(extractApiError(err, 'ส่งคำขอไม่สำเร็จ'), 'error');
      captcha.refetch();
      setCaptchaAnswer('');
    }
  };

  if (submitted) {
    return (
      <div
        style={{
          padding: 18,
          background: 'rgba(34, 211, 238, 0.08)',
          border: '1px solid rgba(34, 211, 238, 0.3)',
          borderRadius: 12,
          fontSize: 13.5,
          color: 'var(--text)',
          lineHeight: 1.7,
        }}
      >
        <ShieldCheck size={26} color="#22d3ee" style={{ marginBottom: 8, display: 'block' }} />
        <strong style={{ color: 'var(--cyan)' }}>ส่งคำขอแล้ว</strong>
        <p style={{ margin: '8px 0 0', color: 'var(--dim)' }}>
          หากข้อมูลของคุณถูกต้อง ผู้ดูแลจะเห็นคำขอในระบบ และจะ
          <strong> ส่งรหัสยืนยัน 6 หลัก</strong> ให้คุณทางช่องทางที่ติดต่อกันได้
          <br />
          เมื่อได้รับแล้ว — กลับไปหน้าเข้าสู่ระบบ <strong>กรอกรหัสยืนยันแทนรหัสผ่าน</strong>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <Field label="ชื่อผู้ใช้">
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          autoComplete="username"
          style={inputStyle}
        />
      </Field>
      <Spacer />
      <Field label="อีเมล หรือ เบอร์โทรศัพท์ (ตามที่ลงทะเบียนไว้)">
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          required
          style={inputStyle}
        />
      </Field>

      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        name="website"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
        aria-hidden="true"
      />

      <Spacer />
      <Field label={`พิสูจน์ว่าไม่ใช่บอท: ${captcha.data?.question ?? 'กำลังโหลด...'}`}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9-]*"
            value={captchaAnswer}
            onChange={(e) => setCaptchaAnswer(e.target.value)}
            required
            style={{ ...inputStyle, flex: 1 }}
          />
          <button
            type="button"
            onClick={() => captcha.refetch()}
            disabled={captcha.isFetching}
            title="โจทย์ใหม่"
            style={iconButtonStyle}
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </Field>

      <button
        type="submit"
        disabled={mutation.isPending || captcha.isLoading}
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
          'กำลังส่งคำขอ...'
        ) : (
          <>
            <Send size={15} /> ส่งคำขอ
          </>
        )}
      </button>
    </form>
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

function Spacer() {
  return <div style={{ height: 14 }} />;
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

const iconButtonStyle: React.CSSProperties = {
  width: 42,
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: 10,
  color: 'var(--cyan)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
