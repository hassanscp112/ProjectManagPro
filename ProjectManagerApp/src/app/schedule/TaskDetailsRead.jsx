import { FolderOpen, Link2, Lock } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { ordersInScope } from '../../state/scheduleModel.js';
import { orderRollup, quantityRows, sortedElements, statusCounts } from '../../state/taskDetailsModel.js';
import { Button, Card, EmptyState, ProgressBar, StatusBadge, Table, cx } from '../../ui/index.js';
import { signedAmount } from '../bidi.js';
import { OrderPhotoStrip } from '../record/OrderPhotos.jsx';
import OrderRow from '../record/OrderRow.jsx';
import { useOrderActions } from '../record/useApproval.jsx';
import s from './TaskDetails.module.css';

const STATUS_TONE = { not_started: 'neutral', in_progress: 'accent', completed: 'success', on_hold: 'warning' };
const ORDERS_SHOWN = 10;

const num = (n) => (Number(n) ? formatNumber(n) : '—');
const pct = (v) => `${Math.floor(Math.min(1, Math.max(0, Number(v) || 0)) * 100)}%`;

/** The read-first report of one item. */
export default function TaskDetailsRead({ task, computed, columns, elements, sums, children, computedById }) {
  const { t, lang } = useI18n();
  const { tasks, orders, registries, projectMeta } = useProject();
  const actions = useOrderActions();
  const [showCompleted, setShowCompleted] = useState(false);
  const isSigned = Boolean(projectMeta.baseline);
  const counts = statusCounts(elements);
  const rows = quantityRows(columns, sums, computedById);
  const scopeOrders = useMemo(() => ordersInScope(tasks, orders, task.id), [tasks, orders, task.id]);
  const rollup = useMemo(() => orderRollup(scopeOrders, registries.contractors || []), [scopeOrders, registries.contractors]);
  const sorted = sortedElements(elements);
  const visible = showCompleted ? sorted : sorted.filter((x) => x.el.status !== 'completed');
  const money = (n) => (Number(n) ? compactCurrency(n, lang) : '—');
  const contractValue = Number(computed.totalCost) || 0;
  const executedValue = Number(computed.actualCost) || 0;
  const deviation = executedValue - contractValue;

  return (
    <>
      <Card title={t('taskDetails.secQuantities')} subtitle={t('taskDetails.secQuantitiesSub')} titleAs="h2" padding="md">
        <div className={s.overall}>
          <div className={s.overallHead}>
            <span>{t('taskDetails.overallProgress')}</span>
            <strong>{pct(computed.progress)}</strong>
          </div>
          <ProgressBar value={Math.floor((computed.progress || 0) * 100)} label={t('taskDetails.overallProgress')} />
          <span className={s.muted}>
            {task.isGroup
              ? t('taskDetails.rollupFromChildren', { n: children.length })
              : t('taskDetails.executedOfTotal', { executed: num(computed.actualQty), total: num(computed.qty), unit: computed.unit || '' })}
          </span>
        </div>
        {rows.length === 0 ? (
          <p className={s.muted}>{t('details.qtyEmpty')}</p>
        ) : (
          <div className={s.qtyGrid}>
            {rows.map((r) => (
              <div key={r.col.id} className={s.qtyCard}>
                <div className={s.qtyHead}>
                  <strong>{r.col.name || t('taskDetails.qtyTypeFallback')}</strong>
                  {r.col.unit && <span className={s.muted}>{r.col.unit}</span>}
                  {r.leaf && (
                    <StatusBadge tone="accent" icon={false} title={t('taskDetails.linkedBoqTitle')}>
                      <Link2 size={12} aria-hidden="true" /> {r.leaf.wbs}
                    </StatusBadge>
                  )}
                </div>
                <dl className={s.qtyStats}>
                  <div>
                    <dt>{t('taskDetails.statContract')}</dt>
                    <dd>{num(r.contract)}</dd>
                  </div>
                  <div>
                    <dt>{t('taskDetails.statExecuted')}</dt>
                    <dd>{r.executed != null ? num(r.executed) : '—'}</dd>
                  </div>
                  <div>
                    <dt>{t('taskDetails.statRemaining')}</dt>
                    <dd className={cx(r.remaining < 0 && s.danger)}>{r.remaining != null ? num(r.remaining) : '—'}</dd>
                  </div>
                </dl>
                <ProgressBar value={(r.rate || 0) * 100} size="sm" label={r.col.name} />
                <div className={s.qtyFoot}>
                  {r.waste > 0 && <span title={t('taskDetails.wasteChipTitle')}>{t('taskDetails.wasteChip', { n: r.waste })}</span>}
                  {r.reconDelta != null && (
                    <span className={Math.abs(r.reconDelta) < 0.001 ? s.ok : s.warn}>
                      {t('taskDetails.elementSumLabel', { n: num(r.leaf.elementSum) })}{' '}
                      {Math.abs(r.reconDelta) < 0.001 ? t('taskDetails.reconMatch') : t('taskDetails.reconDelta', { n: num(r.reconDelta) })}
                    </span>
                  )}
                  {!r.leaf && <span>{t('taskDetails.calcQuantityNote')}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card
        title={t('taskDetails.secWorkStatus')}
        titleAs="h2"
        padding="md"
        actions={
          <div className={s.chips}>
            {['in_progress', 'on_hold', 'not_started', 'completed'].map((st) =>
              counts[st] ? (
                <StatusBadge key={st} tone={STATUS_TONE[st]}>
                  {counts[st]} {t(`taskDetails.status.${st}`)}
                </StatusBadge>
              ) : null
            )}
            {counts.completed > 0 && (
              <Button size="sm" variant="ghost" aria-pressed={showCompleted} onClick={() => setShowCompleted((v) => !v)}>
                {showCompleted ? t('taskDetails.hideCompleted') : t('taskDetails.showCompleted')}
              </Button>
            )}
          </div>
        }
      >
        {elements.length === 0 ? (
          <p className={s.muted}>{t('details.mapEmpty')}</p>
        ) : visible.length === 0 ? (
          <p className={s.muted}>{t('details.allCompleted', { n: counts.completed })}</p>
        ) : (
          <Table minWidth={480 + columns.length * 90} label={t('taskDetails.secWorkStatus')}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('common.name')}</th>
                <th>{t('taskDetails.locationStation')}</th>
                <th>{t('common.status')}</th>
                {columns.map((c) => (
                  <th key={c.id} className="ui-num">
                    {c.name} {c.unit ? `(${c.unit})` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map(({ el, index }) => (
                <tr key={el.id} className={cx(el.status === 'completed' && s.doneRow)}>
                  <td className="ui-num">{index + 1}</td>
                  <td>
                    {el.name || '—'}
                    {el.notes && <div className={s.muted}>{el.notes}</div>}
                  </td>
                  <td className="ui-ltr">{el.location || '—'}</td>
                  <td>
                    <StatusBadge tone={STATUS_TONE[el.status] || 'neutral'}>{t(`taskDetails.status.${el.status || 'not_started'}`)}</StatusBadge>
                  </td>
                  {columns.map((c) => (
                    <td key={c.id} className="ui-num">
                      {num(el.values?.[c.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className={s.twoCol}>
        <Card title={`${t('taskDetails.secOrders')} (${scopeOrders.length})`} titleAs="h2" padding="sm">
          {scopeOrders.length === 0 ? (
            <EmptyState title={t('details.ordersEmpty')} action={<Button as={Link} to="/record" state={task.isGroup ? undefined : { taskId: task.id }}>{t('schedule.recordWork')}</Button>} />
          ) : (
            <>
              <ul className={s.list}>
                {scopeOrders.slice(0, ORDERS_SHOWN).map((o) => (
                  <li key={o.id}>
                    <OrderRow order={o} onApprove={actions.approve} />
                  </li>
                ))}
              </ul>
              {scopeOrders.length > ORDERS_SHOWN && (
                <p className={s.muted}>{t('details.moreOrders', { shown: ORDERS_SHOWN, total: scopeOrders.length })}</p>
              )}
              {rollup.contractors.length > 0 && (
                <div className={s.rollup}>
                  <span className={s.label}>{t('taskDetails.rollupTitle')}</span>
                  {rollup.contractors.map((c) => (
                    <span key={c.id} className={s.rollupItem}>
                      <strong>{c.name || t('taskDetails.unknownContractor')}</strong> · {t(c.count === 1 ? 'taskDetails.orderOne' : 'taskDetails.ordersMany', { n: c.count })}
                      {c.qty > 0 && ` · ${t('taskDetails.executedQtyLabel')} ${num(c.qty)}`}
                      {c.expense > 0 && ` · ${t('taskDetails.expensesLabel')} ${money(c.expense)}`}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
          {actions.dialogs}
        </Card>

        <div className={s.stack}>
          <Card title={t('taskDetails.secMoney')} titleAs="h2" padding="md">
            <dl className={s.facts}>
              <div>
                <dt>{t('taskDetails.moneyContract')}</dt>
                <dd>{money(contractValue)}</dd>
                {!task.isGroup && (
                  <span className={s.muted}>
                    {num(computed.qty)} × {money(computed.price ?? computed.unitPrice)}
                    {computed.unit ? ` / ${computed.unit}` : ''}
                  </span>
                )}
              </div>
              <div>
                <dt>{t('taskDetails.moneyExecuted')}</dt>
                <dd>{money(executedValue)}</dd>
                <span className={s.muted}>{task.isGroup ? t('taskDetails.moneyExecSubGroup') : t('taskDetails.moneyExecSubLeaf')}</span>
              </div>
              <div>
                <dt>{t('taskDetails.moneyDeviation')}</dt>
                <dd>{deviation === 0 ? '—' : signedAmount(deviation, compactCurrency(Math.abs(deviation), lang))}</dd>
                <span className={s.muted}>
                  {deviation === 0 ? t('taskDetails.moneyDevMatch') : deviation > 0 ? t('taskDetails.moneyDevOver') : t('taskDetails.moneyDevUnder')}
                </span>
              </div>
              <div>
                <dt>{t('taskDetails.moneyExpenses')}</dt>
                <dd>{money(rollup.expenses)}</dd>
                <span className={s.muted}>{t('taskDetails.moneyExpensesSub')}</span>
              </div>
            </dl>
          </Card>
          <Card title={t('taskDetails.secEvidence')} titleAs="h2" padding="md">
            <dl className={s.facts}>
              <div>
                <dt>{t('taskDetails.evidenceTests')}</dt>
                <dd>{rollup.tests}</dd>
              </div>
              <div>
                <dt>{t('taskDetails.evidenceCompletions')}</dt>
                <dd>{rollup.completions}</dd>
              </div>
              <div>
                <dt>{t('taskDetails.evidencePhotos')}</dt>
                <dd>{rollup.photoIds.length}</dd>
              </div>
            </dl>
            {rollup.photoIds.length > 0 && <OrderPhotoStrip ids={rollup.photoIds.slice(0, 8)} title={t('taskDetails.evidenceLatestPhotos')} />}
            <Button as={Link} to={`/library/files/${encodeURIComponent(task.id)}`} icon={FolderOpen} size="sm">
              {t('details.openFiles')}
            </Button>
          </Card>
        </div>
      </div>

      {task.isGroup && (
        <Card title={`${t('taskDetails.secChildren')} (${children.length})`} titleAs="h2" padding="sm" subtitle={t('details.childrenHint')}>
          {children.length === 0 ? (
            <p className={s.muted}>{t('taskDetails.childrenEmptyRead')}</p>
          ) : (
            <Table minWidth={760} label={t('taskDetails.secChildren')}>
              <thead>
                <tr>
                  <th>{t('taskDetails.colCode')}</th>
                  <th>{t('common.name')}</th>
                  <th className="ui-num">{t('common.contractQty')}</th>
                  <th className="ui-num">{t('taskDetails.colExecutedQty')}</th>
                  <th>{t('common.unit')}</th>
                  <th className="ui-num">{t('taskDetails.colUnitPrice')}</th>
                  <th>{t('common.type')}</th>
                  <th>{t('common.progress')}</th>
                </tr>
              </thead>
              <tbody>
                {children.map((child) => {
                  const c = computedById.get(child.id) || child;
                  const linkedCol = child.boqLink ? columns.find((col) => col.id === child.boqLink.colId) : null;
                  return (
                    <tr key={child.id}>
                      <td className="ui-ltr">{child.wbs}</td>
                      <td>
                        <Link to={child.isGroup ? `/schedule/task/${encodeURIComponent(child.id)}/details` : `/schedule/task/${encodeURIComponent(child.id)}`} className={s.link}>
                          {child.name || '—'}
                        </Link>
                      </td>
                      <td className="ui-num">
                        {(child.boqLink || isSigned) && <Lock size={12} aria-label={child.boqLink ? t('taskDetails.managedFromElements') : t('taskDetails.approvedContractQty')} />} {num(c.qty ?? c.quantity)}
                      </td>
                      <td className="ui-num">{num(c.actualQty)}</td>
                      <td>{c.unit || '—'}</td>
                      <td className="ui-num">{num(child.unitPrice)}</td>
                      <td>
                        <StatusBadge tone={child.isGroup ? 'neutral' : child.boqLink ? 'accent' : 'neutral'} icon={false}>
                          {child.isGroup ? t('taskDetails.typeGroup') : child.boqLink ? `BOQ${linkedCol ? ` · ${linkedCol.name}` : ''}` : t('taskDetails.typeManual')}
                        </StatusBadge>
                      </td>
                      <td className={s.progressCell}>
                        <ProgressBar value={Math.floor((c.progress || 0) * 100)} size="sm" label={child.name} />
                        <span>{pct(c.progress)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </>
  );
}
