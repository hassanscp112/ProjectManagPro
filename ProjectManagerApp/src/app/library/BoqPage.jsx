import { Pencil, Plus, Table2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { addCalcRow, columnTotals, removeCalcRow, renameCalcRow, setCalcCell, upsertCalcTemplate } from '../../state/libraryModel.js';
import { loadCalcTemplates, saveCalcTemplates } from '../../utils/CalculatorTemplates.js';
import { Button, Card, ConfirmDialog, EmptyState, IconButton, Input, ListRow, Table, cx } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import BoqTemplateEditor from './BoqTemplateEditor.jsx';
import s from './Library.module.css';

const fixed2 = (v) => formatNumber(Math.round((parseFloat(v) || 0) * 100) / 100);

/** One grid: a row per element, input cells, computed formula cells, totals. */
function BoqGrid({ template, onChange }) {
  const { t } = useI18n();
  const totals = useMemo(() => columnTotals(template), [template]);
  return (
    <>
      <Table minWidth={Math.max(480, 200 + template.columns.length * 130)} label={template.name}>
        <thead>
          <tr>
            <th>{t('calculator.nameRefHeader')}</th>
            {template.columns.map((c) => (
              <th key={c.id} className="ui-num" title={c.source === 'formula' ? c.formula : undefined}>
                {c.name}
                {c.source === 'formula' && <span className={s.fx}>ƒ</span>}
              </th>
            ))}
            <th aria-label={t('common.actions')} />
          </tr>
        </thead>
        <tbody>
          {template.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <Input aria-label={t('calculator.rowNamePlaceholder')} value={row.name || ''} placeholder={t('calculator.rowNamePlaceholder')} onChange={(e) => onChange(renameCalcRow(template, row.id, e.target.value))} />
              </td>
              {template.columns.map((c) => (
                <td key={c.id} className="ui-num">
                  {c.source === 'formula' ? (
                    <span className={s.computed}>{fixed2(row.values[c.id])}</span>
                  ) : (
                    <Input
                      type="number"
                      inputMode="decimal"
                      aria-label={`${row.name} · ${c.name}`}
                      className={cx(s.cellInput, c.source === 'design' && s.designCell)}
                      value={row.values[c.id] ?? ''}
                      placeholder={c.source === 'design' ? t('calculator.designPlaceholder') : undefined}
                      onChange={(e) => onChange(setCalcCell(template, row.id, c.id, e.target.value))}
                    />
                  )}
                </td>
              ))}
              <td>
                <IconButton icon={Trash2} label={t('common.delete')} size="sm" variant="ghost" onClick={() => onChange(removeCalcRow(template, row.id))} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>{t('calculator.grandTotal')}</td>
            {template.columns.map((c) => (
              <td key={c.id} className="ui-num">
                {fixed2(totals[c.id])}
              </td>
            ))}
            <td />
          </tr>
        </tfoot>
      </Table>
      <div>
        <Button icon={Plus} onClick={() => onChange(addCalcRow(template, { id: `row_${Date.now()}`, name: t('calculator.defaultRowName', { n: template.rows.length + 1 }) }))}>
          {t('library.addRow')}
        </Button>
      </div>
    </>
  );
}

/**
 * /library/boq — quantity take-off grids: pick or create a grid, fill its
 * rows (formula columns compute themselves), edit its columns in the
 * spreadsheet editor. The open grid is kept in the URL (?grid=id).
 * Storage: utils/CalculatorTemplates.js.
 */
export default function BoqPage() {
  const { t } = useI18n();
  const [templates, setTemplates] = useState(loadCalcTemplates);
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null); // null | 'new' | template
  const [toDelete, setToDelete] = useState(null);
  const activeId = params.get('grid') || templates[0]?.id || null;
  const active = templates.find((x) => x.id === activeId) || null;
  const open = (id) => setParams(id ? { grid: id } : {}, { replace: true });

  useEffect(() => saveCalcTemplates(templates), [templates]);

  const update = (tpl) => setTemplates((list) => upsertCalcTemplate(list, tpl));

  if (editing) {
    return (
      <Page area="library">
        <BoqTemplateEditor
          initial={editing === 'new' ? null : editing}
          onCancel={() => setEditing(null)}
          onSave={(tpl) => {
            update(tpl);
            open(tpl.id);
            setEditing(null);
          }}
        />
      </Page>
    );
  }

  return (
    <Page area="library">
      <div className={s.split}>
        <Card
          title={t('calculator.title')}
          titleAs="h2"
          padding="sm"
          actions={<IconButton icon={Plus} label={t('calculator.addTemplateTitle')} variant="secondary" onClick={() => setEditing('new')} />}
          className={s.listCard}
        >
          {templates.length === 0 ? (
            <p className={s.muted}>{t('calculator.noTemplates')}</p>
          ) : (
            <ul className={s.list}>
              {templates.map((tpl) => (
                <li key={tpl.id}>
                  <ListRow
                    flush
                    onClick={() => open(tpl.id)}
                    aria-current={tpl.id === activeId ? 'true' : undefined}
                    className={cx(tpl.id === activeId && s.current)}
                    leading={<Table2 size={18} aria-hidden="true" />}
                    title={tpl.name}
                    subtitle={t('library.gridMeta', { cols: tpl.columns.length, rows: tpl.rows.length })}
                  />
                </li>
              ))}
            </ul>
          )}
        </Card>

        {active ? (
          <Card
            title={active.name}
            titleAs="h2"
            padding="md"
            className={s.main}
            actions={
              <>
                <Button size="sm" icon={Pencil} onClick={() => setEditing(active)}>
                  {t('library.editColumns')}
                </Button>
                <IconButton icon={Trash2} label={t('calculator.deleteTemplate')} variant="ghost" onClick={() => setToDelete(active)} />
              </>
            }
          >
            <BoqGrid template={active} onChange={update} />
          </Card>
        ) : (
          <EmptyState
            icon={Table2}
            title={t('calculator.emptyPrompt')}
            action={
              <Button variant="primary" icon={Plus} onClick={() => setEditing('new')}>
                {t('library.newGrid')}
              </Button>
            }
          />
        )}
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('library.deleteGridTitle')}
        message={toDelete?.name}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={() => {
          setTemplates((list) => list.filter((x) => x.id !== toDelete.id));
          if (activeId === toDelete.id) open(null);
        }}
      />
    </Page>
  );
}
