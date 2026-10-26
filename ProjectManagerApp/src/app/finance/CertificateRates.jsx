import { Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { rateRows } from '../../state/certificateModel.js';
import { useProject } from '../../state/projectContext.js';
import { saveSettings, setRate } from '../../utils/Certificates.js';
import { Button, Card, EmptyState, Field, Input, NumberInput, Segmented, Select, Table, cx, usePhone } from '../../ui/index.js';
import { useCan } from '../useCan.js';
import { useCurrency } from './CertificateShared.js';
import s from './Certificates.module.css';

/** A number typed freely and saved when the field is left (Enter too). */
function CommitNumber({ value, onCommit, className, ...rest }) {
  const shown = value == null ? '' : String(value);
  const [draft, setDraft] = useState(shown);
  const [base, setBase] = useState(shown);
  if (base !== shown) {
    // the stored value changed elsewhere: show it
    setBase(shown);
    setDraft(shown);
  }
  const commit = () => draft !== shown && onCommit(draft);
  return (
    <NumberInput
      {...rest}
      className={className}
      min="0"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && commit()}
    />
  );
}

const SETTINGS_FIELDS = [
  { key: 'retentionPct', label: 'certificates.retentionPct', unit: '%', hint: 'certificates.retentionPctHint' },
  { key: 'retentionLimit', label: 'certificates.retentionLimit', money: true, hint: 'certificates.retentionLimitHint' },
  { key: 'advanceAmount', label: 'certificates.advanceAmountMain', money: true, hint: 'certificates.advanceAmountHint' },
  { key: 'advanceRecoveryPct', label: 'certificates.advanceRecoveryPct', unit: '%', hint: 'certificates.advanceRecoveryHint' },
];

/** Defaults for new certificates (the main contract's terms). */
function SettingsCard({ settings, editable }) {
  const { t } = useI18n();
  const currency = useCurrency(settings);
  return (
    <Card title={t('certificates.settingsTitle')} subtitle={t('certificates.settingsHint')} titleAs="h2" padding="md">
      <div className={s.pair}>
        {SETTINGS_FIELDS.map((f) => (
          <Field key={f.key} label={t(f.label)} hint={t(f.hint)}>
            <CommitNumber
              value={settings[f.key]}
              unit={f.money ? currency : f.unit}
              disabled={!editable}
              onCommit={(v) => saveSettings({ [f.key]: v })}
            />
          </Field>
        ))}
        <Field label={t('certificates.currencyLabel')} hint={t('certificates.currencyLabelHint')}>
          <Input
            key={settings.currencyLabel}
            defaultValue={settings.currencyLabel}
            placeholder={t('orders.currencySuffix')}
            disabled={!editable}
            onBlur={(e) => e.target.value !== settings.currencyLabel && saveSettings({ currencyLabel: e.target.value.trim() })}
          />
        </Field>
      </div>
    </Card>
  );
}

/**
 * Contractor × item table of agreed rates. A contractor with orders on an
 * item but no rate is marked; their certificate can't be issued until it
 * has one. On phones one contractor at a time.
 */
function RatesCard({ rates, settings, editable, focusContractor }) {
  const { t } = useI18n();
  const phone = usePhone();
  const { tasks, orders, registries } = useProject();
  const currency = useCurrency(settings);
  const contractors = useMemo(
    () => [...(registries.contractors || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [registries.contractors]
  );
  const [picked, setPicked] = useState(focusContractor || '');
  const [scope, setScope] = useState('worked');
  const [query, setQuery] = useState('');
  const known = contractors.some((c) => c.id === picked);
  // Phones show one contractor; with none picked, the first.
  const contractorId = known ? picked : phone ? contractors[0]?.id || '' : '';
  const shown = useMemo(() => (contractorId ? contractors.filter((c) => c.id === contractorId) : contractors), [contractorId, contractors]);

  const allRows = useMemo(
    () => rateRows({ tasks, orders, rates, contractorIds: contractors.map((c) => c.id) }),
    [tasks, orders, rates, contractors]
  );
  const missingBy = useMemo(() => {
    const counts = {};
    allRows.forEach((row) => row.missing.forEach((id) => (counts[id] = (counts[id] || 0) + 1)));
    return counts;
  }, [allRows]);
  const rows = useMemo(
    () => rateRows({ tasks, orders, rates, contractorIds: shown.map((c) => c.id), onlyWorked: scope === 'worked', query }),
    [tasks, orders, rates, shown, scope, query]
  );

  if (contractors.length === 0) {
    return (
      <Card padding="md">
        <EmptyState
          icon={Users}
          title={t('certificates.noContractorsTitle')}
          body={t('certificates.noContractors')}
          action={
            <Button as="a" href="#/people/contractors" variant="primary">
              {t('certificates.goToPeople')}
            </Button>
          }
        />
      </Card>
    );
  }

  const label = (c) => {
    const name = c.name || t('certificates.unknownContractor');
    return missingBy[c.id] ? `${name} · ${t('certificates.missingCount', { n: missingBy[c.id] })}` : name;
  };

  return (
    <Card title={t('certificates.ratesTitle')} subtitle={t('certificates.ratesHint')} titleAs="h2" padding="md">
      <div className={s.stack}>
        <div className={s.filters}>
          <Field label={t('certificates.contractor')} className={s.grow}>
            <Select value={contractorId} onChange={(e) => setPicked(e.target.value)}>
              {!phone && <option value="">{t('certificates.allContractors')}</option>}
              {contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {label(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('certificates.itemsShown')}>
            <Segmented
              label={t('certificates.itemsShown')}
              value={scope}
              onChange={setScope}
              options={[
                { value: 'worked', label: t('certificates.itemsWorked') },
                { value: 'all', label: t('certificates.itemsAll') },
              ]}
            />
          </Field>
          <Field label={t('certificates.search')} className={s.grow}>
            <Input type="search" value={query} placeholder={t('certificates.searchItems')} onChange={(e) => setQuery(e.target.value)} />
          </Field>
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={Search} title={t('certificates.noRateItems')} body={t(scope === 'worked' ? 'certificates.noRateItemsWorked' : 'certificates.noRateItemsAll')} />
        ) : (
          <Table label={t('certificates.ratesTitle')} minWidth={phone ? undefined : 360 + shown.length * 150} className={s.rateTable}>
            <thead>
              <tr>
                <th>{t('certificates.colItem')}</th>
                <th className="ui-num">{t('certificates.colBoqPrice')}</th>
                {shown.map((c) => (
                  <th key={c.id}>{c.name || t('certificates.unknownContractor')}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ task, rates: taskRates, missing, worked }) => (
                <tr key={task.id}>
                  <td>
                    <span className={cx(s.wbs, 'ui-ltr')}>{task.wbs}</span>
                    {task.name}
                    {task.unit && <span className={s.sub}>{t('certificates.perUnit', { unit: task.unit })}</span>}
                  </td>
                  <td className="ui-num">{Number(task.unitPrice) > 0 ? formatNumber(task.unitPrice) : '—'}</td>
                  {shown.map((c) => (
                    <td key={c.id} className={missing.has(c.id) ? s.missing : undefined}>
                      <CommitNumber
                        className={s.rateInput}
                        value={taskRates[c.id]}
                        unit={currency}
                        disabled={!editable}
                        aria-label={t('certificates.rateFor', { item: task.name, contractor: c.name || '' })}
                        aria-invalid={missing.has(c.id) || undefined}
                        onCommit={(v) => setRate(c.id, task.id, v)}
                      />
                      {missing.has(c.id) ? (
                        <span className={s.sub}>{t('certificates.rateNeeded')}</span>
                      ) : worked.has(c.id) ? (
                        <span className={s.sub}>{t('certificates.hasOrders')}</span>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </Card>
  );
}

/** The "Rates & terms" view of the certificates page. */
export function CertificateRates({ doc, focusContractor }) {
  const allowed = useCan();
  const editable = allowed('certificates.prepare');
  return (
    <div className={s.stack}>
      <RatesCard rates={doc.rates} settings={doc.settings} editable={editable} focusContractor={focusContractor} />
      <SettingsCard settings={doc.settings} editable={editable} />
    </div>
  );
}
