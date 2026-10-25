import jspreadsheet from 'jspreadsheet-ce';
import 'jspreadsheet-ce/dist/jspreadsheet.css';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { colIndexToLetter } from '../../utils/CalculatorEngine.js';
import { Button, Card, Field, Input, Select, useToast } from '../../ui/index.js';
import s from './Library.module.css';

const COLS = 15;

/**
 * Define a grid's columns in a small spreadsheet: row 1 = column names,
 * row 2 = a test value or an Excel-style formula (=A2*B2). The side panel
 * sets the selected column's source (input / design data / formula).
 * jspreadsheet stays left-to-right inside its own light box.
 */
export default function BoqTemplateEditor({ initial, onSave, onCancel }) {
  const { t } = useI18n();
  const toast = useToast();
  const [name, setName] = useState(initial?.name || '');
  const [selected, setSelected] = useState(null);
  const [sources, setSources] = useState(() => Object.fromEntries((initial?.columns || []).map((c, i) => [i, c.source])));
  const hostRef = useRef(null);
  const sheetRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || sheetRef.current) return undefined;
    const headers = Array(COLS).fill('');
    const values = Array(COLS).fill('');
    (initial?.columns || []).slice(0, COLS).forEach((c, i) => {
      headers[i] = c.name;
      values[i] = c.source === 'formula' ? c.formula : c.testValue || '';
    });
    const data = [headers, values, ...Array.from({ length: 6 }, () => Array(COLS).fill(''))];
    host.innerHTML = ''; // StrictMode mounts twice
    const instance = jspreadsheet(host, {
      worksheets: [{ data, minDimensions: [COLS, 8], defaultColWidth: 100 }],
      tabs: false,
      contextMenu: () => false,
      onselection: (_i, col1) => setSelected(parseInt(col1, 10)),
      onchange: (_i, _cell, col, row, value) => {
        if (parseInt(row, 10) === 1 && typeof value === 'string' && value.startsWith('=')) setSources((p) => ({ ...p, [parseInt(col, 10)]: 'formula' }));
      },
    });
    sheetRef.current = instance;
    const sheet = instance[0];
    for (let i = 0; i < COLS; i++) {
      sheet.setStyle(`${colIndexToLetter(i)}1`, 'font-weight', 'bold');
      sheet.setStyle(`${colIndexToLetter(i)}1`, 'background-color', '#f3f0f8');
    }
    return () => {
      try {
        sheetRef.current?.[0]?.destroy();
      } catch {
        // already gone
      }
      host.innerHTML = '';
      sheetRef.current = null;
    };
  }, [initial]);

  const save = () => {
    if (!name.trim()) {
      toast({ title: t('calculator.alertNameRequired') });
      return;
    }
    const sheet = sheetRef.current[0];
    const headers = sheet.getData(false)[0];
    const raw = sheet.options.data[1]; // raw formulas, not evaluated values
    const columns = [];
    headers.forEach((header, c) => {
      if (!header || !String(header).trim()) return;
      const source = sources[c] || 'input';
      columns.push({
        id: initial?.columns?.[c]?.id || `col_${Date.now()}_${c}`,
        name: String(header).trim(),
        source,
        formula: source === 'formula' ? raw[c] : '',
        testValue: source !== 'formula' ? raw[c] : '',
      });
    });
    if (!columns.length) {
      toast({ title: t('calculator.alertColumnRequired') });
      return;
    }
    onSave({ id: initial?.id || `tpl_${Date.now()}`, name: name.trim(), columns, rows: initial?.rows || [] });
  };

  return (
    <div className={s.editor}>
      <Card padding="md" className={s.editorMain}>
        <div className={s.editorHead}>
          <Field label={t('calculator.templateName')} className={s.grow}>
            <Input data-autofocus value={name} placeholder={t('calculator.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div className={s.actions}>
            <Button onClick={onCancel}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={save}>
              {t('calculator.saveTemplate')}
            </Button>
          </div>
        </div>
        <ol className={s.steps}>
          <li>{t('library.boqStep1')}</li>
          <li>
            {t('library.boqStep2')} <code className="ui-ltr">=A2*B2</code>
          </li>
        </ol>
        <div className={s.sheetBox} dir="ltr">
          <div ref={hostRef} />
        </div>
      </Card>
      <Card title={t('calculator.columnSettings')} titleAs="h2" padding="md" className={s.editorSide}>
        {selected === null ? (
          <p className={s.muted}>{t('calculator.selectCellHint')}</p>
        ) : (
          <>
            <p className={s.colLetter}>{t('calculator.columnLetter', { col: colIndexToLetter(selected) })}</p>
            <Field label={t('calculator.dataSource')}>
              <Select value={sources[selected] || 'input'} onChange={(e) => setSources((p) => ({ ...p, [selected]: e.target.value }))}>
                <option value="input">{t('calculator.sourceInput')}</option>
                <option value="design">{t('calculator.sourceDesign')}</option>
                <option value="formula">{t('calculator.sourceFormula')}</option>
              </Select>
            </Field>
            {sources[selected] === 'formula' && (
              <p className={s.notice}>
                <strong>{t('calculator.formulaNoticeTitle')}</strong> {t('calculator.formulaNoticeBody')}
              </p>
            )}
            {sources[selected] === 'design' && (
              <p className={s.notice}>
                <strong>{t('calculator.designNoticeTitle')}</strong> {t('calculator.designNoticeBody')}
              </p>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
