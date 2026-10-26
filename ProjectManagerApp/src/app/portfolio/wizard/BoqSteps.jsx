import { FileUp } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { compactCurrency, formatNumber } from '../../../i18n/index.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { matchRows } from '../../../state/plannerModel.js';
import { pickBoqSheet, tableToText } from '../../../utils/planning/BoqImport.js';
import { workTypeName } from '../../../utils/planning/WorkTypes.js';
import { Button, Card, ChipGroup, Field, Select, StatusBadge, Table, Textarea, cx, useToast } from '../../../ui/index.js';
import s from './Wizard.module.css';

const ROLES = ['no', 'description', 'unit', 'qty', 'rate', 'amount'];
const PREVIEW_ROWS = 8;

/**
 * Paste the BOQ from Excel, or open the .xlsx file (the sheet with the most
 * BOQ lines is chosen; another can be picked); check / correct which column
 * holds what.
 */
export function StepBoq({ state, dispatch, boq }) {
  const { t, lang } = useI18n();
  const toast = useToast();
  const fileRef = useRef(null);
  const [sheets, setSheets] = useState(null); // [{ sheet, data }] of the opened workbook
  const [sheetIndex, setSheetIndex] = useState(0);
  const chooseSheet = (list, i) => {
    setSheetIndex(i);
    dispatch({ type: 'boqText', text: tableToText(list[i].data) });
  };
  const openFile = async (file) => {
    if (!file) return;
    try {
      // The reader is loaded only when a file is opened.
      const { default: readXlsxFile } = await import('read-excel-file/browser');
      const list = await readXlsxFile(file);
      if (!list.length) throw new Error('empty');
      setSheets(list);
      chooseSheet(list, pickBoqSheet(list));
    } catch {
      toast({ title: t('planning.wiz.boqFileError'), tone: 'danger' });
    }
  };
  const width = boq ? boq.rows.reduce((m, r) => Math.max(m, r.length), 0) : 0;
  const roleOf = (i) => (boq ? ROLES.find((r) => boq.columns[r] === i) || '' : '');
  const setRole = (i, role) => {
    const columns = { ...boq.columns };
    ROLES.forEach((r) => {
      if (columns[r] === i) columns[r] = -1;
    });
    if (role) columns[role] = i;
    dispatch({ type: 'boqColumns', columns });
  };
  const items = boq ? boq.lines.filter((l) => l.kind === 'item') : [];
  const sections = boq ? boq.lines.filter((l) => l.kind === 'section') : [];
  const total = items.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const firstRow = boq ? boq.header + 1 : 0;

  return (
    <Card title={t('planning.wiz.step.boq')} subtitle={t('planning.wiz.boqHint')} titleAs="h2" padding="md">
      <div className={s.row}>
        <input ref={fileRef} type="file" accept=".xlsx" hidden onChange={(e) => openFile(e.target.files[0]).finally(() => (e.target.value = ''))} />
        <Button icon={FileUp} onClick={() => fileRef.current?.click()}>
          {t('planning.wiz.boqOpenFile')}
        </Button>
        {sheets && sheets.length > 1 && (
          <Field label={t('planning.wiz.boqSheet')} className={s.grow}>
            <Select value={String(sheetIndex)} onChange={(e) => chooseSheet(sheets, Number(e.target.value))}>
              {sheets.map((sh, i) => (
                <option key={sh.sheet} value={String(i)}>
                  {sh.sheet}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Textarea
        rows={8}
        aria-label={t('planning.wiz.boqPaste')}
        placeholder={t('planning.wiz.boqPlaceholder')}
        value={state.boqText}
        onChange={(e) => dispatch({ type: 'boqText', text: e.target.value })}
      />
      {boq && (
        <>
          <p className={s.muted}>
            {t('planning.wiz.boqSummary', { items: items.length, sections: sections.length, total: compactCurrency(total, lang) })}
            {boq.header < 0 ? ` ${t('planning.wiz.boqNoHeader')}` : ''}
          </p>
          <Table label={t('planning.wiz.boqColumns')} minWidth={Math.max(560, width * 120)}>
            <thead>
              <tr>
                {Array.from({ length: width }, (_, i) => (
                  <th key={i}>
                    <Select aria-label={t('planning.wiz.boqColumnN', { n: i + 1 })} value={roleOf(i)} onChange={(e) => setRole(i, e.target.value)}>
                      <option value="">{t('planning.wiz.col.none')}</option>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {t(`planning.wiz.col.${r}`)}
                        </option>
                      ))}
                    </Select>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {boq.rows.slice(firstRow, firstRow + PREVIEW_ROWS).map((row, ri) => (
                <tr key={ri}>
                  {Array.from({ length: width }, (_, i) => (
                    <td key={i} className={cx(roleOf(i) === '' && s.dimCell)}>
                      {row[i] ?? ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Table>
          {boq.rows.length - firstRow > PREVIEW_ROWS && <p className={s.muted}>{t('planning.wiz.boqMoreRows', { n: boq.rows.length - firstRow - PREVIEW_ROWS })}</p>}
        </>
      )}
    </Card>
  );
}

/** Each BOQ item → the work type it is (matched automatically; changed by hand). */
export function StepMatch({ state, dispatch, boq, workTypes, template }) {
  const { t, lang } = useI18n();
  const [filter, setFilter] = useState('attention');
  const rows = useMemo(() => matchRows(state, boq), [state, boq]);
  const allTypes = useMemo(
    () => [...workTypes.values()].filter((w) => !w.legacy).sort((a, b) => workTypeName(a, lang).localeCompare(workTypeName(b, lang), lang)),
    [workTypes, lang]
  );
  const inTemplate = useMemo(() => new Set((template?.elements || []).map((e) => e.workType)), [template]);
  if (!boq) return null;

  const count = (c) => rows.filter((r) => r.confidence === c).length;
  const shown = rows.filter((r) => filter === 'all' || (filter === 'attention' ? r.confidence === 'low' || r.confidence === 'medium' : r.confidence === 'manual'));
  const tone = { high: 'success', medium: 'warning', low: 'danger', manual: 'accent' };
  const name = (id) => workTypeName(workTypes.get(id), lang) || id;
  const pct = (score) => `${Math.round((score || 0) * 100)}%`;

  return (
    <Card title={t('planning.wiz.step.match')} subtitle={t('planning.wiz.matchHint')} titleAs="h2" padding="md">
      <div className={s.row}>
        <p className={s.muted}>
          {t('planning.wiz.matchCounts', { high: count('high'), medium: count('medium'), low: count('low'), manual: count('manual') })}
        </p>
        <div className={s.spacer} />
        <ChipGroup
          size="sm"
          label={t('planning.wiz.linksFilter')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'attention', label: t('planning.wiz.matchAttention') },
            { value: 'manual', label: t('planning.wiz.matchManual') },
            { value: 'all', label: t('planning.wiz.linksAll') },
          ]}
        />
      </div>
      {shown.length === 0 ? (
        <p className={s.ok}>{t('planning.wiz.matchNothing')}</p>
      ) : (
        <Table label={t('planning.wiz.step.match')} minWidth={760}>
          <thead>
            <tr>
              <th>{t('planning.wiz.col.no')}</th>
              <th>{t('planning.wiz.col.description')}</th>
              <th className="ui-num">{t('common.quantity')}</th>
              <th>{t('planning.wiz.workType')}</th>
              <th>{t('planning.wiz.matchConfidence')}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const value = r.manual ? state.assignments[String(r.line.row)] : 'auto';
              const outside = r.chosen && !inTemplate.has(r.chosen);
              return (
                <tr key={r.line.row}>
                  <td className="ui-ltr">{r.line.no || r.line.wbs}</td>
                  <td>{r.line.description}</td>
                  <td className="ui-num">
                    {formatNumber(r.line.qty)} {r.line.unit}
                  </td>
                  <td>
                    <Select aria-label={t('planning.wiz.matchFor', { name: r.line.description })} value={value} onChange={(e) => dispatch({ type: 'assign', row: r.line.row, workTypeId: e.target.value })}>
                      <option value="auto">{r.best ? t('planning.wiz.matchAuto', { name: name(r.best.workTypeId) }) : t('planning.wiz.matchAutoNone')}</option>
                      <option value="">{t('planning.wiz.matchNone')}</option>
                      {r.candidates.length > 0 && (
                        <optgroup label={t('planning.wiz.matchSuggested')}>
                          {r.candidates.map((c) => (
                            <option key={c.workTypeId} value={c.workTypeId}>
                              {`${name(c.workTypeId)} · ${pct(c.score)}`}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      <optgroup label={t('planning.wiz.matchAllTypes')}>
                        {allTypes.map((w) => (
                          <option key={w.id} value={w.id}>
                            {`${workTypeName(w, lang)} (${w.unit})`}
                          </option>
                        ))}
                      </optgroup>
                    </Select>
                    {outside && <div className={s.muted}>{t('planning.wiz.matchOutside')}</div>}
                  </td>
                  <td>
                    <StatusBadge tone={tone[r.confidence]}>
                      {t(`planning.wiz.conf.${r.confidence}`)}
                      {r.confidence !== 'manual' && r.best ? ` ${pct(r.best.score)}` : ''}
                    </StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
