import { useId } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { cx } from './cx.js';
import { FieldContext, useField } from './fieldContext.js';
import s from './Field.module.css';

/**
 * Labelled form field. Wraps exactly one control (Input, Textarea,
 * Select, NumberInput…) and wires label, hint and error to it.
 */
export function Field({ label, hint, error, optional = false, className, children }) {
  const { t } = useI18n();
  const id = useId();
  const hintId = hint ? `${id}-hint` : null;
  const errorId = error ? `${id}-error` : null;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>
      <div className={cx(s.field, className)}>
        <label htmlFor={id} className={s.label}>
          {label}
          {optional && <span className={s.optional}>{t('ui.optional')}</span>}
        </label>
        {children}
        {hint && (
          <p id={hintId} className={s.hint}>
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} className={s.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}

const useControlProps = (rest) => {
  const f = useField();
  return {
    id: rest.id || f?.id,
    'aria-describedby': rest['aria-describedby'] || f?.describedBy,
    'aria-invalid': f?.invalid || undefined,
  };
};

export function Input({ className, ref, ...rest }) {
  const a11y = useControlProps(rest);
  return <input ref={ref} {...rest} {...a11y} className={cx(s.control, className)} />;
}

export function Textarea({ className, rows = 3, ref, ...rest }) {
  const a11y = useControlProps(rest);
  return <textarea ref={ref} rows={rows} {...rest} {...a11y} className={cx(s.control, s.textarea, className)} />;
}

/** Native select (best on phones); pass <option> children. */
export function Select({ className, children, ref, ...rest }) {
  const a11y = useControlProps(rest);
  return (
    <select ref={ref} {...rest} {...a11y} className={cx(s.control, s.select, className)}>
      {children}
    </select>
  );
}

/**
 * Number entry with a unit suffix (م3, د.ع…). Opens the decimal
 * keypad on phones. size="lg" is the big on-site quantity box.
 */
export function NumberInput({ unit, size = 'md', className, ref, ...rest }) {
  const a11y = useControlProps(rest);
  const f = useField();
  return (
    <span className={cx(s.box, size === 'lg' && s.boxLg, className)} data-invalid={f?.invalid || undefined}>
      <input
        ref={ref}
        type="number"
        inputMode="decimal"
        step="any"
        {...rest}
        {...a11y}
        className={s.boxInput}
      />
      {unit && <span className={s.unit}>{unit}</span>}
    </span>
  );
}
