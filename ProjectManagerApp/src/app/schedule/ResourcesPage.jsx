import { AlertTriangle, Eraser, Scale, Undo2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import {
  bucketDaysFor,
  calendarPresetOf,
  equipmentLabel,
  fillResourcesPatches,
  histogramSummary,
  resourceLabel,
  resourceUsage,
  setCrewLimit,
  setEquipmentLimit,
  setLabourLimit,
  toggleTeam,
} from '../../state/resourcesModel.js';
import { logAppEvent } from '../../utils/ActivityLog.js';
import { readLevelLinks } from '../../utils/planning/links.js';
import { clearLeveling, levelResources } from '../../utils/planning/ResourceLeveler.js';
import { capacitiesOf, resourceHistogram } from '../../utils/planning/resources.js';
import { getCalendar, presetCalendar } from '../../utils/planning/WorkCalendar.js';
import { loadWorkTypes, workTypeMap } from '../../utils/planning/WorkTypes.js';
import { Button, Card, Field, IconButton, NumberInput, Select, Table, useToast } from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import { useCan } from '../useCan.js';
import CalendarEditor from './CalendarEditor.jsx';
import ResourceChart from './ResourceChart.jsx';
import s from './Resources.module.css';

const MOVES_SHOWN = 8;

function Kpi({ label, value, tone }) {
  return (
    <div className={s.kpi}>
      <dt>{label}</dt>
      <dd className={tone ? s[tone] : undefined}>{value}</dd>
    </div>
  );
}

/**
 * /schedule/resources — what the project has (crews per trade, people on
 * site, key equipment, People teams as named crews), where the plan asks
 * for more, and leveling: a live preview of the plan fitted to the limits,
 * applied (or cleared) as one undo step. Also the project's working
 * calendar and markups. Limits live in projectMeta.planning.
 */
export default function ResourcesPage() {
  const { t } = useI18n();
  const toast = useToast();
  const { tasks, orders, projectStart, projectMeta, engineResult, registries, identity, applyTaskPatches, setPlanning, undo, canUndo } = useProject();
  const canEdit = useCan()('plan.edit');
  const planning = useMemo(() => projectMeta?.planning || {}, [projectMeta]);
  const resources = useMemo(() => planning.resources || {}, [planning]);
  const caps = useMemo(() => capacitiesOf(resources), [resources]);
  const usage = useMemo(() => resourceUsage(tasks), [tasks]);
  const teams = useMemo(() => registries?.teams || [], [registries]);
  const teamName = (id) => teams.find((x) => x.id === id)?.name || id;

  const preview = useMemo(() => (caps.size ? levelResources(tasks, { projectStart, meta: projectMeta, orders }) : null), [tasks, projectStart, projectMeta, orders, caps]);
  const fillPatches = useMemo(() => fillResourcesPatches(tasks, workTypeMap(loadWorkTypes())), [tasks]);
  const leveledCount = useMemo(() => tasks.filter((x) => readLevelLinks(x).length).length, [tasks]);

  const start = engineResult.scheduleStartDate;
  const end = engineResult.scheduleEndDate;
  const bucketDays = bucketDaysFor(start, end);
  const histogram = useMemo(
    () => resourceHistogram(engineResult.tasks, engineResult.timing, caps, getCalendar(planning.calendar), start, end, bucketDays),
    [engineResult, caps, planning.calendar, start, end, bucketDays]
  );
  const summary = useMemo(() => histogramSummary(histogram), [histogram]);
  const [chosen, setChosen] = useState(null);
  const shown = histogram.find((h) => h.resource === chosen) || histogram.find((h) => h.resource === summary[0]?.resource) || null;
  const shownSummary = summary.find((x) => x.resource === shown?.resource);

  const taskById = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);
  const taskName = (id) => {
    const x = taskById.get(id);
    return x ? `${x.wbs || ''} ${x.name || ''}`.trim() : id;
  };

  const editResources = (fn) => setPlanning((p) => ({ ...p, resources: fn(p.resources || {}) }));
  const equipmentRows = useMemo(() => {
    const used = new Map(usage.equipment.map((e) => [e.type, e]));
    Object.keys(resources.equipment || {}).forEach((type) => used.has(type) || used.set(type, { type, count: 0, max: 0 }));
    return [...used.values()];
  }, [usage, resources]);

  const apply = () => {
    if (!preview) return;
    applyTaskPatches(preview.patches);
    setPlanning({ leveledAt: new Date().toISOString() });
    logAppEvent({
      actor: identity?.name || '',
      kind: 'planning',
      summary: t('schedule.res.loggedLevel', { n: preview.report.moved.length, end: formatDay(preview.report.endAfter) }),
      refType: 'project',
      refId: 'leveling',
    });
    toast({ title: t('schedule.res.applied', { n: preview.report.moved.length }) });
  };
  const clear = () => {
    const { patches, count } = clearLeveling(tasks, { projectStart, meta: projectMeta, orders });
    if (!count) return;
    applyTaskPatches(patches);
    setPlanning({ leveledAt: null });
    logAppEvent({ actor: identity?.name || '', kind: 'planning', summary: t('schedule.res.loggedClear', { n: count }), refType: 'project', refId: 'leveling' });
    toast({ title: t('schedule.res.cleared', { n: count }) });
  };

  const report = preview?.report;
  const shift = report ? Math.round(((report.daysAfter || 0) - (report.daysBefore || 0)) * 10) / 10 : 0;
  const overloadsNow = engineResult.overloads || [];
  const markups = planning.markups;

  return (
    <Page area="schedule">
      <div className={s.stack}>
        <Card title={t('schedule.res.title')} subtitle={t('schedule.res.subtitle')} titleAs="h2" padding="md">
          <dl className={s.kpis}>
            <Kpi label={t('schedule.res.kpiLimits')} value={caps.size ? formatNumber(caps.size) : t('schedule.res.none')} />
            <Kpi label={t('schedule.res.kpiOverloads')} value={formatNumber(overloadsNow.length)} tone={overloadsNow.length ? 'danger' : caps.size ? 'success' : undefined} />
            <Kpi label={t('schedule.res.kpiFinish')} value={formatDay(end)} />
            <Kpi label={t('schedule.res.kpiLeveled')} value={leveledCount ? t('schedule.res.leveledItems', { n: formatNumber(leveledCount) }) : t('schedule.res.notLeveled')} />
          </dl>
          {usage.untraded > 0 && <p className={s.muted}>{t('schedule.res.untraded', { n: formatNumber(usage.untraded) })}</p>}
        </Card>

        <Card title={t('schedule.res.levelTitle')} subtitle={t('schedule.res.levelHint')} titleAs="h2" padding="md">
          {!preview && <p className={s.muted}>{t('schedule.res.needLimits')}</p>}
          {report?.blocked === 'cycle' && (
            <p className={s.alert} role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              {t('schedule.res.blockedCycle')}
            </p>
          )}
          {report && !report.blocked && (
            <>
              <dl className={s.kpis}>
                <Kpi label={t('schedule.res.finishNow')} value={formatDay(report.endBefore)} />
                <Kpi label={t('schedule.res.finishLeveled')} value={formatDay(report.endAfter)} tone={shift > 0 ? 'danger' : undefined} />
                <Kpi label={t('schedule.res.workingDaysShift')} value={shift > 0 ? `+${formatNumber(shift)}` : formatNumber(shift)} />
                <Kpi label={t('schedule.res.itemsMoved')} value={formatNumber(report.moved.length)} />
                <Kpi label={t('schedule.res.crewChanges')} value={formatNumber(report.crewChanges.length)} />
              </dl>
              {preview.patches.length === 0 && <p className={s.muted}>{overloadsNow.length ? t('schedule.res.fixedOnly') : t('schedule.res.alreadyFits')}</p>}
              {report.fixedCount > 0 && <p className={s.muted}>{t('schedule.res.fixedNote', { n: formatNumber(report.fixedCount) })}</p>}
              {report.conflicts.length > 0 && (
                <p className={s.alert}>
                  <AlertTriangle size={16} aria-hidden="true" />
                  {t('schedule.res.tooBig', {
                    list: [...new Set(report.conflicts.map((c) => `${taskName(c.id)} (${resourceLabel(t, c.resource)}: ${formatNumber(c.demand)} / ${formatNumber(c.capacity)})`))].slice(0, 3).join('، '),
                    n: report.conflicts.length,
                  })}
                </p>
              )}
              {report.remaining.length > 0 && (
                <p className={s.alert}>
                  <AlertTriangle size={16} aria-hidden="true" />
                  {t('schedule.res.remaining', { n: formatNumber(report.remaining.length) })}
                </p>
              )}
              {report.moved.length > 0 && (
                <ul className={s.moves} aria-label={t('schedule.res.itemsMoved')}>
                  {report.moved.slice(0, MOVES_SHOWN).map((m) => (
                    <li key={m.id} className={s.move}>
                      <span className={s.moveName}>{taskName(m.id)}</span>
                      <span className={`${s.moveDays} ${m.days > 0 ? s.danger : s.success}`}>{t(m.days > 0 ? 'schedule.res.later' : 'schedule.res.earlier', { n: formatNumber(Math.abs(m.days)) })}</span>
                      <span className={s.moveMeta}>
                        <span className="ui-ltr">{`${formatDay(m.from)} → ${formatDay(m.to)}`}</span>
                        {m.waitsFor.length > 0 && ` · ${t('schedule.res.waitsFor', { list: m.waitsFor.map(taskName).join('، ') })}`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {report.moved.length > MOVES_SHOWN && <p className={s.muted}>{t('schedule.res.moreMoved', { n: formatNumber(report.moved.length - MOVES_SHOWN) })}</p>}
            </>
          )}
          {canEdit && (
            <div className={s.actions}>
              <Button variant="primary" icon={Scale} disabled={!preview || Boolean(report?.blocked) || !preview.patches.length} onClick={apply}>
                {t('schedule.res.apply')}
              </Button>
              <Button icon={Eraser} disabled={!leveledCount && !tasks.some((x) => Array.isArray(x.teamIds))} onClick={clear}>
                {t('schedule.res.clear')}
              </Button>
              <Button icon={Undo2} disabled={!canUndo} onClick={undo}>
                {t('schedule.undo')}
              </Button>
              <span className={s.muted}>{t('schedule.res.undoNote')}</span>
            </div>
          )}
          {planning.leveledAt && <p className={s.muted}>{t('schedule.res.leveledAt', { date: formatDay(planning.leveledAt.slice(0, 10)) })}</p>}
        </Card>

        <fieldset className={s.lockable} disabled={!canEdit}>
          <Card title={t('schedule.res.limitsTitle')} subtitle={t('schedule.res.limitsHint')} titleAs="h2" padding="md">
            {usage.trades.length === 0 ? (
              <p className={s.muted}>{t('schedule.res.noTrades')}</p>
            ) : (
              <Table label={t('schedule.res.limitsTitle')} minWidth={640}>
                <thead>
                  <tr>
                    <th>{t('planning.wiz.trade')}</th>
                    <th className="ui-num">{t('planning.wiz.items')}</th>
                    <th className="ui-num">{t('schedule.res.maxCrews')}</th>
                    <th>{t('schedule.res.crewsAvailable')}</th>
                    <th>{t('schedule.res.teams')}</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.trades.map((row) => {
                    const trade = t(`planning.trade.${row.trade}`);
                    const chosenTeams = resources.teams?.[row.trade] || [];
                    const free = teams.filter((x) => !Object.values(resources.teams || {}).some((ids) => (ids || []).includes(x.id)));
                    return (
                      <tr key={row.trade}>
                        <td>{trade}</td>
                        <td className="ui-num">{formatNumber(row.count)}</td>
                        <td className="ui-num">{formatNumber(row.maxCrews)}</td>
                        <td>
                          <NumberInput
                            size="sm"
                            min="0"
                            className={s.cellInput}
                            aria-label={t('schedule.res.crewsFor', { trade })}
                            placeholder={chosenTeams.length ? t('schedule.res.asTeams', { n: formatNumber(chosenTeams.length) }) : t('schedule.res.unlimited')}
                            value={resources.crews?.[row.trade] ?? ''}
                            onChange={(e) => editResources((r) => setCrewLimit(r, row.trade, e.target.value))}
                          />
                        </td>
                        <td>
                          <div className={s.teams}>
                            {chosenTeams.map((id) => (
                              <span key={id} className={s.chip}>
                                {teamName(id)}
                                {canEdit && <IconButton icon={X} size="sm" label={t('schedule.res.removeTeam', { name: teamName(id) })} onClick={() => editResources((r) => toggleTeam(r, row.trade, id))} />}
                              </span>
                            ))}
                            {free.length > 0 && (
                              <Select aria-label={t('schedule.res.addTeamFor', { trade })} value="" onChange={(e) => e.target.value && editResources((r) => toggleTeam(r, row.trade, e.target.value))}>
                                <option value="">{t('schedule.res.addTeam')}</option>
                                {free.map((x) => (
                                  <option key={x.id} value={x.id}>
                                    {x.name}
                                  </option>
                                ))}
                              </Select>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            )}
            {teams.length === 0 && (
              <p className={s.muted}>
                {t('schedule.res.noTeams')} <a href="#/people/teams">{t('schedule.res.goTeams')}</a>
              </p>
            )}
            <div className={s.row}>
              <Field label={t('schedule.res.labour')} hint={usage.trades.some((r) => r.maxLabour > 0) ? t('schedule.res.labourHint', { n: formatNumber(Math.max(...usage.trades.map((r) => r.maxLabour))) }) : undefined} className={s.grow}>
                <NumberInput min="0" placeholder={t('schedule.res.unlimited')} value={resources.labour ?? ''} onChange={(e) => editResources((r) => setLabourLimit(r, e.target.value))} />
              </Field>
            </div>
            {fillPatches.length > 0 && (
              <div className={s.row}>
                <p className={s.muted}>{t('schedule.res.fillNote', { n: formatNumber(fillPatches.length) })}</p>
                <Button size="sm" onClick={() => applyTaskPatches(fillPatches)}>
                  {t('schedule.res.fill')}
                </Button>
              </div>
            )}
            <div>
              <span className={s.muted}>{t('schedule.res.equipment')}</span>
              {equipmentRows.length === 0 ? (
                <p className={s.muted}>{t('schedule.res.noEquipment')}</p>
              ) : (
                <div className={s.row}>
                  {equipmentRows.map((row) => (
                    <Field key={row.type} label={equipmentLabel(t, row.type)} hint={t('schedule.res.equipmentHint', { n: formatNumber(row.count), max: formatNumber(row.max) })} className={s.narrow}>
                      <NumberInput min="0" placeholder={t('schedule.res.unlimited')} value={resources.equipment?.[row.type] ?? ''} onChange={(e) => editResources((r) => setEquipmentLimit(r, row.type, e.target.value))} />
                    </Field>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </fieldset>

        <Card title={t('schedule.res.chartTitle')} subtitle={t('schedule.res.chartHint')} titleAs="h2" padding="md">
          {histogram.length === 0 ? (
            <p className={s.muted}>{t('schedule.res.chartEmpty')}</p>
          ) : (
            <>
              <div className={s.row}>
                <Field label={t('schedule.res.chartResource')} className={s.grow}>
                  <Select value={shown?.resource || ''} onChange={(e) => setChosen(e.target.value)}>
                    {summary.map((x) => (
                      <option key={x.resource} value={x.resource}>
                        {x.over ? `⚠ ${resourceLabel(t, x.resource)} — ${t('schedule.res.overWeeks', { n: formatNumber(x.over) })}` : resourceLabel(t, x.resource)}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              {shownSummary && (
                <p className={shownSummary.over ? s.alert : s.muted}>
                  {shownSummary.over > 0 && <AlertTriangle size={16} aria-hidden="true" />}
                  {shownSummary.capacity == null
                    ? t('schedule.res.peakUnlimited', { peak: formatNumber(shownSummary.peak) })
                    : shownSummary.over
                      ? t('schedule.res.peakOver', { peak: formatNumber(shownSummary.peak), cap: formatNumber(shownSummary.capacity), n: formatNumber(shownSummary.over) })
                      : t('schedule.res.peakWithin', { peak: formatNumber(shownSummary.peak), cap: formatNumber(shownSummary.capacity) })}
                </p>
              )}
              <ResourceChart key={shown?.resource} series={shown} label={shown ? resourceLabel(t, shown.resource) : ''} bucketDays={bucketDays} />
            </>
          )}
        </Card>

        <fieldset className={s.lockable} disabled={!canEdit}>
          <CalendarEditor
            calendar={planning.calendar}
            preset={calendarPresetOf(planning)}
            note={t('schedule.res.calendarNote')}
            onPreset={(preset) => setPlanning({ calendar: presetCalendar(preset, projectStart), calendarPreset: preset })}
            onChange={(patch) => setPlanning((p) => ({ ...p, calendar: { ...(p.calendar || {}), ...patch }, calendarPreset: 'custom' }))}
          />
        </fieldset>

        <Card title={t('planning.wiz.markupTotal')} titleAs="h2" padding="md">
          {markups ? (
            <dl className={s.kpis}>
              {['overhead', 'contingency', 'profit'].map((k) => (
                <Kpi key={k} label={t(`planning.wiz.markup.${k}`)} value={`${formatNumber(Number(markups[k]) || 0)}%`} />
              ))}
            </dl>
          ) : (
            <p className={s.muted}>{t('schedule.res.noMarkups')}</p>
          )}
          <p className={s.muted}>{t('schedule.res.markupsNote')}</p>
        </Card>
      </div>
    </Page>
  );
}
