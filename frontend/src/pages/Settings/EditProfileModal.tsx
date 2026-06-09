import { useEffect, useState } from 'react';
import { X, Save, UserCog } from 'lucide-react';
import type { User } from '@monitor/shared';
import { useUpdateProfile } from '@/features/account/hooks';

interface EditProfileModalProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}

export function EditProfileModal({
  open,
  user,
  onClose,
  onSaved,
}: EditProfileModalProps) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const mutation = useUpdateProfile();

  useEffect(() => {
    if (!open) return;
    setFullName(user?.fullName ?? '');
    setEmail(user?.email ?? '');
    setPhoneNumber(user?.phoneNumber ?? '');
    setError(null);
  }, [open, user]);

  if (!open) return null;

  const handleSubmit = async () => {
    setError(null);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('รูปแบบอีเมลไม่ถูกต้อง');
      return;
    }
    try {
      await mutation.mutateAsync({
        fullName: fullName.trim() || undefined,
        email: email.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
      });
      onSaved('บันทึกข้อมูลส่วนตัวเรียบร้อย');
      onClose();
    } catch (err) {
      setError(extractError(err) ?? 'บันทึกไม่สำเร็จ');
    }
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div style={titleStyle}>
            <UserCog size={18} />
            แก้ไขข้อมูลส่วนตัว
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={20} />
          </button>
        </div>

        {error && <div style={errorBoxStyle}>{error}</div>}

        <div style={{ display: 'grid', gap: 16 }}>
          <Field label="ชื่อผู้ใช้ (ไม่สามารถแก้ไขได้)">
            <input type="text" value={user?.username ?? ''} style={inputStyle} disabled />
          </Field>
          <Field label="ชื่อ-นามสกุล">
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={inputStyle}
              placeholder="ระบุชื่อ-นามสกุล"
            />
          </Field>
          <Field label="อีเมล">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
              placeholder="name@example.com"
            />
          </Field>
          <Field label="เบอร์โทรศัพท์">
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={inputStyle}
              placeholder="08x-xxx-xxxx"
              maxLength={30}
            />
          </Field>
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
                <Save size={14} /> บันทึก
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
