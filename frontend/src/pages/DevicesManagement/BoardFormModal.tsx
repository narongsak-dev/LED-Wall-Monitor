import { useEffect, useState } from 'react';
import { X, Save } from 'lucide-react';
import type {
  BoardWithSensors,
  CreateBoardPayload,
  Site,
  UpdateBoardPayload,
} from '@monitor/shared';
import { useZones } from '@/features/zones/hooks';
import { ModalPicker } from '@/components/inputs/ModalPicker';

interface Props {
  open: boolean;
  editing: BoardWithSensors | null;
  sites: Site[];
  defaultSiteId?: number;
  onClose: () => void;
  onSubmit: (payload: CreateBoardPayload | UpdateBoardPayload) => void;
  submitting?: boolean;
}

export function BoardFormModal({
  open,
  editing,
  sites,
  defaultSiteId,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const [siteId, setSiteId] = useState<number | ''>('');
  const [zoneId, setZoneId] = useState<number | ''>('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [hardware, setHardware] = useState('');
  const [firmware, setFirmware] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Zones depend on the currently selected site; refetch when it changes.
  const { data: zones = [] } = useZones(typeof siteId === 'number' ? siteId : null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setSiteId(editing.siteId);
      setZoneId(editing.zoneId ?? '');
      setCode(editing.code);
      setName(editing.name ?? '');
      setHardware(editing.hardware ?? '');
      setFirmware(editing.firmware ?? '');
      setMacAddress(editing.macAddress ?? '');
      setIpAddress(editing.ipAddress ?? '');
      setIsActive(editing.isActive);
    } else {
      setSiteId(defaultSiteId ?? (sites[0]?.id ?? ''));
      setZoneId('');
      setCode('');
      setName('');
      setHardware('HKL-EA8 (ESP32)');
      setFirmware('');
      setMacAddress('');
      setIpAddress('');
      setIsActive(true);
    }
    // Only re-seed when modal opens or the editing target changes — not on every
    // parent re-render (which would discard whatever the user just typed).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id, defaultSiteId]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!siteId) {
      setError('กรุณาเลือกไซต์');
      return;
    }
    if (!code.trim() || code.length < 3) {
      setError('รหัสบอร์ดต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    const payload: CreateBoardPayload | UpdateBoardPayload = {
      siteId: Number(siteId),
      zoneId: zoneId === '' ? null : Number(zoneId),
      code: code.trim(),
      name: name.trim() || undefined,
      hardware: hardware.trim() || undefined,
      firmware: firmware.trim() || undefined,
      macAddress: macAddress.trim() || undefined,
      ipAddress: ipAddress.trim() || undefined,
      isActive,
    };
    onSubmit(payload);
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
          width: 520,
          maxWidth: '92vw',
          maxHeight: '92vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {editing ? `แก้ไขบอร์ด: ${editing.code}` : 'เพิ่มบอร์ดใหม่'}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--dim)',
              cursor: 'pointer',
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Site picker — required, no "none" option. If only one site
              exists ModalPicker auto-locks it (read-only chip). When
              editing a board the picker stays read-only because we
              don't support cross-site moves. */}
          <div>
            <ModalPicker
              label="ไซต์ *"
              options={sites.map((s) => ({
                value: s.id,
                label: `${s.code} · ${s.name}`,
                sub: s.location ?? undefined,
              }))}
              value={typeof siteId === 'number' ? siteId : null}
              onChange={(v) => setSiteId(v as number)}
              emptyLabel="ยังไม่มีไซต์"
              disabled={!!editing}
              minWidth={260}
            />
            {editing && (
              <div style={{ fontSize: 11, color: 'var(--dim2)', marginTop: 4 }}>
                ย้ายบอร์ดข้ามไซต์ไม่ได้
              </div>
            )}
          </div>

          <div>
            <ModalPicker
              label="โซน (ถ้ามี)"
              options={zones.map((z) => ({
                value: z.id,
                label: `${z.code} · ${z.name}`,
                sub: z.description ?? undefined,
              }))}
              value={typeof zoneId === 'number' ? zoneId : null}
              onChange={(v) => setZoneId(v == null ? '' : (v as number))}
              allowNone
              noneLabel="— ไม่ระบุ —"
              emptyLabel="ยังไม่มีโซนในไซต์นี้"
              minWidth={260}
            />
            <div style={{ fontSize: 11, color: 'var(--dim2)', marginTop: 4 }}>
              {zones.length === 0
                ? 'ไซต์นี้ยังไม่มีโซน — เพิ่มได้จากหน้ารายละเอียดไซต์'
                : 'เลือกโซนเพื่อจัดกลุ่มบอร์ดตามตำแหน่งจริง'}
            </div>
          </div>

          <Field label="รหัสบอร์ด" required>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="BOARD-001"
              style={inputStyle}
              disabled={!!editing}
            />
            {editing && (
              <div style={{ fontSize: 11, color: 'var(--dim2)', marginTop: 4 }}>
                แก้ไขรหัสไม่ได้ (firmware/MQTT ผูกกับรหัสนี้)
              </div>
            )}
          </Field>

          <Field label="ชื่อแสดงผล">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ตู้ควบคุมจุดที่ 1"
              style={inputStyle}
            />
          </Field>

          <Field label="ฮาร์ดแวร์">
            <input
              type="text"
              value={hardware}
              onChange={(e) => setHardware(e.target.value)}
              placeholder="HKL-EA8 (ESP32)"
              style={inputStyle}
            />
          </Field>

          <Field label="Firmware version">
            <input
              type="text"
              value={firmware}
              onChange={(e) => setFirmware(e.target.value)}
              placeholder="v0.2.0"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14 }}>
            <Field label="MAC Address">
              <input
                type="text"
                value={macAddress}
                onChange={(e) => setMacAddress(e.target.value)}
                placeholder="AA:BB:CC:DD:EE:FF"
                style={inputStyle}
              />
            </Field>
            <Field label="IP Address">
              <input
                type="text"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                placeholder="192.168.1.100"
                style={inputStyle}
              />
            </Field>
          </div>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>
              เปิดใช้งาน
            </span>
          </label>

          {error && (
            <div
              style={{
                padding: '10px 12px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 8,
                color: '#ef4444',
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
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
              border: 'none',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 600,
              cursor: submitting ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            <Save size={14} />
            {editing ? 'บันทึก' : 'เพิ่มบอร์ด'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 12,
          color: 'var(--dim)',
          marginBottom: 6,
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}
      >
        {label}
        {required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}
      </label>
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
};
