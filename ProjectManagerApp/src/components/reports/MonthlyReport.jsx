import { useMemo, useState } from 'react';
import SCurveChart from '../dashboard/SCurveChart';
import { resolveWho } from '../../utils/Registries';
import { useI18n } from '../../i18n/useI18n.js';
import { compactCurrency, formatCurrency } from '../../i18n/index.js';
import './MonthlyReport.css';

/* ─────────────────────────────────────────────────────────────────
   Monthly Report — a LIVE view recomputed from the order ledger
   every render. The act of printing freezes the authoritative
   copy, which is why the sheet always carries BOTH the covered
   period and the generation stamp.
   ───────────────────────────────────────────────────────────────── */

// Project status badge → shared dictionary keys (common.statusDraft…).
const STATUS_KEYS = {
  draft: 'common.statusDraft',
  signed: 'common.statusSigned',
  executing: 'common.statusExecuting',
  completed: 'common.statusCompleted',
};

// Order log labels, keyed by the language-independent type code.
const ORDER_TYPE_KEYS = {
  quick_work: 'reports.orderTypeQuickWork',
  completion: 'reports.orderTypeCompletion',
  concrete_test: 'reports.orderTypeConcreteTest',
  soil_test: 'reports.orderTypeSoilTest',
  material: 'reports.orderTypeMaterial',
  payroll: 'reports.orderTypePayroll',
  machinery: 'reports.orderTypeMachinery',
  fuel: 'reports.orderTypeFuel',
  other_expense: 'reports.orderTypeOtherExpense',
};

// Fixed display order for the financial summary categories:
// [ledger category code, dictionary key].
const EXPENSE_CATEGORIES = [
  ['materials', 'reports.catMaterials'],
  ['payroll', 'reports.catPayroll'],
  ['machinery', 'reports.catMachinery'],
  ['fuel', 'reports.catFuel'],
  ['other', 'reports.catOther'],
];

// Variation-order fields that carry a translatable label.
const FIELD_KEYS = {
  quantity: 'common.contractQty',
  unitPrice: 'reports.fieldUnitPrice',
};

/* ── formatters (house rules: en-US digits, locale-aware currency) ── */
const numFmt2 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const numFmt0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

const fmtNum = (v) => numFmt2.format(Number(v) || 0);
const fmtInt = (v) => numFmt0.format(Math.round(Number(v) || 0));

const toLocalISO = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

// Normalize any stored date (plain YYYY-MM-DD or full ISO) to a local
// YYYY-MM-DD string so month filtering never shifts across timezones.
const isoDateOf = (value) => {
  const s = String(value || '');
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '' : toLocalISO(d);
};

// 'YYYY-MM-DD' → 'DD/MM/YYYY' (used only for the period label).
const fmtDMY = (iso) => (iso && iso.length >= 10
  ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
  : '—');

// SPI/CPI tone: ≥1 green, 0.9–1 amber, <0.9 red.
const evmTone = (idx) => {
  const v = Number(idx) || 0;
  if (v >= 1) return 'good';
  if (v >= 0.9) return 'warn';
  return 'bad';
};

const defaultPrevMonth = () => {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
};

const DEFAULT_REGISTRIES = { contractors: [], teams: [], workers: [] };

const MonthlyReport = ({
  summary,
  computedTasks = [],
  orders = [],
  variations,
  projectMeta = {},
  registries = DEFAULT_REGISTRIES,
}) => {
  const { t, lang, dir, isRTL } = useI18n();
  const [month, setMonth] = useState(defaultPrevMonth);
  const [generatedAt, setGeneratedAt] = useState(() => new Date());

  // Variations may arrive as a dedicated prop or inside projectMeta.
  const variationList = useMemo(
    () => (Array.isArray(variations) ? variations : (projectMeta?.variations || [])),
    [variations, projectMeta]
  );

  // Month boundaries in local time.
  const bounds = useMemo(() => {
    const match = /^(\d{4})-(\d{2})$/.exec(month || '');
    const base = match
      ? new Date(Number(match[1]), Number(match[2]) - 1, 1)
      : new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const start = new Date(base.getFullYear(), base.getMonth(), 1);
    const end = new Date(base.getFullYear(), base.getMonth() + 1, 0);
    const prevEnd = new Date(base.getFullYear(), base.getMonth(), 0);
    return {
      startStr: toLocalISO(start),
      endStr: toLocalISO(end),
      prevEndStr: toLocalISO(prevEnd),
    };
  }, [month]);

  const stamp = useMemo(() => {
    const hh = String(generatedAt.getHours()).padStart(2, '0');
    const mm = String(generatedAt.getMinutes()).padStart(2, '0');
    return `${toLocalISO(generatedAt)} ${hh}:${mm}`;
  }, [generatedAt]);

  const periodLabel = `${fmtDMY(bounds.startStr)} – ${fmtDMY(bounds.endStr)}`;

  const handlePrint = () => {
    // Printing freezes the copy — stamp it with the print moment itself.
    setGeneratedAt(new Date());
    setTimeout(() => window.print(), 60);
  };

  const report = useMemo(() => {
    const tasks = computedTasks || [];
    const taskById = new Map(tasks.map((task) => [task.id, task]));

    const dateOf = (o) => isoDateOf(o?.date);
    const inMonth = (d) => !!d && d >= bounds.startStr && d <= bounds.endStr;

    // Approved value orders drive "executed" quantities (payment-grade data).
    const approvedValue = (orders || []).filter(
      (o) => o.family === 'value' && o.status === 'approved'
    );
    const valueBefore = approvedValue.filter((o) => {
      const d = dateOf(o);
      return !!d && d <= bounds.prevEndStr;
    });
    const valueInMonth = approvedValue.filter((o) => inMonth(dateOf(o)));

    // The order log lists EVERY order of the month (recorded + approved).
    const monthOrders = (orders || [])
      .filter((o) => inMonth(dateOf(o)))
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    // Monetary value of an order: qty × contract unit price for value
    // orders (fallback to its amount), plain amount for expenses.
    const orderValue = (o) => {
      if (o.family === 'value') {
        const price = Number(taskById.get(o.taskId)?.unitPrice) || 0;
        const qty = Number(o.quantity) || 0;
        if (qty && price) return qty * price;
      }
      return Number(o.amount) || 0;
    };

    // Top-level WBS segment an order belongs to.
    const groupKeyOf = (o) => {
      const wbs = taskById.get(o.taskId)?.wbs || o.taskWbs || '';
      return String(wbs).split('.')[0];
    };

    /* ── 4. BOQ progress per top-level group (current − last month) ── */
    const boqRows = tasks
      .filter((g) => g.isGroup && g.wbs && !g.wbs.includes('.'))
      .map((g) => {
        const prefix = `${g.wbs}.`;
        const leaves = tasks.filter(
          (task) => !task.isGroup && task.wbs && task.wbs.startsWith(prefix)
        );
        const contractQty = leaves.reduce(
          (s, task) => s + (Number(task.qty ?? task.quantity ?? 0) || 0), 0
        );
        const units = [...new Set(leaves.map((task) => (task.unit || '').trim()).filter(Boolean))];
        const prevQty = valueBefore
          .filter((o) => groupKeyOf(o) === g.wbs)
          .reduce((s, o) => s + (Number(o.quantity) || 0), 0);
        const monthQty = valueInMonth
          .filter((o) => groupKeyOf(o) === g.wbs)
          .reduce((s, o) => s + (Number(o.quantity) || 0), 0);
        const totalQty = prevQty + monthQty;
        return {
          key: g.id || g.wbs,
          wbs: g.wbs,
          name: g.name,
          contractQty,
          unit: units.length === 1 ? units[0] : '',
          prevQty,
          monthQty,
          totalQty,
          remaining: contractQty - totalQty,
          pct: contractQty > 0 ? (totalQty / contractQty) * 100 : null,
        };
      });

    const boqTotals = boqRows.reduce(
      (acc, r) => ({
        contractQty: acc.contractQty + r.contractQty,
        prevQty: acc.prevQty + r.prevQty,
        monthQty: acc.monthQty + r.monthQty,
        totalQty: acc.totalQty + r.totalQty,
        remaining: acc.remaining + r.remaining,
      }),
      { contractQty: 0, prevQty: 0, monthQty: 0, totalQty: 0, remaining: 0 }
    );
    boqTotals.pct = boqTotals.contractQty > 0
      ? (boqTotals.totalQty / boqTotals.contractQty) * 100
      : null;

    /* ── 5. Display rows for the month's order log ── */
    const orderRows = monthOrders.map((o, i) => {
      const task = taskById.get(o.taskId);
      let who;
      try {
        who = resolveWho(registries, o.who) || '—';
      } catch {
        who = '—';
      }
      const unit = String(task?.unit || o.unit || '').trim();
      const qtyCell = o.family === 'value'
        ? (Number(o.quantity) > 0
          ? `${fmtNum(o.quantity)}${unit ? ` ${unit}` : ''}`
          : '—')
        : (Number(o.amount) > 0 ? formatCurrency(o.amount, lang) : '—');
      const wbs = o.taskWbs || task?.wbs || '';
      const typeKey = ORDER_TYPE_KEYS[o.type];
      return {
        key: `${String(o.date)}-${o.type}-${i}`,
        date: dateOf(o),
        typeLabel: typeKey ? t(typeKey) : (o.type || '—'),
        taskLabel: wbs ? `${wbs} — ${o.taskName || task?.name || ''}` : '—',
        who,
        qtyCell,
        value: orderValue(o),
      };
    });

    /* ── 6. Variation orders raised within the month ── */
    const monthVariations = (variationList || [])
      .filter((v) => inMonth(isoDateOf(v?.date)))
      .slice()
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));

    /* ── 7. Quantities per contractor (approved value orders only) ── */
    const qtyMix = (list) => {
      const byUnit = new Map();
      list.forEach((o) => {
        const u = String(taskById.get(o.taskId)?.unit || o.unit || '').trim();
        byUnit.set(u, (byUnit.get(u) || 0) + (Number(o.quantity) || 0));
      });
      const parts = [...byUnit.entries()].map(
        ([u, q]) => (u ? `${fmtNum(q)} ${u}` : fmtNum(q))
      );
      return parts.length ? parts.join(' + ') : fmtNum(0);
    };

    const byContractor = new Map();
    const internalOrders = [];
    valueInMonth.forEach((o) => {
      const who = o.who || {};
      if (who.kind === 'contractor' && who.contractorId != null) {
        const id = String(who.contractorId);
        if (!byContractor.has(id)) byContractor.set(id, []);
        byContractor.get(id).push(o);
      } else if (who.kind === 'team' || who.kind === 'workers') {
        internalOrders.push(o);
      }
    });

    const contractorRows = [...byContractor.entries()]
      .map(([id, list]) => ({
        id,
        name: (registries?.contractors || []).find((c) => String(c.id) === id)?.name
          || t('reports.contractorFallback', { id }),
        count: list.length,
        qtyMix: qtyMix(list),
        value: list.reduce((s, o) => s + orderValue(o), 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));

    const internalRow = internalOrders.length
      ? {
        name: t('reports.internalCrews'),
        count: internalOrders.length,
        qtyMix: qtyMix(internalOrders),
        value: internalOrders.reduce((s, o) => s + orderValue(o), 0),
      }
      : null;

    /* ── 8. Financial summary — whole ledger of the month ── */
    const monthExpenses = monthOrders.filter((o) => o.family === 'expense');
    const knownCats = new Set(EXPENSE_CATEGORIES.map(([k]) => k));
    const expenseRows = EXPENSE_CATEGORIES.map(([key, labelKey]) => ({
      key,
      labelKey,
      amount: monthExpenses
        .filter((o) => (key === 'other'
          ? (!o.category || !knownCats.has(o.category))
          : o.category === key))
        .reduce((s, o) => s + (Number(o.amount) || 0), 0),
    }));
    const expensesTotal = expenseRows.reduce((s, r) => s + r.amount, 0);
    const monthValueAll = monthOrders
      .filter((o) => o.family === 'value')
      .reduce((s, o) => s + orderValue(o), 0);
    const net = monthValueAll - expensesTotal;

    return {
      boqRows,
      boqTotals,
      orderRows,
      monthVariations,
      contractorRows,
      internalRow,
      expenseRows,
      expensesTotal,
      monthValueAll,
      net,
      orderCount: orderRows.length,
    };
  }, [orders, computedTasks, variationList, registries, bounds, t, lang]);

  const evm = summary?.evm;
  const actualPct = Number(summary?.projectTotalProgress) || 0;
  const plannedPct = Number(summary?.projectPlannedProgress) || 0;
  const deviation = Number(summary?.projectDeviation) || 0;
  const statusKey = projectMeta?.status || 'draft';
  // The "old ← new" arrow follows the reading direction.
  const changeArrow = isRTL ? '←' : '→';

  return (
    <div className="monthly-report" dir={dir}>
      {/* ── Control bar (hidden when printing) ── */}
      <div className="mr-controls no-print">
        <div className="mr-control-field">
          <label htmlFor="mr-month-input">{t('reports.monthOfReport')}</label>
          <input
            id="mr-month-input"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <div className="mr-period">
          <span className="mr-period-label">{t('reports.periodLabel')}</span>
          <span className="mr-period-value">{periodLabel}</span>
        </div>
        <button
          type="button"
          className="apple-btn primary mr-print-btn"
          onClick={handlePrint}
        >
          {t('reports.printReport')}
        </button>
        <div className="mr-stamp" title={t('reports.stampTitle')}>
          {t('reports.issuedAt')} {stamp}
        </div>
      </div>

      {/* ── The printable sheet ── */}
      <div className="report-sheet">

        {/* 1. Header — the project title line is project data and stays as entered */}
        <header className="mr-sheet-header">
          <p className="mr-project-title">مشروع استصلاح اراضي واسط / عقد 5 لسنة 2023</p>
          <h2 className="mr-report-title">{t('reports.monthlyReportTitle')}</h2>
          <div className="mr-header-meta">
            <span><strong>{t('reports.periodColon')}</strong> {periodLabel}</span>
            <span><strong>{t('reports.issuedAt')}</strong> {stamp}</span>
            <span className={`project-status-badge status-${statusKey}`}>
              {STATUS_KEYS[statusKey] ? t(STATUS_KEYS[statusKey]) : statusKey}
            </span>
          </div>
        </header>

        {/* 2. Executive summary */}
        <section className="mr-section">
          <h3 className="mr-section-title">{t('reports.execSummary')}</h3>
          <div className="mr-kpi-grid">
            <div className="mr-kpi-card">
              <span className="mr-kpi-label">{t('reports.actualProgress')}</span>
              <span className="mr-kpi-value">{actualPct.toFixed(2)}%</span>
            </div>
            <div className="mr-kpi-card">
              <span className="mr-kpi-label">{t('reports.plannedProgress')}</span>
              <span className="mr-kpi-value">{plannedPct.toFixed(2)}%</span>
            </div>
            <div className="mr-kpi-card">
              <span className="mr-kpi-label">{t('common.variance')}</span>
              <span className={`mr-kpi-value ${deviation < 0 ? 'tone-bad' : 'tone-good'}`}>
                {deviation > 0 ? '+' : ''}{deviation.toFixed(2)}%
              </span>
            </div>
            <div className="mr-kpi-card">
              <span className="mr-kpi-label">{t('reports.spiLabel')}</span>
              <span className={`mr-kpi-value tone-${evmTone(evm?.spi)}`}>
                {(Number(evm?.spi) || 0).toFixed(2)}
              </span>
            </div>
            <div className="mr-kpi-card">
              <span className="mr-kpi-label">{t('reports.cpiLabel')}</span>
              <span className={`mr-kpi-value tone-${evmTone(evm?.cpi)}`}>
                {(Number(evm?.cpi) || 0).toFixed(2)}
              </span>
            </div>
            <div className="mr-kpi-card">
              <span className="mr-kpi-label">{t('reports.totalCost')}</span>
              <span className="mr-kpi-value">{compactCurrency(summary?.projectTotalCost, lang)}</span>
            </div>
          </div>
        </section>

        {/* 3. S-Curve (reused from the dashboard) */}
        <section className="mr-section">
          <h3 className="mr-section-title">{t('reports.scurveTitle')}</h3>
          <SCurveChart points={summary?.sCurve} />
        </section>

        {/* 4. BOQ progress — current minus last month */}
        <section className="mr-section">
          <h3 className="mr-section-title">{t('reports.boqTitle')}</h3>
          <table className="mr-table mr-boq-table">
            <thead>
              <tr>
                <th>{t('reports.colId')}</th>
                <th>{t('reports.colSection')}</th>
                <th className="num">{t('common.contractQty')}</th>
                <th className="num">{t('reports.colPrevMonths')}</th>
                <th className="num">{t('reports.colThisMonth')}</th>
                <th className="num">{t('reports.colTotalExecuted')}</th>
                <th className="num">{t('reports.colRemaining')}</th>
                <th className="num">{t('reports.colProgressPct')}</th>
              </tr>
            </thead>
            <tbody>
              {report.boqRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="mr-empty">{t('reports.boqEmpty')}</td>
                </tr>
              ) : report.boqRows.map((r) => (
                <tr key={r.key}>
                  <td className="mr-wbs">{r.wbs}</td>
                  <td className="mr-name">{r.name}</td>
                  <td className="num">
                    {r.contractQty > 0
                      ? `${fmtNum(r.contractQty)}${r.unit ? ` ${r.unit}` : ''}`
                      : '—'}
                  </td>
                  <td className="num">{fmtNum(r.prevQty)}</td>
                  <td className="num">{fmtNum(r.monthQty)}</td>
                  <td className="num">{fmtNum(r.totalQty)}</td>
                  <td className={`num${r.remaining < 0 ? ' tone-bad' : ''}`}>{fmtNum(r.remaining)}</td>
                  <td className="num">{r.pct == null ? '—' : `${r.pct.toFixed(2)}%`}</td>
                </tr>
              ))}
            </tbody>
            {report.boqRows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>{t('common.total')}</td>
                  <td className="num">{fmtNum(report.boqTotals.contractQty)}</td>
                  <td className="num">{fmtNum(report.boqTotals.prevQty)}</td>
                  <td className="num">{fmtNum(report.boqTotals.monthQty)}</td>
                  <td className="num">{fmtNum(report.boqTotals.totalQty)}</td>
                  <td className="num">{fmtNum(report.boqTotals.remaining)}</td>
                  <td className="num">
                    {report.boqTotals.pct == null
                      ? '—'
                      : `${report.boqTotals.pct.toFixed(2)}%`}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </section>

        {/* 5. Order log of the month */}
        <section className="mr-section">
          <h3 className="mr-section-title">
            {t('reports.ordersLogTitle')} ({fmtInt(report.orderCount)})
          </h3>
          <table className="mr-table">
            <thead>
              <tr>
                <th>{t('common.date')}</th>
                <th>{t('common.type')}</th>
                <th>{t('reports.colTask')}</th>
                <th>{t('reports.colExecutedBy')}</th>
                <th>{t('reports.qtyOrAmount')}</th>
                <th className="num">{t('reports.colValueIqd')}</th>
              </tr>
            </thead>
            <tbody>
              {report.orderRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mr-empty">{t('reports.noOrdersPeriod')}</td>
                </tr>
              ) : report.orderRows.map((r) => (
                <tr key={r.key}>
                  <td className="mr-date">{r.date || '—'}</td>
                  <td>{r.typeLabel}</td>
                  <td className="mr-name">{r.taskLabel}</td>
                  <td>{r.who}</td>
                  <td className="mr-qty-cell">{r.qtyCell}</td>
                  <td className="num">{r.value > 0 ? fmtInt(r.value) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 6. Variation orders within the period */}
        <section className="mr-section">
          <h3 className="mr-section-title">{t('reports.variationsTitle')}</h3>
          <table className="mr-table">
            <thead>
              <tr>
                <th>{t('reports.colCode')}</th>
                <th>{t('reports.colTask')}</th>
                <th>{t('reports.colField')}</th>
                <th>{t('reports.colChange')}</th>
                <th>{t('reports.colReason')}</th>
                <th>{t('reports.colApprovedBy')}</th>
              </tr>
            </thead>
            <tbody>
              {report.monthVariations.length === 0 ? (
                <tr>
                  <td colSpan={6} className="mr-empty">{t('reports.noVariations')}</td>
                </tr>
              ) : report.monthVariations.map((v) => (
                <tr key={v.id || `${v.taskWbs}-${v.date}`}>
                  <td className="mr-wbs">{v.taskWbs || '—'}</td>
                  <td className="mr-name">{v.taskName || '—'}</td>
                  <td>{FIELD_KEYS[v.field] ? t(FIELD_KEYS[v.field]) : (v.field || '—')}</td>
                  <td className="mr-qty-cell">
                    {fmtNum(v.oldValue)} {changeArrow} <strong>{fmtNum(v.newValue)}</strong>
                  </td>
                  <td>{v.reason || '—'}</td>
                  <td>{v.approver || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* 7. Quantities per contractor (payment verification) */}
        <section className="mr-section">
          <h3 className="mr-section-title">{t('reports.perContractorTitle')}</h3>
          <table className="mr-table">
            <thead>
              <tr>
                <th>{t('reports.colContractor')}</th>
                <th className="num">{t('reports.orderCount')}</th>
                <th>{t('reports.colTotalQty')}</th>
                <th className="num">{t('reports.colValueIqd')}</th>
              </tr>
            </thead>
            <tbody>
              {report.contractorRows.length === 0 && !report.internalRow ? (
                <tr>
                  <td colSpan={4} className="mr-empty">
                    {t('reports.noContractorQty')}
                  </td>
                </tr>
              ) : (
                <>
                  {report.contractorRows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.name}</td>
                      <td className="num">{fmtInt(r.count)}</td>
                      <td className="mr-qty-cell">{r.qtyMix}</td>
                      <td className="num">{r.value > 0 ? fmtInt(r.value) : '—'}</td>
                    </tr>
                  ))}
                  {report.internalRow && (
                    <tr className="mr-internal-row">
                      <td>{report.internalRow.name}</td>
                      <td className="num">{fmtInt(report.internalRow.count)}</td>
                      <td className="mr-qty-cell">{report.internalRow.qtyMix}</td>
                      <td className="num">
                        {report.internalRow.value > 0 ? fmtInt(report.internalRow.value) : '—'}
                      </td>
                    </tr>
                  )}
                </>
              )}
            </tbody>
          </table>
        </section>

        {/* 8. Financial summary */}
        <section className="mr-section">
          <h3 className="mr-section-title">{t('reports.finSummaryTitle')}</h3>
          <table className="mr-table mr-fin-table">
            <tbody>
              <tr className="mr-row-value">
                <td>{t('reports.finValueExecuted')}</td>
                <td className="num">{fmtInt(report.monthValueAll)}</td>
              </tr>
              {report.expenseRows.map((r) => (
                <tr key={r.key}>
                  <td>{t('reports.finExpenseCat', { label: t(r.labelKey) })}</td>
                  <td className="num">{fmtInt(r.amount)}</td>
                </tr>
              ))}
              <tr className="mr-row-total">
                <td>{t('reports.totalExpensesSum')}</td>
                <td className="num">{fmtInt(report.expensesTotal)}</td>
              </tr>
              <tr className={`mr-row-net ${report.net >= 0 ? 'mr-net-positive' : 'mr-net-negative'}`}>
                <td>{t('reports.finNet')}</td>
                <td className="num">{fmtInt(report.net)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mr-footnote">
            {t('reports.finFootnote')}
          </p>
        </section>

        {/* 9. Signatures */}
        <section className="mr-section mr-signatures">
          {['reports.signPreparer', 'reports.signSiteManager', 'reports.signApproval'].map((roleKey) => (
            <div key={roleKey} className="mr-sign-block">
              <span className="mr-sign-role">{t(roleKey)}</span>
              <div className="mr-sign-line" />
              <span className="mr-sign-hint">
                {t('reports.signSignature')} &nbsp; {t('reports.signDate')}
              </span>
            </div>
          ))}
        </section>

      </div>
    </div>
  );
};

export default MonthlyReport;
