import {
  X,
  Pencil,
  User as UserIcon,
  Mail,
  Phone,
  Crown,
  Eye,
  CircleDot,
  Ban,
  Building2,
  Clock,
  KeyRound,
  History,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dayjs } from '@/lib/dayjs';
import type { UserRole, UserWithPermissions } from '@monitor/shared';

interface UserDetailModalProps {
  user: UserWithPermissions | null;
  /** Role of the viewer — gates whether the Edit / Reset / History buttons
   *  show up. The modal itself is read-only; callbacks open the relevant
   *  flows on the parent page. */
  actorRole: UserRole;
  /** True when the modal subject is the viewer themself (hide destructive
   *  buttons like reset/delete on the parent — we just hide them here too). */
  isSelf: boolean;
  onClose: () => void;
  onEdit: () => void;
  onResetPassword: () => void;
}

/** Read-only view of every field on a user record, plus the actions that
 *  make sense from this context (edit, reset password, view reset history). */
export function UserDetailModal({
  user,
  actorRole,
  isSelf,
  onClose,
  onEdit,
  onResetPassword,
}: UserDetailModalProps) {
  const navigate = useNavigate();
  if (!user) return null;

  // site_admin can't manage non-viewer users, so we hide the destructive
  // actions to avoid confusing 403s. The form/server enforce the same.
  const canManage =
    actorRole === 'super_admin' || (actorRole === 'site_admin' && user.role === 'viewer');

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                background:
                  'linear-gradient(135deg, var(--cyan) 0%, var(--cyan-bright) 100%)',
                display: 'grid',
                placeItems: 'center',
                color: '#000',
                fontWeight: 800,
                fontSize: 18,
              }}
            >
              {(user.fullName || user.username).slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>
                {user.fullName ?? user.username}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--dim)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 2,
                }}
              >
                <code style={{ fontFamily: 'monospace', color: 'var(--cyan)' }}>
                  @{user.username}
                </code>
                <RoleBadge role={user.role} />
                <StatusBadge isActive={user.isActive} />
              </div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtn}>
            <X size={20} />
          </button>
        </div>

        <Section title="ข้อมูลทั่วไป">
          <Row Icon={UserIcon} label="ชื่อ-นามสกุล" value={user.fullName} />
          <Row Icon={Mail} label="อีเมล" value={user.email} mono />
          <Row Icon={Phone} label="เบอร์โทรศัพท์" value={user.phoneNumber} mono />
        </Section>

        <Section title={`สิทธิ์การเข้าถึงไซต์ (${user.sitePermissions.length})`}>
          {user.sitePermissions.length === 0 ? (
            <div style={{ color: 'var(--dim2)', fontSize: 13, padding: '4px 0' }}>
              ยังไม่ได้รับมอบหมายให้ไซต์ใด
            </div>
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {user.sitePermissions.map((p) => (
                <div
                  key={p.siteId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '9px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Building2 size={14} color="#22d3ee" />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{p.siteName}</div>
                      <div style={{ fontSize: 11, color: 'var(--dim)' }}>{p.siteCode}</div>
                    </div>
                  </div>
                  <PermissionPill permission={p.permission} />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="ระบบ">
          <Row
            Icon={Clock}
            label="สร้างเมื่อ"
            value={dayjs(user.createdAt).format('DD/MM/YYYY HH:mm')}
          />
          <Row
            Icon={Clock}
            label="อัปเดตล่าสุด"
            value={dayjs(user.updatedAt).format('DD/MM/YYYY HH:mm')}
          />
        </Section>

        <div style={footer}>
          {canManage && !isSelf && (
            <button
              onClick={() => navigate(`/admin/password-resets?userId=${user.id}`)}
              style={ghostBtn}
              title="ดูประวัติคำขอตั้งรหัสผ่านของผู้ใช้คนนี้"
            >
              <History size={14} /> ประวัติคำขอ
            </button>
          )}
          {canManage && !isSelf && (
            <button onClick={onResetPassword} style={warnBtn}>
              <KeyRound size={14} /> ตั้งรหัสใหม่
            </button>
          )}
          <button onClick={onClose} style={ghostBtn}>
            ปิด
          </button>
          {canManage && (
            <button onClick={onEdit} style={primaryBtn}>
              <Pencil size={14} /> แก้ไข
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--cyan)',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: 0.7,
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Row({
  Icon,
  label,
  value,
  mono,
}: {
  Icon: typeof UserIcon;
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '20px 130px 1fr',
        gap: 10,
        alignItems: 'center',
        padding: '7px 0',
        fontSize: 13.5,
        borderBottom: '1px dashed var(--border-color)',
      }}
    >
      <Icon size={14} color="#8b949e" />
      <div style={{ color: 'var(--dim)' }}>{label}</div>
      <div
        style={{
          color: value ? 'var(--text)' : 'var(--dim2)',
          fontFamily: mono ? 'monospace' : 'inherit',
        }}
      >
        {value ?? '—'}
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const cfg =
    role === 'super_admin'
      ? { bg: 'rgba(250, 204, 21, 0.15)', text: 'var(--yellow)', Icon: Crown, label: 'Super Admin' }
      : role === 'site_admin'
        ? { bg: 'rgba(34, 211, 238, 0.15)', text: 'var(--cyan)', Icon: UserIcon, label: 'Site Admin' }
        : { bg: 'rgba(167, 139, 250, 0.15)', text: '#a78bfa', Icon: Eye, label: 'Viewer' };
  return (
    <span
      style={{
        padding: '2px 10px',
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.text,
        fontSize: 11,
        fontWeight: 600,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <cfg.Icon size={11} />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 10px',
        borderRadius: 20,
        background: isActive ? 'rgba(74, 222, 128, 0.15)' : 'rgba(248, 113, 113, 0.15)',
        color: isActive ? 'var(--green)' : 'var(--red)',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {isActive ? (
        <>
          <CircleDot size={10} /> Active
        </>
      ) : (
        <>
          <Ban size={10} /> Inactive
        </>
      )}
    </span>
  );
}

function PermissionPill({ permission }: { permission: 'read' | 'write' | 'admin' }) {
  const cfg =
    permission === 'admin'
      ? { bg: 'rgba(250, 204, 21, 0.15)', text: 'var(--yellow)' }
      : permission === 'write'
        ? { bg: 'rgba(34, 211, 238, 0.15)', text: 'var(--cyan)' }
        : { bg: 'rgba(139, 148, 158, 0.15)', text: 'var(--dim)' };
  return (
    <span
      style={{
        padding: '2px 10px',
        borderRadius: 20,
        background: cfg.bg,
        color: cfg.text,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {permission}
    </span>
  );
}

const overlay: React.CSSProperties = {
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

const modal: React.CSSProperties = {
  background: 'var(--bg-card)',
  border: '1px solid var(--border-color)',
  borderRadius: 14,
  padding: 26,
  width: '100%',
  maxWidth: 560,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: 8,
  paddingBottom: 14,
  borderBottom: '1px solid var(--border-color)',
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--dim)',
  fontSize: 22,
  cursor: 'pointer',
};

const footer: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  flexWrap: 'wrap',
  gap: 8,
  marginTop: 22,
  paddingTop: 16,
  borderTop: '1px solid var(--border-color)',
};

const primaryBtn: React.CSSProperties = {
  padding: '9px 16px',
  background: 'var(--cyan)',
  color: '#000',
  border: 'none',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const ghostBtn: React.CSSProperties = {
  padding: '9px 16px',
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border-color)',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};

const warnBtn: React.CSSProperties = {
  padding: '9px 16px',
  background: 'transparent',
  color: 'var(--yellow)',
  border: '1px solid var(--yellow)',
  borderRadius: 8,
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};
