import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { RATE_CATEGORIES, addRate, deleteRate, loadRateLibrary, updateRate } from '../../utils/RateLibrary.js';
import { Button, ConfirmDialog, Dialog, EmptyState, Field, IconButton, Input, NumberInput, Select, StatusBadge, Table } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import { categoryLabel } from './templateLabels.js';
import s from './Library.module.css';

/**
 * /library/rates — the IQD rate library the template generator prices
 * items from. Prices are copied at generation time. Storage: RateLibrary.
 */
export default function RatesPage() {
  const { t } = useI18n();
  const [rates, setRates] = useState(loadRateLibrary);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rates;
    return rates.filter((r) => [r.name, r.category, categoryLabel(r.category, t), r.unit].some((v) => String(v || '').toLowerCase().includes(q)));
  }, [rates, query, t]);

  const save = () => {
    if (!draft.name.trim()) return;
    const payload = { name: draft.name.trim(), unit: draft.unit.trim(), unitPrice: Math.max(0, Number(draft.unitPrice) || 0), category: draft.category || 'أخرى' };
    if (draft.id) updateRate(draft.id, payload);
    else addRate(payload);
    setRates(loadRateLibrary());
    setDraft(null);
  };

  return (
    <Page area="library">
      <div className={s.toolbar}>
        <Input type="search" className={s.search} aria-label={t('templates.searchRates')} placeholder={t('templates.searchRates')} value={query} onChange={(e) => setQuery(e.target.value)} />
        <Button variant="primary" icon={Plus} onClick={() => setDraft({ id: null, name: '', unit: 'م2', unitPrice: '', category: RATE_CATEGORIES[0] })}>
          {t('library.addRate')}
        </Button>
      </div>

      {shown.length === 0 ? (
        <EmptyState title={t('templates.noRatesMatch')} />
      ) : (
        <Table minWidth={560} label={t('templates.tabRates')}>
          <thead>
            <tr>
              <th>{t('templates.colItem')}</th>
              <th>{t('common.unit')}</th>
              <th className="ui-num">{t('templates.unitPriceIqd')}</th>
              <th>{t('templates.colCategory')}</th>
              <th aria-label={t('common.actions')} />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.unit}</td>
                <td className="ui-num">{formatNumber(r.unitPrice)}</td>
                <td>
                  <StatusBadge icon={false}>{categoryLabel(r.category, t)}</StatusBadge>
                </td>
                <td className={s.rowActions}>
                  <IconButton icon={Pencil} label={t('common.edit')} size="sm" variant="ghost" onClick={() => setDraft({ ...r, unitPrice: String(r.unitPrice ?? '') })} />
                  <IconButton icon={Trash2} label={t('common.delete')} size="sm" variant="ghost" onClick={() => setToDelete(r)} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <p className={s.hint}>{t('templates.copyNote')}</p>

      <Dialog
        open={draft !== null}
        onOpenChange={(o) => !o && setDraft(null)}
        title={draft?.id ? t('library.editRate') : t('library.addRate')}
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
            <Field label={t('templates.colItem')} className={s.span2}>
              <Input data-autofocus value={draft.name} placeholder={t('templates.rateNamePlaceholder')} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={t('common.unit')}>
              <Input value={draft.unit} placeholder={t('templates.rateUnitPlaceholder')} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} />
            </Field>
            <Field label={t('templates.unitPriceIqd')}>
              <NumberInput value={draft.unitPrice} min="0" onChange={(e) => setDraft({ ...draft, unitPrice: e.target.value })} />
            </Field>
            <Field label={t('templates.colCategory')} className={s.span2}>
              <Select value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                {RATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c, t)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('library.deleteRateTitle')}
        message={toDelete?.name}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={() => {
          deleteRate(toDelete.id);
          setRates(loadRateLibrary());
        }}
      />
    </Page>
  );
}
