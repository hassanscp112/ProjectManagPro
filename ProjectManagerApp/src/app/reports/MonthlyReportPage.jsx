import { ChevronLeft, ChevronRight, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { indexTone } from '../../state/homeModel.js';
import { STATUS_KEYS } from '../../state/projectModel.js';
import { useProject } from '../../state/projectContext.js';
import { addMonths, dayOf, monthlyReport } from '../../state/reportsModel.js';
import { resolveWhoLabel, todayStr } from '../../utils/OrderEngine.js';
import { Button, IconButton, StatusBadge, cx } from '../../ui/index.js';
import { ltr } from '../bidi.js';
import { issueStamp, monthLabel } from '../dates.js';
import SCurve from '../home/SCurve.jsx';
import { Page } from '../Page.jsx';
import { formatDay, orderFigure, orderSubject, typeLabel } from '../record/orderMeta.js';
import { ReportSheet, SheetSection } from './ReportSheet.jsx';
import s from './Reports.module.css';

const TONE = { success: s.toneSuccess, warning: s.toneWarning, danger: s.toneDanger };
const CATEGORY_KEYS = {
  materials: 'reports.catMaterials',
  payroll: 'reports.catPayroll',
  machinery: 'reports.catMachinery',
  fuel: 'reports.catFuel',
  other: 'reports.catOther',
};
const pct2 = (n) => `${(Number(n) || 0).toFixed(2)}%`;
const idx2 = (n) => (Number(n) || 0).toFixed(2);
const int = (n) => formatNumber(Math.round(Number(n) || 0));

/**
 * /reports/monthly — the month's report, recomputed from the order ledger:
 * summary, S-curve, BOQ progress per section, the month's orders and
 * variation orders, quantities per contractor, the money summary, signatures.
 */
export default function MonthlyReportPage() {
  const { t, lang, dir } = useI18n();
  const { engineResult, orders, projectMeta, registries } = useProject();
  const thisMonth = todayStr().slice(0, 7);
  const [month, setMonth] = useState(() => addMonths(thisMonth, -1));
  const [stamp, setStamp] = useState(() => issueStamp());
  const r = useMemo(
    () => monthlyReport({ orders, tasks: engineResult.tasks, variations: projectMeta.variations || [], month }),
    [orders, engineResult.tasks, projectMeta.variations, month]
  );

  const evm = engineResult.evm;
  const deviation = Number(engineResult.projectDeviation) || 0;
  const status = projectMeta.status || 'draft';
  // old → new follows the reading direction (old ← new in Arabic).
  const arrow = dir === 'rtl' ? '←' : '→';
  const contractorName = (id) => registries.contractors?.find((c) => String(c.id) === id)?.name || t('reports.contractorFallback', { id });
  const qtyText = (pairs) => (pairs.length ? pairs.map(([u, q]) => `${formatNumber(q)}${u ? ` ${u}` : ''}`).join(' + ') : '0');
  const print = () => {
    setStamp(issueStamp());
    setTimeout(() => window.print(), 50);
  };

  const figures = [
    ['reports.actualProgress', pct2(engineResult.projectTotalProgress)],
    ['reports.plannedProgress', pct2(engineResult.projectPlannedProgress)],
    ['common.variance', ltr(`${deviation > 0 ? '+' : ''}${pct2(deviation)}`), deviation < 0 ? 'danger' : 'success'],
    ['reports.spiLabel', idx2(evm?.spi), indexTone(evm?.spi)],
    ['reports.cpiLabel', idx2(evm?.cpi), indexTone(evm?.cpi)],
    ['reports.totalCost', compactCurrency(engineResult.projectTotalCost, lang)],
  ];

  return (
    <Page area="reports">
      <div className={cx(s.toolbar, 'ui-no-print')}>
        <div className={s.period}>
          <IconButton icon={ChevronLeft} label={t('planning.prevMonth')} variant="secondary" className="ui-flip-rtl" onClick={() => setMonth(addMonths(month, -1))} />
          <span className={s.periodLabel} aria-live="polite">
            {monthLabel(month, lang)}
          </span>
          <IconButton
            icon={ChevronRight}
            label={t('planning.nextMonth')}
            variant="secondary"
            className="ui-flip-rtl"
            disabled={month >= thisMonth}
            onClick={() => setMonth(addMonths(month, 1))}
          />
        </div>
        <div className={s.spacer} />
        <Button variant="primary" icon={Printer} onClick={print}>
          {t('reports.print')}
        </Button>
      </div>

      <ReportSheet
        title={`${t('reports.monthlyReportTitle')} — ${monthLabel(month, lang)}`}
        period={`${formatDay(r.bounds.start)} – ${formatDay(r.bounds.end)}`}
        stamp={stamp}
        extra={<StatusBadge tone="accent">{STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status}</StatusBadge>}
      >
        <SheetSection title={t('reports.execSummary')}>
          <dl className={s.figures}>
            {figures.map(([key, value, tone]) => (
              <div key={key} className={s.figure}>
                <dt>{t(key)}</dt>
                <dd className={TONE[tone]}>{value}</dd>
              </div>
            ))}
          </dl>
          <p className={s.footnote}>{t('reports.summaryNote')}</p>
        </SheetSection>

        <SheetSection title={t('reports.scurveTitle')} className={s.chart}>
          <SCurve points={engineResult.sCurve} today={todayStr()} />
        </SheetSection>

        <SheetSection title={t('reports.boqTitle')}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('reports.colSection')}</th>
                  <th className={s.num}>{t('common.contractQty')}</th>
                  <th className={s.num}>{t('reports.colPrevMonths')}</th>
                  <th className={s.num}>{t('reports.colThisMonth')}</th>
                  <th className={s.num}>{t('reports.colTotalExecuted')}</th>
                  <th className={s.num}>{t('reports.colRemaining')}</th>
                  <th className={s.num}>{t('reports.colProgressPct')}</th>
                </tr>
              </thead>
              <tbody>
                {r.boqRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className={s.empty}>
                      {t('reports.boqEmpty')}
                    </td>
                  </tr>
                ) : (
                  r.boqRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <span className={cx(s.wbs, 'ui-ltr')}>{row.wbs}</span>
                        {row.name}
                      </td>
                      <td className={s.num}>{row.contractQty > 0 ? `${formatNumber(row.contractQty)}${row.unit ? ` ${row.unit}` : ''}` : '—'}</td>
                      <td className={s.num}>{formatNumber(row.prevQty)}</td>
                      <td className={s.num}>{formatNumber(row.monthQty)}</td>
                      <td className={s.num}>{formatNumber(row.totalQty)}</td>
                      <td className={cx(s.num, row.remaining < 0 && s.toneDanger)}>{formatNumber(row.remaining)}</td>
                      <td className={s.num}>{row.rate == null ? '—' : pct2(row.rate * 100)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {r.boqRows.length > 0 && (
                <tfoot>
                  <tr>
                    <td>{t('common.total')}</td>
                    <td className={s.num}>{formatNumber(r.boqTotals.contractQty)}</td>
                    <td className={s.num}>{formatNumber(r.boqTotals.prevQty)}</td>
                    <td className={s.num}>{formatNumber(r.boqTotals.monthQty)}</td>
                    <td className={s.num}>{formatNumber(r.boqTotals.totalQty)}</td>
                    <td className={s.num}>{formatNumber(r.boqTotals.remaining)}</td>
                    <td className={s.num}>{r.boqTotals.rate == null ? '—' : pct2(r.boqTotals.rate * 100)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </SheetSection>

        <SheetSection title={`${t('reports.ordersLogTitle')} (${r.monthOrders.length})`}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.type')}</th>
                  <th>{t('reports.colTask')}</th>
                  <th>{t('reports.colExecutedBy')}</th>
                  <th className={s.num}>{t('reports.qtyOrAmount')}</th>
                  <th className={s.num}>{t('reports.colValueIqd')}</th>
                </tr>
              </thead>
              <tbody>
                {r.monthOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={s.empty}>
                      {t('reports.noOrdersPeriod')}
                    </td>
                  </tr>
                ) : (
                  r.monthOrders.map((o) => {
                    const task = engineResult.tasks.find((x) => x.id === o.taskId);
                    const value = o.family === 'value' ? (Number(o.quantity) || 0) * (Number(task?.unitPrice) || 0) : Number(o.amount) || 0;
                    return (
                      <tr key={o.id}>
                        <td className={s.num}>{formatDay(dayOf(o.date))}</td>
                        <td>
                          {typeLabel(o.type)}
                          {o.status !== 'approved' && <span className={s.pending}>{t('common.pending')}</span>}
                        </td>
                        <td>{orderSubject(o) || '—'}</td>
                        <td>{resolveWhoLabel(o.who, registries)}</td>
                        <td className={s.num}>{orderFigure(o, lang)}</td>
                        <td className={s.num}>{value > 0 ? int(value) : '—'}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </SheetSection>

        <SheetSection title={t('reports.variationsTitle')}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('reports.colTask')}</th>
                  <th>{t('reports.colField')}</th>
                  <th className={s.num}>{t('reports.colChange')}</th>
                  <th>{t('reports.colReason')}</th>
                  <th>{t('reports.colApprovedBy')}</th>
                </tr>
              </thead>
              <tbody>
                {r.monthVariations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={s.empty}>
                      {t('reports.noVariations')}
                    </td>
                  </tr>
                ) : (
                  r.monthVariations.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <span className={cx(s.wbs, 'ui-ltr')}>{v.taskWbs}</span>
                        {v.taskName}
                      </td>
                      <td>{v.field === 'unitPrice' ? t('reports.fieldUnitPrice') : t('common.contractQty')}</td>
                      <td className={s.num}>{`${formatNumber(v.oldValue)} ${arrow} ${formatNumber(v.newValue)}`}</td>
                      <td>{v.reason || '—'}</td>
                      <td>{v.approver || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SheetSection>

        <SheetSection title={t('reports.perContractorTitle')}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('reports.colContractor')}</th>
                  <th className={s.num}>{t('reports.orderCount')}</th>
                  <th className={s.num}>{t('reports.colTotalQty')}</th>
                  <th className={s.num}>{t('reports.colValueIqd')}</th>
                </tr>
              </thead>
              <tbody>
                {r.contractors.length === 0 && !r.internal ? (
                  <tr>
                    <td colSpan={4} className={s.empty}>
                      {t('reports.noContractorQty')}
                    </td>
                  </tr>
                ) : (
                  <>
                    {r.contractors.map((c) => (
                      <tr key={c.contractorId}>
                        <td>{contractorName(c.contractorId)}</td>
                        <td className={s.num}>{c.count}</td>
                        <td className={s.num}>{qtyText(c.qtyByUnit)}</td>
                        <td className={s.num}>{c.value > 0 ? int(c.value) : '—'}</td>
                      </tr>
                    ))}
                    {r.internal && (
                      <tr>
                        <td>{t('reports.internalCrews')}</td>
                        <td className={s.num}>{r.internal.count}</td>
                        <td className={s.num}>{qtyText(r.internal.qtyByUnit)}</td>
                        <td className={s.num}>{r.internal.value > 0 ? int(r.internal.value) : '—'}</td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </SheetSection>

        <SheetSection title={t('reports.finSummaryTitle')}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <tbody>
                <tr>
                  <td>{t('reports.finValueExecuted')}</td>
                  <td className={s.num}>{int(r.valueTotal)}</td>
                </tr>
                {r.expenses.map((e) => (
                  <tr key={e.key}>
                    <td>{t('reports.finExpenseCat', { label: t(CATEGORY_KEYS[e.key]) })}</td>
                    <td className={s.num}>{int(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>{t('reports.totalExpensesSum')}</td>
                  <td className={s.num}>{int(r.expensesTotal)}</td>
                </tr>
                <tr>
                  <td>{t('reports.finNet')}</td>
                  <td className={cx(s.num, r.net >= 0 ? s.netPositive : s.netNegative)}>{int(r.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className={s.footnote}>{t('reports.finFootnote')}</p>
        </SheetSection>

        <div className={s.signatures}>
          {['reports.signPreparer', 'reports.signSiteManager', 'reports.signApproval'].map((key) => (
            <div key={key} className={s.sign}>
              <strong>{t(key)}</strong>
              <div className={s.signLine} />
              <span className={s.footnote}>{t('reports.signDate')}</span>
            </div>
          ))}
        </div>
      </ReportSheet>
    </Page>
  );
}
