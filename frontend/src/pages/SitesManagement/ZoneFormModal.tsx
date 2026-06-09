import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import type {
  Zone,
  CreateZonePayload,
  UpdateZonePayload,
} from '@monitor/shared';

interface Props {
  open: boolean;
  siteId: number;
  editing: Zone | null;
  onClose: () => void;
  onSubmit: (payload: CreateZonePayload | UpdateZonePayload) => void;
  submitting?: boolean;
}

export function ZoneFormModal({
  open,
  siteId,
  editing,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setCode(editing.code);
      setName(editing.name);
      setDescription(editing.description ?? '');
      setIsActive(editing.isActive);
    } else {
      setCode('');
      setName('');
      setDescription('');
      setIsActive(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!code.trim() || code.length < 2) {
      setError('รหัสโซนต้องมีอย่างน้อย 2 ตัวอักษร');
      return;
    }
    if (!name.trim() || name.length < 2) {
      setError('ชื่อโซนต้องมีอย่างน้อย 2 ตัวอักษร');
      return;
    }
    if (editing) {
      const payload: UpdateZonePayload = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        isActive,
      };
      onSubmit(payload);
    } else {
      const payload: CreateZonePayload = {
        siteId,
        code: code.trim(),
        name: name.trim(),
        description: description.trim() || undefined,
        isActive,
      };
      onSubmit(payload);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 14,
          padding: 24,
          width: 460,
          maxWidth: '90vw',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h3 style={{ margin: 0, color: 'var(--text)', fontSize: 16 }}>
            {editing ? `แก้ไขโซน · ${editing.code}` : 'เพิ่มโซนใหม่'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--dim)',
              cursor: 'pointer',
              padding: 4,
              display: 'inline-flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#ef4444',
              padding: '9px 12px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 14,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="รหัสโซน">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="FLOOR-1, HALL-A, ZONE-2..."
              style={inputStyle}
              maxLength={50}
            />
          </Field>
          <Field label="ชื่อ">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ชั้น 1, โซนผลิต ฯลฯ"
              style={inputStyle}
              maxLength={200}
            />
          </Field>
          <Field label="คำอธิบาย (ถ้ามี)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>
          <Field label="สถานะ">
            <select
              value={isActive ? '1' : '0'}
              onChange={(e) => setIsActive(e.target.value === '1')}
              style={inputStyle}
            >
              <option value="1">เปิดใช้งาน</option>
              <option value="0">ปิดใช้งาน</option>
            </select>
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 22 }}>
          <button
            onClick={onClose}
            style={{
              padding: '9px 18px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              borderRadius: 8,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: '9px 18px',
              background: 'var(--cyan)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              opacity: submitting ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Save size={14} />
            {editing ? 'บันทึก' : 'เพิ่ม'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </div>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  padding: '9px 12px',
  borderRadius: 8,
  fontSize: 14,
  outline: 'none',
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};
