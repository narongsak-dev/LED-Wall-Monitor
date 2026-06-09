import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Modal } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronDown, X } from 'lucide-react';
import { fetchMySites } from '@/features/sites/api';
import { SiteOverviewGrid } from '@/features/sites/SiteOverviewGrid';

export function SiteQuickPicker() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  const {
    data: sites = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['sites', 'mine'],
    queryFn: fetchMySites,
    staleTime: 5 * 60_000,
  });

  const siteMatch = location.pathname.match(/\/sites\/(\d+)\/(\w+)/);
  const currentSiteId = siteMatch?.[1];
  const currentSubPath = siteMatch?.[2] ?? 'dashboard';
  const current = sites.find((s) => String(s.site.id) === currentSiteId);

  const handleSelect = (siteId: number) => {
    navigate(`/sites/${siteId}/${currentSubPath}`);
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          color: 'var(--text)',
          padding: '10px 12px',
          borderRadius: 10,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontFamily: 'inherit',
          marginBottom: 16,
          width: '100%',
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
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--cyan-glow)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--cyan)',
            flexShrink: 0,
          }}
        >
          <Building2 size={15} />
        </div>
        <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: 'var(--text)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}
          >
            {current ? current.site.name : 'เลือกไซต์'}
          </div>
          <div
            style={{
              fontSize: 10.5,
              color: 'var(--dim)',
              marginTop: 1,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {current ? current.site.code : `${sites.length} ไซต์`}
          </div>
        </div>
        <ChevronDown size={14} color="var(--dim)" style={{ flexShrink: 0 }} />
      </button>

      <Modal
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={1100}
        closeIcon={null}
        styles={{
          mask: { backdropFilter: 'blur(4px)' },
          content: {
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            borderRadius: 16,
            padding: 0,
            boxShadow: 'var(--shadow-lg)',
          },
          body: { padding: 0 },
        }}
      >
        {/* Custom header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '22px 24px 18px',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <div>
            <h2
              style={{
                color: 'var(--text)',
                fontSize: 22,
                margin: '0 0 4px',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <Building2 size={22} color="var(--cyan)" />
              เลือกไซต์งาน
            </h2>
            <div style={{ fontSize: 13, color: 'var(--dim)' }}>
              ภาพรวมระบบ · อัปเดตทุก 1 นาที
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-color)',
              color: 'var(--dim)',
              width: 36,
              height: 36,
              borderRadius: 10,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-hover)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-color)';
              e.currentTarget.style.color = 'var(--dim)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: 24,
            maxHeight: 'calc(85vh - 100px)',
            overflowY: 'auto',
          }}
        >
          <SiteOverviewGrid
            data={sites}
            isLoading={isLoading}
            error={(error as Error) ?? null}
            onSelectSite={handleSelect}
          />
        </div>
      </Modal>
    </>
  );
}
