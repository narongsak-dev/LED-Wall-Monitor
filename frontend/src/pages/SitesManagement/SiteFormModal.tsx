import { useEffect, useState } from 'react';
import { X, Plus, Pencil, Save } from 'lucide-react';
import type {
  CreateSitePayload,
  Site,
  UpdateSitePayload,
} from '@monitor/shared';

interface SiteFormModalProps {
  open: boolean;
  editing: Site | null;
  onClose: () => void;
  onSubmit: (payload: CreateSitePayload | UpdateSitePayload) => void;
  submitting: boolean;
}

interface FormState {
  code: string;
  name: string;
  location: string;
  timezone: string;
  isActive: boolean;
}

const TIMEZONES = [
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Asia/Hong_Kong',
  'UTC',
];

const initialState = (): FormState => ({
  code: '',
  name: '',
  location: '',
  timezone: 'Asia/Bangkok',
  isActive: true,
});

export function SiteFormModal({
  open,
  editing,
  onClose,
  onSubmit,
  submitting,
}: SiteFormModalProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        code: editing.code,
        name: editing.name,
        location: editing.location ?? '',
        timezone: editing.timezone,
        isActive: editing.isActive,
      });
    } else {
      setForm(initialState());
    }
    setError(null);
  }, [open, editing]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!form.code || form.code.length < 3) {
      setError('รหัสไซต์ต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (!form.name || form.name.length < 2) {
      setError('ชื่อไซต์ต้องมีอย่างน้อย 2 ตัวอักษร');
      return;
    }
    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      location: form.location.trim() || undefined,
      timezone: form.timezone,
      isActive: form.isActive,
    };
    onSubmit(payload);
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--cyan)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {editing ? <Pencil size={18} /> : <Plus size={18} />}
            {editing ? 'แก้ไขไซต์' : 'เพิ่มไซต์ใหม่'}
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 8,
              color: 'var(--red)',
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            {error}
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
            gap: 16,
          }}
        >
          <Field label="รหัสไซต์ *">
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              placeholder="SITE-001"
              style={inputStyle}
              disabled={!!editing}
            />
          </Field>
          <Field label="ชื่อไซต์ *">
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="โรงงาน A"
              style={inputStyle}
            />
          </Field>
          <Field label="สถานที่">
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="กรุงเทพมหานคร"
              style={inputStyle}
            />
          </Field>
          <Field label="Timezone">
            <select
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              style={inputStyle}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {/* Active toggle */}
        <div
          style={{
            marginTop: 18,
            padding: 14,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              สถานะการใช้งาน
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
              ปิดเพื่อพักการใช้งานไซต์ชั่วคราว
            </div>
          </div>
          <Toggle
            checked={form.isActive}
            onChange={(v) => setForm({ ...form, isActive: v })}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={secondaryBtnStyle}>
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              ...primaryBtnStyle,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {submitting ? (
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          color: 'var(--dim)',
          marginBottom: 6,
          fontWeight: 600,
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

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        background: checked ? 'var(--cyan)' : 'var(--border-strong)',
        border: 'none',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: checked ? 22 : 2,
          top: 2,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }}
      />
    </button>
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
  maxWidth: 560,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: 'var(--shadow-lg)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 22,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--dim)',
  fontSize: 22,
  cursor: 'pointer',
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

const primaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: 'var(--cyan)',
  color: '#fff',
  border: 'none',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '9px 18px',
  borderRadius: 8,
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
