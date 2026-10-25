import { useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { formatDateStr } from '../utils/OrderEngine.js';
import { cx } from './cx.js';
import { Input } from './Field.jsx';
import s from './Choice.module.css';

/**
 * Keyboard support shared by chip groups and segmented controls:
 * arrow keys move between options (direction-aware), like a native
 * radio group.
 */
const onRadioKeyDown = (e, options, value, onChange, dir) => {
  const keys = dir === 'rtl' ? { next: 'ArrowLeft', prev: 'ArrowRight' } : { next: 'ArrowRight', prev: 'ArrowLeft' };
  const idx = options.findIndex((o) => o.value === value);
  let next = null;
  if (e.key === keys.next || e.key === 'ArrowDown') next = options[(idx + 1) % options.length];
  if (e.key === keys.prev || e.key === 'ArrowUp') next = options[(idx - 1 + options.length) % options.length];
  if (!next) return;
  e.preventDefault();
  onChange(next.value);
  const group = e.currentTarget;
  requestAnimationFrame(() => group.querySelector('[aria-checked="true"]')?.focus());
};

/** Single-choice pill chips (contractors, teams…). options: [{ value, label }]. */
export function ChipGroup({ options, value, onChange, label, size = 'md', className }) {
  const { dir } = useI18n();
  // Exactly one chip is tabbable: the checked one, else the first.
  const focusIdx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(s.chips, className)}
      onKeyDown={(e) => onRadioKeyDown(e, options, value, onChange, dir)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === focusIdx ? 0 : -1}
            className={cx(s.chip, size === 'sm' && s.chipSm)}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** Segmented control (view switches: week / month / quarter…). */
export function Segmented({ options, value, onChange, label, block = false, className }) {
  const { dir } = useI18n();
  const focusIdx = Math.max(0, options.findIndex((o) => o.value === value));
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cx(s.segmented, block && s.block, className)}
      onKeyDown={(e) => onRadioKeyDown(e, options, value, onChange, dir)}
    >
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === focusIdx ? 0 : -1}
            className={s.segment}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const shiftDays = (base, days) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return formatDateStr(d);
};

/**
 * Today / Yesterday / Other date — one tap for the common case, a date
 * input only when needed. value and onChange use local 'YYYY-MM-DD'.
 */
export function DateChips({ value, onChange, label, now }) {
  const { t } = useI18n();
  const base = now || new Date();
  const today = formatDateStr(base);
  const yesterday = shiftDays(base, -1);
  const [otherOpen, setOtherOpen] = useState(false);
  const isOther = otherOpen || (value && value !== today && value !== yesterday);
  const current = isOther ? 'other' : value === yesterday ? 'yesterday' : 'today';

  const pick = (choice) => {
    if (choice === 'today') {
      setOtherOpen(false);
      onChange(today);
    } else if (choice === 'yesterday') {
      setOtherOpen(false);
      onChange(yesterday);
    } else {
      setOtherOpen(true);
    }
  };

  return (
    <div className={s.dateRow}>
      <ChipGroup
        label={label || t('ui.date')}
        value={current}
        onChange={pick}
        options={[
          { value: 'today', label: t('ui.today') },
          { value: 'yesterday', label: t('ui.yesterday') },
          { value: 'other', label: t('ui.otherDate') },
        ]}
      />
      {isOther && (
        <Input
          type="date"
          aria-label={label || t('ui.date')}
          value={value || ''}
          max={today}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}
