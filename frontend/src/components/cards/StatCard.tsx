import type { ReactNode } from 'react';
import { ArrowUp, ArrowDown, ArrowRight } from 'lucide-react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  unit?: string;
  sub?: string;
  valueColor?: string;
  iconBg?: string;
  delta?: { value: string; direction: 'up' | 'down' | 'eq' };
}

export function StatCard({
  icon,
  label,
  value,
  unit,
  sub,
  valueColor = 'var(--text)',
  iconBg = 'var(--cyan-glow)',
  delta,
}: StatCardProps) {
  const deltaColor = {
    up: 'var(--green)',
    down: 'var(--red)',
    eq: 'var(--yellow)',
  }[delta?.direction ?? 'eq'];

  const deltaBg = {
    up: 'rgba(34, 197, 94, 0.12)',
    down: 'rgba(239, 68, 68, 0.12)',
    eq: 'rgba(250, 204, 21, 0.12)',
  }[delta?.direction ?? 'eq'];

  return (
    <div
      className="fade-in-up"
      style={{
        background: 'var(--bg-card)',
        backgroundImage: 'var(--card-gradient)',
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxShadow: 'var(--shadow-sm)',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-hover)';
        e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        e.currentTarget.style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-color)';
        e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div
          style={{
            display: 'grid',
            placeItems: 'center',
            width: 38,
            height: 38,
            borderRadius: 10,
            background: iconBg,
          }}
        >
          {icon}
        </div>
        {delta && (
          <div
            style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 999,
              fontWeight: 700,
              background: deltaBg,
              color: deltaColor,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              letterSpacing: '0.02em',
            }}
          >
            {delta.direction === 'up' ? (
              <ArrowUp size={11} strokeWidth={2.5} />
            ) : delta.direction === 'down' ? (
              <ArrowDown size={11} strokeWidth={2.5} />
            ) : (
              <ArrowRight size={11} strokeWidth={2.5} />
            )}
            {delta.value}
          </div>
        )}
      </div>

      <div>
        <div
          style={{
            fontSize: 11.5,
            color: 'var(--dim)',
            fontWeight: 500,
            marginBottom: 4,
            letterSpacing: '0.01em',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: valueColor,
            lineHeight: 1.15,
            letterSpacing: '-0.02em',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
          {unit && (
            <span
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: 'var(--dim)',
                marginLeft: 5,
                letterSpacing: 0,
              }}
            >
              {unit}
            </span>
          )}
        </div>
        {sub && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--dim2)',
              marginTop: 4,
              fontWeight: 500,
            }}
          >
            {sub}
          </div>
        )}
      </div>
    </div>
  );
}
