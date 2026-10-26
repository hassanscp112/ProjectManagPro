import { useMemo, useState } from 'react';
import { compactCurrency, formatNumber } from '../../../i18n/index.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { reviewWarnings } from '../../../state/plannerModel.js';
import { timelineRange, visibleRows } from '../../../state/scheduleModel.js';
import { todayStr } from '../../../utils/OrderEngine.js';
import { Card, Segmented } from '../../../ui/index.js';
import { formatDay } from '../../record/orderMeta.js';
import Gantt from '../../schedule/Gantt.jsx';
import s from './Wizard.module.css';

const noop = () => {};

/** The generated schedule, read-only (collapsible groups, zoom). */
export function GanttPreview({ tasks, startDate }) {
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [zoom, setZoom] = useState('month');
  const today = todayStr();
  const rows = useMemo(() => visibleRows(tasks, { collapsed }), [tasks, collapsed]);
  const range = useMemo(() => timelineRange(tasks, startDate, today), [tasks, startDate, today]);
  const taskById = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);
  const toggle = (task) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(task.id)) next.delete(task.id);
      else next.add(task.id);
      return next;
    });

  return (
    <div className={s.body}>
      <Segmented
        label={t('schedule.zoom')}
        value={zoom}
        onChange={setZoom}
        options={[
          { value: 'week', label: t('schedule.zoomWeek') },
          { value: 'month', label: t('schedule.zoomMonth') },
          { value: 'quarter', label: t('schedule.zoomQuarter') },
        ]}
      />
      <div className={s.gantt}>
        <Gantt
          rows={rows}
          range={range}
          zoom={zoom}
          cols="schedule"
          today={today}
          editMode={false}
          isSigned={false}
          selectedId={null}
          dependencyOptions={[]}
          taskById={taskById}
          onSelect={noop}
          onToggle={toggle}
          onUpdate={noop}
          onAddSub={noop}
          onDelete={noop}
          onAddMain={noop}
        />
      </div>
    </div>
  );
}

const warningText = (t, w) => {
  const names = w.names && w.names.length ? ` (${w.names.join('، ')}${w.count > w.names.length ? '…' : ''})` : '';
  switch (w.code) {
    case 'unpriced':
    case 'noProductivity':
    case 'engine':
    case 'calendar':
      return `${t(`planning.wiz.warn.${w.code}`, { n: w.count })}${names}`;
    case 'longTasks':
      return `${t('planning.wiz.warn.longTasks', { n: w.count, days: w.params.days })}${names}`;
    case 'formula':
      return t('planning.wiz.warn.formula', { element: w.params.elementKey });
    case 'unknownLink':
      return t('planning.wiz.warn.unknownLink', { element: w.params.elementKey, to: w.params.to });
    case 'unknownWorkType':
      return t('planning.wiz.warn.unknownWorkType', { id: w.params.workTypeId });
    default:
      return w.code;
  }
};

/**
 * Review before creating a building plan: headline figures, what to look
 * at, and the schedule itself (engine result on the chosen calendar).
 */
export function StepReview({ plan, engine, startDate }) {
  const { t, lang } = useI18n();
  if (!plan || !engine) return null;
  const warnings = reviewWarnings(plan, engine);
  const leaves = engine.tasks.filter((x) => !x.isGroup);

  return (
    <>
      <Card title={t('planning.wiz.step.review')} subtitle={t('planning.wiz.reviewHint')} titleAs="h2" padding="md">
        <dl className={s.figures}>
          {[
            ['planning.wiz.contractValue', compactCurrency(plan.stats.totalCost, lang)],
            ['planning.wiz.directCost', compactCurrency(plan.stats.directCost, lang)],
            ['planning.wiz.start', formatDay(engine.scheduleStartDate)],
            ['planning.wiz.finish', formatDay(engine.scheduleEndDate)],
            ['planning.wiz.duration', t('planning.wiz.durationValue', { days: formatNumber(engine.projectDuration), work: formatNumber(Math.round(engine.projectWorkingDays)) })],
            ['planning.wiz.items', formatNumber(leaves.length)],
            ['planning.wiz.critical', formatNumber(leaves.filter((x) => x.isCritical).length)],
          ].map(([k, v]) => (
            <div key={k} className={s.figure}>
              <dt>{t(k)}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        {warnings.length ? (
          <ul className={s.warnings}>
            {warnings.map((w, i) => (
              <li key={i}>{warningText(t, w)}</li>
            ))}
          </ul>
        ) : (
          <p className={s.ok}>{t('planning.wiz.noWarnings')}</p>
        )}
      </Card>
      <Card title={t('planning.wiz.schedulePreview')} titleAs="h2" padding="md">
        <GanttPreview tasks={engine.tasks} startDate={startDate} />
      </Card>
    </>
  );
}
