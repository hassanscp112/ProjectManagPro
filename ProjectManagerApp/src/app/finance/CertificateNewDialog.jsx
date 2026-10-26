import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { certificateProblem, createCertificate, nextNumber, openDraft, seriesOf } from '../../utils/Certificates.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { Button, Dialog, Field, Input, Segmented, Select } from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import s from './Certificates.module.css';

const PROBLEM_KEYS = {
  contractor: 'certificates.errContractor',
  date: 'certificates.errDate',
  openDraft: 'certificates.errOpenDraft',
  beforePrevious: 'certificates.errBeforePrevious',
};

/**
 * New certificate: kind, contractor (subcontractor) and the period end.
 * A series has one draft at a time, so an open draft is offered instead.
 */
export function CertificateNewDialog({ open, onOpenChange, certificates, initialKind = 'subcontractor', initialContractor = '' }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { registries } = useProject();
  const contractors = [...(registries.contractors || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const [kind, setKind] = useState(initialKind);
  const [contractorId, setContractorId] = useState(initialContractor || contractors[0]?.id || '');
  const [periodEnd, setPeriodEnd] = useState(todayStr);
  const [tried, setTried] = useState(false);

  const input = { kind, contractorId: kind === 'employer' ? null : contractorId, periodEnd };
  const problem = certificateProblem(certificates, input);
  const series = seriesOf(certificates, input.kind, input.contractorId);
  const lastIssued = series.filter((c) => c.status === 'issued').pop();
  const draft = openDraft(certificates, input.kind, input.contractorId);
  const go = (id) => {
    onOpenChange(false);
    navigate(`/finance/certificates/${id}`);
  };

  const create = (e) => {
    e.preventDefault();
    setTried(true);
    if (problem) return;
    const cert = createCertificate(input);
    if (cert) go(cert.id);
  };

  const error =
    problem && (tried || problem === 'openDraft' || problem === 'beforePrevious')
      ? t(PROBLEM_KEYS[problem] || 'certificates.errDate', {
          number: draft?.number ?? lastIssued?.number ?? '',
          date: formatDay(lastIssued?.periodEnd),
        })
      : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('certificates.newTitle')}
      description={t('certificates.newHint')}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('ui.cancel')}
          </Button>
          {problem === 'openDraft' ? (
            <Button variant="primary" onClick={() => go(draft.id)}>
              {t('certificates.openDraft', { number: draft.number })}
            </Button>
          ) : (
            <Button variant="primary" type="submit" form="new-certificate">
              {t('certificates.createNumbered', { number: nextNumber(certificates, input.kind, input.contractorId) })}
            </Button>
          )}
        </>
      }
    >
      <form id="new-certificate" className={s.form} onSubmit={create}>
        <Field label={t('certificates.kind')}>
          <Segmented
            label={t('certificates.kind')}
            block
            value={kind}
            onChange={setKind}
            options={[
              { value: 'subcontractor', label: t('certificates.kindSubcontractor') },
              { value: 'employer', label: t('certificates.kindEmployer') },
            ]}
          />
        </Field>
        <p className={s.hint}>{t(kind === 'employer' ? 'certificates.kindEmployerHint' : 'certificates.kindSubcontractorHint')}</p>
        {kind === 'subcontractor' &&
          (contractors.length === 0 ? (
            <p className={s.hint}>
              {t('certificates.noContractors')}{' '}
              <a className={s.link} href="#/people/contractors" onClick={() => onOpenChange(false)}>
                {t('certificates.goToPeople')}
              </a>
            </p>
          ) : (
            <Field label={t('certificates.contractor')} error={tried && problem === 'contractor' ? error : undefined}>
              <Select value={contractorId} onChange={(e) => setContractorId(e.target.value)} data-autofocus>
                {contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || t('certificates.unknownContractor')}
                  </option>
                ))}
              </Select>
            </Field>
          ))}
        <Field
          label={t('certificates.periodEnd')}
          hint={lastIssued && !error ? t('certificates.periodAfter', { number: lastIssued.number, date: formatDay(lastIssued.periodEnd) }) : t('certificates.periodEndHint')}
          error={problem !== 'contractor' ? error : undefined}
        >
          <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
}
