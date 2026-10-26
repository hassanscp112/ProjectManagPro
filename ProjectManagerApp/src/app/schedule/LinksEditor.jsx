import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { LINK_TYPES, linksPatch, readLinks } from '../../utils/planning/links.js';
import { Button, IconButton, NumberInput, Select } from '../../ui/index.js';
import s from './Schedule.module.css';

const blankRow = () => ({ id: '', type: 'FS', lag: 0 });

/**
 * Every predecessor of one item, one row each: the item it waits for, the
 * link type, the lag and whether the lag counts working or calendar days
 * (curing). Complete rows are saved as they change; a new row is saved once
 * its item is picked. Remount it (key) when the stored links change.
 */
export default function LinksEditor({ task, tasks, onChange }) {
  const { t } = useI18n();
  const [rows, setRows] = useState(() => readLinks(task).map((l) => ({ lagUnit: 'wd', ...l, lag: Number(l.lag) || 0 })));
  const options = tasks.filter((x) => !x.isGroup && x.id !== task.id);

  const update = (next) => {
    setRows(next);
    const complete = next.filter((r) => r.id);
    if (complete.length === next.length) onChange(linksPatch(complete.map((r) => ({ ...r, lagUnit: r.lagUnit === 'cd' ? 'cd' : undefined }))));
  };
  const setRow = (i, patch) => update(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className={s.links}>
      {rows.length === 0 && <p className={s.muted}>{t('schedule.noPredecessor')}</p>}
      {rows.map((row, i) => (
        <div key={i} className={s.linkRow}>
          <Select aria-label={t('gantt.colPredecessor')} className={s.linkTask} value={row.id} onChange={(e) => setRow(i, { id: e.target.value })}>
            <option value="">{t('schedule.chooseItem')}</option>
            {options.map((x) => (
              <option key={x.id} value={x.id} disabled={x.id !== row.id && rows.some((r) => r.id === x.id)}>
                {x.wbs} — {x.name}
              </option>
            ))}
          </Select>
          <Select aria-label={t('gantt.colRelation')} className={s.linkType} value={row.type} onChange={(e) => setRow(i, { type: e.target.value })}>
            {LINK_TYPES.map((d) => (
              <option key={d} value={d}>
                {t(`gantt.dep${d}`)}
              </option>
            ))}
          </Select>
          <NumberInput aria-label={t('schedule.lagDays')} size="sm" className={s.linkLag} value={row.lag} onChange={(e) => setRow(i, { lag: e.target.value })} />
          <Select aria-label={t('schedule.lagUnit')} className={s.linkUnit} value={row.lagUnit === 'cd' ? 'cd' : 'wd'} onChange={(e) => setRow(i, { lagUnit: e.target.value })}>
            <option value="wd">{t('schedule.lagWorkingDays')}</option>
            <option value="cd">{t('schedule.lagCalendarDays')}</option>
          </Select>
          <IconButton icon={Trash2} label={t('schedule.removePredecessor')} size="sm" className={s.linkRemove} onClick={() => update(rows.filter((_, j) => j !== i))} />
        </div>
      ))}
      <div>
        <Button size="sm" icon={Plus} disabled={rows.some((r) => !r.id)} onClick={() => setRows([...rows, blankRow()])}>
          {t('schedule.addPredecessor')}
        </Button>
      </div>
    </div>
  );
}
