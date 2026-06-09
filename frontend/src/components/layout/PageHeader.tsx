import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dropdown } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, LogOut } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/features/auth/store';
import { fetchMySites } from '@/features/sites/api';
import { ConnectionBadge } from './ConnectionBadge';
import { AlertBell } from './AlertBell';
import { dayjs } from '@/lib/dayjs';

interface PageHeaderProps {
  title: string;
  breadcrumb?: string;
  icon?: LucideIcon;
}

export function PageHeader({ title, breadcrumb, icon: Icon }: PageHeaderProps) {
  const navigate = useNavigate();
  const { siteId } = useParams();
  const hasSiteContext = !!siteId;
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const [now, setNow] = useState(() => dayjs());

  const { data: sites } = useQuery({
    queryKey: ['sites', 'mine'],
    queryFn: fetchMySites,
    staleTime: 5 * 60_000,
    enabled: hasSiteContext,
  });

  const currentSite = sites?.find((s) => String(s.site.id) === siteId)?.site;

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleLogout = () => {
    clear();
    navigate('/login');
  };

  const fullTitle = currentSite
    ? `${currentSite.code} · ${currentSite.name}`
    : title;

  return (
    <div
      className="fade-in"
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
        gap: 16,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h2
          className="page-title"
          style={{ display: 'flex', alignItems: 'center', gap: 10 }}
        >
          {Icon && <Icon size={22} />}
          {fullTitle}
        </h2>
        <div
          className="breadcrumb"
          style={{ display: 'flex', alignItems: 'center', gap: 8 }}
        >
          หน้าหลัก <span style={{ color: 'var(--dim2)' }}>/</span>{' '}
          <span>{breadcrumb ?? title}</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div className="page-header-connection">
          <ConnectionBadge />
        </div>
        <AlertBell />

        {/* Clock — hidden on phones via .page-header-clock media query */}
        <div
          className="page-header-clock"
          style={{
            padding: '8px 14px',
            borderRadius: 12,
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
            fontSize: 13,
            fontWeight: 600,
            fontVariantNumeric: 'tabular-nums',
            color: 'var(--text)',
          }}
        >
          {now.format('DD MMM · HH:mm:ss')}
        </div>

        {/* User dropdown */}
        <Dropdown
          menu={{
            items: [
              {
                key: 'logout',
                icon: <LogOut size={14} />,
                label: 'ออกจากระบบ',
                onClick: handleLogout,
              },
            ],
          }}
          trigger={['click']}
        >
          <div
            style={{
              padding: '6px 10px 6px 6px',
              borderRadius: 999,
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'border-color 0.2s, background 0.2s',
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = 'var(--border-hover)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = 'var(--border-color)')
            }
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: '50%',
                background:
                  'linear-gradient(135deg, var(--cyan) 0%, var(--purple) 100%)',
                display: 'grid',
                placeItems: 'center',
                color: '#fff',
                fontWeight: 700,
                fontSize: 11,
                flexShrink: 0,
              }}
            >
              {(user?.fullName ?? user?.username ?? 'U').charAt(0).toUpperCase()}
            </div>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
              {user?.fullName ?? user?.username ?? 'User'}
            </span>
            <ChevronDown size={14} color="var(--dim)" />
          </div>
        </Dropdown>
      </div>
    </div>
  );
}
