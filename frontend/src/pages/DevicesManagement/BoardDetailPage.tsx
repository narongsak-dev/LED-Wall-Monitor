import { Fragment, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Cpu,
  Wifi,
  CircleDot,
  Ban,
  Gauge,
  Activity,
  Zap,
  BatteryCharging,
  Thermometer,
  Hash,
  Plus,
  Pencil,
  Trash2,
  Power,
  Upload,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { BoardOtaModal } from './BoardOtaModal';
import { dayjs } from '@/lib/dayjs';
import { showToast } from '@/lib/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { useBoard, useDeleteBoard, useUpdateBoard } from '@/features/boards/hooks';
import { useBoardSensors, useCreateSensor, useDeleteSensor, useUpdateSensor } from '@/features/sensors/hooks';
import { useAdminSites } from '@/features/sites/adminHooks';
import { useSiteRealtime } from '@/features/realtime/realtimeStore';
import type {
  BoardWithSensors,
  CreateSensorPayload,
  SensorWithContext,
  TelemetryPoint,
  UpdateBoardPayload,
  UpdateSensorPayload,
} from '@monitor/shared';
import { SensorFormModal } from './SensorFormModal';
import { BoardFormModal } from './BoardFormModal';

export function BoardDetailPage() {
  const { boardId } = useParams();
  const navigate = useNavigate();
  const id = boardId ? Number(boardId) : null;

  const { data: board, isLoading } = useBoard(id);
  const { data: sensors = [] } = useBoardSensors(id);

  // Realtime is subscribed globally in App.tsx — we just read the store here.
  const siteState = useSiteRealtime(board?.siteId ?? 0);

  const createMut = useCreateSensor();
  const updateMut = useUpdateSensor();
  const deleteMut = useDeleteSensor();
  const updateBoardMut = useUpdateBoard();
  const deleteBoardMut = useDeleteBoard();
  const { data: sites = [] } = useAdminSites();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SensorWithContext | null>(null);
  const [deletingSensor, setDeletingSensor] = useState<SensorWithContext | null>(null);
  const [otaOpen, setOtaOpen] = useState(false);
  const [boardEditOpen, setBoardEditOpen] = useState(false);
  const [boardDeleting, setBoardDeleting] = useState(false);
  const isSuperAdmin = useAuthStore((s) => s.user?.role === 'super_admin');
  if (isLoading) {
    return <div style={{ padding: 20, color: 'var(--dim)' }}>กำลังโหลด...</div>;
  }
  if (!board) {
    return <div style={{ padding: 20, color: 'var(--red)' }}>ไม่พบบอร์ด</div>;
  }

  const isOnline = !!board.lastSeenAt && dayjs().diff(board.lastSeenAt, 'minute') < 5;
  // Map sensorId -> latest TelemetryPoint, sourced from the WebSocket store.
  const latestBySensor = new Map<number, TelemetryPoint>();
  for (const s of sensors) {
    const point = siteState?.bySensor?.[s.id]?.latest;
    if (point) latestBySensor.set(s.id, point);
  }

  // Slot status: 1 board may hold at most 1 PZEM + 1 KWS
  const hasPzem = sensors.some((s) => (s.model ?? '').toLowerCase().startsWith('pzem'));
  const hasKws = sensors.some((s) => (s.model ?? '').toLowerCase().startsWith('kws'));
  const slotsFull = hasPzem && hasKws;

  const handleSubmit = async (payload: CreateSensorPayload | UpdateSensorPayload) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload });
        showToast(`อัปเดต ${editing.code} เรียบร้อย`);
      } else {
        await createMut.mutateAsync(payload as CreateSensorPayload);
        showToast('เพิ่มเซ็นเซอร์เรียบร้อย');
      }
      setModalOpen(false);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
        (err as Error).message ??
        'บันทึกไม่สำเร็จ';
      showToast(msg, 'error');
    }
  };

  const handleToggle = async (s: SensorWithContext) => {
    try {
      await updateMut.mutateAsync({ id: s.id, payload: { isActive: !s.isActive } });
      showToast(s.isActive ? `ปิด ${s.code}` : `เปิด ${s.code}`, 'info');
    } catch (err) {
      showToast((err as Error).message ?? 'เปลี่ยนสถานะไม่สำเร็จ', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deletingSensor) return;
    try {
      await deleteMut.mutateAsync(deletingSensor.id);
      showToast(`ลบ ${deletingSensor.code} แล้ว`, 'info');
    } catch (err) {
      showToast((err as Error).message ?? 'ลบไม่สำเร็จ', 'error');
    }
    setDeletingSensor(null);
  };

  return (
    <div>
      <PageHeader
        title={`รายละเอียดบอร์ด · ${board.code}`}
        breadcrumb="จัดการอุปกรณ์ → รายละเอียดบอร์ด"
        icon={Cpu}
      />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 18,
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={() => navigate('/admin/devices')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            color: 'var(--text)',
            padding: '7px 14px',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          <ArrowLeft size={14} />
          กลับ
        </button>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={() => setBoardEditOpen(true)}
            title="แก้ไขข้อมูลบอร์ด (ชื่อ / โซน / IP / ฯลฯ)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--text)',
              padding: '8px 14px', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 600, fontSize: 13,
            }}
          >
            <Pencil size={14} />
            แก้ไขบอร์ด
          </button>
          <button
            onClick={() => setBoardDeleting(true)}
            title="ลบบอร์ด"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'transparent',
              border: '1px solid var(--red)',
              color: 'var(--red)',
              padding: '8px 14px', borderRadius: 8,
              cursor: 'pointer', fontFamily: 'inherit',
              fontWeight: 600, fontSize: 13,
            }}
          >
            <Trash2 size={14} />
            ลบ
          </button>
          {isSuperAdmin && (
            <button
              onClick={() => setOtaOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'var(--cyan)',
                border: 'none', color: '#000',
                padding: '8px 16px', borderRadius: 8,
                cursor: 'pointer', fontFamily: 'inherit',
                fontWeight: 600, fontSize: 13,
              }}
            >
              <Upload size={14} />
              อัปเดตเฟิร์มแวร์
            </button>
          )}
        </div>
      </div>

      {/* Board info card */}
      <section className="card fade-in-up" style={{ marginBottom: 18, padding: 22 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 18,
            marginBottom: 14,
          }}
        >
          <InfoField label="รหัสบอร์ด" value={board.code} />
          <InfoField label="ชื่อ" value={board.name ?? '-'} />
          <InfoField
            label="สถานะ"
            value={
              <span className={isOnline ? 'badge badge-online' : 'badge badge-offline'}>
                {isOnline ? (
                  <>
                    <CircleDot size={10} /> Online
                  </>
                ) : (
                  <>
                    <Ban size={10} /> Offline
                  </>
                )}
              </span>
            }
          />
          <InfoField label="ฮาร์ดแวร์" value={board.hardware ?? '-'} />
          <InfoField label="Firmware" value={board.firmware ?? '-'} />
          <InfoField label="ไซต์" value={`${board.siteCode ?? '-'} · ${board.siteName ?? ''}`} />
          <InfoField label="IP Address" value={board.ipAddress ?? '-'} mono />
          <InfoField label="MAC" value={board.macAddress ?? '-'} mono />
          <InfoField
            label="เห็นล่าสุด"
            value={
              board.lastSeenAt
                ? `${dayjs(board.lastSeenAt).fromNow()} · ${dayjs(board.lastSeenAt).format(
                    'DD/MM/YYYY HH:mm:ss',
                  )}`
                : 'ยังไม่เคยส่งข้อมูล'
            }
          />
        </div>
      </section>

      {/* Sensors header + add */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--dim)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Wifi size={14} />
          เซ็นเซอร์ที่ต่อกับบอร์ด ({sensors.length})
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          disabled={slotsFull}
          title={slotsFull ? 'บอร์ดนี้มี PZEM + KWS ครบแล้ว' : 'เพิ่มเซ็นเซอร์ใหม่'}
          style={{
            padding: '9px 16px',
            background: slotsFull ? 'var(--bg-input)' : 'var(--cyan)',
            color: slotsFull ? 'var(--dim2)' : '#fff',
            border: slotsFull ? '1px solid var(--border-color)' : 'none',
            borderRadius: 8,
            fontWeight: 600,
            fontSize: 13,
            cursor: slotsFull ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            opacity: slotsFull ? 0.6 : 1,
          }}
        >
          <Plus size={15} />
          {slotsFull ? 'เต็มแล้ว (PZEM + KWS)' : 'เพิ่มเซ็นเซอร์'}
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: 16,
        }}
      >
        {sensors.map((s) => (
          <SensorCard
            key={s.id}
            sensor={s}
            reading={latestBySensor.get(s.id)}
            onEdit={() => {
              setEditing(s);
              setModalOpen(true);
            }}
            onToggle={() => handleToggle(s)}
            onDelete={() => setDeletingSensor(s)}
          />
        ))}
        {sensors.length === 0 && (
          <div
            style={{
              padding: 28,
              background: 'var(--bg-card)',
              border: '1px dashed var(--border-color)',
              borderRadius: 12,
              textAlign: 'center',
              color: 'var(--dim)',
              gridColumn: '1 / -1',
            }}
          >
            ยังไม่มีเซ็นเซอร์ — กดปุ่ม "เพิ่มเซ็นเซอร์" ด้านบนเพื่อเริ่มต้น
          </div>
        )}
      </div>

      <SensorFormModal
        open={modalOpen}
        boardId={board.id}
        editing={editing}
        existingSensors={sensors}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        submitting={createMut.isPending || updateMut.isPending}
      />

      <BoardOtaModal
        board={otaOpen ? board : null}
        onClose={() => setOtaOpen(false)}
      />

      <BoardFormModal
        open={boardEditOpen}
        editing={board as BoardWithSensors}
        sites={sites}
        onClose={() => setBoardEditOpen(false)}
        onSubmit={async (payload) => {
          try {
            await updateBoardMut.mutateAsync({
              id: board.id, payload: payload as UpdateBoardPayload,
            });
            showToast(`อัปเดต ${board.code} เรียบร้อย`);
            setBoardEditOpen(false);
          } catch (err) {
            showToast((err as Error).message ?? 'บันทึกไม่สำเร็จ', 'error');
          }
        }}
        submitting={updateBoardMut.isPending}
      />

      {boardDeleting && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            zIndex: 1000, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
          }}
          onClick={(e) => e.target === e.currentTarget && setBoardDeleting(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14, padding: 28, width: 420,
              textAlign: 'center', boxShadow: 'var(--shadow-lg)',
            }}
          >
            <Trash2 size={48} color="var(--red)" style={{ marginBottom: 12 }} />
            <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>
              ยืนยันการลบบอร์ด
            </h3>
            <p style={{ color: 'var(--dim)', fontSize: 14 }}>
              ลบบอร์ด <strong style={{ color: 'var(--red)' }}>{board.code}</strong>?
              <br />
              {sensors.length > 0 && (
                <span style={{ color: 'var(--yellow)' }}>
                  ⚠ ต้องลบ sensor {sensors.length} ตัวก่อน
                </span>
              )}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setBoardDeleting(false)}
                style={{
                  padding: '9px 18px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text)',
                  borderRadius: 8, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >ยกเลิก</button>
              <button
                onClick={async () => {
                  try {
                    await deleteBoardMut.mutateAsync(board.id);
                    showToast(`ลบ ${board.code} แล้ว`, 'info');
                    navigate('/admin/devices');
                  } catch (err) {
                    const msg = (err as { response?: { data?: { message?: string } } })
                      .response?.data?.message ?? 'ลบไม่สำเร็จ (อาจมี sensor ผูกอยู่)';
                    showToast(msg, 'error');
                    setBoardDeleting(false);
                  }
                }}
                style={{
                  padding: '9px 18px',
                  background: 'var(--red)', border: 'none', color: '#fff',
                  borderRadius: 8, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >ลบเลย</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deletingSensor && (
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
          onClick={(e) => e.target === e.currentTarget && setDeletingSensor(null)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: 28,
              width: 420,
              textAlign: 'center',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <Trash2 size={48} color="#ef4444" style={{ marginBottom: 12 }} />
            <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>ยืนยันการลบ</h3>
            <p style={{ color: 'var(--dim)', fontSize: 14 }}>
              ลบเซ็นเซอร์{' '}
              <strong style={{ color: 'var(--red)' }}>{deletingSensor.code}</strong>
              ?<br />
              ข้อมูล telemetry เก่าจะยังอยู่ใน DB
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 22 }}>
              <button
                onClick={() => setDeletingSensor(null)}
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
                onClick={handleDelete}
                style={{
                  padding: '9px 18px',
                  background: 'var(--red)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ลบเลย
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function InfoField({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--dim2)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 4,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 14,
          color: 'var(--text)',
          fontFamily: mono ? 'monospace' : 'inherit',
          fontWeight: mono ? 500 : 400,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function SensorCard({
  sensor,
  reading,
  onEdit,
  onToggle,
  onDelete,
}: {
  sensor: SensorWithContext;
  reading?: TelemetryPoint;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const hasData = !!reading;
  const stale = reading && dayjs().diff(reading.time, 'second') > 30;
  const showLive = sensor.isActive && hasData && !stale;

  const color = sensor.code.startsWith('PZEM')
    ? '#06b6d4'
    : sensor.code.startsWith('KWS')
      ? '#a78bfa'
      : '#22c55e';

  const opacity = sensor.isActive ? 1 : 0.55;

  return (
    <div
      style={{
        background: 'var(--bg-card)',
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: 18,
        boxShadow: 'var(--shadow-sm)',
        opacity,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: 'var(--text)',
              letterSpacing: '-0.01em',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {sensor.code}
            {!sensor.isActive && (
              <span
                style={{
                  fontSize: 10,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'rgba(148, 163, 184, 0.15)',
                  color: 'var(--dim2)',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                }}
              >
                DISABLED
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--dim)', marginTop: 2 }}>
            {sensor.name ?? 'ไม่มีชื่อ'}{' '}
            {sensor.model && <span style={{ color: 'var(--dim2)' }}>· {sensor.model}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {sensor.isActive && (
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 999,
                background: showLive
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(148, 163, 184, 0.12)',
                color: showLive ? '#22c55e' : 'var(--dim2)',
                fontSize: 11,
                fontWeight: 700,
                border: `1px solid ${showLive ? '#22c55e33' : 'var(--border-color)'}`,
                letterSpacing: '0.04em',
                marginRight: 4,
              }}
            >
              {showLive ? 'LIVE' : 'NO DATA'}
            </span>
          )}
          <IconBtn
            title={sensor.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
            onClick={onToggle}
            color={sensor.isActive ? '#22c55e' : '#94a3b8'}
          >
            <Power size={14} />
          </IconBtn>
          <IconBtn title="แก้ไข" onClick={onEdit}>
            <Pencil size={14} />
          </IconBtn>
          <IconBtn title="ลบ" onClick={onDelete} color="#ef4444">
            <Trash2 size={14} />
          </IconBtn>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))',
          gap: 12,
          marginBottom: 12,
        }}
      >
        <Metric Icon={Zap} color="#06b6d4" label="Voltage" value={reading?.voltage} unit="V" digits={1} />
        <Metric Icon={Activity} color="#22c55e" label="Current" value={reading?.current} unit="A" digits={3} />
        <Metric Icon={Gauge} color="#a78bfa" label="Power" value={reading?.power} unit="W" digits={1} />
        <Metric Icon={BatteryCharging} color="#f59e0b" label="Energy" value={reading?.energy} unit="kWh" digits={3} />
        {reading?.temperature != null && (
          <Metric Icon={Thermometer} color="#ef4444" label="Temperature" value={reading.temperature} unit="°C" digits={1} />
        )}
        {(reading?.raw as Record<string, number> | undefined)?.frequency != null && (
          <Metric
            Icon={Hash}
            color="#94a3b8"
            label="Frequency"
            value={(reading!.raw as Record<string, number>).frequency}
            unit="Hz"
            digits={1}
          />
        )}
      </div>

      {/* Per-phase breakdown for KWS-AC306L 3-phase sensors. The main
          grid above shows aggregates (V_A as the reference, sum of
          currents, meter Total power); this strip splits them per
          phase so an unbalanced load is visible at a glance. */}
      <PerPhaseStrip sensor={sensor} raw={reading?.raw} />

      {/* Peak Limit (per-sensor thresholds) */}
      {(sensor.voltageMin != null ||
        sensor.voltageMax != null ||
        sensor.currentMax != null ||
        sensor.powerMax != null ||
        sensor.temperatureMax != null) && (
        <div
          style={{
            fontSize: 10.5,
            color: 'var(--dim)',
            paddingTop: 10,
            borderTop: '1px dashed var(--border-color)',
            marginBottom: 8,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
          }}
        >
          <span
            style={{
              fontWeight: 700,
              letterSpacing: '0.04em',
              color: 'var(--dim2)',
            }}
          >
            PEAK LIMITS:
          </span>
          {sensor.voltageMin != null && (
            <LimitBadge label={`V ≥ ${sensor.voltageMin}V`} />
          )}
          {sensor.voltageMax != null && (
            <LimitBadge label={`V ≤ ${sensor.voltageMax}V`} />
          )}
          {sensor.currentMax != null && (
            <LimitBadge label={`I ≤ ${sensor.currentMax}A`} />
          )}
          {sensor.powerMax != null && (
            <LimitBadge label={`W ≤ ${sensor.powerMax}W`} />
          )}
          {sensor.temperatureMax != null && (
            <LimitBadge label={`T ≤ ${sensor.temperatureMax}°C`} />
          )}
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: 'var(--dim2)',
          paddingTop: 10,
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>
          {sensor.channel ? `ช่อง: ${sensor.channel}` : ''}
          {sensor.channel && reading && ' · '}
          {reading && `อัปเดต: ${dayjs(reading.time).fromNow()}`}
        </span>
        {reading && (reading.raw as Record<string, number> | undefined)?.pf != null && (
          <span>PF: {(reading.raw as Record<string, number>).pf.toFixed(2)}</span>
        )}
      </div>
    </div>
  );
}

// Only render anything when the sensor identifies as KWS 3-phase
// (model contains AC306) AND the firmware has supplied per-phase
// values in the raw payload. Otherwise this returns null and the
// surrounding layout collapses cleanly.
function PerPhaseStrip({
  sensor,
  raw,
}: {
  sensor: { model?: string | null; phases?: 1 | 3 | null };
  raw: unknown;
}) {
  // Render the per-phase strip for any KWS sensor (1-phase or
  // 3-phase). For 1-phase wiring B/C come back as zeros — that's
  // intentional: operators want a consistent "all three phases"
  // layout instead of having to remember which sensors are which.
  // PZEM and unknown families don't have per-phase data so we skip.
  const m = (sensor.model ?? '').toUpperCase();
  const isKws =
    sensor.phases === 1 ||
    sensor.phases === 3 ||
    (sensor.phases == null && (m.includes('KWS') || m.includes('AC301') || m.includes('AC306')));
  if (!isKws) return null;
  const r = raw as Record<string, unknown> | undefined;
  if (!r) return null;
  // Skip if firmware predates per-phase fields entirely — don't render
  // a misleading "Phase A: 0/0/0" panel for boards on old firmware.
  const hasPerPhase =
    r.vA !== undefined || r.iA !== undefined || r.pA !== undefined;
  if (!hasPerPhase) return null;
  const num = (k: string) => (typeof r[k] === 'number' ? (r[k] as number) : 0);
  const phases = [
    { label: 'A', v: num('vA'), i: num('iA'), p: num('pA') },
    { label: 'B', v: num('vB'), i: num('iB'), p: num('pB') },
    { label: 'C', v: num('vC'), i: num('iC'), p: num('pC') },
  ];
  return (
    <div
      style={{
        marginTop: 2,
        marginBottom: 12,
        padding: '10px 12px',
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        borderRadius: 8,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <div style={{
        fontSize: 10.5, fontWeight: 700, letterSpacing: '0.05em',
        color: 'var(--dim2)', textTransform: 'uppercase', marginBottom: 6,
      }}>
        Per-phase
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '24px 1fr 1fr 1fr',
        gap: '4px 14px',
        fontSize: 12,
        color: 'var(--text)',
      }}>
        <span style={{ color: 'var(--dim)', fontWeight: 600 }} />
        <span style={{ color: 'var(--dim)', fontWeight: 600 }}>V</span>
        <span style={{ color: 'var(--dim)', fontWeight: 600 }}>A</span>
        <span style={{ color: 'var(--dim)', fontWeight: 600 }}>W</span>
        {phases.map((p) => (
          <Fragment key={p.label}>
            <span style={{ fontWeight: 700, color: 'var(--cyan)' }}>{p.label}</span>
            <span>{p.v.toFixed(1)}</span>
            <span>{p.i.toFixed(3)}</span>
            <span>{p.p.toFixed(1)}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function LimitBadge({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: '1px 7px',
        borderRadius: 4,
        background: 'rgba(167, 139, 250, 0.1)',
        color: '#a78bfa',
        border: '1px solid rgba(167, 139, 250, 0.25)',
        fontSize: 10,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {label}
    </span>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  color,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  color?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        background: 'var(--bg-input)',
        border: '1px solid var(--border-color)',
        color: color ?? 'var(--text)',
        width: 30,
        height: 30,
        borderRadius: 7,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  );
}

function Metric({
  Icon,
  color,
  label,
  value,
  unit,
  digits,
}: {
  Icon: LucideIcon;
  color: string;
  label: string;
  value: number | null | undefined;
  unit: string;
  digits: number;
}) {
  return (
    <div
      style={{
        padding: '10px 12px',
        background: 'var(--bg-input)',
        borderRadius: 8,
        border: '1px solid var(--border-color)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: 'var(--dim)',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          marginBottom: 4,
          fontWeight: 600,
          letterSpacing: '0.03em',
        }}
      >
        <Icon size={11} color={color} />
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: value != null ? 'var(--text)' : 'var(--dim2)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value != null ? value.toFixed(digits) : '—'}
        <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--dim)', marginLeft: 4 }}>
          {unit}
        </span>
      </div>
    </div>
  );
}
