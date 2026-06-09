import { useEffect, useState } from 'react';
import { X, Plus, Pencil, Save, KeyRound } from 'lucide-react';
import type {
  CreateUserPayload,
  Site,
  SitePermission,
  UpdateUserPayload,
  UserRole,
  UserWithPermissions,
} from '@monitor/shared';

interface UserFormModalProps {
  open: boolean;
  editing: UserWithPermissions | null;
  sites: Site[];
  /** Role of the user driving the form — gates which fields are editable. */
  actorRole: UserRole;
  onClose: () => void;
  onSubmit: (payload: CreateUserPayload | UpdateUserPayload) => void;
  submitting: boolean;
}

interface FormState {
  username: string;
  password: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
  isActive: boolean;
  perms: Record<number, { enabled: boolean; permission: SitePermission }>;
}

const initialState = (): FormState => ({
  username: '',
  password: '',
  fullName: '',
  email: '',
  phoneNumber: '',
  role: 'viewer',
  isActive: true,
  perms: {},
});

export function UserFormModal({
  open,
  editing,
  sites,
  actorRole,
  onClose,
  onSubmit,
  submitting,
}: UserFormModalProps) {
  // site_admin gets a stripped-down form: no role selector, no password,
  // no username rename — those are server-blocked too, but hiding them
  // avoids a confusing 403 after a save attempt.
  const limitedActor = actorRole === 'site_admin';
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const perms: Record<number, { enabled: boolean; permission: SitePermission }> = {};
      sites.forEach((s) => {
        const found = editing.sitePermissions.find((p) => p.siteId === s.id);
        perms[s.id] = {
          enabled: !!found,
          permission: found?.permission ?? 'read',
        };
      });
      setForm({
        username: editing.username,
        password: '',
        fullName: editing.fullName ?? '',
        email: editing.email ?? '',
        phoneNumber: editing.phoneNumber ?? '',
        role: editing.role,
        isActive: editing.isActive,
        perms,
      });
    } else {
      const perms: Record<number, { enabled: boolean; permission: SitePermission }> = {};
      sites.forEach((s) => {
        perms[s.id] = { enabled: false, permission: 'read' };
      });
      setForm({ ...initialState(), perms });
    }
    setError(null);
  }, [open, editing, sites]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!form.username || form.username.length < 3) {
      setError('ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร');
      return;
    }
    if (!editing && (!form.password || form.password.length < 6)) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (form.password && form.password.length < 6) {
      setError('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    const sitePermissions = Object.entries(form.perms)
      .filter(([, v]) => v.enabled)
      .map(([siteId, v]) => ({ siteId: Number(siteId), permission: v.permission }));

    const payload: CreateUserPayload | UpdateUserPayload = {
      username: form.username,
      fullName: form.fullName || undefined,
      email: form.email || undefined,
      phoneNumber: form.phoneNumber || undefined,
      role: form.role,
      isActive: form.isActive,
      sitePermissions,
    };
    if (form.password) {
      (payload as CreateUserPayload).password = form.password;
    }
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
            {editing ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div
            style={{
              padding: 12,
              background: 'rgba(248, 113, 113, 0.1)',
              border: '1px solid var(--red)',
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
          <Field label="ชื่อผู้ใช้ *">
            <input
              type="text"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              style={inputStyle}
              disabled={!!editing}
            />
          </Field>
          {/* site_admin doesn't get to set passwords directly — they use the
              dedicated reset-password button in the user list. */}
          {(!limitedActor || !editing) && (
            <Field label={editing ? 'รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)' : 'รหัสผ่าน *'}>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={inputStyle}
              />
            </Field>
          )}
          <Field label="ชื่อ-นามสกุล">
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="อีเมล">
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <Field label="เบอร์โทรศัพท์">
            <input
              type="tel"
              value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
              placeholder="เช่น 0812345678"
              style={inputStyle}
            />
          </Field>
          <Field label="บทบาท (Role)">
            {limitedActor ? (
              <input
                type="text"
                value="Viewer (site_admin สร้างได้เฉพาะ viewer)"
                disabled
                style={{ ...inputStyle, color: 'var(--dim)' }}
              />
            ) : (
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
                style={inputStyle}
              >
                <option value="super_admin">Super Admin</option>
                <option value="site_admin">Site Admin</option>
                <option value="viewer">Viewer</option>
              </select>
            )}
          </Field>
          <Field label="สถานะ">
            <select
              value={form.isActive ? '1' : '0'}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}
              style={inputStyle}
            >
              <option value="1">Active</option>
              <option value="0">Inactive</option>
            </select>
          </Field>
        </div>

        {/* Permission section */}
        <div
          style={{
            marginTop: 22,
            padding: 16,
            background: 'rgba(34, 211, 238, 0.04)',
            border: '1px solid var(--border-color)',
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--cyan)',
              marginBottom: 10,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <KeyRound size={14} />
            สิทธิ์การเข้าถึงไซต์
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sites.length === 0 && (
              <div style={{ color: 'var(--dim)', fontSize: 13 }}>
                ยังไม่มีไซต์ในระบบ
              </div>
            )}
            {sites.map((site) => {
              const perm = form.perms[site.id] ?? { enabled: false, permission: 'read' };
              return (
                <div
                  key={site.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '8px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={perm.enabled}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        perms: {
                          ...form.perms,
                          [site.id]: { ...perm, enabled: e.target.checked },
                        },
                      })
                    }
                    style={{ width: 16, height: 16, accentColor: '#22d3ee' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>
                      {site.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--dim)' }}>
                      {site.code}
                    </div>
                  </div>
                  <select
                    value={perm.permission}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        perms: {
                          ...form.perms,
                          [site.id]: {
                            ...perm,
                            permission: e.target.value as SitePermission,
                          },
                        },
                      })
                    }
                    disabled={!perm.enabled}
                    style={{ ...inputStyle, width: 120, padding: '6px 8px', fontSize: 12 }}
                  >
                    <option value="read">Read</option>
                    <option value="write">Write</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              );
            })}
          </div>
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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
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
  maxWidth: 640,
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5)',
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
  fontFamily: 'Sarabun, sans-serif',
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
