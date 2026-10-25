import { Plus, Printer, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { compactCurrency, formatCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import {
  addListItem,
  addRecord,
  buildRecord,
  deleteRecord,
  filterLedger,
  financeTotals,
  ledgerTotal,
  missingFields,
  removeListItem,
} from '../../state/financeModel.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { LEDGERS, loadFinanceConfig, loadFinanceData, saveFinanceConfig, saveFinanceData } from '../../utils/Finance.js';
import {
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  NumberInput,
  Select,
  Table,
  cx,
  useMediaQuery,
  useToast,
} from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import s from './Finance.module.css';

/*
 * Each ledger as data: form fields (grouped in sections), the fields reset
 * after a save (the rest stay for fast repeated entry), the filters and the
 * table columns.
 */
const LEDGER_SPEC = {
  machinery: {
    formTitle: 'finance.addMachineryRecord',
    sections: [
      {
        title: 'finance.machineInfo',
        fields: [
          { key: 'date', label: 'common.date', type: 'date' },
          { key: 'badge', label: 'finance.badge', optional: true },
          { key: 'machineName', label: 'finance.machineName', list: 'machines' },
          { key: 'machineType', label: 'finance.machineType', options: 'machines' },
          { key: 'machineSize', label: 'finance.machineSize', options: 'machineSizes' },
          { key: 'machineHours', label: 'finance.machineHours', type: 'number' },
          { key: 'machineRate', label: 'finance.machineRate', type: 'number', money: true },
        ],
      },
      {
        title: 'finance.driverInfo',
        fields: [
          { key: 'operator', label: 'finance.driverName', list: 'employees' },
          { key: 'driverHours', label: 'finance.driverHours', type: 'number', optional: true },
          { key: 'driverRate', label: 'finance.driverRate', type: 'number', money: true, optional: true },
        ],
      },
      {
        title: 'finance.fuelInfo',
        fields: [
          { key: 'fuelLiters', label: 'finance.fuelLiters', type: 'number', optional: true },
          { key: 'fuelPrice', label: 'finance.fuelPricePerLiter', type: 'number', money: true, optional: true },
        ],
      },
    ],
    reset: ['machineHours', 'driverHours', 'fuelLiters'],
    filters: [
      { key: 'machineType', label: 'finance.machineType', options: 'machines' },
      { key: 'operator', label: 'finance.driverName', options: 'employees' },
    ],
  },
  materials: {
    formTitle: 'finance.addMaterialRecord',
    sections: [
      {
        fields: [
          { key: 'date', label: 'common.date', type: 'date' },
          { key: 'receipt', label: 'finance.receiptNo', optional: true },
          { key: 'materialType', label: 'finance.materialType', options: 'materials' },
          { key: 'details', label: 'finance.detailsExample' },
          { key: 'quantity', label: 'finance.quantityWithUnit', placeholder: 'finance.qtyPlaceholder' },
          { key: 'totalPrice', label: 'common.price', type: 'number', money: true },
        ],
      },
    ],
    reset: ['receipt', 'details', 'quantity', 'totalPrice'],
    filters: [{ key: 'materialType', label: 'finance.materialType', options: 'materials' }],
  },
  pettyCash: {
    formTitle: 'finance.addPettyExpense',
    sections: [
      {
        fields: [
          { key: 'date', label: 'common.date', type: 'date' },
          { key: 'expenseType', label: 'finance.expenseType', options: 'expenseTypes' },
          { key: 'totalPrice', label: 'finance.amountIqd', type: 'number', money: true },
          { key: 'notes', label: 'common.notes', optional: true },
        ],
      },
    ],
    reset: ['totalPrice', 'notes'],
    filters: [{ key: 'expenseType', label: 'finance.expenseType', options: 'expenseTypes' }],
  },
  payroll: {
    formTitle: 'finance.paySalary',
    sections: [
      {
        fields: [
          { key: 'date', label: 'common.date', type: 'date' },
          { key: 'employee', label: 'finance.employeeName', list: 'employees' },
          { key: 'salary', label: 'finance.baseSalaryIqd', type: 'number', money: true },
          { key: 'advancePayment', label: 'finance.advanceAmount', type: 'number', money: true, optional: true },
          { key: 'status', label: 'common.status', options: 'statuses' },
        ],
      },
    ],
    reset: ['employee', 'salary', 'advancePayment'],
    filters: [{ key: 'employee', label: 'finance.filterEmployee', options: 'employees' }],
  },
};

const LEDGER_LABELS = {
  machinery: 'finance.cardMachinery',
  materials: 'finance.cardMaterials',
  pettyCash: 'finance.cardPettyCash',
  payroll: 'finance.cardPayroll',
};

const freshDraft = (ledger, config) => {
  const d = { date: todayStr() };
  LEDGER_SPEC[ledger].sections.forEach((sec) =>
    sec.fields.forEach((f) => {
      if (f.key !== 'date') d[f.key] = f.options ? config[f.options]?.[0] || '' : '';
    })
  );
  return d;
};

/** The add-record form for one ledger. */
function RecordForm({ ledger, config, onSave }) {
  const { t } = useI18n();
  const spec = LEDGER_SPEC[ledger];
  const [draft, setDraft] = useState(() => freshDraft(ledger, config));
  const [tried, setTried] = useState(false);
  const missing = missingFields(ledger, draft);
  const set = (key, value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = (e) => {
    e.preventDefault();
    setTried(true);
    if (missing.length) return;
    onSave(buildRecord[ledger](draft));
    setDraft((d) => ({ ...d, ...Object.fromEntries(spec.reset.map((k) => [k, ''])) }));
    setTried(false);
  };

  const control = (f) => {
    const value = draft[f.key] ?? '';
    if (f.options)
      return (
        <Select value={value} onChange={(e) => set(f.key, e.target.value)}>
          {(config[f.options] || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      );
    if (f.type === 'number')
      return <NumberInput value={value} min="0" step="any" unit={f.money ? t('orders.currencySuffix') : undefined} onChange={(e) => set(f.key, e.target.value)} />;
    return (
      <Input
        type={f.type === 'date' ? 'date' : 'text'}
        value={value}
        list={f.list ? `fin-${f.list}` : undefined}
        placeholder={f.placeholder ? t(f.placeholder) : undefined}
        onChange={(e) => set(f.key, e.target.value)}
      />
    );
  };

  return (
    <form className={s.form} onSubmit={submit}>
      {spec.sections.map((sec, i) => (
        <fieldset key={i} className={s.fieldset}>
          {sec.title && <legend className={s.legend}>{t(sec.title)}</legend>}
          <div className={s.fields}>
            {sec.fields.map((f) => (
              <Field
                key={f.key}
                label={t(f.label)}
                optional={f.optional}
                error={tried && missing.includes(f.key) ? t('record.required') : undefined}
                className={f.type === 'date' || f.type === 'number' || f.options ? undefined : s.wide}
              >
                {control(f)}
              </Field>
            ))}
          </div>
        </fieldset>
      ))}
      {['machines', 'employees'].map((list) => (
        <datalist key={list} id={`fin-${list}`}>
          {(config[list] || []).map((o) => (
            <option key={o} value={o} />
          ))}
        </datalist>
      ))}
      <Button type="submit" variant="primary">
        {t(ledger === 'payroll' ? 'finance.savePayment' : 'finance.saveRecord')}
      </Button>
    </form>
  );
}

/** One ledger's table with its filters, total and delete. */
function LedgerTable({ ledger, records, config, onDelete }) {
  const { t, lang } = useI18n();
  const spec = LEDGER_SPEC[ledger];
  const [filters, setFilters] = useState({ from: '', to: '' });
  const shown = useMemo(() => filterLedger(records, filters), [records, filters]);
  const money = (n) => formatCurrency(n, lang);
  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));

  const columns = {
    machinery: [
      ['finance.thMachine', (r) => (
        <>
          <strong>{r.machineName}</strong> <span className={s.muted}>{[r.machineType, r.machineSize, r.badge].filter(Boolean).join(' · ')}</span>
          <div className={s.sub}>{t('finance.costLine', { h: formatNumber(r.machineHours), rate: money(r.machineRate), total: money(r.machineTotal) })}</div>
        </>
      )],
      ['finance.thDriver', (r) => (
        <>
          {r.operator}
          {Number(r.driverTotal) > 0 && <div className={s.sub}>{t('finance.costLine', { h: formatNumber(r.driverHours), rate: money(r.driverRate), total: money(r.driverTotal) })}</div>}
        </>
      )],
      ['finance.thFuelCost', (r) => (
        <>
          {money(r.fuelTotal)}
          {Number(r.fuelLiters) > 0 && <div className={s.sub}>{t('finance.liters', { n: formatNumber(r.fuelLiters) })}</div>}
        </>
      ), true],
    ],
    materials: [
      ['finance.receiptNo', (r) => r.receipt || '—'],
      ['finance.thMaterial', (r) => r.materialType],
      ['finance.thDetails', (r) => r.details],
      ['common.quantity', (r) => r.quantity],
    ],
    pettyCash: [
      ['common.type', (r) => r.expenseType],
      ['common.notes', (r) => r.notes || '—'],
    ],
    payroll: [
      ['finance.filterEmployee', (r) => r.employee],
      ['finance.thBaseSalary', (r) => money(r.salary), true],
      ['finance.thAdvanceStatus', (r) => `${money(r.advancePayment)} (${r.status})`],
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
        {spec.filters.map((f) => (
          <Field key={f.key} label={t(f.label)}>
            <Select value={filters[f.key] || ''} onChange={(e) => setFilter(f.key, e.target.value)}>
              <option value="">{t('finance.all')}</option>
              {(config[f.options] || []).map((o) => (
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
              <th className="ui-no-print" aria-label={t('finance.thAction')} />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td className={s.date}>{formatDay(r.date)}</td>
                {columns.map(([label, render, isNum]) => (
                  <td key={label} className={isNum ? 'ui-num' : undefined}>
                    {render(r)}
                  </td>
                ))}
                <td className={cx('ui-num', s.total)}>{money(r.totalPrice)}</td>
                <td className="ui-no-print">
                  <IconButton icon={Trash2} label={t('common.delete')} size="sm" variant="ghost" onClick={() => onDelete(r)} />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={columns.length + 1}>{t('finance.periodTotal')}</td>
              <td className={cx('ui-num', s.total)}>{money(ledgerTotal(shown))}</td>
              <td className="ui-no-print" />
            </tr>
          </tfoot>
        </Table>
      )}
    </Card>
  );
}

/** Editable dropdown lists used by the ledger forms. */
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
 * /finance/:ledger — site cost ledgers (machinery, materials, petty cash,
 * payroll) and /finance/lists — their dropdown lists. Storage: utils/Finance.js.
 */
export default function FinancePage() {
  const { ledger } = useParams();
  const { t, lang } = useI18n();
  const toast = useToast();
  const wide = useMediaQuery('(min-width: 1100px)');
  const [data, setData] = useState(loadFinanceData);
  const [config, setConfig] = useState(loadFinanceConfig);
  const [formOpen, setFormOpen] = useState(false);
  const [toDelete, setToDelete] = useState(null);

  useEffect(() => saveFinanceData(data), [data]);
  useEffect(() => saveFinanceConfig(config), [config]);

  if (ledger !== 'lists' && !LEDGERS.includes(ledger)) return <Navigate to="/finance/machinery" replace />;
  const totals = financeTotals(data);

  const save = (record) => {
    setData((d) => addRecord(d, ledger, record, Date.now().toString()));
    toast({ title: t('finance.recordSaved') });
    setFormOpen(false);
  };

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

      {ledger === 'lists' ? (
        <ListsView config={config} onChange={(key, list) => setConfig((c) => ({ ...c, [key]: list }))} />
      ) : (
        <>
          {!wide && (
            <div className="ui-no-print">
              <Button variant="primary" icon={Plus} onClick={() => setFormOpen(true)}>
                {t('finance.addRecord')}
              </Button>
            </div>
          )}
          <div className={s.layout}>
            <LedgerTable key={ledger} ledger={ledger} records={data[ledger]} config={config} onDelete={setToDelete} />
            {wide && (
              <Card title={t(LEDGER_SPEC[ledger].formTitle)} titleAs="h2" className={cx(s.formCard, 'ui-no-print')}>
                <RecordForm key={ledger} ledger={ledger} config={config} onSave={save} />
              </Card>
            )}
          </div>
          {!wide && (
            <Drawer open={formOpen} onOpenChange={setFormOpen} title={t(LEDGER_SPEC[ledger].formTitle)}>
              <RecordForm key={ledger} ledger={ledger} config={config} onSave={save} />
            </Drawer>
          )}
        </>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={t('finance.deleteTitle')}
        message={toDelete ? `${formatDay(toDelete.date)} · ${formatCurrency(toDelete.totalPrice, lang)}` : ''}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={() => setData((d) => deleteRecord(d, ledger, toDelete.id))}
      />
    </Page>
  );
}
