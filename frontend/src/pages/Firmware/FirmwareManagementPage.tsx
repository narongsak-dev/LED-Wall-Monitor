import { useState } from 'react';
import {
  Cpu,
  Upload,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Copy,
  Power,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { dayjs } from '@/lib/dayjs';
import {
  useDeleteFirmware,
  useFirmwareList,
  useSetFirmwareActive,
  useUploadFirmware,
} from '@/features/firmware/hooks';
import { extractApiError, showToast } from '@/lib/toast';
import { copyToClipboard } from '@/lib/clipboard';
import type { FirmwareRelease } from '@monitor/shared';

export function FirmwareManagementPage() {
  const { data: releases = [], isLoading } = useFirmwareList();
  const uploadMut = useUploadFirmware();
  const toggleMut = useSetFirmwareActive();
  const deleteMut = useDeleteFirmware();

  const [file, setFile] = useState<File | null>(null);
  const [version, setVersion] = useState('');
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const reset = () => {
    setFile(null);
    setVersion('');
    setDescription('');
    setProgress(null);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast('กรุณาเลือกไฟล์ .bin', 'error');
      return;
    }
    if (!version.trim()) {
      showToast('กรุณาระบุ version', 'error');
      return;
    }
    try {
      await uploadMut.mutateAsync({
        file,
        version: version.trim(),
        description: description.trim() || undefined,
        onProgress: (loaded, total) => setProgress({ loaded, total }),
      });
      showToast(`อัปโหลด ${version} สำเร็จ`, 'success');
      reset();
    } catch (err) {
      showToast(extractApiError(err, 'อัปโหลดไม่สำเร็จ'), 'error');
      setProgress(null);
    }
  };

  const handleDelete = async () => {
    if (deletingId == null) return;
    try {
      await deleteMut.mutateAsync(deletingId);
      showToast('ลบ firmware แล้ว', 'info');
    } catch (err) {
      showToast(extractApiError(err, 'ลบไม่สำเร็จ'), 'error');
    }
    setDeletingId(null);
  };

  const handleToggle = async (r: FirmwareRelease) => {
    try {
      await toggleMut.mutateAsync({ id: r.id, isActive: !r.isActive });
      showToast(
        !r.isActive ? `เปิดใช้งาน ${r.version}` : `ปิดใช้งาน ${r.version}`,
        'success',
      );
    } catch (err) {
      showToast(extractApiError(err, 'เปลี่ยนสถานะไม่สำเร็จ'), 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="จัดการ Firmware"
        breadcrumb="คลังไฟล์อัปเดตเฟิร์มแวร์ของบอร์ด"
        icon={Cpu}
      />

      {/* Upload card */}
      <section
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          padding: 22,
          marginBottom: 22,
        }}
      >
        <h3 style={{ marginTop: 0, color: 'var(--text)', fontSize: 16 }}>
          อัปโหลดไฟล์ใหม่
        </h3>
        <p style={{ color: 'var(--dim)', fontSize: 13, marginTop: 0 }}>
          เลือกไฟล์ <code>.bin</code> ที่ build จาก Arduino IDE/PlatformIO —
          บอร์ดจะดึงไฟล์นี้ผ่านปุ่ม "ตรวจสอบเวอร์ชันล่าสุด" บนหน้าเว็บของตัวบอร์ดเอง
        </p>

        <form onSubmit={handleUpload}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
              gap: 14,
            }}
          >
            <Field label="Version *">
              <input
                type="text"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="เช่น v0.12.0"
                required
                style={inputStyle}
              />
            </Field>
            <Field label="ไฟล์ .bin *">
              <input
                type="file"
                accept=".bin"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                required
                style={{ ...inputStyle, padding: 8 }}
              />
            </Field>
          </div>
          <div style={{ height: 14 }} />
          <Field label="รายละเอียดการเปลี่ยนแปลง (ทางเลือก)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="เช่น เพิ่ม OTA ผ่านหน้าเว็บ + แก้บั๊ก MQTT reconnect"
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </Field>

          {progress && (
            <div style={{ marginTop: 14 }}>
              <div
                style={{
                  height: 8,
                  background: 'var(--bg-input)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    background:
                      'linear-gradient(90deg, var(--cyan) 0%, var(--cyan-bright) 100%)',
                    width: `${(progress.loaded * 100) / progress.total}%`,
                    transition: 'width 0.2s',
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 6 }}>
                {(progress.loaded / 1024).toFixed(0)} KB /{' '}
                {(progress.total / 1024).toFixed(0)} KB
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={uploadMut.isPending}
            style={{
              marginTop: 16,
              padding: '10px 20px',
              background: 'var(--cyan)',
              color: '#000',
              border: 'none',
              borderRadius: 8,
              fontWeight: 600,
              cursor: uploadMut.isPending ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              opacity: uploadMut.isPending ? 0.6 : 1,
            }}
          >
            <Upload size={15} />
            {uploadMut.isPending ? 'กำลังอัปโหลด...' : 'อัปโหลด'}
          </button>
        </form>
      </section>

      {/* Releases list */}
      <section
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <strong style={{ color: 'var(--text)' }}>
            ไฟล์ที่อัปโหลดแล้ว ({releases.length})
          </strong>
        </div>
        {isLoading ? (
          <div style={{ padding: 24, color: 'var(--dim)' }}>กำลังโหลด...</div>
        ) : releases.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--dim)', textAlign: 'center' }}>
            <AlertCircle size={28} color="#8b949e" style={{ marginBottom: 8 }} />
            <div>ยังไม่มีไฟล์เฟิร์มแวร์ที่อัปโหลด</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr>
                  <th style={th}>Version</th>
                  <th style={th}>ขนาด</th>
                  <th style={th}>SHA-256</th>
                  <th style={th}>อัปโหลดเมื่อ</th>
                  <th style={th}>สถานะ</th>
                  <th style={{ ...th, textAlign: 'center' }}>จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => (
                  <Row
                    key={r.id}
                    release={r}
                    onToggle={() => handleToggle(r)}
                    onDelete={() => setDeletingId(r.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {deletingId != null && (
        <div
          style={overlayStyle}
          onClick={(e) => e.target === e.currentTarget && setDeletingId(null)}
        >
          <div style={modalStyle}>
            <Trash2 size={44} color="#f87171" style={{ marginBottom: 12 }} />
            <h3 style={{ color: 'var(--text)', marginBottom: 8 }}>ยืนยันการลบ</h3>
            <p style={{ color: 'var(--dim)', fontSize: 13 }}>
              ลบไฟล์{' '}
              <strong style={{ color: 'var(--red)' }}>
                {releases.find((r) => r.id === deletingId)?.version}
              </strong>
              ? บอร์ดที่ตั้งค่าไว้ให้ดาวน์โหลดเวอร์ชันนี้จะหา file ไม่เจอ
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 18 }}>
              <button onClick={() => setDeletingId(null)} style={secondaryBtn}>
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                style={{ ...secondaryBtn, background: 'var(--red)', color: '#000', border: 'none' }}
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

function Row({
  release: r,
  onToggle,
  onDelete,
}: {
  release: FirmwareRelease;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const copyHash = async () => {
    const ok = await copyToClipboard(r.sha256);
    showToast(ok ? 'คัดลอก SHA-256 แล้ว' : 'คัดลอกไม่สำเร็จ', ok ? 'success' : 'error');
  };
  return (
    <tr>
      <td style={td}>
        <strong style={{ color: 'var(--cyan)' }}>{r.version}</strong>
        {r.description && (
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
            {r.description}
          </div>
        )}
      </td>
      <td style={{ ...td, fontFamily: 'monospace', fontSize: 12, color: 'var(--dim)' }}>
        {(r.fileSize / 1024).toFixed(1)} KB
      </td>
      <td style={{ ...td, fontFamily: 'monospace', fontSize: 11, color: 'var(--dim)' }}>
        <span title={r.sha256} style={{ marginRight: 6 }}>
          {r.sha256.slice(0, 12)}…
        </span>
        <button
          onClick={copyHash}
          title="คัดลอก SHA-256 ครบ"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--cyan)',
            cursor: 'pointer',
            padding: 0,
          }}
        >
          <Copy size={12} />
        </button>
      </td>
      <td style={{ ...td, color: 'var(--dim)', fontSize: 12 }}>
        {dayjs(r.uploadedAt).format('DD/MM/YYYY HH:mm')}
      </td>
      <td style={td}>
        {r.isActive ? (
          <span
            style={{
              ...statusBadge,
              background: 'rgba(74, 222, 128, 0.15)',
              color: 'var(--green)',
            }}
          >
            <CheckCircle2 size={11} /> Active
          </span>
        ) : (
          <span
            style={{
              ...statusBadge,
              background: 'rgba(139, 148, 158, 0.15)',
              color: 'var(--dim)',
            }}
          >
            <XCircle size={11} /> Disabled
          </span>
        )}
      </td>
      <td style={{ ...td, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
          <button
            onClick={onToggle}
            title={r.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
            style={iconBtn}
          >
            <Power size={13} />
          </button>
          <button onClick={onDelete} title="ลบ" style={{ ...iconBtn, color: 'var(--red)' }}>
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
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
          fontWeight: 600,
          marginBottom: 6,
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

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '10px 14px',
  background: 'rgba(34, 211, 238, 0.05)',
  color: 'var(--dim)',
  fontWeight: 600,
  fontSize: 11.5,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  borderBottom: '1px solid var(--border-color)',
};
const td: React.CSSProperties = {
  padding: '10px 14px',
  borderBottom: '1px solid var(--border-color)',
  verticalAlign: 'top',
};
const statusBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '2px 10px',
  borderRadius: 20,
  fontSize: 11,
  fontWeight: 600,
};
const iconBtn: React.CSSProperties = {
  background: 'none',
  border: '1px solid var(--border-color)',
  color: 'var(--dim)',
  width: 30,
  height: 30,
  borderRadius: 6,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.7)',
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
  width: 400,
  textAlign: 'center',
};
const secondaryBtn: React.CSSProperties = {
  padding: '9px 18px',
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  color: 'var(--text)',
  borderRadius: 8,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
