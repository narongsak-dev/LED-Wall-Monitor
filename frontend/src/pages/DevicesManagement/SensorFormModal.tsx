import { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import type {
  CreateSensorPayload,
  SensorWithContext,
  UpdateSensorPayload,
} from '@monitor/shared';

interface Props {
  open: boolean;
  boardId: number;
  editing: SensorWithContext | null;
  existingSensors: SensorWithContext[];
  onClose: () => void;
  onSubmit: (payload: CreateSensorPayload | UpdateSensorPayload) => void;
  submitting?: boolean;
}

// The two supported sensor kinds, with their derived fields baked in so the
// user only has to pick once.
// Three concrete sensor variants. The KWS family is split into 1-phase
// and 3-phase so the operator can pick exactly what hardware is wired up,
// but the per-board constraint "at most one KWS" treats both variants as
// the same family (they share the RS485 bus + slave address).
type SensorKind = 'PZEM' | 'KWS_1P' | 'KWS_3P';
const SENSOR_KINDS: Record<
  SensorKind,
  {
    label: string;
    description: string;
    model: string;
    channel: string;
    sensorType: 'power_meter';
    defaultCode: string;
    family: 'PZEM' | 'KWS';
  }
> = {
  PZEM: {
    label: 'PZEM-004T',
    description: 'มิเตอร์ AC 1 เฟส ผ่าน TTL (HMI port)',
    model: 'PZEM-004T',
    channel: 'hmi',
    sensorType: 'power_meter',
    defaultCode: 'PZEM-001',
    family: 'PZEM',
  },
  KWS_1P: {
    label: 'KWS-AC301L (1-phase)',
    description: 'มิเตอร์ AC 1 เฟส ผ่าน RS485 + อุณหภูมิ',
    model: 'KWS-AC301L',
    channel: 'rs485',
    sensorType: 'power_meter',
    defaultCode: 'KWS-001',
    family: 'KWS',
  },
  KWS_3P: {
    label: 'KWS-AC306L (3-phase)',
    description: 'มิเตอร์ AC 3 เฟส ผ่าน RS485 (L1/L2/L3)',
    model: 'KWS-AC306L',
    channel: 'rs485',
    sensorType: 'power_meter',
    defaultCode: 'KWS-001',
    family: 'KWS',
  },
};

// detectKind: PZEM by prefix, KWS-AC306L (or anything 3-phase-y) =>
// KWS_3P, otherwise any KWS model => KWS_1P. The 'AC306' check is the
// authoritative signal — leave the loose 3P/THREE check in place as
// a fallback for legacy / pre-rename rows.
function detectKind(model: string | null | undefined): SensorKind | null {
  if (!model) return null;
  const m = model.toUpperCase();
  if (m.startsWith('PZEM')) return 'PZEM';
  if (m.includes('AC306') || m.includes('3P') || m.includes('THREE')) return 'KWS_3P';
  if (m.startsWith('KWS')) return 'KWS_1P';
  return null;
}

export function SensorFormModal({
  open,
  boardId,
  editing,
  existingSensors,
  onClose,
  onSubmit,
  submitting,
}: Props) {
  const [kind, setKind] = useState<SensorKind>('PZEM');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [vMin, setVMin] = useState('');
  const [vMax, setVMax] = useState('');
  const [iMax, setIMax] = useState('');
  const [wMax, setWMax] = useState('');
  const [tMax, setTMax] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Which families are already used on this board? KWS_1P and KWS_3P
  // share the "KWS" family and the RS485 bus, so picking one locks out
  // the other. PZEM is its own family.
  const usedFamilies = useMemo(() => {
    const set = new Set<'PZEM' | 'KWS'>();
    for (const s of existingSensors) {
      if (editing && s.id === editing.id) continue;
      const k = detectKind(s.model);
      if (k) set.add(SENSOR_KINDS[k].family);
    }
    return set;
  }, [existingSensors, editing]);

  const availableKinds = useMemo(
    () =>
      (Object.keys(SENSOR_KINDS) as SensorKind[]).filter(
        (k) => !usedFamilies.has(SENSOR_KINDS[k].family),
      ),
    [usedFamilies],
  );

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      const k = detectKind(editing.model) ?? 'PZEM';
      setKind(k);
      setCode(editing.code);
      setName(editing.name ?? '');
      setIsActive(editing.isActive);
      setVMin(editing.voltageMin?.toString() ?? '');
      setVMax(editing.voltageMax?.toString() ?? '');
      setIMax(editing.currentMax?.toString() ?? '');
      setWMax(editing.powerMax?.toString() ?? '');
      setTMax(editing.temperatureMax?.toString() ?? '');
    } else {
      const first = availableKinds[0] ?? 'PZEM';
      setKind(first);
      setCode(SENSOR_KINDS[first].defaultCode);
      setName('');
      setIsActive(true);
      setVMin('');
      setVMax('');
      setIMax('');
      setWMax('');
      setTMax('');
    }
    // We only want to (re)seed state when the modal opens or the editing
    // target changes — NOT on every keystroke. availableKinds intentionally
    // excluded from deps to avoid resetting fields while typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  if (!open) return null;

  // Auto-update default code when kind changes (only for new sensors)
  const handleKindChange = (newKind: SensorKind) => {
    setKind(newKind);
    if (!editing) {
      setCode(SENSOR_KINDS[newKind].defaultCode);
    }
  };

  const noSlotAvailable = !editing && availableKinds.length === 0;

  const handleSubmit = () => {
    if (noSlotAvailable) return;
    if (!code.trim() || code.length < 3) {
      setError('รหัสเซ็นเซอร์ต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    const spec = SENSOR_KINDS[kind];
    const parseNum = (v: string): number | null => {
      const trimmed = v.trim();
      if (!trimmed) return null;
      const n = parseFloat(trimmed);
      return Number.isFinite(n) ? n : null;
    };
    const payload: CreateSensorPayload | UpdateSensorPayload = {
      boardId,
      code: code.trim(),
      name: name.trim() || undefined,
      sensorType: spec.sensorType,
      model: spec.model,
      channel: spec.channel,
      isActive,
      voltageMin: parseNum(vMin),
      voltageMax: parseNum(vMax),
      currentMax: parseNum(iMax),
      powerMax: parseNum(wMax),
      // Only the KWS family carries a temperature probe.
      temperatureMax: SENSOR_KINDS[kind].family === 'KWS' ? parseNum(tMax) : null,
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
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
              {editing ? `แก้ไขเซ็นเซอร์: ${editing.code}` : 'เพิ่มเซ็นเซอร์ใหม่'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>
              ผูกกับ board #{boardId} · 1 บอร์ดมีได้สูงสุด PZEM 1 + KWS 1
            </div>
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
          {noSlotAvailable && (
            <div
              style={{
                padding: '12px 14px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 10,
                color: '#f59e0b',
                fontSize: 13,
              }}
            >
              บอร์ดนี้มี PZEM + KWS ครบแล้ว — ลบหรือแก้ไขตัวเดิมแทน
            </div>
          )}

          <Field label="ชนิดเซ็นเซอร์" required>
            <div style={{ display: 'grid', gap: 10 }}>
              {(Object.keys(SENSOR_KINDS) as SensorKind[]).map((k) => {
                const spec = SENSOR_KINDS[k];
                const familyUsed = usedFamilies.has(spec.family);
                const isSelected = kind === k;
                // Disable a variant when its FAMILY is already in use on
                // another sensor (board has at most one of each family).
                const disabled = familyUsed
                  && (!editing || SENSOR_KINDS[detectKind(editing.model) ?? 'PZEM'].family !== spec.family);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => !disabled && handleKindChange(k)}
                    disabled={disabled}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      background: isSelected
                        ? 'rgba(6, 182, 212, 0.1)'
                        : 'var(--bg-input)',
                      border: `1px solid ${
                        isSelected ? 'var(--cyan)' : 'var(--border-color)'
                      }`,
                      borderRadius: 10,
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      fontFamily: 'inherit',
                      color: disabled ? 'var(--dim2)' : 'var(--text)',
                      opacity: disabled ? 0.5 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span>{spec.label}</span>
                      {disabled && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '2px 8px',
                            borderRadius: 999,
                            background: 'rgba(148, 163, 184, 0.2)',
                            color: 'var(--dim2)',
                            fontWeight: 600,
                          }}
                        >
                          มีอยู่แล้วบนบอร์ดนี้
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--dim)' }}>{spec.description}</div>
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="รหัส (Sensor code)" required>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={SENSOR_KINDS[kind].defaultCode}
              style={inputStyle}
              disabled={!!editing}
            />
            {editing && (
              <div style={{ fontSize: 11, color: 'var(--dim2)', marginTop: 4 }}>
                แก้ไขรหัสไม่ได้ (ผูกอยู่กับ telemetry และ firmware)
              </div>
            )}
          </Field>

          <Field label="ชื่อแสดงผล (ไม่บังคับ)">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="มิเตอร์ AC จุดที่ 1"
              style={inputStyle}
            />
          </Field>

          {/* Threshold section — empty value = use global default */}
          <div
            style={{
              borderTop: '1px dashed var(--border-color)',
              paddingTop: 14,
              marginTop: 4,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--dim)',
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              ค่าขีดจำกัด (Peak Limit) สำหรับแจ้งเตือน
            </div>
            <div style={{ fontSize: 11, color: 'var(--dim2)', marginBottom: 12 }}>
              ปล่อยว่าง = ใช้ค่า default ของระบบ
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 160px), 1fr))', gap: 10 }}>
              <Field label="Voltage ต่ำสุด (V)">
                <input
                  type="number"
                  step="0.1"
                  value={vMin}
                  onChange={(e) => setVMin(e.target.value)}
                  placeholder="210"
                  style={inputStyle}
                />
              </Field>
              <Field label="Voltage สูงสุด (V)">
                <input
                  type="number"
                  step="0.1"
                  value={vMax}
                  onChange={(e) => setVMax(e.target.value)}
                  placeholder="240"
                  style={inputStyle}
                />
              </Field>
              <Field label="Current สูงสุด (A)">
                <input
                  type="number"
                  step="0.01"
                  value={iMax}
                  onChange={(e) => setIMax(e.target.value)}
                  placeholder="25"
                  style={inputStyle}
                />
              </Field>
              <Field label="Power สูงสุด (W)">
                <input
                  type="number"
                  step="1"
                  value={wMax}
                  onChange={(e) => setWMax(e.target.value)}
                  placeholder="5500"
                  style={inputStyle}
                />
              </Field>
              {SENSOR_KINDS[kind].family === 'KWS' && (
                <Field label="Temperature สูงสุด (°C)">
                  <input
                    type="number"
                    step="0.1"
                    value={tMax}
                    onChange={(e) => setTMax(e.target.value)}
                    placeholder="40"
                    style={inputStyle}
                  />
                </Field>
              )}
            </div>
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
              เปิดใช้งาน (เก็บข้อมูล telemetry จากเซ็นเซอร์นี้)
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
            disabled={submitting || noSlotAvailable}
            style={{
              padding: '9px 18px',
              background: 'var(--cyan)',
              border: 'none',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 600,
              cursor: submitting || noSlotAvailable ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              opacity: submitting || noSlotAvailable ? 0.5 : 1,
            }}
          >
            <Save size={14} />
            {editing ? 'บันทึก' : 'เพิ่มเซ็นเซอร์'}
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
