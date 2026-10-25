import { ClipboardList, FileText, FolderOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { childrenOf, fieldLock, ordersInScope, scheduleStatus } from '../../state/scheduleModel.js';
import { useProject } from '../../state/projectContext.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { Button, Drawer, Field, Input, ListRow, NumberInput, ProgressBar, Select, StatusBadge } from '../../ui/index.js';
import { ltr } from '../bidi.js';
import OrderRow from '../record/OrderRow.jsx';
import { formatDay } from '../record/orderMeta.js';
import { useOrderActions } from '../record/useApproval.jsx';
import s from './Schedule.module.css';

const STATUS = {
  done: { tone: 'success', key: 'schedule.statusDone' },
  late: { tone: 'danger', key: 'schedule.statusLate' },
  active: { tone: 'accent', key: 'schedule.statusActive' },
  notStarted: { tone: 'neutral', key: 'schedule.statusNotStarted' },
};
const DEP_TYPES = ['FS', 'SS', 'FF', 'SF'];
const ORDERS_SHOWN = 5;

const pctText = (p) => `${Math.floor(Math.min(1, Math.max(0, p || 0)) * 1000) / 10}%`;

/**
 * The task side panel (bottom sheet on phones): read-first summary of one
 * item, with Record work / Files / Full details, and a quick edit for the
 * schedule and contract fields (same locks as the grid).
 */
export default function TaskPanel({ taskId, onClose }) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { tasks, orders, engineResult, projectMeta, updateTask, requestDeleteTask, addSubTask } = useProject();
  const actions = useOrderActions();
  const [editing, setEditing] = useState(false);
  const raw = tasks.find((x) => x.id === taskId) || null;
  const task = engineResult.tasks.find((x) => x.id === taskId) || null;
  const isSigned = Boolean(projectMeta.baseline);
  const scopeOrders = useMemo(() => (raw ? ordersInScope(tasks, orders, raw.id) : []), [tasks, orders, raw]);
  const children = useMemo(() => (raw ? childrenOf(tasks, raw) : []), [tasks, raw]);
  if (!raw || !task) return null;

  const today = todayStr();
  const status = STATUS[scheduleStatus(task, today)];
  const pred = raw.dependsOn ? tasks.find((x) => x.id === raw.dependsOn) : null;
  const unit = task.unit || '';
  const qty = Number(task.qty ?? task.quantity) || 0;
  const done = Number(task.actualQty) || 0;
  const set = (field, value) => updateTask({ ...raw, [field]: value });
  const lock = (field) => fieldLock(task, field, isSigned);
  const goto = (path, state) => {
    onClose();
    navigate(path, state ? { state } : undefined);
  };

  const facts = task.isGroup
    ? [
        ['schedule.itemValue', compactCurrency(task.totalCost, lang)],
        ['schedule.earnedValue', compactCurrency((task.totalCost || 0) * (task.progress || 0), lang)],
        ['gantt.colStart', formatDay(task.startDate)],
        ['gantt.colEnd', formatDay(task.endDate)],
      ]
    : [
        ['common.contractQty', `${formatNumber(qty)} ${unit}`],
        ['common.executed', `${formatNumber(done)} ${unit}`],
        ['schedule.remaining', `${formatNumber(Math.max(0, qty - done))} ${unit}`],
        ['schedule.unitPrice', compactCurrency(task.price ?? task.unitPrice, lang)],
        ['schedule.itemValue', compactCurrency(task.totalCost, lang)],
        ['schedule.earnedValue', compactCurrency((task.totalCost || 0) * (task.progress || 0), lang)],
        ['gantt.colStart', formatDay(task.startDate)],
        ['gantt.colEnd', formatDay(task.endDate)],
        ['schedule.duration', t('schedule.durationDays', { n: task.duration })],
        [
          'schedule.predecessor',
          pred ? `${pred.wbs} ${pred.name} · ${ltr(`${raw.depType || 'FS'}${raw.lag ? ` ${raw.lag > 0 ? '+' : ''}${raw.lag}` : ''}`)}` : t('schedule.noPredecessor'),
        ],
      ];

  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${task.wbs || ''} ${task.name || ''}`.trim()}
      footer={
        <div className={s.actions}>
          {!task.isGroup && (
            <Button variant="primary" icon={ClipboardList} onClick={() => goto('/record', { taskId: raw.id })}>
              {t('schedule.recordWork')}
            </Button>
          )}
          <Button icon={FolderOpen} onClick={() => goto(`/library/files/${encodeURIComponent(raw.id)}`)}>
            {t('schedule.files')}
          </Button>
          <Button icon={FileText} onClick={() => goto(`/schedule/task/${encodeURIComponent(raw.id)}/details`)}>
            {t('schedule.fullDetails')}
          </Button>
          <Button variant={editing ? 'outline' : 'secondary'} icon={Pencil} aria-pressed={editing} onClick={() => setEditing((v) => !v)}>
            {editing ? t('schedule.closeEdit') : t('schedule.quickEdit')}
          </Button>
        </div>
      }
    >
      <div className={s.panel}>
        <div className={s.chips}>
          <StatusBadge tone={status.tone} size="md">
            {t(status.key)}
          </StatusBadge>
          {task.isCritical && !task.isGroup && (
            <StatusBadge tone="danger" icon="dot" size="md">
              {t('home.critical')}
            </StatusBadge>
          )}
          {task.totalFloat != null && !task.isGroup && <StatusBadge size="md">{t('schedule.float', { n: task.totalFloat })}</StatusBadge>}
          {task.warnings?.length > 0 && (
            <StatusBadge tone="warning" size="md" title={task.warnings.join('\n')}>
              {t('schedule.warningsCount', { n: task.warnings.length })}
            </StatusBadge>
          )}
        </div>

        <div>
          <div className={s.big}>
            <span className={s.bigValue}>{pctText(task.progress)}</span>
            <span className={s.muted}>
              {task.isGroup ? t('common.progress') : task.orderSource?.manual === false ? t('schedule.doneFromOrders') : t('schedule.doneManual')}
            </span>
          </div>
          <ProgressBar value={(task.progress || 0) * 100} marker={(task.plannedProgress || 0) * 100} size="lg" label={t('common.progress')} />
        </div>

        <dl className={s.facts}>
          {facts.map(([key, value]) => (
            <div key={key} className={s.fact}>
              <dt>{t(key)}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>

        {editing && (
          <div className={s.editBox}>
            <span className={s.sectionTitle}>{t('schedule.quickEdit')}</span>
            {isSigned && !task.isGroup && <p className={s.muted}>{t('schedule.editLockedNote')}</p>}
            <div className={s.formGrid}>
              <Field label={t('common.name')} className={s.wide}>
                <Input data-autofocus value={raw.name || ''} onChange={(e) => set('name', e.target.value)} />
              </Field>
              {!task.isGroup && (
                <>
                  <Field label={t('schedule.duration')}>
                    <NumberInput min="0" value={raw.duration ?? ''} onChange={(e) => set('duration', e.target.value)} />
                  </Field>
                  <Field label={t('gantt.colStart')} hint={lock('manualStart') ? t('schedule.lockDependency') : undefined}>
                    <Input type="date" value={raw.manualStart || ''} disabled={Boolean(lock('manualStart'))} onChange={(e) => set('manualStart', e.target.value)} />
                  </Field>
                  <Field label={t('gantt.colPredecessor')} className={s.wide}>
                    <Select
                      value={raw.dependsOn || ''}
                      onChange={(e) =>
                        updateTask({ ...raw, dependsOn: e.target.value || null, depType: e.target.value ? raw.depType || 'FS' : '', lag: e.target.value ? raw.lag || 0 : 0 })
                      }
                    >
                      <option value="">{t('gantt.noDependency')}</option>
                      {tasks
                        .filter((x) => !x.isGroup && x.id !== raw.id)
                        .map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.wbs} — {x.name}
                          </option>
                        ))}
                    </Select>
                  </Field>
                  <Field label={t('gantt.colRelation')}>
                    <Select value={raw.depType || ''} disabled={!raw.dependsOn} onChange={(e) => set('depType', e.target.value)}>
                      <option value="">{t('common.none')}</option>
                      {DEP_TYPES.map((d) => (
                        <option key={d} value={d}>
                          {t(`gantt.dep${d}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label={t('schedule.lagDays')}>
                    <NumberInput value={raw.lag ?? 0} disabled={!raw.dependsOn} onChange={(e) => set('lag', e.target.value)} />
                  </Field>
                  <Field label={t('common.contractQty')} hint={lock('quantity') ? (lock('quantity') === 'boq' ? t('gantt.lockedFromDetails') : t('gantt.lockedContractQty')) : undefined}>
                    <NumberInput value={raw.quantity ?? ''} disabled={Boolean(lock('quantity'))} unit={unit} onChange={(e) => set('quantity', e.target.value)} />
                  </Field>
                  <Field label={t('common.unit')}>
                    <Input value={raw.unit || ''} disabled={Boolean(lock('unit'))} onChange={(e) => set('unit', e.target.value)} />
                  </Field>
                  <Field label={t('schedule.unitPrice')} hint={lock('unitPrice') ? t('gantt.lockedContractPrice') : undefined}>
                    <NumberInput value={raw.unitPrice ?? ''} disabled={Boolean(lock('unitPrice'))} unit={t('orders.currencySuffix')} onChange={(e) => set('unitPrice', e.target.value)} />
                  </Field>
                  {!lock('actualQuantity') && (
                    <Field label={t('common.executed')} hint={t('schedule.doneManual')}>
                      <NumberInput value={raw.actualQuantity ?? ''} unit={unit} onChange={(e) => set('actualQuantity', e.target.value)} />
                    </Field>
                  )}
                </>
              )}
            </div>
            <div className={s.actions}>
              {task.isGroup && (
                <Button size="sm" icon={Plus} onClick={() => addSubTask(raw.id)}>
                  {t('schedule.addSubItem')}
                </Button>
              )}
              <Button size="sm" variant="danger" icon={Trash2} onClick={() => requestDeleteTask(raw.id)}>
                {t('schedule.deleteItem')}
              </Button>
            </div>
          </div>
        )}

        {children.length > 0 && (
          <div>
            <span className={s.sectionTitle}>{t('schedule.subItems')}</span>
            {children.map((c) => {
              const cc = engineResult.tasks.find((x) => x.id === c.id);
              return (
                <ListRow
                  key={c.id}
                  flush
                  href={`#/schedule/task/${encodeURIComponent(c.id)}`}
                  title={`${c.wbs} ${c.name || ''}`}
                  trailing={<span className={s.muted}>{pctText(cc?.progress)}</span>}
                />
              );
            })}
          </div>
        )}

        <div>
          <span className={s.sectionTitle}>{t('schedule.latestOrders')}</span>
          {scopeOrders.length === 0 ? (
            <p className={s.muted}>{t('schedule.noOrders')}</p>
          ) : (
            scopeOrders.slice(0, ORDERS_SHOWN).map((o) => <OrderRow key={o.id} order={o} onApprove={actions.approve} />)
          )}
        </div>
      </div>
      {actions.dialogs}
    </Drawer>
  );
}
