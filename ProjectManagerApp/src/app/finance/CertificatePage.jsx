import { ArrowLeft, ArrowRight, FileText, Plus, Printer, Stamp, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { computeCertificate } from '../../state/certificateModel.js';
import { useProject } from '../../state/projectContext.js';
import { createCertificateId, deleteDraft, issueCertificate, previousCertificates, updateDraft } from '../../utils/Certificates.js';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  NumberInput,
  StatusBadge,
  Textarea,
  cx,
  useToast,
} from '../../ui/index.js';
import { issueStamp } from '../dates.js';
import { formatDay } from '../record/orderMeta.js';
import { ReportSheet, SheetSection } from '../reports/ReportSheet.jsx';
import { Page } from '../Page.jsx';
import { useCan } from '../useCan.js';
import { CertificateStatus } from './CertificateParts.jsx';
import { money, partyName, useCertificatesStore, useCurrency } from './CertificateShared.js';
import s from './Certificates.module.css';

const pct = (n) => `${formatNumber(n)}%`;
const SIGNATURES = {
  subcontractor: ['certificates.signPreparer', 'certificates.signProjectManager', 'certificates.signSubcontractor'],
  employer: ['certificates.signContractor', 'certificates.signResidentEngineer', 'certificates.signEmployer'],
};
const TERM_FIELDS = [
  { key: 'retentionPct', label: 'certificates.retentionPct', unit: '%' },
  { key: 'retentionLimit', label: 'certificates.retentionLimit', money: true },
  { key: 'advanceAmount', label: 'certificates.advanceAmount', money: true },
  { key: 'advanceRecoveryPct', label: 'certificates.advanceRecoveryPct', unit: '%' },
];

/** An uncontrolled field saved when it is left (Enter too); re-mounted when the stored value changes. */
function Committed({ as: Comp, value, onCommit, ...rest }) {
  const text = String(value ?? '');
  return (
    <Comp
      key={text}
      {...rest}
      defaultValue={text}
      onBlur={(e) => e.target.value !== text && onCommit(e.target.value)}
      onKeyDown={(e) => e.key === 'Enter' && Comp !== Textarea && e.currentTarget.blur()}
    />
  );
}

/** The draft's editable details: period end, terms, other deductions, note. */
function DraftEditor({ cert, currency }) {
  const { t } = useI18n();
  const toast = useToast();
  const update = (patch) => {
    if (!updateDraft(cert.id, patch)) toast({ title: t('certificates.errBeforePreviousShort'), tone: 'danger' });
  };
  const setDeduction = (id, patch) => update({ deductions: cert.deductions.map((d) => (d.id === id ? { ...d, ...patch } : d)) });

  return (
    <Card title={t('certificates.draftDetails')} titleAs="h2" padding="md" className="ui-no-print">
      <div className={s.form}>
        <Field label={t('certificates.periodEnd')}>
          <Committed as={Input} type="date" value={cert.periodEnd} onCommit={(v) => v && update({ periodEnd: v })} />
        </Field>
        <p className={s.legend}>{t('certificates.terms')}</p>
        <div className={s.pair}>
          {TERM_FIELDS.map((f) => (
            <Field key={f.key} label={t(f.label)}>
              <Committed
                as={NumberInput}
                min="0"
                unit={f.money ? currency : f.unit}
                value={cert.terms[f.key]}
                onCommit={(v) => update({ terms: { ...cert.terms, [f.key]: v } })}
              />
            </Field>
          ))}
        </div>
        <p className={s.hint}>{t('certificates.termsHint')}</p>

        <p className={s.legend}>{t('certificates.otherDeductions')}</p>
        {cert.deductions.length === 0 && <p className={s.hint}>{t('certificates.noDeductions')}</p>}
        {cert.deductions.map((d) => (
          <div key={d.id} className={s.deduction}>
            <Committed
              as={Input}
              aria-label={t('certificates.deductionLabel')}
              placeholder={t('certificates.deductionLabelPh')}
              value={d.label}
              onCommit={(v) => setDeduction(d.id, { label: v.trim() })}
            />
            <Committed
              as={NumberInput}
              aria-label={t('certificates.deductionAmount')}
              min="0"
              unit={currency}
              value={d.amount}
              onCommit={(v) => setDeduction(d.id, { amount: v })}
            />
            <IconButton
              icon={Trash2}
              size="sm"
              label={t('certificates.removeDeduction')}
              onClick={() => update({ deductions: cert.deductions.filter((x) => x.id !== d.id) })}
            />
          </div>
        ))}
        <div>
          <Button size="sm" icon={Plus} onClick={() => update({ deductions: [...cert.deductions, { id: createCertificateId(), label: '', amount: 0 }] })}>
            {t('certificates.addDeduction')}
          </Button>
        </div>

        <Field label={t('certificates.note')} optional>
          <Committed as={Textarea} value={cert.note} onCommit={(v) => update({ note: v })} />
        </Field>
      </div>
    </Card>
  );
}

/** What blocks issuing a draft, with the way out. */
function Problems({ cert, r, previous }) {
  const { t } = useI18n();
  const last = previous[previous.length - 1];
  const messages = r.problems.map((p) => {
    if (p === 'missingRates')
      return cert.kind === 'employer' ? (
        <>
          {t('certificates.missingPrices', { n: r.totals.missingRates })}{' '}
          <a className={s.link} href="#/schedule">
            {t('certificates.goToSchedule')}
          </a>
        </>
      ) : (
        <>
          {t('certificates.missingRates', { n: r.totals.missingRates })}{' '}
          <a className={s.link} href={`#/finance/certificates?view=rates&contractor=${cert.contractorId}`}>
            {t('certificates.setRates')}
          </a>
        </>
      );
    if (p === 'beforePrevious') return t('certificates.errBeforePrevious', { number: last?.number ?? '', date: formatDay(last?.periodEnd) });
    if (p === 'noLines') return t('certificates.noLinesYet');
    return t('certificates.errDate');
  });
  return messages.map((m, i) => (
    <div key={r.problems[i]} className={cx(s.notice, s.noticeWarning, 'ui-no-print')} role="status">
      <p className={s.noticeText}>{m}</p>
    </div>
  ));
}

/**
 * /finance/certificates/:id — one payment certificate as a printable sheet:
 * work done per item (previous / this period / to date), the deductions,
 * the net payable and signature lines. A draft follows the order log and
 * can be edited and issued; an issued certificate is frozen.
 */
export default function CertificatePage() {
  const { id } = useParams();
  const { t, dir } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();
  const allowed = useCan();
  const doc = useCertificatesStore();
  const { tasks, orders, registries } = useProject();
  const currency = useCurrency(doc.settings);
  const [stamp, setStamp] = useState(() => issueStamp());
  const [confirm, setConfirm] = useState(null); // 'issue' | 'delete'
  const cert = doc.certificates.find((c) => c.id === id) || null;
  const r = useMemo(
    () => (cert ? computeCertificate(cert, { certificates: doc.certificates, rates: doc.rates, tasks, orders }) : null),
    [cert, doc, tasks, orders]
  );

  if (!cert) {
    return (
      <Page area="finance">
        <Card padding="md">
          <EmptyState
            icon={FileText}
            title={t('certificates.notFound')}
            action={
              <Button as="a" href="#/finance/certificates" variant="primary">
                {t('certificates.backToList')}
              </Button>
            }
          />
        </Card>
      </Page>
    );
  }

  const previous = previousCertificates(doc.certificates, cert);
  const draft = cert.status === 'draft';
  const canPrepare = allowed('certificates.prepare');
  const canIssue = allowed('certificates.issue');
  const party = partyName(cert, registries, t);
  const { totals } = r;
  const sum = (key) => r.lines.reduce((acc, l) => acc + (l[key] ?? 0), 0);
  const print = () => {
    if (draft) setStamp(issueStamp());
    setTimeout(() => window.print(), 50);
  };
  const issue = () => {
    const issued = issueCertificate(cert.id, r);
    if (issued) toast({ title: t('certificates.issuedToast', { number: issued.number }), tone: 'success' });
  };
  const remove = () => {
    if (deleteDraft(cert.id)) {
      toast({ title: t('certificates.deletedToast', { number: cert.number }) });
      navigate('/finance/certificates');
    }
  };

  const summary = [
    { key: 'gross', label: t('certificates.rowGross'), row: totals.gross },
    {
      key: 'retention',
      label: t('certificates.rowRetention', { pct: pct(cert.terms.retentionPct) }),
      sub: totals.retention?.limited ? t('certificates.retentionLimited', { limit: money(cert.terms.retentionLimit) }) : null,
      row: totals.retention,
    },
    {
      key: 'advance',
      label: cert.terms.advanceAmount > 0 ? t('certificates.rowAdvance', { pct: pct(cert.terms.advanceRecoveryPct) }) : t('certificates.rowAdvanceNone'),
      sub:
        cert.terms.advanceAmount > 0
          ? t('certificates.advanceLeft', { amount: money(cert.terms.advanceAmount), left: money(totals.advance?.remaining) })
          : null,
      row: totals.advance,
    },
    { key: 'deductions', label: t('certificates.rowDeductions'), row: totals.deductions },
  ];

  return (
    <Page area="finance">
      <div className={cx(s.toolbar, 'ui-no-print')}>
        <Button as="a" href="#/finance/certificates" variant="ghost" icon={dir === 'rtl' ? ArrowRight : ArrowLeft}>
          {t('certificates.backToList')}
        </Button>
        <div className={s.spacer} />
        {draft && canPrepare && (
          <Button variant="ghost" icon={Trash2} onClick={() => setConfirm('delete')}>
            {t('certificates.deleteDraft')}
          </Button>
        )}
        <Button icon={Printer} onClick={print}>
          {t('reports.print')}
        </Button>
        {draft && canIssue && (
          <Button variant="primary" icon={Stamp} disabled={!r.issuable} onClick={() => setConfirm('issue')}>
            {t('certificates.issue')}
          </Button>
        )}
      </div>

      {draft ? (
        <>
          <Problems cert={cert} r={r} previous={previous} />
          <div className={cx(s.notice, s.noticeInfo, 'ui-no-print')}>
            <p className={s.noticeText}>{t(canIssue ? 'certificates.draftNotice' : 'certificates.draftNoticeNoIssue')}</p>
          </div>
        </>
      ) : null}

      <div className={s.layout}>
        <ReportSheet
          title={`${t('certificates.sheetTitle', { number: cert.number })} — ${party}`}
          period={r.periodStart ? `${formatDay(r.periodStart)} – ${formatDay(cert.periodEnd)}` : t('certificates.upTo', { date: formatDay(cert.periodEnd) })}
          stamp={draft ? null : issueStamp(new Date(cert.issuedAt))}
          extra={
            <>
              <CertificateStatus status={cert.status} />
              {draft && (
                <span>
                  {t('certificates.printedAt')} <span className="ui-ltr">{stamp}</span>
                </span>
              )}
            </>
          }
        >
          <SheetSection>
            <dl className={s.terms}>
              <div className={s.term}>
                <dt>{t(cert.kind === 'employer' ? 'certificates.kind' : 'certificates.contractor')}</dt>
                <dd>{party}</dd>
              </div>
              <div className={s.term}>
                <dt>{t('certificates.colNumber')}</dt>
                <dd>{formatNumber(cert.number)}</dd>
              </div>
              <div className={s.term}>
                <dt>{t('certificates.retentionPct')}</dt>
                <dd>{pct(cert.terms.retentionPct)}</dd>
              </div>
              <div className={s.term}>
                <dt>{t('certificates.advanceAmount')}</dt>
                <dd>{cert.terms.advanceAmount > 0 ? `${money(cert.terms.advanceAmount)} ${currency}` : '—'}</dd>
              </div>
              <div className={s.term}>
                <dt>{t('certificates.ordersCounted')}</dt>
                <dd>{formatNumber(r.orderIds.length)}</dd>
              </div>
            </dl>
          </SheetSection>

          <SheetSection title={t('certificates.workDone')} aside={<span className={s.footnote}>{t('certificates.amountsIn', { currency })}</span>}>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr className={s.groupHead}>
                    <th colSpan={3} />
                    <th colSpan={3}>{t('certificates.quantities')}</th>
                    <th colSpan={3}>{t('certificates.amounts')}</th>
                  </tr>
                  <tr>
                    <th>{t('certificates.colItem')}</th>
                    <th>{t('common.unit')}</th>
                    <th className={s.num}>{t(cert.kind === 'employer' ? 'certificates.colUnitPrice' : 'certificates.colRate')}</th>
                    <th className={s.num}>{t('certificates.colPrevious')}</th>
                    <th className={s.num}>{t('certificates.colThisPeriod')}</th>
                    <th className={s.num}>{t('certificates.colToDate')}</th>
                    <th className={s.num}>{t('certificates.colPrevious')}</th>
                    <th className={s.num}>{t('certificates.colThisPeriod')}</th>
                    <th className={s.num}>{t('certificates.colToDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={s.empty}>
                        {t('certificates.noLines')}
                      </td>
                    </tr>
                  ) : (
                    r.lines.map((l) => (
                      <tr key={l.taskId} className={l.missingRate ? s.missing : undefined}>
                        <td>
                          <span className={cx(s.wbs, 'ui-ltr')}>{l.wbs}</span>
                          {l.name || t('certificates.deletedItem')}
                          {l.missingTask && l.name && <span className={s.sub}>{t('certificates.deletedItem')}</span>}
                        </td>
                        <td>{l.unit || '—'}</td>
                        <td className={s.num}>
                          {l.missingRate ? (
                            <StatusBadge tone="warning">{t(cert.kind === 'employer' ? 'certificates.noPrice' : 'certificates.noRate')}</StatusBadge>
                          ) : (
                            formatNumber(l.rate)
                          )}
                        </td>
                        <td className={s.num}>{formatNumber(l.prevQty)}</td>
                        <td className={s.num}>{formatNumber(l.thisQty)}</td>
                        <td className={s.num}>{formatNumber(l.cumQty)}</td>
                        <td className={s.num}>{money(l.prevAmount)}</td>
                        <td className={s.num}>{money(l.thisAmount)}</td>
                        <td className={s.num}>{money(l.cumAmount)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {r.lines.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={6}>{t('common.total')}</td>
                      <td className={s.num}>{money(sum('prevAmount'))}</td>
                      <td className={s.num}>{money(sum('thisAmount'))}</td>
                      <td className={s.num}>{money(sum('cumAmount'))}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </SheetSection>

          <SheetSection title={t('certificates.summary')} aside={<span className={s.footnote}>{t('certificates.amountsIn', { currency })}</span>}>
            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th />
                    <th className={s.num}>{t('certificates.colPrevious')}</th>
                    <th className={s.num}>{t('certificates.colThisPeriod')}</th>
                    <th className={s.num}>{t('certificates.colToDate')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((row) => (
                    <tr key={row.key}>
                      <td>
                        {row.label}
                        {row.sub && <span className={s.sub}>{row.sub}</span>}
                      </td>
                      <td className={s.num}>{money(row.row?.prev)}</td>
                      <td className={s.num}>{money(row.row?.this)}</td>
                      <td className={s.num}>{money(row.row?.cum)}</td>
                    </tr>
                  ))}
                  <tr className={s.netRow}>
                    <td>{t('certificates.rowNetDue')}</td>
                    <td className={s.num}>{money(totals.netDue?.prev)}</td>
                    <td className={s.num}>{money(totals.netDue?.this)}</td>
                    <td className={s.num}>{money(totals.netDue?.cum)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3}>{t('certificates.rowPreviousNet', { n: previous.length })}</td>
                    <td className={s.num}>{money(totals.previousNet)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className={s.payable}>
                    <td colSpan={3}>{t('certificates.rowNetPayable')}</td>
                    <td className={cx(s.num, totals.netPayable < 0 && s.danger)}>
                      {money(totals.netPayable)} {currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {totals.missingRates > 0 && <p className={cx(s.footnote, s.danger)}>{t('certificates.totalsIncomplete', { n: totals.missingRates })}</p>}
          </SheetSection>

          {cert.deductions.length > 0 && (
            <SheetSection title={t('certificates.otherDeductionsThis')}>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <tbody>
                    {cert.deductions.map((d) => (
                      <tr key={d.id}>
                        <td>{d.label || '—'}</td>
                        <td className={s.num}>{money(d.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SheetSection>
          )}

          {cert.note && (
            <SheetSection title={t('certificates.note')}>
              <p className={s.note}>{cert.note}</p>
            </SheetSection>
          )}

          <p className={s.footnote}>
            {draft
              ? t('certificates.draftFootnote')
              : t('certificates.issuedFootnote', { name: cert.issuedBy?.name || '—', date: issueStamp(new Date(cert.issuedAt)) })}
          </p>

          <div className={s.signatures}>
            {SIGNATURES[cert.kind].map((key) => (
              <div key={key} className={s.sign}>
                <strong>{t(key)}</strong>
                <div className={s.signLine} />
                <span className={s.footnote}>{t('certificates.signNameDate')}</span>
              </div>
            ))}
          </div>
        </ReportSheet>

        <div className={cx(s.side, 'ui-no-print')}>
          {draft && canPrepare && <DraftEditor cert={cert} currency={currency} />}
          {!draft && (
            <Card title={t('certificates.issuedTitle')} titleAs="h2" padding="md">
              <dl className={s.facts}>
                <dt>{t('certificates.issuedBy')}</dt>
                <dd>{cert.issuedBy?.name || '—'}</dd>
                <dt>{t('certificates.issuedOn')}</dt>
                <dd className="ui-ltr">{issueStamp(new Date(cert.issuedAt))}</dd>
                <dt>{t('certificates.ordersCounted')}</dt>
                <dd>{formatNumber(cert.orderIds?.length || 0)}</dd>
              </dl>
              <p className={s.hint}>{t('certificates.issuedHint')}</p>
            </Card>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirm === 'issue'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('certificates.issueTitle', { number: cert.number })}
        message={t('certificates.issueMessage', { net: `${money(totals.netPayable)} ${currency}`, n: r.orderIds.length })}
        confirmLabel={t('certificates.issue')}
        onConfirm={issue}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('certificates.deleteTitle', { number: cert.number })}
        message={t('certificates.deleteMessage')}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={remove}
      />
    </Page>
  );
}
