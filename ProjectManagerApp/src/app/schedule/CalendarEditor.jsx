import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { addHoliday, addPeriod, removeHoliday, removePeriod, toggleRestDay } from '../../state/plannerModel.js';
import { CALENDAR_PRESETS } from '../../utils/planning/WorkCalendar.js';
import { Button, Card, Field, IconButton, Input, NumberInput, Select } from '../../ui/index.js';
import s from './Resources.module.css';

// UTC weekday numbers, Saturday first (the Iraqi working week).
const WEEK = [6, 0, 1, 2, 3, 4, 5];

/**
 * A project's working calendar: a preset, rest days, holidays and
 * reduced-pace periods (Ramadan). Used by the new-project wizard and the
 * Resources page. onPreset(preset) replaces the calendar with a preset;
 * onChange(patch) merges a change (the calendar becomes "custom").
 */
export default function CalendarEditor({ calendar, preset, onPreset, onChange, note }) {
  const { t, lang } = useI18n();
  const cal = calendar || {};
  const [holiday, setHoliday] = useState({ from: '', to: '', name: '' });
  const [period, setPeriod] = useState({ from: '', to: '', factor: '0.75', name: t('planning.wiz.ramadan') });
  const patch = (p) => p && onChange(p);
  const dayName = (d) => new Intl.DateTimeFormat(lang === 'ar' ? 'ar-IQ' : 'en-GB', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2030, 0, 6 + d)));
  const rest = new Set(cal.weekRest || []);

  return (
    <Card title={t('planning.wiz.calendar')} subtitle={t('planning.wiz.calendarHint')} titleAs="h2" padding="md">
      {note && <p className={s.muted}>{note}</p>}
      <Field label={t('planning.wiz.calendarPreset')}>
        <Select value={preset} onChange={(e) => onPreset(e.target.value)}>
          {CALENDAR_PRESETS.map((p) => (
            <option key={p} value={p}>
              {t(`planning.wiz.preset.${p}`)}
            </option>
          ))}
          {preset === 'custom' && <option value="custom">{t('planning.wiz.preset.custom')}</option>}
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
