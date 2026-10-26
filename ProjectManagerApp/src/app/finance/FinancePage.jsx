import { ArrowRightLeft, Plus, Printer, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { compactCurrency, formatCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import {
  FILTER_FIELDS,
  addListItem,
  draftAfterSave,
  filterLedger,
  financeTotals,
  ledgerAddType,
  ledgerOrders,
  ledgerTotal,
  migrationCheck,
  migrationFlag,
  planFinanceMigration,
  removeListItem,
} from '../../state/financeModel.js';
import { useProject } from '../../state/projectContext.js';
import { exportAppData } from '../../utils/DataIO.js';
import {
  FINANCE_DATA_KEY,
  LEDGERS,
  loadFinanceConfig,
  loadFinanceData,
  loadFinanceMigration,
  saveFinanceConfig,
  saveFinanceMigration,
} from '../../utils/Finance.js';
import { addOrders, createOrderDraft, expenseBreakdown, loadOrdersData } from '../../utils/OrderEngine.js';
import { onStoreChange } from '../../utils/storeEvents.js';
import {
  Button,
  Card,
  Dialog,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  Select,
  Table,
  cx,
  useMediaQuery,
  useToast,
} from '../../ui/index.js';
import OrderForm from '../record/OrderForm.jsx';
import { formatDay, savedMessage, typeLabel } from '../record/orderMeta.js';
import { useOrderActions } from '../record/useApproval.jsx';
import { useOrderEntry } from '../record/useOrderEntry.js';
import { Page } from '../Page.jsx';
import { useActor, useCan } from '../useCan.js';
import s from './Finance.module.css';

const LEDGER_LABELS = {
  machinery: 'finance.cardMachinery',
  materials: 'finance.cardMaterials',
  pettyCash: 'finance.cardPettyCash',
  payroll: 'finance.cardPayroll',
};

const FORM_TITLES = {
  machinery: 'finance.addMachineryRecord',
  materials: 'finance.addMaterialRecord',
  pettyCash: 'finance.addPettyExpense',
  payroll: 'finance.paySalary',
};

const FILTER_LABELS = {
  machineType: 'finance.machineType',
  driver: 'finance.driverName',
  material: 'finance.materialType',
  expenseType: 'finance.expenseType',
  employee: 'finance.filterEmployee',
};

/**
 * "Add" on a ledger: the Record screen's order form for that ledger's
 * expense type (same fields, same rules, photos too). After a save the
 * date and the slow-changing fields stay for fast repeated entry.
 */
function ExpenseOrderForm({ ledger, onSaved }) {
  const { t } = useI18n();
  const toast = useToast();
  const type = ledgerAddType(ledger);
  const [initial] = useState(() => createOrderDraft(type, { lastWho: loadOrdersData().lastWhoByType }));
  const entry = useOrderEntry(initial);
  const { draft, missing, showErrors, saving, photosBusy } = entry;

  const submit = async (e) => {
    e.preventDefault();
    const saved = draft;
    const order = await entry.save();
    if (!order) return;
    toast({ title: savedMessage(t, order) });
    entry.startFrom(draftAfterSave(saved, entry.freshDraft(type)));
    onSaved?.(order);
  };

  return (
    <form className={s.form} noValidate onSubmit={submit}>
      <OrderForm entry={entry} />
      {showErrors && missing.length > 0 && (
        <p role="alert" className={s.alert}>
          {t('orders.fillRequired', { fields: missing.map((f) => f.label).join(t('orders.listSep')) })}
        </p>
      )}
      <Button type="submit" variant="primary" disabled={saving || photosBusy} aria-busy={saving || undefined}>
        {saving ? t('record.saving') : photosBusy ? t('record.photosPreparing') : t(ledger === 'payroll' ? 'finance.savePayment' : 'finance.saveRecord')}
      </Button>
    </form>
  );
}

/** One ledger: its expense orders with filters, the period total, delete and print. */
function LedgerTable({ ledger, orders, config, canEdit, onDelete }) {
  const { t, lang } = useI18n();
  const [filters, setFilters] = useState({ from: '', to: '' });
  const shown = useMemo(() => filterLedger(orders, filters), [orders, filters]);
  const money = (n) => formatCurrency(n, lang);
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const costLine = (p) => t('finance.costLine', { h: formatNumber(p.qty), rate: money(p.rate), total: money(p.total) });

  const columns = {
    machinery: [
      ['finance.thMachine', (o, d) => {
        const [machine] = expenseBreakdown('machinery', d).parts;
        return (
          <>
            <strong>{d.machineType || d.machineName || '—'}</strong>{' '}
            <span className={s.muted}>{[d.machineSize, d.machineType && d.machineName, d.badge].filter(Boolean).join(' · ')}</span>
            {machine.total > 0 && <div className={s.sub}>{costLine(machine)}</div>}
          </>
        );
      }],
      ['finance.thDriver', (o, d) => {
        const [, driver] = expenseBreakdown('machinery', d).parts;
        return (
          <>
            {d.driver || '—'}
            {driver.total > 0 && <div className={s.sub}>{costLine(driver)}</div>}
          </>
        );
      }],
      ['finance.thFuelCost', (o, d) => {
        const [, , fuel] = expenseBreakdown('machinery', d).parts;
        return (
          <>
            {money(fuel.total)}
            {fuel.qty > 0 && <div className={s.sub}>{t('finance.liters', { n: formatNumber(fuel.qty) })}</div>}
          </>
        );
      }, true],
    ],
    materials: [
      ['finance.receiptNo', (o, d) => d.receipt || '—'],
      ['finance.thMaterial', (o, d) => d.material || '—'],
      ['finance.thDetails', (o, d) => d.note || '—'],
      ['common.quantity', (o, d) =>
        d.materialQty != null ? (
          <>
            {[formatNumber(d.materialQty), d.materialUnit].filter(Boolean).join(' ')}
            {d.unitPrice > 0 && <div className={s.sub}>{t('finance.unitPriceLine', { price: money(d.unitPrice) })}</div>}
          </>
        ) : (
          d.quantityText || '—'
        )],
    ],
    pettyCash: [
      ['common.type', (o, d) => d.expenseType || typeLabel(o.type)],
      ['common.notes', (o, d) => d.note || '—'],
    ],
    payroll: [
      ['finance.filterEmployee', (o, d) => d.employee || '—'],
      ['finance.thBaseSalary', (o, d) => money(d.salary || 0), true],
      ['finance.thAdvanceStatus', (o, d) => (d.advance ? `${money(d.advance)}${d.payStatus ? ` (${d.payStatus})` : ''}` : '—')],
    ],
  }[ledger];
  const totalLabel = ledger === 'payroll' ? 'finance.thNetPaid' : ledger === 'machinery' ? 'finance.thTotalPrice' : ledger === 'pettyCash' ? 'finance.thAmount' : 'common.price';

  return (
    <Card padding="sm" className={cx(s.tableCard, 'ui-print-sheet')}>
      <h2 className={s.printTitle}>
        {t(LEDGER_LABELS[ledger])}
        {(filters.from || filters.to) && ` · ${formatDay(filters.from) || '…'} – ${formatDay(filters.to) || '…'}`}
      </h2>
      <div className={cx(s.filters, 'ui-no-print')}>
        <Field label={t('finance.dateFrom')}>
          <Input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} />
        </Field>
        <Field label={t('finance.dateTo')}>
          <Input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} />
        </Field>
        {FILTER_FIELDS[ledger].map(([key, list]) => (
          <Field key={key} label={t(FILTER_LABELS[key])}>
            <Select value={filters[key] || ''} onChange={(e) => setFilter(key, e.target.value)}>
              <option value="">{t('finance.all')}</option>
              {(config[list] || []).map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </Field>
        ))}
        <span className={s.count}>{t('finance.count', { n: shown.length })}</span>
        <Button icon={Printer} onClick={() => window.print()}>
          {t('reports.print')}
        </Button>
      </div>
      {shown.length === 0 ? (
        <EmptyState title={t('finance.noRecords')} />
      ) : (
        <Table minWidth={ledger === 'machinery' ? 640 : 520} label={t(LEDGER_LABELS[ledger])}>
          <thead>
            <tr>
              <th>{t('common.date')}</th>
              {columns.map(([label, , isNum]) => (
                <th key={label} className={isNum ? 'ui-num' : undefined}>
                  {t(label)}
                </th>
              ))}
              <th className="ui-num">{t(totalLabel)}</th>
              {canEdit && <th className="ui-no-print" aria-label={t('finance.thAction')} />}
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id}>
                <td className={s.date}>{formatDay(o.date)}</td>
                {columns.map(([label, render, isNum]) => (
                  <td key={label} className={isNum ? 'ui-num' : undefined}>
                    {render(o, o.details || {})}
                  </td>
                ))}
                <td className={cx('ui-num', s.total)}>{money(o.amount)}</td>
                {canEdit && (
                  <td className="ui-no-print">
                    <IconButton icon={Trash2} label={t('common.delete')} size="sm" variant="ghost" onClick={() => onDelete(o)} />
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={columns.length + 1}>{t('finance.periodTotal')}</td>
              <td className={cx('ui-num', s.total)}>{money(ledgerTotal(shown))}</td>
              {canEdit && <td className="ui-no-print" />}
            </tr>
          </tfoot>
        </Table>
      )}
    </Card>
  );
}

/**
 * The old ledger ('project-manager-finance-data'): until it is moved, a
 * notice with the dry run and the one-time move into expense orders
 * (finance.edit; a backup downloads first). After: "moved on …", the old
 * ledger kept read-only, and any records added to it since can be moved too.
 */
function LegacyLedger({ orders, canEdit }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const actor = useActor();
  const [legacy, setLegacy] = useState(loadFinanceData);
  const [migration, setMigration] = useState(loadFinanceMigration);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const money = (n) => formatCurrency(n, lang);

  // Sync can bring the flag (or old records) from another device.
  useEffect(
    () =>
      onStoreChange((key) => {
        if (key !== FINANCE_DATA_KEY) return;
        setLegacy(loadFinanceData());
        setMigration(loadFinanceMigration());
      }),
    []
  );

  const plan = useMemo(() => planFinanceMigration(legacy, orders, { migration }), [legacy, orders, migration]);
  if (!migration && plan.count === 0) return null;

  const run = async () => {
    setBusy(true);
    try {
      await exportAppData({ label: 'before-finance-migration' });
    } catch {
      toast({ title: t('finance.migrateBackupFailed'), tone: 'danger', duration: 8000 });
      setBusy(false);
      return;
    }
    // Planned again from storage: the freshest orders and flag decide what is added.
    const now = new Date().toISOString();
    const previous = loadFinanceMigration();
    const fresh = planFinanceMigration(loadFinanceData(), loadOrdersData().orders, { migration: previous, actorName: actor.name || '', now });
    addOrders(fresh.orders);
    const flag = migrationFlag(fresh, { previous, actorName: actor.name || '', now });
    saveFinanceMigration(flag);
    setMigration(flag);
    setBusy(false);
    setOpen(false);
    toast({ title: t('finance.migrateDone', { n: fresh.orders.length }) });
  };

  const moveButton = canEdit && plan.toAdd > 0 && (
    <Button variant={migration ? 'secondary' : 'primary'} icon={ArrowRightLeft} onClick={() => setOpen(true)}>
      {t(migration ? 'finance.migrateMoreButton' : 'finance.migrateButton', { n: plan.toAdd })}
    </Button>
  );

  return (
    <>
      {migration ? (
        <div className={cx(s.legacyNote, 'ui-no-print')}>
          <p>
            {t('finance.migratedOn', {
              date: formatDay(String(migration.migratedAt || '').slice(0, 10)),
              name: migration.migratedBy || t('finance.someone'),
              n: migration.count || 0,
            })}
          </p>
          <details className={s.check}>
            <summary>{t('finance.migrateCheck')}</summary>
            <Table label={t('finance.migrateCheck')}>
              <thead>
                <tr>
                  <th>{t('finance.migrateLedger')}</th>
                  <th className="ui-num">{t('finance.migrateOldRecords')}</th>
                  <th className="ui-num">{t('finance.migrateOldTotal')}</th>
                  <th className="ui-num">{t('finance.migrateOrders')}</th>
                  <th className="ui-num">{t('finance.migrateOrdersTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {migrationCheck(legacy, orders).map((r) => (
                  <tr key={r.ledger}>
                    <td>{t(LEDGER_LABELS[r.ledger])}</td>
                    <td className="ui-num">{formatNumber(r.count)}</td>
                    <td className="ui-num">{money(r.total)}</td>
                    <td className="ui-num">{formatNumber(r.orders)}</td>
                    <td className="ui-num">{money(r.ordersTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </details>
          {plan.toAdd > 0 && <p>{t('finance.migrateNewSince', { n: plan.toAdd })}</p>}
          {moveButton}
        </div>
      ) : (
        <section className={cx(s.legacyCard, 'ui-no-print')} aria-labelledby="finance-legacy-title">
          <h2 id="finance-legacy-title">{t('finance.legacyTitle')}</h2>
          <p>{t('finance.legacyBody', { n: plan.count, total: money(plan.total) })}</p>
          {moveButton || <p>{t('finance.legacyNoRight')}</p>}
        </section>
      )}

      <Dialog
        open={open}
        onOpenChange={(next) => !busy && setOpen(next)}
        title={t('finance.migrateTitle')}
        description={t('finance.migrateIntro')}
        size="lg"
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button variant="primary" onClick={run} disabled={busy || plan.toAdd === 0} aria-busy={busy || undefined}>
              {busy ? t('finance.migrating') : t('finance.migrateConfirm', { n: plan.toAdd })}
            </Button>
          </>
        }
      >
        <Table label={t('finance.migrateTitle')}>
          <thead>
            <tr>
              <th>{t('finance.migrateLedger')}</th>
              <th className="ui-num">{t('finance.migrateOldRecords')}</th>
              <th className="ui-num">{t('finance.migrateOldTotal')}</th>
              <th className="ui-num">{t('finance.migrateAlready')}</th>
              <th className="ui-num">{t('finance.migrateToAdd')}</th>
              <th className="ui-num">{t('finance.migrateAddTotal')}</th>
            </tr>
          </thead>
          <tbody>
            {plan.ledgers.map((r) => (
              <tr key={r.ledger}>
                <td>
                  {t(LEDGER_LABELS[r.ledger])}
                  <div className={s.sub}>{t('finance.migrateBecomes', { type: typeLabel(ledgerAddType(r.ledger)) })}</div>
                </td>
                <td className="ui-num">{formatNumber(r.count)}</td>
                <td className="ui-num">{money(r.total)}</td>
                <td className="ui-num">{formatNumber(r.done)}</td>
                <td className="ui-num">{formatNumber(r.toAdd)}</td>
                <td className={cx('ui-num', s.total)}>{money(r.addTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t('finance.migrateAll')}</td>
              <td className="ui-num">{formatNumber(plan.count)}</td>
              <td className="ui-num">{money(plan.total)}</td>
              <td className="ui-num">{formatNumber(plan.count - plan.toAdd)}</td>
              <td className="ui-num">{formatNumber(plan.toAdd)}</td>
              <td className={cx('ui-num', s.total)}>{money(plan.addTotal)}</td>
            </tr>
          </tfoot>
        </Table>
        <ul className={s.steps}>
          <li>{t('finance.migrateStepBackup')}</li>
          <li>{t('finance.migrateStepOrders')}</li>
          <li>{t('finance.migrateStepKept')}</li>
        </ul>
      </Dialog>
    </>
  );
}

/** Editable dropdown lists used by the expense order fields. */
function ListsView({ config, onChange }) {
  const { t } = useI18n();
  const [drafts, setDrafts] = useState({});
  const LISTS = [
    ['machines', 'finance.cfgMachines'],
    ['machineSizes', 'finance.cfgMachineSizes'],
    ['employees', 'finance.cfgEmployees'],
    ['materials', 'finance.cfgMaterials'],
    ['expenseTypes', 'finance.cfgExpenseTypes'],
    ['statuses', 'finance.cfgStatuses'],
  ];
  return (
    <>
      <p className={s.hint}>{t('finance.settingsDesc')}</p>
      <div className={s.lists}>
        {LISTS.map(([key, label]) => (
          <Card key={key} title={t(label)} titleAs="h2" padding="md">
            <ul className={s.chips}>
              {config[key].map((item) => (
                <li key={item} className={s.chip}>
                  <span>{item}</span>
                  <IconButton icon={Trash2} label={t('finance.removeItem', { item })} size="sm" variant="ghost" onClick={() => onChange(key, removeListItem(config[key], item))} />
                </li>
              ))}
            </ul>
            <form
              className={s.addRow}
              onSubmit={(e) => {
                e.preventDefault();
                onChange(key, addListItem(config[key], drafts[key]));
                setDrafts((d) => ({ ...d, [key]: '' }));
              }}
            >
              <Input aria-label={t(label)} value={drafts[key] || ''} placeholder={t('finance.addNewPlaceholder')} onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))} />
              <IconButton type="submit" icon={Plus} label={t('common.add')} variant="secondary" />
            </form>
          </Card>
        ))}
      </div>
    </>
  );
}

/**
 * /finance/:ledger — the site cost ledgers (machinery, materials, petty
 * cash, payroll) as views over expense orders; "Add" records an expense
 * order. /finance/lists — the dropdown lists those orders pick from.
 * Rules: state/financeModel.js; orders: utils/OrderEngine.js.
 */
export default function FinancePage() {
  const { ledger } = useParams();
  const { t, lang } = useI18n();
  const can = useCan();
  const { orders } = useProject();
  const wide = useMediaQuery('(min-width: 1100px)');
  const [config, setConfig] = useState(loadFinanceConfig);
  const [formOpen, setFormOpen] = useState(false);
  const actions = useOrderActions();
  const canEdit = can('finance.edit');

  useEffect(() => saveFinanceConfig(config), [config]);

  const totals = useMemo(() => financeTotals(orders), [orders]);
  const rows = useMemo(() => (LEDGERS.includes(ledger) ? ledgerOrders(orders, ledger) : []), [orders, ledger]);
  if (ledger !== 'lists' && !LEDGERS.includes(ledger)) return <Navigate to="/finance/machinery" replace />;

  return (
    <Page area="finance">
      <dl className={cx(s.figures, 'ui-no-print')}>
        <div className={cx(s.figure, s.figureTotal)}>
          <dt>{t('finance.totalCosts')}</dt>
          <dd>{compactCurrency(totals.total, lang)}</dd>
        </div>
        {LEDGERS.map((l) => (
          <div key={l} className={cx(s.figure, l === ledger && s.figureActive)}>
            <dt>{t(LEDGER_LABELS[l])}</dt>
            <dd>{compactCurrency(totals[l], lang)}</dd>
          </div>
        ))}
      </dl>

      <LegacyLedger orders={orders} canEdit={canEdit} />

      {ledger === 'lists' ? (
        <ListsView config={config} onChange={(key, list) => setConfig((c) => ({ ...c, [key]: list }))} />
      ) : (
        <>
          {!wide && canEdit && (
            <div className="ui-no-print">
              <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
                {t('finance.addRecord')}
              </Button>
            </div>
          )}
          <div className={cx(s.layout, !(wide && canEdit) && s.layoutSingle)}>
            <LedgerTable key={ledger} ledger={ledger} orders={rows} config={config} canEdit={canEdit} onDelete={actions.requestDelete} />
            {wide && canEdit && (
              <Card title={t(FORM_TITLES[ledger])} subtitle={t('finance.addAsOrder')} titleAs="h2" className={cx(s.formCard, 'ui-no-print')}>
                <ExpenseOrderForm key={ledger} ledger={ledger} />
              </Card>
            )}
          </div>
          {!wide && canEdit && (
            <Drawer open={formOpen} onOpenChange={setFormOpen} title={t(FORM_TITLES[ledger])} description={t('finance.addAsOrder')}>
              <ExpenseOrderForm key={ledger} ledger={ledger} onSaved={() => setFormOpen(false)} />
            </Drawer>
          )}
        </>
      )}

      {actions.dialogs}
    </Page>
  );
}
