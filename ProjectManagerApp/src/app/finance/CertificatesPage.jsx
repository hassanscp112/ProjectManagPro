import { FileText, Plus, TriangleAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { computeCertificate, filterCertificates } from '../../state/certificateModel.js';
import { useProject } from '../../state/projectContext.js';
import { Button, Card, EmptyState, Field, ListRow, Segmented, Select, StatusBadge, Table, cx, usePhone } from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import { useCan } from '../useCan.js';
import { CertificateNewDialog } from './CertificateNewDialog.jsx';
import { CertificateStatus } from './CertificateParts.jsx';
import { CertificateRates } from './CertificateRates.jsx';
import { money, partyName, useCertificatesStore, useCurrency } from './CertificateShared.js';
import s from './Certificates.module.css';

const href = (cert) => `#/finance/certificates/${cert.id}`;

/** The certificates list with its filters (kind, contractor). */
function CertificateList({ doc, onNew }) {
  const { t } = useI18n();
  const phone = usePhone();
  const { tasks, orders, registries } = useProject();
  const currency = useCurrency(doc.settings);
  const [kind, setKind] = useState('all');
  const [contractorId, setContractorId] = useState('');
  const contractor = kind === 'employer' ? '' : contractorId;

  const rows = useMemo(() => {
    const ctx = { certificates: doc.certificates, rates: doc.rates, tasks, orders };
    return filterCertificates(doc.certificates, { kind, contractorId: contractor }).map((cert) => ({ cert, r: computeCertificate(cert, ctx) }));
  }, [doc, tasks, orders, kind, contractor]);

  // Contractors that have a certificate (filter options).
  const withCertificates = [...new Set(doc.certificates.filter((c) => c.contractorId).map((c) => c.contractorId))]
    .map((id) => ({ id, name: partyName({ kind: 'subcontractor', contractorId: id }, registries, t) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const title = (cert) => `${t('certificates.numberShort', { number: cert.number })} · ${partyName(cert, registries, t)}`;
  const period = (cert, r) => (r.periodStart ? `${formatDay(r.periodStart)} – ${formatDay(cert.periodEnd)}` : t('certificates.upTo', { date: formatDay(cert.periodEnd) }));
  const missing = (r) =>
    r.totals.missingRates > 0 && (
      <StatusBadge tone="warning" icon={TriangleAlert}>
        {t('certificates.missingCount', { n: r.totals.missingRates })}
      </StatusBadge>
    );

  if (doc.certificates.length === 0) {
    return (
      <Card padding="md">
        <EmptyState
          icon={FileText}
          title={t('certificates.emptyTitle')}
          body={t('certificates.emptyBody')}
          action={
            onNew && (
              <Button variant="primary" icon={Plus} onClick={onNew}>
                {t('certificates.new')}
              </Button>
            )
          }
        />
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className={s.stack}>
        <div className={s.filters}>
          <Field label={t('certificates.kind')}>
            <Segmented
              label={t('certificates.kind')}
              value={kind}
              onChange={setKind}
              options={[
                { value: 'all', label: t('certificates.kindAll') },
                { value: 'subcontractor', label: t('certificates.kindSubcontractorShort') },
                { value: 'employer', label: t('certificates.kindEmployerShort') },
              ]}
            />
          </Field>
          {kind !== 'employer' && withCertificates.length > 0 && (
            <Field label={t('certificates.contractor')} className={s.grow}>
              <Select value={contractorId} onChange={(e) => setContractorId(e.target.value)}>
                <option value="">{t('certificates.allContractors')}</option>
                {withCertificates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <span className={s.count}>{rows.length === 1 ? t('certificates.countOne') : t('certificates.count', { n: rows.length })}</span>
        </div>

        {rows.length === 0 ? (
          <EmptyState title={t('certificates.noMatching')} />
        ) : phone ? (
          <div className={s.list}>
            {rows.map(({ cert, r }) => (
              <ListRow
                key={cert.id}
                href={href(cert)}
                title={title(cert)}
                subtitle={period(cert, r)}
                trailing={
                  <span className={s.rowTrailing}>
                    <span className={s.strong}>{money(r.totals.netPayable)}</span>
                    <CertificateStatus status={cert.status} />
                  </span>
                }
              />
            ))}
          </div>
        ) : (
          <Table label={t('certificates.listTitle')} minWidth={760}>
            <thead>
              <tr>
                <th>{t('certificates.colNumber')}</th>
                <th>{t('certificates.colParty')}</th>
                <th>{t('certificates.colPeriod')}</th>
                <th>{t('common.status')}</th>
                <th className="ui-num">{t('certificates.colGrossToDate', { currency })}</th>
                <th className="ui-num">{t('certificates.colNetPayable', { currency })}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ cert, r }) => (
                <tr key={cert.id}>
                  <td>
                    <a className={s.link} href={href(cert)}>
                      {t('certificates.numberShort', { number: cert.number })}
                    </a>
                  </td>
                  <td>
                    {partyName(cert, registries, t)}
                    <span className={s.sub}>{t(cert.kind === 'employer' ? 'certificates.kindEmployerShort' : 'certificates.kindSubcontractorShort')}</span>
                  </td>
                  <td>{period(cert, r)}</td>
                  <td>
                    <div className={s.filters}>
                      <CertificateStatus status={cert.status} />
                      {missing(r)}
                    </div>
                  </td>
                  <td className="ui-num">{money(r.totals.gross?.cum)}</td>
                  <td className={cx('ui-num', s.strong, r.totals.netPayable < 0 && s.danger)}>{money(r.totals.netPayable)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        <p className={s.hint}>{t('certificates.listFootnote', { n: formatNumber(rows.filter((x) => x.cert.status === 'draft').length) })}</p>
      </div>
    </Card>
  );
}

/**
 * /finance/certificates — payment certificates (ذرعات): the list, and
 * ?view=rates — the agreed rates (contractor × item) and default terms.
 */
export default function CertificatesPage() {
  const { t } = useI18n();
  const allowed = useCan();
  const doc = useCertificatesStore();
  const [params, setParams] = useSearchParams();
  const [newOpen, setNewOpen] = useState(false);
  const view = params.get('view') === 'rates' ? 'rates' : 'list';
  const canPrepare = allowed('certificates.prepare');

  return (
    <Page area="finance">
      <div className={cx(s.toolbar, 'ui-no-print')}>
        <Segmented
          label={t('certificates.view')}
          value={view}
          onChange={(v) => setParams(v === 'rates' ? { view: 'rates' } : {})}
          options={[
            { value: 'list', label: t('certificates.viewList') },
            { value: 'rates', label: t('certificates.viewRates') },
          ]}
        />
        <div className={s.spacer} />
        {canPrepare && (
          <Button variant="primary" icon={Plus} onClick={() => setNewOpen(true)}>
            {t('certificates.new')}
          </Button>
        )}
      </div>

      {view === 'rates' ? (
        <CertificateRates doc={doc} focusContractor={params.get('contractor') || ''} />
      ) : (
        <CertificateList doc={doc} onNew={canPrepare ? () => setNewOpen(true) : null} />
      )}

      {newOpen && (
        <CertificateNewDialog
          open
          onOpenChange={setNewOpen}
          certificates={doc.certificates}
          initialContractor={params.get('contractor') || ''}
        />
      )}
    </Page>
  );
}
