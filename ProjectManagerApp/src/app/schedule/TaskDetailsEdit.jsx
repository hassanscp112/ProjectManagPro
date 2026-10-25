import { FileText, Link2, Lock, Plus, Trash2, Unlink } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { fieldLock } from '../../state/scheduleModel.js';
import {
  ELEMENT_STATUSES,
  linkableLeaves,
  newColumn,
  newElement,
  patchColumn,
  patchElement,
  removeColumnPatch,
  setElementValue,
} from '../../state/taskDetailsModel.js';
import { Button, Card, ConfirmDialog, IconButton, Input, NumberInput, Select, StatusBadge, Table, cx } from '../../ui/index.js';
import { lockText } from './lockText.js';
import s from './TaskDetails.module.css';

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`);
const num = (n) => (Number(n) ? formatNumber(n) : '—');

/** Edit view: sub-items, quantity types (with BOQ links) and elements. */
export default function TaskDetailsEdit({ task, columns, elements, sums, children, computedById }) {
  const { t } = useI18n();
  const { projectMeta, updateTask, addSubTask, requestDeleteTask, setBoqLink, linkBoqToExisting } = useProject();
  const [confirm, setConfirm] = useState(null); // { kind: 'column' | 'element', item }
  const isSigned = Boolean(projectMeta.baseline);
  const patchTask = (patch) => updateTask({ ...task, ...patch });
  const linkable = linkableLeaves(children);
  const taskById = new Map(children.map((c) => [c.id, c]));

  const addDefaults = () => {
    const unit = t('taskDetails.unitPlaceholder');
    patchTask({ elementColumns: [...columns, ...['C25', 'C20', 'C7'].map((name) => newColumn(uid(), { name, unit }))] });
  };
  const onConfirm = () => {
    const { kind, item } = confirm;
    if (kind === 'element') {
      patchTask({ elements: elements.filter((el) => el.id !== item.id) });
      return;
    }
    if (item.linkedTaskId) setBoqLink(task.id, item, false);
    patchTask(removeColumnPatch(columns, elements, item.id));
  };

  return (
    <>
      <p className={s.help}>
        <strong>{t('taskDetails.helpTitle')}</strong> {t('taskDetails.helpPre')} <em>{t('taskDetails.helpKey')}</em> {t('taskDetails.helpPost')}
      </p>

      {task.isGroup && (
        <Card
          title={`${t('taskDetails.secChildren')} (${children.length})`}
          titleAs="h2"
          padding="sm"
          actions={
            <Button size="sm" icon={Plus} onClick={() => addSubTask(task.id)}>
              {t('details.addChild')}
            </Button>
          }
        >
          {children.length === 0 ? (
            <p className={s.muted}>{t('taskDetails.childrenEmptyEdit')}</p>
          ) : (
            <Table minWidth={860} label={t('taskDetails.secChildren')}>
              <thead>
                <tr>
                  <th>{t('taskDetails.colCode')}</th>
                  <th>{t('common.name')}</th>
                  <th>{t('common.contractQty')}</th>
                  <th>{t('taskDetails.colExecutedQty')}</th>
                  <th>{t('common.unit')}</th>
                  <th>{t('taskDetails.colUnitPrice')}</th>
                  <th>{t('common.type')}</th>
                  <th aria-label={t('common.actions')} />
                </tr>
              </thead>
              <tbody>
                {children.map((child) => {
                  const c = { ...(computedById.get(child.id) || {}), ...child, boqLinked: Boolean(child.boqLink) };
                  const set = (patch) => updateTask({ ...child, ...patch });
                  const lockOf = (field) => fieldLock(c, field, isSigned);
                  const cell = (field, type = 'number') => {
                    const lock = lockOf(field);
                    if (lock) {
                      const shown = field === 'actualQuantity' ? (computedById.get(child.id) || child).actualQty : child[field];
                      return (
                        <span className={s.locked} title={lockText(t, lock, field)}>
                          {lock === 'boq' || lock === 'orders' ? <Link2 size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                          {type === 'number' ? num(shown) : shown || '—'}
                        </span>
                      );
                    }
                    return type === 'number' ? (
                      <NumberInput aria-label={`${child.wbs} · ${field}`} value={child[field] ?? ''} onChange={(e) => set({ [field]: e.target.value === '' ? '' : Number(e.target.value) })} />
                    ) : (
                      <Input aria-label={`${child.wbs} · ${field}`} value={child[field] || ''} placeholder={t('taskDetails.unitPlaceholder')} onChange={(e) => set({ [field]: e.target.value })} />
                    );
                  };
                  return (
                    <tr key={child.id}>
                      <td className="ui-ltr">{child.wbs}</td>
                      <td>
                        <Input aria-label={t('common.name')} value={child.name || ''} placeholder={t('taskDetails.childNamePlaceholder')} onChange={(e) => set({ name: e.target.value })} />
                      </td>
                      <td>{child.isGroup ? '—' : cell('quantity')}</td>
                      <td>{child.isGroup ? '—' : cell('actualQuantity')}</td>
                      <td>{child.isGroup ? '—' : cell('unit', 'text')}</td>
                      <td>{child.isGroup ? '—' : cell('unitPrice')}</td>
                      <td>
                        <StatusBadge tone={child.boqLink ? 'accent' : 'neutral'} icon={false}>
                          {child.isGroup ? t('taskDetails.typeGroup') : child.boqLink ? 'BOQ' : t('taskDetails.typeManual')}
                        </StatusBadge>
                      </td>
                      <td className={s.rowActions}>
                        {child.isGroup && (
                          <Link to={`/schedule/task/${encodeURIComponent(child.id)}/details`} className={s.iconLink} aria-label={t('taskDetails.openChildDetails')} title={t('taskDetails.openChildDetails')}>
                            <FileText size={16} aria-hidden="true" />
                          </Link>
                        )}
                        <IconButton icon={Trash2} label={t('taskDetails.deleteChild')} size="sm" variant="ghost" onClick={() => requestDeleteTask(child.id)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      <Card
        title={t('taskDetails.secQtyTypes')}
        titleAs="h2"
        padding="sm"
        actions={
          <>
            {columns.length === 0 && (
              <Button size="sm" onClick={addDefaults}>
                {t('details.defaultTypes')}
              </Button>
            )}
            <Button
              size="sm"
              icon={Plus}
              onClick={() => patchTask({ elementColumns: [...columns, newColumn(uid(), { name: t('taskDetails.qtyTypeFallback'), unit: t('taskDetails.unitPlaceholder') })] })}
            >
              {t('details.addType')}
            </Button>
          </>
        }
      >
        {columns.length === 0 ? (
          <p className={s.muted}>{t('details.typesEmpty')}</p>
        ) : (
          <Table minWidth={760} label={t('taskDetails.secQtyTypes')}>
            <thead>
              <tr>
                <th>{t('taskDetails.colQtyType')}</th>
                <th>{t('common.unit')}</th>
                <th>{t('taskDetails.colWaste')}</th>
                <th className="ui-num">{t('taskDetails.colTotalWithWaste')}</th>
                <th>{t('taskDetails.colBoq')}</th>
                <th aria-label={t('common.actions')} />
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => {
                const set = (patch) => patchTask({ elementColumns: patchColumn(columns, col.id, patch) });
                const linked = col.linkedTaskId ? taskById.get(col.linkedTaskId) || computedById.get(col.linkedTaskId) : null;
                const waste = Number(col.wasteFactorPct) || 0;
                return (
                  <tr key={col.id}>
                    <td>
                      <Input aria-label={t('taskDetails.colQtyType')} value={col.name || ''} placeholder={t('taskDetails.namePlaceholder')} onChange={(e) => set({ name: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label={t('common.unit')} className={s.narrow} value={col.unit || ''} onChange={(e) => set({ unit: e.target.value })} />
                    </td>
                    <td>
                      <NumberInput aria-label={t('taskDetails.wasteTitle')} className={s.narrow} min="0" unit="%" value={col.wasteFactorPct ?? 0} onChange={(e) => set({ wasteFactorPct: Number(e.target.value) || 0 })} />
                    </td>
                    <td className="ui-num">
                      <strong>{num((sums[col.id] || 0) * (1 + waste / 100))}</strong>
                      {waste > 0 && <div className={s.muted}>{t('taskDetails.rawLabel', { n: num(sums[col.id]) })}</div>}
                    </td>
                    <td>
                      {!task.isGroup ? (
                        <span className={s.muted}>{t('taskDetails.recordOnly')}</span>
                      ) : col.linkedTaskId ? (
                        <div className={s.boq}>
                          <span>
                            <Link2 size={14} aria-hidden="true" /> {linked ? `${linked.wbs || ''} ${linked.name || ''}` : t('taskDetails.boqLinkedFallback')}
                          </span>
                          <Button size="sm" variant="ghost" icon={Unlink} title={t('taskDetails.unlinkTitle')} onClick={() => setBoqLink(task.id, col, false)}>
                            {t('details.unlink')}
                          </Button>
                        </div>
                      ) : (
                        <div className={s.boq}>
                          <Button size="sm" icon={Plus} title={t('taskDetails.newBoqTitle')} onClick={() => setBoqLink(task.id, col, true)}>
                            {t('details.newBoq')}
                          </Button>
                          {linkable.length > 0 && (
                            <Select aria-label={t('taskDetails.linkExistingTitle')} value="" onChange={(e) => e.target.value && linkBoqToExisting(task.id, col, e.target.value)}>
                              <option value="">{t('details.linkExisting')}</option>
                              {linkable.map((lf) => (
                                <option key={lf.id} value={lf.id}>
                                  {`${lf.wbs || ''} ${lf.name || ''} — ${num(lf.quantity)} ${lf.unit || ''}`}
                                </option>
                              ))}
                            </Select>
                          )}
                        </div>
                      )}
                    </td>
                    <td>
                      <IconButton icon={Trash2} label={t('taskDetails.deleteType')} size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'column', item: col })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <Card
        title={`${t('taskDetails.secElements')} (${elements.length})`}
        titleAs="h2"
        padding="sm"
        actions={
          <Button size="sm" icon={Plus} disabled={columns.length === 0} onClick={() => patchTask({ elements: [...elements, newElement(uid())] })}>
            {t('details.addElement')}
          </Button>
        }
      >
        {columns.length === 0 ? (
          <p className={s.muted}>{t('taskDetails.elementsNeedType')}</p>
        ) : elements.length === 0 ? (
          <p className={s.muted}>{t('details.elementsEmpty')}</p>
        ) : (
          <Table minWidth={620 + columns.length * 110} label={t('taskDetails.secElements')}>
            <thead>
              <tr>
                <th>#</th>
                <th>{t('common.name')}</th>
                <th>{t('taskDetails.locationStation')}</th>
                <th>{t('common.status')}</th>
                {columns.map((c) => (
                  <th key={c.id}>
                    {c.name} {c.unit ? `(${c.unit})` : ''}
                  </th>
                ))}
                <th>{t('common.notes')}</th>
                <th aria-label={t('common.actions')} />
              </tr>
            </thead>
            <tbody>
              {elements.map((el, i) => {
                const set = (patch) => patchTask({ elements: patchElement(elements, el.id, patch) });
                return (
                  <tr key={el.id}>
                    <td className="ui-num">{i + 1}</td>
                    <td>
                      <Input aria-label={t('common.name')} value={el.name || ''} placeholder={t('taskDetails.elementNamePlaceholder')} onChange={(e) => set({ name: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label={t('taskDetails.locationStation')} className="ui-ltr" value={el.location || ''} placeholder="0+250" onChange={(e) => set({ location: e.target.value })} />
                    </td>
                    <td>
                      <Select aria-label={t('common.status')} className={cx(s.status, s[`st_${el.status || 'not_started'}`])} value={el.status || 'not_started'} onChange={(e) => set({ status: e.target.value })}>
                        {ELEMENT_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {t(`taskDetails.status.${st}`)}
                          </option>
                        ))}
                      </Select>
                    </td>
                    {columns.map((c) => (
                      <td key={c.id}>
                        <NumberInput
                          aria-label={`${el.name || i + 1} · ${c.name}`}
                          value={el.values?.[c.id] ?? ''}
                          onChange={(e) => patchTask({ elements: setElementValue(elements, el.id, c.id, e.target.value) })}
                        />
                      </td>
                    ))}
                    <td>
                      <Input aria-label={t('common.notes')} value={el.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
                    </td>
                    <td>
                      <IconButton icon={Trash2} label={t('taskDetails.deleteElement')} size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'element', item: el })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>{t('common.total')}</td>
                {columns.map((c) => (
                  <td key={c.id} className="ui-num">
                    {num(sums[c.id])}
                  </td>
                ))}
                <td colSpan={2} />
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === 'column' ? t('details.deleteTypeTitle') : t('details.deleteElementTitle')}
        message={confirm?.kind === 'column' ? t('taskDetails.confirmDeleteType', { name: confirm.item.name }) : confirm?.item.name || ''}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={onConfirm}
      />
    </>
  );
}
