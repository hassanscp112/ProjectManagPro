import { useState } from 'react';
import { formatCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { taskQuantityStatus } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { loadFinanceConfig } from '../../utils/Finance.js';
import { expenseBreakdown, hasComputedAmount } from '../../utils/OrderEngine.js';
import { DateChips, Field, Input, NumberInput, PhotoPicker, Select, TaskPicker, Textarea, WhoPicker, useField } from '../../ui/index.js';
import own from './OrderForm.module.css';
import s from './Record.module.css';

// Who-field modes from the order spec → the WhoPicker kinds they offer.
const WHO_KINDS = {
  contractor: ['contractor', 'none'],
  recipient: ['contractor', 'team', 'workers', 'none'],
};

/** The computed amount of an expense order and the lines it adds up from (read-only). */
function ComputedAmount({ type, draft }) {
  const { t, lang } = useI18n();
  const field = useField();
  const b = expenseBreakdown(type, draft);
  const money = (n) => formatCurrency(n, lang);
  const lines =
    type === 'payroll'
      ? [
          t('orders.lineSalary', { amount: money(b.salary) }),
          b.deducted ? t('orders.lineAdvanceDeducted', { amount: money(b.advance) }) : Number(draft.advance) > 0 && t('orders.lineAdvanceKept'),
        ]
      : b.parts
          .filter((p) => p.qty > 0 || p.rate > 0)
          .map((p) =>
            t('orders.partLine', {
              label: t(p.labelKey),
              qty: [formatNumber(p.qty), p.unitKey ? t(p.unitKey) : p.unit].filter(Boolean).join(' '),
              rate: money(p.rate),
              total: money(p.total),
            })
          );
  return (
    <div className={own.computed}>
      <output id={field?.id} aria-describedby={field?.describedBy} aria-live="polite" className={own.amount}>
        {money(b.amount)}
      </output>
      {lines.filter(Boolean).map((line) => (
        <span key={line} className={own.line}>
          {line}
        </span>
      ))}
    </div>
  );
}

/**
 * The fields of one order type, driven by its spec in OrderEngine, then
 * photos (every type; kept beside the draft by useOrderEntry).
 * Required fields are plain; optional ones say "(optional)". Errors show
 * per field after a save attempt (showErrors). size="lg": phone inputs.
 * Expense details pick their values from the finance lists (choice), take
 * numbers (measure) and recompute the amount on every change (computed).
 */
export default function OrderForm({ entry, size = 'md' }) {
  const { t } = useI18n();
  const { tasks, orders, registries, engineResult } = useProject();
  const [lists] = useState(loadFinanceConfig);
  const { draft, spec, missing, showErrors, patch, setTask } = entry;
  if (!draft || !spec) return null;

  /** Patch expense details; a computed amount follows them. */
  const patchDetail = (changes) => {
    if (!hasComputedAmount(draft.type)) return patch(changes);
    const amount = expenseBreakdown(draft.type, { ...draft, ...changes }).amount;
    return patch({ ...changes, amount: amount > 0 ? amount : '' });
  };

  const missingKeys = new Set(missing.map((f) => f.key));
  const errorFor = (f) => (showErrors && missingKeys.has(f.key) ? t('record.required') : undefined);
  const rawTask = draft.taskId ? tasks.find((x) => x.id === draft.taskId) || null : null;
  const computedTask = draft.taskId ? engineResult.tasks.find((x) => x.id === draft.taskId) : null;

  const qtyHint = (task) => {
    const st = taskQuantityStatus(engineResult.tasks.find((x) => x.id === task.id));
    return st
      ? t('record.qtyStatus', { done: formatNumber(st.done), total: formatNumber(st.total), unit: st.unit, left: formatNumber(st.left) })
      : null;
  };

  const renderField = (f) => {
    const common = { label: f.label, optional: !f.required, error: errorFor(f) };

    switch (f.kind) {
      case 'date':
        return (
          <Field key={f.key} {...common}>
            <DateChips value={draft.date} onChange={(date) => patch({ date })} label={f.label} />
          </Field>
        );
      case 'task':
        return (
          <Field key={f.key} {...common}>
            <TaskPicker tasks={tasks} orders={orders} value={draft.taskId} onChange={setTask} optional={!f.required} hint={qtyHint} />
          </Field>
        );
      case 'element': {
        const elements = Array.isArray(rawTask?.elements) ? rawTask.elements : [];
        if (elements.length === 0) return null; // nothing to pick for this task
        return (
          <Field key={f.key} {...common}>
            <Select value={draft.elementId || ''} onChange={(e) => patch({ elementId: e.target.value })}>
              <option value="">{t('orders.noElement')}</option>
              {elements.map((el) => (
                <option key={el.id} value={el.id}>
                  {el.name || t('orders.elementFallback')}
                  {el.location ? ` (${el.location})` : ''}
                </option>
              ))}
            </Select>
          </Field>
        );
      }
      case 'number':
        return (
          <Field key={f.key} {...common}>
            <NumberInput
              size={size}
              min="0"
              placeholder={f.placeholder || '0'}
              unit={draft.unit || computedTask?.unit || rawTask?.unit || ''}
              value={draft.quantity ?? ''}
              onChange={(e) => patch({ quantity: e.target.value })}
            />
          </Field>
        );
      case 'unit':
        // The task's BOQ unit is shown on the quantity box; ask only when it has none.
        if (rawTask?.unit) return null;
        return (
          <Field key={f.key} {...common} hint={t('record.unitHint')}>
            <Input value={draft.unit || ''} placeholder={f.placeholder || ''} onChange={(e) => patch({ unit: e.target.value })} />
          </Field>
        );
      case 'amount':
        return (
          <Field key={f.key} {...common}>
            <NumberInput
              size={size}
              min="0"
              placeholder="0"
              unit={t('orders.currencySuffix')}
              value={draft.amount ?? ''}
              onChange={(e) => patch({ amount: e.target.value })}
            />
          </Field>
        );
      case 'text':
        return (
          <Field key={f.key} {...common}>
            <Input value={draft[f.key] || ''} placeholder={f.placeholder || ''} onChange={(e) => patch({ [f.key]: e.target.value })} />
          </Field>
        );
      case 'choice': {
        const options = lists[f.list] || [];
        const value = draft[f.key] || '';
        return (
          <Field key={f.key} {...common}>
            <Select value={value} onChange={(e) => patchDetail({ [f.key]: e.target.value })}>
              <option value="">{t('orders.chooseOption')}</option>
              {/* a value no longer in the list (removed later, or migrated) stays selectable */}
              {value && !options.includes(value) && <option value={value}>{value}</option>}
              {options.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </Field>
        );
      }
      case 'measure':
        return (
          <Field key={f.key} {...common}>
            <NumberInput
              size={size}
              min="0"
              placeholder="0"
              unit={f.money ? t('orders.currencySuffix') : f.unit}
              value={draft[f.key] ?? ''}
              onChange={(e) => patchDetail({ [f.key]: e.target.value })}
            />
          </Field>
        );
      case 'computed':
        return (
          <Field key={f.key} {...common} error={common.error && t('orders.computedNotPositive')} className={s.wide}>
            <ComputedAmount type={draft.type} draft={draft} />
          </Field>
        );
      case 'note':
        return (
          <Field key={f.key} {...common} className={s.wide}>
            <Textarea rows={2} value={draft[f.key] || ''} placeholder={f.placeholder || ''} onChange={(e) => patch({ [f.key]: e.target.value })} />
          </Field>
        );
      case 'who':
        return (
          <Field key={f.key} {...common} className={s.wide}>
            <WhoPicker value={draft.who} onChange={(who) => patch({ who })} registries={registries} kinds={WHO_KINDS[f.mode] || WHO_KINDS.recipient} label={f.label} />
          </Field>
        );
      default:
        return null;
    }
  };

  return (
    <div className={s.formGrid}>
      {spec.fields.map(renderField)}
      <PhotoPicker className={s.wide} photos={entry.photos} onChange={entry.setPhotos} disabled={entry.saving} />
    </div>
  );
}
