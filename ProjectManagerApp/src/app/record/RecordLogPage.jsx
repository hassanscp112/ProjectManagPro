import { Check, Inbox, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { EMPTY_FILTERS, filterOrders, hasActiveFilters, orderKpis } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { ORDER_TYPE_LIST, daysAgoStr, resolveWhoLabel, todayStr } from '../../utils/OrderEngine.js';
import { wbsCompare } from '../../utils/TaskRanking.js';
import { Button, Card, EmptyState, Field, IconButton, Input, Select, StatCard, StatusBadge, Table, usePhone } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import { OrderPhotosButton } from './OrderPhotos.jsx';
import OrderRow from './OrderRow.jsx';
import { formatDay, orderFigure, orderSubject, typeLabel } from './orderMeta.js';
import { useOrderActions } from './useApproval.jsx';
import s from './Record.module.css';

/** /record/log — every order, filterable, with approve and delete. */
export default function RecordLogPage() {
  const { t, lang } = useI18n();
  const phone = usePhone();
  const { orders, tasks, registries, pendingApprovals } = useProject();
  const actions = useOrderActions();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));

  const kpis = useMemo(() => orderKpis(orders, todayStr(), daysAgoStr(6)), [orders]);
  const rows = useMemo(() => filterOrders(orders, filters), [orders, filters]);
  const leafTasks = useMemo(() => tasks.filter((x) => !x.isGroup).sort(wbsCompare), [tasks]);
  const filtered = hasActiveFilters(filters);

  return (
    <Page area="record" tabCounts={{ '/record/pending': pendingApprovals }}>
      <section className={s.stats} aria-label={t('orders.logTitle')}>
        <StatCard label={t('orders.kpiTodayOrders')} value={kpis.todayValueCount} />
        <StatCard label={t('orders.kpiTodayQty')} value={formatNumber(kpis.todayQty)} />
        <StatCard label={t('orders.kpiTodayExpenses')} value={compactCurrency(kpis.todayExpenses, lang)} />
        <StatCard label={t('orders.kpiWeekOrders')} value={kpis.weekValueCount} />
        <StatCard label={t('orders.kpiWeekExpenses')} value={compactCurrency(kpis.weekExpenses, lang)} />
      </section>

      <Card
        title={t('orders.logTitle')}
        subtitle={`${t('orders.logCount', { count: rows.length })}${filtered ? ` (${t('orders.filteredTag')})` : ''}`}
        actions={filtered && <Button size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>{t('orders.clearFilters')}</Button>}
      >
        <div className={s.filters} role="group" aria-label={t('record.filters')}>
          <Field label={t('orders.fromDate')}>
            <Input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
          </Field>
          <Field label={t('orders.toDate')}>
            <Input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
          </Field>
          <Field label={t('common.type')}>
            <Select value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
              <option value="all">{t('orders.allTypes')}</option>
              {ORDER_TYPE_LIST.map((ot) => (
                <option key={ot.type} value={ot.type}>
                  {ot.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('orders.contractor')}>
            <Select value={filters.contractorId} onChange={(e) => setFilter('contractorId', e.target.value)}>
              <option value="all">{t('orders.allParties')}</option>
              {registries.contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('orders.task')}>
            <Select value={filters.taskId} onChange={(e) => setFilter('taskId', e.target.value)}>
              <option value="all">{t('orders.allTasks')}</option>
              {leafTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.wbs} — {task.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={t('orders.noMatching')}
            body={t('record.logEmptyBody')}
            action={
              <Button as="a" href="#/record" variant="primary">
                {t('ui.recordOrder')}
              </Button>
            }
          />
        ) : phone ? (
          <div className={s.list}>
            {rows.map((o) => (
              <OrderRow key={o.id} order={o} onApprove={actions.approve} onDelete={actions.requestDelete} />
            ))}
          </div>
        ) : (
          <Table label={t('orders.logTitle')} minWidth={820}>
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.type')}</th>
                <th>{t('orders.task')}</th>
                <th>{t('orders.party')}</th>
                <th className="ui-num">{t('orders.qtyOrAmount')}</th>
                <th>{t('common.status')}</th>
                <th>
                  <span className="ui-visually-hidden">{t('common.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => {
                const pending = o.tier === 'formal' && o.status === 'recorded';
                return (
                  <tr key={o.id}>
                    <td className="ui-ltr">{formatDay(o.date)}</td>
                    <td>
                      <StatusBadge tone={o.family === 'value' ? 'accent' : 'neutral'} icon={false}>
                        {typeLabel(o.type)}
                      </StatusBadge>
                    </td>
                    <td className={s.subject} title={orderSubject(o)}>
                      {orderSubject(o) || '—'}
                    </td>
                    <td>{resolveWhoLabel(o.who, registries)}</td>
                    <td className="ui-num">{orderFigure(o, lang)}</td>
                    <td>
                      {pending ? (
                        <StatusBadge tone="warning">{t('common.recorded')}</StatusBadge>
                      ) : (
                        <StatusBadge tone="success">{t('common.approved')}</StatusBadge>
                      )}
                    </td>
                    <td>
                      <div className={s.cellActions}>
                        <OrderPhotosButton order={o} />
                        {pending && (
                          <Button size="sm" variant="outline" icon={Check} onClick={() => actions.approve(o)}>
                            {t('common.approve')}
                          </Button>
                        )}
                        <IconButton icon={Trash2} label={t('orders.deleteOrder')} size="sm" onClick={() => actions.requestDelete(o)} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
      {actions.dialogs}
    </Page>
  );
}
