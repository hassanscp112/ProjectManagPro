import { useState } from 'react';
import { compactCurrency } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { EMPTY_VO_DRAFT, VO_CLASS_KEYS } from '../../state/projectModel.js';
import { useProject } from '../../state/projectContext.js';
import { Button, Dialog, Field, Input, ListRow, NumberInput, Segmented, Select, StatusBadge, useToast } from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import s from './Schedule.module.css';

/**
 * Sign off (or re-baseline): freeze contract quantities and prices. Mounted
 * only while open so the signer name starts fresh each time (last signer,
 * else the current user).
 */
export function SignOffDialog({ open, onOpenChange }) {
  return open ? <SignOffForm onOpenChange={onOpenChange} /> : null;
}

function SignOffForm({ onOpenChange }) {
  const { t } = useI18n();
  const toast = useToast();
  const { signOff, projectMeta, identity } = useProject();
  const [name, setName] = useState(() => projectMeta.baseline?.signedBy || identity?.name || '');
  const submit = () => {
    signOff(name);
    onOpenChange(false);
    toast({ title: t('schedule.signedToast') });
  };
  return (
    <Dialog
      open
      onOpenChange={onOpenChange}
      title={t('app.modal.signOffTitle')}
      description={t('app.modal.signOffText')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={submit}>
            {t('app.modal.signOffAction')}
          </Button>
        </>
      }
    >
      <Field label={t('app.modal.signOffName')}>
        <Input data-autofocus value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
      </Field>
    </Dialog>
  );
}

/** Variation orders: record a change to a locked contract field, and the list so far. */
export function VariationDialog({ open, onOpenChange }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const { tasks, projectMeta, raiseVariation } = useProject();
  const [draft, setDraft] = useState(EMPTY_VO_DRAFT);
  const leaves = tasks.filter((x) => !x.isGroup);
  const task = leaves.find((x) => x.id === draft.taskId) || null;
  const patch = (changes) => setDraft((d) => ({ ...d, ...changes }));
  const list = [...(projectMeta.variations || [])].reverse();

  const record = () => {
    if (raiseVariation(draft)) {
      setDraft(EMPTY_VO_DRAFT);
      toast({ title: t('schedule.voToast') });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={t('app.vo.title')}
      description={t('app.vo.text')}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.close')}</Button>
          <Button variant="primary" disabled={!draft.taskId} onClick={record}>
            {t('app.vo.record')}
          </Button>
        </>
      }
    >
      <div className={s.formGrid}>
        <Field label={t('app.vo.pickTask')} className={s.wide}>
          <Select
            data-autofocus
            value={draft.taskId}
            onChange={(e) => {
              const next = leaves.find((x) => x.id === e.target.value);
              patch({ taskId: e.target.value, newValue: next ? String(next[draft.field] ?? '') : '' });
            }}
          >
            <option value="">{t('app.vo.pickTask')}</option>
            {leaves.map((x) => (
              <option key={x.id} value={x.id}>
                {x.wbs} — {x.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('common.type')}>
          <Segmented
            label={t('common.type')}
            value={draft.field}
            onChange={(field) => patch({ field, newValue: task ? String(task[field] ?? '') : '' })}
            options={[
              { value: 'quantity', label: t('app.vo.contractQty') },
              { value: 'unitPrice', label: t('app.vo.unitPriceField') },
            ]}
          />
        </Field>
        <Field label={t('app.vo.newValue')} hint={task ? `${String(task[draft.field] ?? '—')} →` : undefined}>
          <NumberInput value={draft.newValue} onChange={(e) => patch({ newValue: e.target.value })} unit={draft.field === 'unitPrice' ? t('orders.currencySuffix') : task?.unit || ''} />
        </Field>
        <Field label={t('app.vo.classification')}>
          <Select value={draft.classification} onChange={(e) => patch({ classification: e.target.value })}>
            <option value="">{t('app.vo.classAuto')}</option>
            {Object.entries(VO_CLASS_KEYS).map(([value, key]) => (
              <option key={value} value={value}>
                {t(key)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('schedule.urgency')}>
          <Select value={draft.urgency} onChange={(e) => patch({ urgency: e.target.value })}>
            <option value="low">{t('app.vo.urgencyLow')}</option>
            <option value="medium">{t('app.vo.urgencyMedium')}</option>
            <option value="high">{t('app.vo.urgencyHigh')}</option>
          </Select>
        </Field>
        <Field label={t('app.vo.costImpact')} optional hint={t('app.vo.costImpactTitle')}>
          <NumberInput value={draft.estCostImpact} onChange={(e) => patch({ estCostImpact: e.target.value })} unit={t('orders.currencySuffix')} />
        </Field>
        <Field label={t('app.vo.scheduleImpact')} optional>
          <NumberInput value={draft.estScheduleDays} onChange={(e) => patch({ estScheduleDays: e.target.value })} />
        </Field>
        <Field label={t('app.vo.changeReason')} className={s.wide}>
          <Input value={draft.reason} onChange={(e) => patch({ reason: e.target.value })} />
        </Field>
        <Field label={t('app.vo.approver')}>
          <Input value={draft.approver} onChange={(e) => patch({ approver: e.target.value })} />
        </Field>
        <Field label={t('app.vo.clauseRef')}>
          <Input value={draft.clauseRef} onChange={(e) => patch({ clauseRef: e.target.value })} />
        </Field>
      </div>

      <div className={s.voList}>
        {list.length === 0 ? (
          <p className={s.muted}>{t('app.vo.empty')}</p>
        ) : (
          list.map((v) => (
            <ListRow
              key={v.id}
              flush
              title={`${v.taskWbs} ${v.taskName}`}
              subtitle={[
                `${v.field === 'unitPrice' ? t('app.vo.unitPriceField') : t('app.vo.qtyField')}: ${String(v.oldValue)} → ${String(v.newValue)}`,
                v.classification ? (VO_CLASS_KEYS[v.classification] ? t(VO_CLASS_KEYS[v.classification]) : v.classification) : null,
                v.clauseRef || null,
                v.estCostImpact > 0 ? `${t('app.vo.impactCost')} ${compactCurrency(v.estCostImpact, lang)}` : null,
                v.reason ? `${t('app.vo.reasonPrefix')} ${v.reason}` : null,
                [v.approver, formatDay((v.date || '').slice(0, 10))].filter(Boolean).join(' · '),
              ]
                .filter(Boolean)
                .join(' · ')}
              trailing={v.urgency === 'high' && <StatusBadge tone="danger">{t('app.vo.urgencyHigh')}</StatusBadge>}
            />
          ))
        )}
      </div>
    </Dialog>
  );
}
