import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';

export interface ModalPickerOption<V extends string | number> {
  value: V;
  label: string;
  /** Optional secondary line shown under the label inside the modal list. */
  sub?: string;
}

export interface ModalPickerProps<V extends string | number> {
  label: string;
  options: ModalPickerOption<V>[];
  value: V | null;
  onChange: (v: V) => void;

  /** Adds a synthetic "any" / "all" choice at the top of the list. The
   *  caller uses `null` (the special value) to represent it. */
  allowNone?: boolean;
  noneLabel?: string;

  /** Override "no items available" copy. */
  emptyLabel?: string;

  disabled?: boolean;
  minWidth?: number;

  /** Hide the uppercase label above the trigger. Use this in filter bars
   *  where the trigger sits inline with unlabelled buttons (search /
   *  primary actions) — the label otherwise puts the trigger ~20 px lower
   *  than its neighbours. The label still appears inside the modal title. */
  compact?: boolean;
}

/**
 * Picker that behaves three ways depending on how many real options exist:
 *
 *   - 0 items                         → disabled chip showing the empty
 *                                       placeholder; never opens a modal.
 *   - 1 item + `allowNone=false`      → auto-selects that single item and
 *                                       renders as a read-only chip — the
 *                                       operator can't pick anything else.
 *   - any other case                  → "dropdown-looking" trigger that
 *                                       opens a centered modal with a
 *                                       search box and selectable list.
 *
 * Generic so the same component can drive Site/Zone/Board/Sensor pickers
 * without per-page boilerplate.
 */
export function ModalPicker<V extends string | number>(
  props: ModalPickerProps<V>,
) {
  const {
    label, options, value, onChange,
    allowNone = false,
    noneLabel = 'ทั้งหมด',
    emptyLabel = 'ไม่มีรายการ',
    disabled = false,
    minWidth = 180,
    compact = false,
  } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Force-pick the single option when there's exactly one and no all/none
  // is allowed. Done with a useEffect so the parent's state stays the
  // source of truth — we just nudge it once on mount / list-change.
  useEffect(() => {
    if (!allowNone && options.length === 1 && value !== options[0].value) {
      onChange(options[0].value);
    }
  }, [options, allowNone, value, onChange]);

  const selected = options.find((o) => o.value === value) ?? null;

  // Choose render mode.
  const isEmpty       = options.length === 0;
  const isForcedOne   = !allowNone && options.length === 1;
  const showModalMode = !isEmpty && !isForcedOne;

  const filtered = useMemo(() => {
    if (!query) return options;
    const q = query.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q)
          || (o.sub ?? '').toLowerCase().includes(q),
    );
  }, [options, query]);

  // Compact mode (used in filter bars) lifts the trigger height to match
  // the unlabelled neighbours by widening padding to 9px. The non-compact
  // mode keeps 8px because it has the label above eating the spacing.
  const triggerPad = compact ? '9px 12px' : '8px 12px';

  return (
    <div>
      {!compact && <label style={pickerLabelStyle}>{label}</label>}
      <button
        type="button"
        onClick={() => showModalMode && !disabled && setOpen(true)}
        disabled={isEmpty || disabled || isForcedOne}
        style={{
          background: compact ? 'var(--bg-card)' : 'var(--bg-input)',
          border: '1px solid var(--border-color)',
          color: isEmpty ? 'var(--dim2)' : 'var(--text)',
          padding: triggerPad,
          paddingRight: showModalMode ? 32 : 12,
          borderRadius: 8,
          fontSize: compact ? 14 : 13,
          fontFamily: 'inherit',
          cursor: isEmpty || disabled || isForcedOne ? 'default' : 'pointer',
          minWidth,
          textAlign: 'left',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          position: 'relative',
          opacity: isEmpty ? 0.6 : 1,
        }}
      >
        <span style={{
          flex: 1, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {isEmpty       ? emptyLabel
          : isForcedOne  ? options[0].label
          : selected     ? selected.label
          : allowNone    ? noneLabel
          :                'เลือก...'}
        </span>
        {showModalMode && (
          <ChevronDown
            size={14}
            color="var(--dim)"
            style={{ position: 'absolute', right: 10, pointerEvents: 'none' }}
          />
        )}
      </button>

      {open && showModalMode && (
        <Modal
          title={label}
          options={filtered}
          allOptions={options}
          query={query} setQuery={setQuery}
          value={value}
          allowNone={allowNone}
          noneLabel={noneLabel}
          onPick={(v) => {
            onChange(v as V);
            setOpen(false);
            setQuery('');
          }}
          onClose={() => { setOpen(false); setQuery(''); }}
        />
      )}
    </div>
  );
}

const pickerLabelStyle: React.CSSProperties = {
  display: 'block', fontSize: 10.5, color: 'var(--dim)',
  fontWeight: 600, marginBottom: 5,
  textTransform: 'uppercase', letterSpacing: 0.4,
};

function Modal<V extends string | number>(props: {
  title: string;
  options: ModalPickerOption<V>[];
  allOptions: ModalPickerOption<V>[];
  query: string; setQuery: (v: string) => void;
  value: V | null;
  allowNone: boolean;
  noneLabel: string;
  onPick: (v: V | null) => void;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        zIndex: 1100, display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && props.onClose()}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
          borderRadius: 14, width: '100%', maxWidth: 480,
          maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: 'var(--shadow-lg)',
          overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            เลือก{props.title}
            <span style={{
              fontSize: 11, color: 'var(--dim)', fontWeight: 500, marginLeft: 8,
            }}>
              {props.allOptions.length} รายการ
            </span>
          </div>
          <button onClick={props.onClose} style={{
            background: 'transparent', border: 'none',
            color: 'var(--dim)', cursor: 'pointer',
            display: 'inline-flex',
          }}>
            <X size={18} />
          </button>
        </div>

        {props.allOptions.length > 6 && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border-color)' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                color="var(--dim)"
                style={{
                  position: 'absolute', left: 10, top: '50%',
                  transform: 'translateY(-50%)', pointerEvents: 'none',
                }}
              />
              <input
                autoFocus
                value={props.query}
                onChange={(e) => props.setQuery(e.target.value)}
                placeholder="ค้นหา..."
                style={{
                  width: '100%',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text)',
                  padding: '8px 12px 8px 32px',
                  borderRadius: 8, fontSize: 13,
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>
          </div>
        )}

        <div style={{
          overflowY: 'auto', flex: 1,
          padding: '6px 0',
        }}>
          {props.allowNone && (
            <PickerRow
              label={props.noneLabel}
              sub="แสดงทั้งหมด"
              selected={props.value == null}
              onClick={() => props.onPick(null as V | null)}
            />
          )}
          {props.options.length === 0 ? (
            <div style={{
              padding: '24px 18px', textAlign: 'center',
              color: 'var(--dim)', fontSize: 13,
            }}>
              ไม่พบรายการที่ตรงกับ "{props.query}"
            </div>
          ) : (
            props.options.map((o) => (
              <PickerRow
                key={String(o.value)}
                label={o.label}
                sub={o.sub}
                selected={o.value === props.value}
                onClick={() => props.onPick(o.value)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function PickerRow(props: {
  label: string; sub?: string;
  selected: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={props.onClick}
      style={{
        width: '100%', textAlign: 'left',
        padding: '10px 18px',
        background: props.selected ? 'rgba(6, 182, 212, 0.08)' : 'transparent',
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
        color: 'var(--text)', fontFamily: 'inherit',
        borderLeft: `3px solid ${props.selected ? 'var(--cyan)' : 'transparent'}`,
      }}
      onMouseEnter={(e) => {
        if (!props.selected) e.currentTarget.style.background = 'var(--hover-bg)';
      }}
      onMouseLeave={(e) => {
        if (!props.selected) e.currentTarget.style.background = 'transparent';
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{props.label}</div>
        {props.sub && (
          <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 1 }}>
            {props.sub}
          </div>
        )}
      </div>
      {props.selected && <Check size={15} color="var(--cyan)" />}
    </button>
  );
}
