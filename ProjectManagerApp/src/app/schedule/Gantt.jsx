import { ChevronDown, ChevronRight, Link2, Lock, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { forwardRef, useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { ZOOM_DAY_WIDTH, daysBetween, fieldLock, headerTiers } from '../../state/scheduleModel.js';
import { formatLinks, linksPatch, parseLinks, readLinks } from '../../utils/planning/links.js';
import { Button, IconButton, cx } from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import s from './Gantt.module.css';
import { lockText } from './lockText.js';
import { warningsTitle } from './warningText.js';

const COLS = {
  schedule: [
    { key: 'duration', head: 'gantt.colDays', className: s.cDur, field: 'duration', type: 'number' },
    { key: 'start', head: 'gantt.colStart', className: s.cDate },
    { key: 'end', head: 'gantt.colEnd', className: s.cDate },
    // Predecessors only while editing (the side panel shows them otherwise),
    // so the timeline keeps room on normal screens. One text cell holds
    // every link: "2.1FS+3; 2.4SS".
    { key: 'links', head: 'gantt.colPredecessors', className: s.cPred, editOnly: true },
  ],
  quantities: [
    { key: 'qty', head: 'common.quantity', className: s.cQty, field: 'quantity', type: 'number' },
    { key: 'exec', head: 'common.executed', className: s.cQty, field: 'actualQuantity', type: 'number' },
    { key: 'unit', head: 'common.unit', className: s.cUnit, field: 'unit', type: 'text' },
    { key: 'price', head: 'common.price', className: s.cPrice, field: 'unitPrice', type: 'number' },
    { key: 'amount', head: 'gantt.colAmount', className: s.cAmt },
  ],
};

// Calendar days a bar covers (durations are working days; days off widen the bar).
const barDays = (task) => (Number.isFinite(task.spanDays) ? task.spanDays : Number(task.duration) || 0);

const num = (n) => (n === 0 || n === null || n === undefined || n === '' ? '—' : formatNumber(n));
const pct = (p) => `${(Math.min(1, Math.max(0, p || 0)) * 100).toFixed(1)}%`;

/**
 * Gantt: item grid (sticky at the reading start) + day-based timeline.
 * rows come from scheduleModel.visibleRows. In edit mode the grid cells are
 * inputs, with the same locks as before (shown with a lock / link icon).
 */
const Gantt = forwardRef(function Gantt(
  { rows, range, zoom, cols, today, editMode, isSigned, selectedId, dependencyOptions, taskById, onSelect, onToggle, onUpdate, onAddSub, onDelete, onAddMain },
  todayRef
) {
  const { t, lang } = useI18n();
  const dayWidth = ZOOM_DAY_WIDTH[zoom] || ZOOM_DAY_WIDTH.month;
  const timelineWidth = range.days * dayWidth;
  const columns = (COLS[cols] || COLS.schedule).filter((c) => editMode || !c.editOnly);

  const tiers = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ-u-nu-latn' : 'en-GB', { month: zoom === 'week' ? 'long' : 'short', timeZone: 'UTC' });
    return headerTiers(range.start, range.days, zoom, (d) => fmt.format(d));
  }, [range.start, range.days, zoom, lang]);

  const offset = (date) => (date ? daysBetween(range.start, date) * dayWidth : 0);
  const todayOffset = offset(today);

  // Edits send only the changed fields; the page merges them onto the stored task.
  const set = (task, field, value) => onUpdate(task.id, { [field]: value });

  const renderLocked = (task, field, lock, display) => (
    <span className={s.locked} title={lockText(t, lock, field)}>
      {lock === 'boq' || lock === 'orders' ? <Link2 size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
      {display}
    </span>
  );

  const renderCell = (col, task) => {
    const editable = editMode && !task.isGroup;
    switch (col.key) {
      case 'start': {
        const lock = fieldLock(task, 'manualStart', isSigned);
        if (editable && !lock) {
          return <input className={s.cellInput} type="date" aria-label={t('gantt.colStart')} value={task.manualStart || ''} onChange={(e) => set(task, 'manualStart', e.target.value)} />;
        }
        return <span className="ui-ltr">{formatDay(task.startDate)}</span>;
      }
      case 'end':
        return <span className="ui-ltr">{formatDay(task.endDate)}</span>;
      case 'links':
        if (task.isGroup) return <span className={s.dim}>—</span>;
        if (!editable) return <span className={s.dim}>—</span>;
        return <LinksInput task={task} dependencyOptions={dependencyOptions} taskById={taskById} onUpdate={onUpdate} />;
      case 'amount':
        return num(task.totalCost);
      default: {
        // Plain field columns: duration, lag, quantity, executed, unit, price.
        if (task.isGroup) return col.key === 'duration' ? <span className={s.dim}>{task.duration}</span> : <span className={s.dim}>—</span>;
        const lock = fieldLock(task, col.field, isSigned);
        const value =
          col.key === 'exec' ? task.actualQty ?? task.actualQuantity : col.key === 'qty' ? task.quantity : task[col.field];
        const shown = col.type === 'number' ? num(value) : value || '—';
        if (!editMode) return shown;
        if (lock && lock !== 'noDependency') return renderLocked(task, col.field, lock, shown);
        return (
          <input
            className={s.cellInput}
            type={col.type === 'number' ? 'number' : 'text'}
            aria-label={t(col.head)}
            value={(col.key === 'exec' ? task.actualQuantity : task[col.field]) ?? ''}
            disabled={lock === 'noDependency'}
            onChange={(e) => set(task, col.field, e.target.value)}
          />
        );
      }
    }
  };

  return (
    <div className={s.scroller} role="table" aria-label={t('schedule.gridLabel')}>
      <div className={s.inner}>
        <div className={s.headRow} role="row">
          <div className={s.gridPart}>
            <div role="columnheader" className={cx(s.cell, s.headCell, s.cWbs)}>{t('gantt.colId')}</div>
            <div role="columnheader" className={cx(s.cell, s.headCell, s.cName)}>{t('gantt.colItem')}</div>
            <div role="columnheader" className={cx(s.cell, s.headCell, s.cPct, s.num)}>{t('gantt.colProgress')}</div>
            {columns.map((col) => (
              <div key={col.key} role="columnheader" className={cx(s.cell, s.headCell, col.className, s.optional)}>
                {t(col.head)}
              </div>
            ))}
          </div>
          <div className={cx(s.timePart, s.tiers)} style={{ width: timelineWidth }} aria-hidden="true">
            {[tiers.top, tiers.bottom].map((tier, i) => (
              <div key={i} className={s.tier}>
                {tier.map((span) => (
                  <div key={span.key} className={s.tierCell} style={{ width: span.days * dayWidth }} title={span.label}>
                    {span.label}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {rows.map(({ task, depth, hasChildren, collapsed }) => {
          const selected = task.id === selectedId;
          const name = task.name || '—';
          return (
            <div key={task.id} role="row" className={cx(s.row, task.isGroup && s.groupRow, selected && s.selected)}>
              <div className={s.gridPart}>
                <div role="cell" className={cx(s.cell, s.cWbs)}>
                  {editMode ? (
                    <input className={s.cellInput} aria-label={t('gantt.colId')} value={task.wbs || ''} onChange={(e) => set(task, 'wbs', e.target.value)} />
                  ) : (
                    <span className="ui-ltr">{task.wbs}</span>
                  )}
                </div>
                <div role="cell" className={cx(s.cell, s.cName)}>
                  <div className={s.nameWrap} style={{ paddingInlineStart: depth * 14 }}>
                    {hasChildren ? (
                      <button
                        type="button"
                        className={s.toggle}
                        aria-expanded={!collapsed}
                        aria-label={t(collapsed ? 'schedule.expand' : 'schedule.collapse', { name })}
                        onClick={() => onToggle(task)}
                      >
                        {collapsed ? <ChevronRight size={16} className="ui-flip-rtl" aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
                      </button>
                    ) : (
                      <span className={s.togglePad} />
                    )}
                    {task.isCritical && !task.isGroup && <span className={s.critDot} title={t('gantt.onCriticalPath')} />}
                    {task.warnings?.length > 0 && (
                      <span className={s.warn} title={warningsTitle(t, task.warnings)} role="img" aria-label={t('schedule.warningsCount', { n: task.warnings.length })}>
                        <TriangleAlert size={14} aria-hidden="true" />
                      </span>
                    )}
                    {editMode ? (
                      <>
                        <input className={s.cellInput} aria-label={t('gantt.colItem')} value={task.name || ''} onChange={(e) => set(task, 'name', e.target.value)} />
                        {task.isGroup && <IconButton icon={Plus} label={t('schedule.addSubItem')} size="sm" onClick={() => onAddSub(task.id)} />}
                        <IconButton icon={Trash2} label={t('schedule.deleteItem')} size="sm" onClick={() => onDelete(task.id)} />
                      </>
                    ) : (
                      <button type="button" className={s.nameButton} title={name} aria-label={t('schedule.openItem', { name: `${task.wbs || ''} ${name}` })} onClick={() => onSelect(task)}>
                        {name}
                      </button>
                    )}
                  </div>
                </div>
                <div role="cell" className={cx(s.cell, s.cPct, s.num)}>
                  <span className={s.pct}>{pct(task.progress)}</span>
                </div>
                {columns.map((col) => (
                  <div key={col.key} role="cell" className={cx(s.cell, col.className, s.optional, (col.type === 'number' || col.key === 'amount') && s.num)}>
                    {renderCell(col, task)}
                  </div>
                ))}
              </div>
              <div className={s.timePart} style={{ width: timelineWidth }} aria-hidden="true">
                {task.startDate &&
                  (task.isGroup ? (
                    <div className={s.groupBar} style={{ insetInlineStart: offset(task.startDate), width: Math.max(dayWidth, barDays(task) * dayWidth) }} />
                  ) : (
                    <div
                      className={cx(s.bar, task.isCritical && s.barCritical)}
                      style={{ insetInlineStart: offset(task.startDate), width: Math.max(dayWidth * 2, barDays(task) * dayWidth) }}
                      title={`${name}\n${pct(task.progress)} · ${formatDay(task.startDate)} → ${formatDay(task.endDate)}`}
                    >
                      <div className={s.barFill} style={{ width: pct(task.progress) }} />
                      {task.plannedProgress > 0 && task.plannedProgress < 1 && <div className={s.barPlanned} style={{ insetInlineStart: pct(task.plannedProgress) }} />}
                    </div>
                  ))}
              </div>
            </div>
          );
        })}

        {editMode && (
          <div className={s.addRow}>
            <Button size="sm" icon={Plus} onClick={onAddMain}>
              {t('gantt.addMainGroup')}
            </Button>
          </div>
        )}

        {/* Month / week lines and the today marker, drawn once under the bars */}
        <TimelineOverlay tiers={tiers.bottom} dayWidth={dayWidth} todayOffset={todayOffset} todayRef={todayRef} timelineWidth={timelineWidth} />
      </div>
    </div>
  );
});

/**
 * Every predecessor of a task as one text cell ("2.1FS+3; 2.4SS; 3.2FF-2d"):
 * WBS, link type (FS when left out), lag in working days (a trailing d =
 * calendar days). Applied on Enter / leaving the cell; text that names no
 * item keeps the cell open and red.
 */
function LinksInput({ task, dependencyOptions, taskById, onUpdate }) {
  const { t } = useI18n();
  const links = task.links || readLinks(task);
  const wbsOf = (id) => taskById.get(id)?.wbs || '';
  const shown = formatLinks(links, wbsOf);
  const [draft, setDraft] = useState(null);
  const [errors, setErrors] = useState([]);
  const idOf = (wbs) => dependencyOptions.find((d) => d.wbs === wbs && d.id !== task.id)?.id || null;

  const commit = () => {
    if (draft === null) return;
    const parsed = parseLinks(draft, idOf);
    setErrors(parsed.errors);
    if (parsed.errors.length) return;
    setDraft(null);
    if (formatLinks(parsed.links, wbsOf) !== shown) onUpdate(task.id, linksPatch(parsed.links));
  };

  return (
    <input
      className={cx(s.cellInput, errors.length > 0 && s.cellInvalid)}
      aria-label={t('gantt.colPredecessors')}
      aria-invalid={errors.length > 0 || undefined}
      title={errors.length ? t('gantt.linksInvalid', { items: errors.join('، ') }) : t('gantt.linksHelp')}
      placeholder={t('gantt.noDependency')}
      dir="ltr"
      value={draft ?? shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') {
          setDraft(null);
          setErrors([]);
        }
      }}
    />
  );
}

/**
 * Vertical lines + today marker, drawn once under the bars. The table is
 * exactly as wide as its content, so the timeline always ends at the
 * inline end of .inner and the overlay can anchor there.
 */
function TimelineOverlay({ tiers, dayWidth, todayOffset, todayRef, timelineWidth }) {
  return (
    <div className={s.lines} style={{ insetInlineEnd: 0, width: timelineWidth }} aria-hidden="true">
      {tiers.map((span) => (
        <div key={span.key} className={s.line} style={{ width: span.days * dayWidth }} />
      ))}
      {todayOffset >= 0 && todayOffset <= timelineWidth && <div ref={todayRef} className={s.todayLine} style={{ insetInlineStart: todayOffset }} />}
    </div>
  );
}

export default Gantt;
