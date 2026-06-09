import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Sun,
  Moon,
  Check,
  Settings as SettingsIcon,
  LogOut,
  UserCog,
  KeyRound,
  History,
  ChevronRight,
  Building2,
} from 'lucide-react';
import { dayjs } from '@/lib/dayjs';
import { PageHeader } from '@/components/layout/PageHeader';
import { showToast } from '@/lib/toast';
import { useThemeStore, type ThemeMode } from '@/features/theme/store';
import { useAuthStore } from '@/features/auth/store';
import { fetchMySites } from '@/features/sites/api';
import { useLoginHistory } from '@/features/account/hooks';
import { EditProfileModal } from './EditProfileModal';
import { ChangePasswordModal } from './ChangePasswordModal';

export function SettingsPage() {
  const navigate = useNavigate();
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const [profileOpen, setProfileOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  // Sites this user has access to (shown inside the Account card).
  const { data: mySites = [] } = useQuery({
    queryKey: ['sites', 'mine'],
    queryFn: fetchMySites,
  });
  // 5 most-recent login attempts for the inline preview.
  const { data: recentLogins } = useLoginHistory({ limit: 5 });

  return (
    <div>
      <PageHeader
        title="การตั้งค่า"
        breadcrumb="ตั้งค่า"
        icon={SettingsIcon}
      />

      <div
        style={{
          display: 'grid',
          // Capped at 2 columns: each column wants ≥640 px, so on any
          // screen wider than ~1300 px (640 × 2 + gap) we still only fit two
          // — never three or four. `min(100%, 640px)` prevents overflow on
          // mobile (<640 px) by falling back to 1 column.
          gridTemplateColumns:
            'repeat(auto-fit, minmax(min(100%, 640px), 1fr))',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {/* User info — top-left so the most relevant info is what you see first */}
        <Section
          title="บัญชีผู้ใช้ (Account)"
          description="ข้อมูลบัญชีของคุณในปัจจุบัน"
        >
          <InfoRow label="ชื่อผู้ใช้" value={user?.username ?? '-'} />
          <InfoRow label="ชื่อ-นามสกุล" value={user?.fullName ?? '-'} />
          <InfoRow label="อีเมล" value={user?.email ?? '-'} />
          <InfoRow label="เบอร์โทรศัพท์" value={user?.phoneNumber ?? '-'} />
          <InfoRow label="บทบาท" value={user?.role ?? '-'} />
          <InfoRow
            label="ไซต์ที่ได้รับสิทธิ์"
            value={
              mySites.length === 0 ? (
                <span style={{ color: 'var(--dim)' }}>ยังไม่ได้รับสิทธิ์ไซต์ใดๆ</span>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {mySites.map((row) => (
                    <span
                      key={row.site.id}
                      onClick={() => navigate(`/sites/${row.site.id}/dashboard`)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '3px 9px',
                        borderRadius: 999,
                        background: 'var(--cyan-glow)',
                        border: '1px solid rgba(34, 211, 238, 0.3)',
                        color: 'var(--cyan)',
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title={`ไปยังหน้า ${row.site.name}`}
                    >
                      <Building2 size={10} />
                      {row.site.code}
                    </span>
                  ))}
                </div>
              )
            }
          />

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 10,
              marginTop: 18,
            }}
          >
            <ActionButton
              icon={<UserCog size={14} />}
              label="แก้ไขข้อมูลส่วนตัว"
              onClick={() => setProfileOpen(true)}
              variant="primary"
            />
            <ActionButton
              icon={<KeyRound size={14} />}
              label="เปลี่ยนรหัสผ่าน"
              onClick={() => setPasswordOpen(true)}
            />
            <button
              onClick={() => setLogoutConfirm(true)}
              style={{
                padding: '9px 18px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                color: 'var(--text)',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'Sarabun, sans-serif',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--red)';
                e.currentTarget.style.color = 'var(--red)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text)';
              }}
            >
              <LogOut size={14} />
              ออกจากระบบ
            </button>
          </div>
        </Section>

        {/* Login history */}
        <Section
          title="ความปลอดภัย (Security)"
          description="ตรวจสอบประวัติการเข้าใช้งานบัญชีของคุณ"
        >
          {/* Preview the 5 most-recent attempts inline so users get answers
              without leaving the page. The full table lives at
              /settings/login-history. */}
          {!recentLogins || recentLogins.rows.length === 0 ? (
            <div
              style={{
                padding: '14px 16px',
                background: 'var(--bg-input)',
                border: '1px dashed var(--border-color)',
                borderRadius: 10,
                color: 'var(--dim)',
                fontSize: 13,
                textAlign: 'center',
              }}
            >
              ยังไม่มีประวัติการเข้าใช้งาน
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recentLogins.rows.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 8,
                    fontSize: 12.5,
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: row.success ? '#22c55e' : '#ef4444',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        color: 'var(--text)',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.success ? 'เข้าสู่ระบบสำเร็จ' : 'เข้าสู่ระบบไม่สำเร็จ'}
                    </div>
                    <div
                      style={{
                        color: 'var(--dim)',
                        fontSize: 11,
                        marginTop: 1,
                        fontFamily: 'ui-monospace, monospace',
                      }}
                    >
                      {row.ipAddress ?? 'unknown IP'}
                    </div>
                  </div>
                  <div
                    style={{
                      color: 'var(--dim2)',
                      fontSize: 11,
                      whiteSpace: 'nowrap',
                    }}
                    title={dayjs(row.createdAt).format('DD/MM/YYYY HH:mm:ss')}
                  >
                    {dayjs(row.createdAt).fromNow()}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={() => navigate('/settings/login-history')}
            style={{
              width: '100%',
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '10px 14px',
              background: 'transparent',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              color: 'var(--cyan)',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'Sarabun, sans-serif',
              transition: 'border-color 0.2s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = 'var(--cyan)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = 'var(--border-color)')
            }
          >
            <History size={14} />
            แสดงประวัติทั้งหมด
            <ChevronRight size={14} />
          </button>
        </Section>

        {/* Theme section — visual prefs, less critical than account info */}
        <Section
          title="การแสดงผล (Appearance)"
          description="เลือกธีมสีของระบบ — การตั้งค่านี้บันทึกในเบราว์เซอร์ของคุณ"
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 14,
            }}
          >
            <ThemeOption
              mode="dark"
              currentMode={mode}
              onSelect={setMode}
              Icon={Moon}
              label="Dark"
              description="ธีมมืด (Default) — ถนอมสายตา ใช้งานในที่แสงน้อย"
              previewBg="#0d1117"
              previewBorder="#30363d"
              previewAccent="#22d3ee"
            />
            <ThemeOption
              mode="light"
              currentMode={mode}
              onSelect={setMode}
              Icon={Sun}
              label="Light"
              description="ธีมสว่าง — ใช้งานในที่แสงสว่าง"
              previewBg="#f3f5f9"
              previewBorder="#d9dee5"
              previewAccent="#0891b2"
            />
          </div>
        </Section>

        {/* About */}
        <Section title="เกี่ยวกับ (About)">
          <InfoRow label="ระบบ" value="Remote Electrical Monitor" />
          <InfoRow label="เวอร์ชัน" value="0.1.0" />
          <InfoRow
            label="Theme ปัจจุบัน"
            value={
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--cyan)',
                }}
              >
                {mode === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                {mode === 'dark' ? 'Dark' : 'Light'}
              </span>
            }
          />
        </Section>
      </div>

      <EditProfileModal
        open={profileOpen}
        user={user}
        onClose={() => setProfileOpen(false)}
        onSaved={(msg) => showToast(msg)}
      />
      <ChangePasswordModal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        onSaved={(msg) => showToast(msg)}
      />

      {/* Logout confirmation — destructive enough to deserve a click-confirm
          step. Matches the delete-site / delete-board confirms elsewhere. */}
      {logoutConfirm && (
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
          onClick={(e) => e.target === e.currentTarget && setLogoutConfirm(false)}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 14,
              padding: 28,
              width: 380,
              maxWidth: '90vw',
              textAlign: 'center',
              boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                display: 'grid',
                placeItems: 'center',
                margin: '0 auto 14px',
              }}
            >
              <LogOut size={26} color="#ef4444" />
            </div>
            <h3 style={{ color: 'var(--text)', margin: '0 0 8px', fontSize: 17 }}>
              ยืนยันการออกจากระบบ
            </h3>
            <p style={{ color: 'var(--dim)', fontSize: 13, margin: '0 0 22px' }}>
              คุณจะถูกออกจากบัญชี <strong style={{ color: 'var(--text)' }}>{user?.username}</strong>
              <br />
              และต้อง login ใหม่ในครั้งถัดไป
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
              <button
                onClick={() => setLogoutConfirm(false)}
                style={{
                  padding: '9px 22px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text)',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'Sarabun, sans-serif',
                }}
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  clear();
                  navigate('/login');
                }}
                style={{
                  padding: '9px 22px',
                  background: 'var(--red)',
                  border: 'none',
                  color: '#fff',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'Sarabun, sans-serif',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <LogOut size={14} />
                ออกจากระบบ
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function ActionButton({
  icon,
  label,
  onClick,
  variant = 'secondary',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}) {
  const primary = variant === 'primary';
  return (
    <button
      onClick={onClick}
      style={{
        padding: '9px 18px',
        background: primary ? 'var(--cyan)' : 'var(--bg-input)',
        border: `1px solid ${primary ? 'var(--cyan)' : 'var(--border-color)'}`,
        color: primary ? '#000' : 'var(--text)',
        borderRadius: 8,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: 600,
        fontFamily: 'Sarabun, sans-serif',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card">
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--cyan)',
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      {description && (
        <div style={{ fontSize: 12, color: 'var(--dim)', marginBottom: 16 }}>
          {description}
        </div>
      )}
      <div style={{ marginTop: description ? 0 : 12 }}>{children}</div>
    </section>
  );
}

function ThemeOption({
  mode,
  currentMode,
  onSelect,
  Icon,
  label,
  description,
  previewBg,
  previewBorder,
  previewAccent,
}: {
  mode: ThemeMode;
  currentMode: ThemeMode;
  onSelect: (m: ThemeMode) => void;
  Icon: typeof Sun;
  label: string;
  description: string;
  previewBg: string;
  previewBorder: string;
  previewAccent: string;
}) {
  const active = mode === currentMode;

  return (
    <button
      onClick={() => onSelect(mode)}
      style={{
        textAlign: 'left',
        padding: 16,
        background: active ? 'var(--cyan-glow)' : 'var(--bg-input)',
        border: `2px solid ${active ? 'var(--cyan)' : 'var(--border-color)'}`,
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: 'Sarabun, sans-serif',
        position: 'relative',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.borderColor = 'var(--border-hover)';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.borderColor = 'var(--border-color)';
      }}
    >
      {active && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: 'var(--cyan)',
            color: '#fff',
            width: 22,
            height: 22,
            borderRadius: '50%',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Check size={14} />
        </div>
      )}

      {/* Preview */}
      <div
        style={{
          background: previewBg,
          border: `1px solid ${previewBorder}`,
          borderRadius: 6,
          padding: 8,
          marginBottom: 10,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
      >
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: previewAccent,
          }}
        />
        <div
          style={{
            height: 4,
            flex: 1,
            background: previewBorder,
            borderRadius: 2,
          }}
        />
        <div
          style={{
            height: 4,
            width: 24,
            background: previewAccent,
            borderRadius: 2,
          }}
        />
      </div>

      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          color: 'var(--text)',
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Icon size={16} color={active ? '#22d3ee' : undefined} />
        {label}
      </div>
      <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
        {description}
      </div>
    </button>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        padding: '10px 0',
        borderBottom: '1px solid var(--border-color)',
        fontSize: 13,
      }}
    >
      <div
        style={{
          width: 160,
          color: 'var(--dim)',
          flexShrink: 0,
        }}
      >
        {label}
      </div>
      <div style={{ color: 'var(--text)' }}>{value}</div>
    </div>
  );
}
