import { useEffect, useState } from 'react';
import { X, Save, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useChangePassword } from '@/features/account/hooks';

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export function ChangePasswordModal({ open, onClose, onSaved }: ChangePasswordModalProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mutation = useChangePassword();

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setShow(false);
    setError(null);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async () => {
    setError(null);
    if (!current) {
      setError('กรุณากรอกรหัสผ่านปัจจุบัน');
      return;
    }
    if (next.length < 6) {
      setError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (next !== confirm) {
      setError('รหัสผ่านใหม่และการยืนยันไม่ตรงกัน');
      return;
    }
    if (next === current) {
      setError('รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม');
      return;
    }
    try {
      await mutation.mutateAsync({ currentPassword: current, newPassword: next });
      onSaved('เปลี่ยนรหัสผ่านเรียบร้อย');
      onClose();
    } catch (err) {
      setError(extractError(err) ?? 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    }
  };

  const inputType = show ? 'text' : 'password';

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>
            <KeyRound size={18} />
            เปลี่ยนรหัสผ่าน
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={20} />
          </button>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <div style={{ display: 'grid', gap: 16 }}>
          <Field label="รหัสผ่านปัจจุบัน *">
            <input
              type={inputType}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              style={inputStyle}
              autoComplete="current-password"
            />
          </Field>
          <Field label="รหัสผ่านใหม่ * (อย่างน้อย 6 ตัวอักษร)">
            <input
              type={inputType}
              value={next}
              onChange={(e) => setNext(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
            />
          </Field>
          <Field label="ยืนยันรหัสผ่านใหม่ *">
            <input
              type={inputType}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              style={inputStyle}
              autoComplete="new-password"
            />
          </Field>

          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--dim)',
              cursor: 'pointer',
            }}
          >
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--cyan)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'Sarabun, sans-serif',
                fontSize: 13,
                padding: 0,
              }}
            >
              {show ? <EyeOff size={15} /> : <Eye size={15} />}
              {show ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
            </button>
          </label>
        </div>

        <div style={footerStyle}>
          <button onClick={onClose} style={secondaryBtnStyle}>
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={mutation.isPending}
            style={{ ...primaryBtnStyle, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {mutation.isPending ? (
              'กำลังบันทึก...'
            ) : (
              <>
                <Save size={14} /> เปลี่ยนรหัสผ่าน
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function extractError(err: unknown): string | null {
  const e = err as { response?: { data?: { message?: string | string[] } } };
  const msg = e?.response?.data?.message;
  if (Array.isArray(msg)) return msg[0] ?? null;
  return msg ?? null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  backdropFilter: 'blur(4px)',
  zIndex: 1000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
};

const modalStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 14,
  padding: 28,
  width: '100%',
  maxWidth: 480,
  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 22,
};

const titleStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  color: 'var(--cyan)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--dim)',
  fontSize: 22,
  cursor: 'pointer',
};

const errorBoxStyle: React.CSSProperties = {
  padding: 12,
  background: 'rgba(248, 113, 113, 0.1)',
  border: '1px solid var(--red)',
  borderRadius: 8,
  color: 'var(--red)',
  fontSize: 13,
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--dim)',
  marginBottom: 6,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
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
  fontFamily: 'Sarabun, sans-serif',
};

const footerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 10,
  marginTop: 24,
};

const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: 'var(--cyan)',
  color: '#000',
  border: 'none',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Sarabun, sans-serif',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'Sarabun, sans-serif',
};
