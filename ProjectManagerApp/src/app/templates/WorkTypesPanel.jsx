import { CircleCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { learnedFromProjects } from '../../state/portfolioModel.js';
import { loadIdentity } from '../../utils/Identity.js';
import { loadRegistries } from '../../utils/OrderEngine.js';
import { TRADES } from '../../utils/planning/trades.js';
import { deleteWorkType, loadWorkTypes, upsertWorkType, workTypeMap, workTypeName } from '../../utils/planning/WorkTypes.js';
import { acceptLearned } from '../../utils/Productivity.js';
import { loadProjects } from '../../utils/Projects.js';
import { findRateById, loadRateLibrary } from '../../utils/RateLibrary.js';
import { Button, ConfirmDialog, Dialog, EmptyState, Field, IconButton, Input, NumberInput, Select, StatusBadge, Table } from '../../ui/index.js';
import s from '../library/Library.module.css';

const toDraft = (wt) => ({
  ...wt,
  productivity: String(wt.productivity ?? ''),
  fixedDays: wt.fixedDays ? String(wt.fixedDays) : '',
  labour: String(wt.crew?.labour ?? ''),
  keywordsText: (wt.keywords || []).join('، '),
});

const fromDraft = (d) => ({
  ...d,
  crew: { ...(d.crew || {}), labour: d.labour },
  keywords: String(d.keywordsText || '')
    .split(/[,،]/)
    .map((k) => k.trim())
    .filter(Boolean),
});

/**
 * The work-type library (tab of /rates): what each kind of work is, its
 * unit and trade, how much one crew does per working day, the crew size
 * and the rate that prices it. Seeded values are marked "check" until a
 * person confirms them. The pace the site really reached (approved orders,
 * every project) is shown beside the library value; where it differs a
 * person can take it (utils/Productivity). Storage: utils/planning/WorkTypes.
 */
export default function WorkTypesPanel({ canEdit }) {
  const { t, lang } = useI18n();
  const [items, setItems] = useState(loadWorkTypes);
  const rates = useMemo(() => loadRateLibrary(), []);
  const [query, setQuery] = useState('');
  const [trade, setTrade] = useState('');
  const [draft, setDraft] = useState(null);
  const [toDelete, setToDelete] = useState(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((w) => !w.legacy)
      .filter((w) => !trade || w.trade === trade)
      .filter((w) => !q || [w.name, w.nameEn, w.unit, ...(w.keywords || [])].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [items, query, trade]);
  const unchecked = items.filter((w) => !w.legacy && !w.checked).length;
  const learned = useMemo(() => learnedFromProjects(loadProjects(), workTypeMap(items), loadRegistries()), [items]);
  const suggestions = [...learned.values()].filter((l) => l.suggest).length;
  const takeLearned = (wt, l) => {
    upsertWorkType(acceptLearned(wt, l, { by: loadIdentity().name || '' }));
    setItems(loadWorkTypes());
  };

  const save = () => {
    if (!draft.name.trim()) return;
    upsertWorkType(fromDraft(draft));
    setItems(loadWorkTypes());
    setDraft(null);
  };
  const confirm = (wt) => {
    upsertWorkType({ ...wt, checked: !wt.checked });
    setItems(loadWorkTypes());
  };

  return (
    <>
      <div className={s.toolbar}>
        <Input type="search" className={s.search} aria-label={t('templates.wt.search')} placeholder={t('templates.wt.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <Select aria-label={t('templates.wt.trade')} value={trade} onChange={(e) => setTrade(e.target.value)}>
          <option value="">{t('templates.wt.allTrades')}</option>
          {TRADES.map((tr) => (
            <option key={tr} value={tr}>
              {t(`planning.trade.${tr}`)}
            </option>
          ))}
        </Select>
        {canEdit && (
          <Button variant="primary" icon={Plus} onClick={() => setDraft(toDraft({ name: '', nameEn: '', unit: 'م2', trade: 'general', productivity: '', crew: { labour: 3 }, rateId: '', keywords: [] }))}>
            {t('templates.wt.add')}
          </Button>
        )}
      </div>
      <p className={s.hint}>{t('templates.wt.hint', { n: unchecked })}</p>
      {suggestions > 0 && <p className={s.hint}>{t('templates.wt.suggestions', { n: suggestions })}</p>}

      {shown.length === 0 ? (
        <EmptyState title={t('templates.wt.none')} />
      ) : (
        <Table minWidth={760} label={t('templates.wt.title')}>
          <thead>
            <tr>
              <th>{t('templates.wt.name')}</th>
              <th>{t('templates.wt.trade')}</th>
              <th className="ui-num">{t('templates.wt.productivity')}</th>
              <th className="ui-num">{t('templates.wt.crew')}</th>
              <th>{t('templates.wt.rate')}</th>
              <th>{t('templates.wt.status')}</th>
              <th aria-label={t('common.actions')} />
            </tr>
          </thead>
          <tbody>
            {shown.map((w) => {
              const rate = findRateById(rates, w.rateId);
              const site = learned.get(w.id);
              return (
                <tr key={w.id}>
                  <td>
                    {workTypeName(w, lang)}
                    <div className={s.muted}>{w.unit}</div>
                  </td>
                  <td>{t(`planning.trade.${w.trade}`)}</td>
                  <td className="ui-num">
                    {w.fixedDays ? t('planning.wiz.fixedDays', { n: w.fixedDays }) : `${formatNumber(w.productivity)} ${w.unit}`}
                    {site ? (
                      <div className={s.muted}>
                        {t('templates.wt.sitePace', { rate: formatNumber(site.rate), days: formatNumber(site.days) })}
                        {site.change !== null && Math.round(site.change * 100) !== 0 && ` (${site.change > 0 ? '+' : ''}${formatNumber(Math.round(site.change * 100))}%)`}
                      </div>
                    ) : w.learned?.rate ? (
                      <div className={s.muted}>{t('templates.wt.learned', { rate: formatNumber(w.learned.rate) })}</div>
                    ) : null}
                    {site?.suggest && canEdit && (
                      <Button size="sm" variant="outline" onClick={() => takeLearned(w, site)}>
                        {t('templates.wt.useLearned', { rate: formatNumber(site.rate) })}
                      </Button>
                    )}
                  </td>
                  <td className="ui-num">{formatNumber(w.crew?.labour || 0)}</td>
                  <td>
                    {rate ? (
                      <>
                        {rate.name}
                        <div className={s.muted}>{formatNumber(rate.unitPrice)}</div>
                      </>
                    ) : (
                      <StatusBadge tone="warning">{t('templates.wt.noRate')}</StatusBadge>
                    )}
                  </td>
                  <td>
                    {canEdit ? (
                      <Button size="sm" variant={w.checked ? 'secondary' : 'outline'} icon={w.checked ? CircleCheck : undefined} aria-pressed={w.checked} onClick={() => confirm(w)}>
                        {w.checked ? t('templates.wt.checked') : t('templates.wt.check')}
                      </Button>
                    ) : (
                      <StatusBadge tone={w.checked ? 'success' : 'warning'}>{w.checked ? t('templates.wt.checked') : t('templates.wt.toCheck')}</StatusBadge>
                    )}
                  </td>
                  <td className={s.rowActions}>
                    {canEdit && (
                      <>
                        <IconButton icon={Pencil} label={t('common.edit')} size="sm" variant="ghost" onClick={() => setDraft(toDraft(w))} />
                        <IconButton icon={Trash2} label={t('common.delete')} size="sm" variant="ghost" onClick={() => setToDelete(w)} />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? t('templates.wt.edit') : t('templates.wt.add')}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" disabled={!draft?.name.trim()} onClick={save}>
              {t('common.save')}
            </Button>
          </>
        }
      >
        {draft && (
          <div className={s.dialogGrid}>
            <Field label={t('templates.wt.nameAr')}>
              <Input data-autofocus value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={t('templates.wt.nameEn')} optional>
              <Input value={draft.nameEn} dir="ltr" onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })} />
            </Field>
            <Field label={t('common.unit')}>
              <Input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            </Field>
            <Field label={t('templates.wt.trade')}>
              <Select value={draft.trade} onChange={(e) => setDraft({ ...draft, trade: e.target.value })}>
                {TRADES.map((tr) => (
                  <option key={tr} value={tr}>
                    {t(`planning.trade.${tr}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('templates.wt.productivityLong', { unit: draft.unit })}>
              <NumberInput min="0" value={draft.productivity} onChange={(e) => setDraft({ ...draft, productivity: e.target.value })} />
            </Field>
            <Field label={t('templates.wt.crewLabour')}>
              <NumberInput min="0" value={draft.labour} onChange={(e) => setDraft({ ...draft, labour: e.target.value })} />
            </Field>
            <Field label={t('templates.wt.fixedDays')} hint={t('templates.wt.fixedDaysHint')} optional>
              <NumberInput min="0" value={draft.fixedDays} onChange={(e) => setDraft({ ...draft, fixedDays: e.target.value })} />
            </Field>
            <Field label={t('templates.wt.rate')}>
              <Select value={draft.rateId || ''} onChange={(e) => setDraft({ ...draft, rateId: e.target.value })}>
                <option value="">{t('templates.wt.noRate')}</option>
                {rates.map((r) => (
                  <option key={r.id} value={r.id}>
                    {`${r.name} (${r.unit})`}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('templates.wt.keywords')} hint={t('templates.wt.keywordsHint')} className={s.span2} optional>
              <Input value={draft.keywordsText} onChange={(e) => setDraft({ ...draft, keywordsText: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('templates.wt.deleteTitle')}
        message={toDelete ? workTypeName(toDelete, lang) : ''}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={() => {
          deleteWorkType(toDelete.id);
          setItems(loadWorkTypes());
        }}
      />
    </>
  );
}
