import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from '../../../i18n/index.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { addHoliday, addPeriod, groupItems, removeHoliday, removePeriod, toggleRestDay, tradesUsed, workTypesUsed } from '../../../state/plannerModel.js';
import { MAX_CREWS_PER_TASK } from '../../../utils/planning/autoPlan.js';
import { CALENDAR_PRESETS } from '../../../utils/planning/WorkCalendar.js';
import { workTypeName } from '../../../utils/planning/WorkTypes.js';
import { Button, Card, ChipGroup, Field, IconButton, Input, NumberInput, Select, Table } from '../../../ui/index.js';
import { itemLabel, itemLabelWithLevel, levelLabel, linkText, sectionLabel, tradeLabel } from './wizardText.js';
import s from './Wizard.module.css';

// UTC weekday numbers, Saturday first (the Iraqi working week).
const WEEK = [6, 0, 1, 2, 3, 4, 5];

/* ─────────────── calendar, productivity, crews ─────────────── */

function CalendarCard({ state, dispatch }) {
  const { t, lang } = useI18n();
  const cal = state.calendar || {};
  const [holiday, setHoliday] = useState({ from: '', to: '', name: '' });
  const [period, setPeriod] = useState({ from: '', to: '', factor: '0.75', name: t('planning.wiz.ramadan') });
  const patch = (p) => p && dispatch({ type: 'calendar', patch: p });
  const dayName = (d) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ' : 'en-GB', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2030, 0, 6 + d)));
  const rest = new Set(cal.weekRest || []);

  return (
    <Card title={t('planning.wiz.calendar')} subtitle={t('planning.wiz.calendarHint')} titleAs="h2" padding="md">
      <Field label={t('planning.wiz.calendarPreset')}>
        <Select value={state.calendarPreset} onChange={(e) => dispatch({ type: 'calendarPreset', preset: e.target.value })}>
          {CALENDAR_PRESETS.map((p) => (
            <option key={p} value={p}>
              {t(`planning.wiz.preset.${p}`)}
            </option>
          ))}
          {state.calendarPreset === 'custom' && <option value="custom">{t('planning.wiz.preset.custom')}</option>}
        </Select>
      </Field>

      <div>
        <span className={s.muted}>{t('planning.wiz.restDays')}</span>
        <div className={s.days} role="group" aria-label={t('planning.wiz.restDays')}>
          {WEEK.map((d) => (
            <Button key={d} size="sm" variant={rest.has(d) ? 'outline' : 'secondary'} aria-pressed={rest.has(d)} onClick={() => patch(toggleRestDay(cal, d))}>
              {dayName(d)}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <span className={s.muted}>{t('planning.wiz.holidays', { n: (cal.holidays || []).length })}</span>
        <ul className={s.list}>
          {(cal.holidays || []).map((h, i) => (
            <li key={`${h.from}-${i}`} className={s.listRow}>
              <span className="ui-ltr">{h.to && h.to !== h.from ? `${h.from} → ${h.to}` : h.from}</span>
              <span className={s.grow}>{h.name}</span>
              <IconButton icon={Trash2} size="sm" label={t('planning.wiz.removeHoliday')} onClick={() => patch(removeHoliday(cal, i))} />
            </li>
          ))}
        </ul>
        <div className={s.row}>
          <Field label={t('planning.wiz.from')} className={s.grow}>
            <Input type="date" value={holiday.from} onChange={(e) => setHoliday({ ...holiday, from: e.target.value })} />
          </Field>
          <Field label={t('planning.wiz.to')} optional className={s.grow}>
            <Input type="date" value={holiday.to} onChange={(e) => setHoliday({ ...holiday, to: e.target.value })} />
          </Field>
          <Field label={t('planning.wiz.holidayName')} optional className={s.grow}>
            <Input value={holiday.name} onChange={(e) => setHoliday({ ...holiday, name: e.target.value })} />
          </Field>
          <Button
            icon={Plus}
            disabled={!holiday.from}
            onClick={() => {
              patch(addHoliday(cal, holiday));
              setHoliday({ from: '', to: '', name: '' });
            }}
          >
            {t('planning.wiz.addHoliday')}
          </Button>
        </div>
      </div>

      <div>
        <span className={s.muted}>{t('planning.wiz.periods')}</span>
        <ul className={s.list}>
          {(cal.periods || []).map((p, i) => (
            <li key={`${p.from}-${i}`} className={s.listRow}>
              <span className="ui-ltr">{`${p.from} → ${p.to}`}</span>
              <span className={s.grow}>{`${p.name} · ${formatNumber(p.factor * 100)}%`}</span>
              <IconButton icon={Trash2} size="sm" label={t('planning.wiz.removePeriod')} onClick={() => patch(removePeriod(cal, i))} />
            </li>
          ))}
        </ul>
        <div className={s.row}>
          <Field label={t('planning.wiz.from')} className={s.grow}>
            <Input type="date" value={period.from} onChange={(e) => setPeriod({ ...period, from: e.target.value })} />
          </Field>
          <Field label={t('planning.wiz.to')} className={s.grow}>
            <Input type="date" value={period.to} onChange={(e) => setPeriod({ ...period, to: e.target.value })} />
          </Field>
          <Field label={t('planning.wiz.pace')} hint={t('planning.wiz.paceHint')} className={s.narrow}>
            <NumberInput step="0.05" min="0.05" max="1" value={period.factor} onChange={(e) => setPeriod({ ...period, factor: e.target.value })} />
          </Field>
          <Field label={t('planning.wiz.holidayName')} className={s.grow}>
            <Input value={period.name} onChange={(e) => setPeriod({ ...period, name: e.target.value })} />
          </Field>
          <Button
            icon={Plus}
            disabled={!period.from || !period.to}
            onClick={() => {
              const p = addPeriod(cal, period);
              if (p) {
                patch(p);
                setPeriod({ from: '', to: '', factor: '0.75', name: period.name });
              }
            }}
          >
            {t('planning.wiz.addPeriod')}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Calendar, productivity per work type and crews per trade. */
export function StepSchedule({ plan, state, dispatch, workTypes }) {
  const { t, lang } = useI18n();
  const types = useMemo(() => workTypesUsed(plan, state.dropped), [plan, state.dropped]);
  const trades = useMemo(() => tradesUsed(plan, state.dropped), [plan, state.dropped]);
  if (!plan) return null;
  const range = ([a, b]) => (a === b ? formatNumber(a) : `${formatNumber(a)}–${formatNumber(b)}`);

  return (
    <>
      <CalendarCard state={state} dispatch={dispatch} />

      <Card title={t('planning.wiz.crews')} subtitle={t('planning.wiz.crewsHint', { max: MAX_CREWS_PER_TASK })} titleAs="h2" padding="md">
        <Table label={t('planning.wiz.crews')} minWidth={420}>
          <thead>
            <tr>
              <th>{t('planning.wiz.trade')}</th>
              <th className="ui-num">{t('planning.wiz.items')}</th>
              <th>{t('planning.wiz.crewsPerTask')}</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((row) => (
              <tr key={row.trade}>
                <td>{tradeLabel(t, row.trade)}</td>
                <td className="ui-num">{formatNumber(row.count)}</td>
                <td>
                  <Select aria-label={t('planning.wiz.crewsFor', { trade: tradeLabel(t, row.trade) })} value={String(state.crews[row.trade] ?? '')} onChange={(e) => dispatch({ type: 'crews', trade: row.trade, value: e.target.value })}>
                    <option value="">{t('planning.wiz.crewsAuto', { range: range(row.crews) })}</option>
                    {Array.from({ length: MAX_CREWS_PER_TASK }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={String(n)}>
                        {formatNumber(n)}
                      </option>
                    ))}
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card title={t('planning.wiz.productivity')} subtitle={t('planning.wiz.productivityHint')} titleAs="h2" padding="md">
        <Table label={t('planning.wiz.productivity')} minWidth={680}>
          <thead>
            <tr>
              <th>{t('planning.wiz.workType')}</th>
              <th className="ui-num">{t('planning.wiz.totalQty')}</th>
              <th className="ui-num">{t('planning.wiz.perCrewDay')}</th>
              <th className="ui-num">{t('planning.wiz.taskDays')}</th>
            </tr>
          </thead>
          <tbody>
            {types.map((row) => {
              const wt = workTypes.get(row.workTypeId);
              const name = workTypeName(wt, lang) || row.workTypeId;
              return (
                <tr key={row.workTypeId}>
                  <td>
                    {name}
                    <div className={s.muted}>{tradeLabel(t, row.trade)}</div>
                  </td>
                  <td className="ui-num">
                    {formatNumber(Math.round(row.qty * 100) / 100)} {row.unit}
                  </td>
                  <td className="ui-num">
                    {wt?.fixedDays ? (
                      t('planning.wiz.fixedDays', { n: wt.fixedDays })
                    ) : (
                      <NumberInput
                        aria-label={t('planning.wiz.productivityOf', { name })}
                        size="sm"
                        className={s.cellInput}
                        value={state.productivity[row.workTypeId] ?? ''}
                        placeholder={formatNumber(wt?.productivity ?? row.productivity)}
                        unit={row.unit}
                        onChange={(e) => dispatch({ type: 'productivity', workTypeId: row.workTypeId, value: e.target.value })}
                      />
                    )}
                  </td>
                  <td className="ui-num">{t('planning.wiz.daysInTasks', { days: formatNumber(row.days), n: formatNumber(row.count) })}</td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </>
  );
}

/* ─────────────── links ─────────────── */

/** Every item with the items it waits for; each link can be switched off. */
export function StepLinks({ plan, template, state, dispatch, workTypes }) {
  const { t, lang } = useI18n();
  const groups = useMemo(() => groupItems(plan, (key) => sectionLabel(template, key, lang), (level) => levelLabel(level, lang)), [plan, template, lang]);
  const [filter, setFilter] = useState('all');
  if (!plan) return null;
  const byKey = new Map(plan.items.map((it) => [it.key, it]));
  const dropped = new Set(state.dropped);
  const off = new Set(state.disabledLinks);
  const linkCount = plan.items.reduce((n, it) => n + (dropped.has(it.key) || it.leftOut ? 0 : it.links.filter((l) => !dropped.has(l.to)).length), 0);

  return (
    <Card title={t('planning.wiz.step.links')} subtitle={t('planning.wiz.linksHint')} titleAs="h2" padding="md">
      <div className={s.row}>
        <p className={s.muted}>{t('planning.wiz.linksCount', { n: linkCount, off: state.disabledLinks.length })}</p>
        <div className={s.spacer} />
        <ChipGroup
          size="sm"
          label={t('planning.wiz.linksFilter')}
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: t('planning.wiz.linksAll') },
            { value: 'off', label: t('planning.wiz.linksOff') },
          ]}
        />
      </div>
      <div className={s.groups}>
        {groups.map((g, gi) => {
          const rows = g.items.filter((it) => !dropped.has(it.key) && (filter === 'all' || it.links.some((l) => off.has(`${it.key}>${l.to}`))));
          if (!rows.length) return null;
          return (
            <details key={g.key} className={s.group} open={gi < 2 || filter === 'off'}>
              <summary>
                {g.label}
                <span className={s.groupMeta}>{t('planning.wiz.itemsCount', { n: rows.length })}</span>
              </summary>
              <div className={s.groupBody}>
                {rows.map((item) => {
                  const links = item.links.filter((l) => !dropped.has(l.to) && byKey.has(l.to));
                  return (
                    <div key={item.key} className={s.linkItem}>
                      <span className={s.linkName}>{itemLabel(item, workTypes, lang)}</span>
                      {links.length === 0 && <span className={s.muted}>{t('planning.wiz.startsOnStart')}</span>}
                      {links.map((l) => {
                        const target = byKey.get(l.to);
                        const on = !off.has(`${item.key}>${l.to}`);
                        const label = `${itemLabelWithLevel(target, plan, workTypes, lang)} · ${linkText(t, l)}`;
                        return (
                          <button
                            key={l.to}
                            type="button"
                            className={s.chip}
                            aria-pressed={on}
                            title={on ? t('planning.wiz.linkOffTitle') : t('planning.wiz.linkOnTitle')}
                            onClick={() => dispatch({ type: 'link', from: item.key, to: l.to })}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </Card>
  );
}
