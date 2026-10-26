import { CloudRain, Copy, ListChecks, Pencil, Plus, Sun, ThermometerSun, Trash2, Wind } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { copyDiaryDay, diaryDraft, diaryTotals, equipmentSuggestions, manpowerFromPlan, previousDiaryDay, tradeSuggestions } from '../../state/diaryModel.js';
import { getDayPlans, loadPlans } from '../../utils/PlanningStore.js';
import { WEATHER_KINDS, createDiaryRowId, isDiaryDayEmpty } from '../../utils/SiteDiary.js';
import { Button, Card, ChipGroup, Drawer, Field, IconButton, Input, NumberInput, Textarea, cx, useToast } from '../../ui/index.js';
import { HistoryStamps } from '../../ui/HistoryStamps.jsx';
import { useLastChange } from '../history/useLastChange.js';
import { formatDay } from '../record/orderMeta.js';
import { SheetSection } from './ReportSheet.jsx';
import d from './Diary.module.css';
import s from './Reports.module.css';

const WEATHER_ICONS = { sunny: Sun, dusty: Wind, rain: CloudRain, heat: ThermometerSun };

const TRADE_KEYS = ['mason', 'carpenter', 'steelFixer', 'labourer', 'operator', 'driver', 'foreman', 'surveyor', 'electrician', 'guard'];
const EQUIP_KEYS = ['excavator', 'loader', 'bulldozer', 'grader', 'roller', 'dumpTruck', 'waterTanker', 'mixer', 'concretePump', 'crane', 'generator', 'compressor'];

const tradeLabel = (trade, t) => trade || t('diary.tradeGeneral');

/** Weather, temperature and hours as one line of figures. */
function Conditions({ entry }) {
  const { t } = useI18n();
  const Icon = WEATHER_ICONS[entry.weather];
  return (
    <dl className={s.figures}>
      <div className={s.figure}>
        <dt>{t('diary.weather')}</dt>
        <dd className={d.weather}>
          {Icon && <Icon size={16} aria-hidden="true" />}
          {entry.weather ? t(`diary.weather.${entry.weather}`) : '—'}
        </dd>
      </div>
      <div className={s.figure}>
        <dt>{t('diary.maxTemp')}</dt>
        <dd>{entry.maxTemp === null || entry.maxTemp === undefined ? '—' : `${formatNumber(entry.maxTemp)} ${t('diary.celsius')}`}</dd>
      </div>
      <div className={s.figure}>
        <dt>{t('diary.hours')}</dt>
        <dd>{entry.hours === null || entry.hours === undefined ? '—' : `${formatNumber(entry.hours)} ${t('diary.hoursUnit')}`}</dd>
      </div>
    </dl>
  );
}

/** A two-column count table (manpower by trade, equipment by type) with its total. */
function CountTable({ title, colLabel, rows, label, total }) {
  const { t } = useI18n();
  return (
    <div className={d.countBlock}>
      <h4 className={d.subTitle}>{title}</h4>
      {rows.length === 0 ? (
        <p className={s.muted}>—</p>
      ) : (
        <table className={s.table}>
          <thead>
            <tr>
              <th>{colLabel}</th>
              <th className={s.num}>{t('diary.count')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{label(r)}</td>
                <td className={s.num}>{r.count ? formatNumber(r.count) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>{t('common.total')}</td>
              <td className={s.num}>{formatNumber(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );
}

/**
 * The diary's first part in a day of the daily report: weather, hours,
 * manpower by trade, equipment on site. `showEmpty` prints a line when
 * the day has no diary (single-day view).
 */
export function DiaryConditions({ entry, showEmpty }) {
  const { t } = useI18n();
  if (!entry || isDiaryDayEmpty(entry)) {
    return showEmpty ? (
      <SheetSection title={t('diary.title')}>
        <p className={s.muted}>{t('diary.noDiary')}</p>
      </SheetSection>
    ) : null;
  }
  const totals = diaryTotals(entry);
  return (
    <SheetSection title={t('diary.title')} aside={<HistoryStamps record={entry} time={false} className={s.tag} />}>
      <Conditions entry={entry} />
      <div className={d.counts}>
        <CountTable title={t('diary.manpower')} colLabel={t('diary.trade')} rows={entry.manpower} label={(r) => tradeLabel(r.trade, t)} total={totals.workers} />
        <CountTable title={t('diary.equipment')} colLabel={t('diary.equipType')} rows={entry.equipment} label={(r) => r.type || '—'} total={totals.equipment} />
      </div>
    </SheetSection>
  );
}

/** The diary's second part: visitors and issues (after the work done). */
export function DiaryRemarks({ entry }) {
  const { t } = useI18n();
  if (!entry || (!entry.visitors?.length && !entry.issues)) return null;
  return (
    <>
      {entry.visitors?.length > 0 && (
        <SheetSection title={t('diary.visitors')}>
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('diary.visitorName')}</th>
                  <th>{t('diary.visitorOrg')}</th>
                  <th>{t('diary.visitorPurpose')}</th>
                </tr>
              </thead>
              <tbody>
                {entry.visitors.map((v) => (
                  <tr key={v.id}>
                    <td>{v.name || '—'}</td>
                    <td>{v.org || '—'}</td>
                    <td>{v.purpose || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SheetSection>
      )}
      {entry.issues && (
        <SheetSection title={t('diary.issues')}>
          <p className={d.issues}>{entry.issues}</p>
        </SheetSection>
      )}
    </>
  );
}

/* ─────────────── editor ─────────────── */

/** A labelled chip group (single choice) in a form; `hint` goes under it. */
export function ChoiceField({ label, hint, value, onChange, options }) {
  return (
    <div className={d.choice}>
      <span className={d.choiceLabel}>{label}</span>
      <ChipGroup label={label} value={value} onChange={onChange} options={options} size="sm" />
      {hint && <p className={d.choiceHint}>{hint}</p>}
    </div>
  );
}

const updateRow = (rows, id, patch) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
const countValue = (v) => (v === 0 || v === null || v === undefined ? '' : v);

/** Editable rows: one text field + a count, or several text fields (visitors). */
function RowsEditor({ title, rows, fields, onChange, addLabel, blank }) {
  const { t } = useI18n();
  return (
    <fieldset className={d.rows}>
      <legend className={d.legend}>{title}</legend>
      {rows.map((r) => (
        <div key={r.id} className={cx(d.row, fields.length > 2 && d.rowWide)}>
          {fields.map((f) =>
            f.kind === 'count' ? (
              <NumberInput
                key={f.key}
                aria-label={f.label}
                className={d.countInput}
                min={0}
                step={1}
                inputMode="numeric"
                value={countValue(r[f.key])}
                onChange={(e) => onChange(updateRow(rows, r.id, { [f.key]: e.target.value }))}
              />
            ) : (
              <Input
                key={f.key}
                aria-label={f.label}
                placeholder={f.placeholder || f.label}
                list={f.list}
                value={r[f.key] || ''}
                onChange={(e) => onChange(updateRow(rows, r.id, { [f.key]: e.target.value }))}
              />
            )
          )}
          <IconButton icon={Trash2} label={t('diary.removeRow')} size="sm" onClick={() => onChange(rows.filter((x) => x.id !== r.id))} />
        </div>
      ))}
      <Button size="sm" variant="ghost" icon={Plus} className={d.addRow} onClick={() => onChange([...rows, { id: createDiaryRowId(), ...blank }])}>
        {addLabel}
      </Button>
    </fieldset>
  );
}

/**
 * The diary of one day in a drawer (a bottom sheet on phones). Opens with
 * the saved day, else manpower prefilled from the day plan; "Same as
 * yesterday" copies the last recorded day; "From the day plan" refills
 * the manpower.
 */
function DiaryEditor({ open, onOpenChange, day, dayLabel, diary, planAssignments, onSave }) {
  const { t } = useI18n();
  const toast = useToast();
  const { registries } = useProject();
  const [start] = useState(() => diaryDraft(diary.days[day], planAssignments, registries));
  const [draft, setDraft] = useState(start.draft);
  const prev = previousDiaryDay(diary, day);
  const trades = useMemo(() => {
    const own = tradeSuggestions(diary, registries);
    return [...own, ...TRADE_KEYS.map((k) => t(`diary.tradeSuggest.${k}`)).filter((x) => !own.includes(x))];
  }, [diary, registries, t]);
  const equipment = useMemo(() => {
    const own = equipmentSuggestions(diary);
    return [...own, ...EQUIP_KEYS.map((k) => t(`diary.equip.${k}`)).filter((x) => !own.includes(x))];
  }, [diary, t]);
  const set = (patch) => setDraft((x) => ({ ...x, ...patch }));

  const sameAsYesterday = () => {
    setDraft((x) => ({ ...copyDiaryDay(diary.days[prev]), visitors: x.visitors, issues: x.issues }));
    toast({ title: t('diary.copied', { day: formatDay(prev) }) });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('diary.editTitle', { day: dayLabel })}
      description={start.prefilled ? t('diary.prefilled') : undefined}
      footer={
        <>
          <Button onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => onSave(draft)}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className={d.editor}>
        {(prev || planAssignments.length > 0) && (
          <div className={d.quick}>
            {prev && (
              <Button size="sm" icon={Copy} onClick={sameAsYesterday}>
                {t('diary.sameAsYesterday')}
              </Button>
            )}
            {planAssignments.length > 0 && (
              <Button size="sm" icon={ListChecks} onClick={() => set({ manpower: manpowerFromPlan(planAssignments, registries) })}>
                {t('diary.fromPlan')}
              </Button>
            )}
            {prev && <p className={d.quickHint}>{t('diary.sameAsHint', { day: formatDay(prev) })}</p>}
          </div>
        )}

        <ChoiceField
          label={t('diary.weather')}
          value={draft.weather}
          onChange={(weather) => set({ weather: weather === draft.weather ? '' : weather })}
          options={WEATHER_KINDS.map((k) => ({ value: k, label: t(`diary.weather.${k}`) }))}
        />
        <div className={d.pair}>
          <Field label={t('diary.maxTemp')} optional>
            <NumberInput unit={t('diary.celsius')} value={draft.maxTemp ?? ''} onChange={(e) => set({ maxTemp: e.target.value })} />
          </Field>
          <Field label={t('diary.hours')} optional>
            <NumberInput unit={t('diary.hoursUnit')} min={0} max={24} value={draft.hours ?? ''} onChange={(e) => set({ hours: e.target.value })} />
          </Field>
        </div>

        <RowsEditor
          title={t('diary.manpower')}
          rows={draft.manpower}
          onChange={(manpower) => set({ manpower })}
          addLabel={t('diary.addTrade')}
          blank={{ trade: '', count: '' }}
          fields={[
            { key: 'trade', label: t('diary.trade'), placeholder: t('diary.tradeGeneral'), list: 'pm-diary-trades' },
            { key: 'count', label: t('diary.count'), kind: 'count' },
          ]}
        />
        <RowsEditor
          title={t('diary.equipment')}
          rows={draft.equipment}
          onChange={(rows) => set({ equipment: rows })}
          addLabel={t('diary.addEquipment')}
          blank={{ type: '', count: '' }}
          fields={[
            { key: 'type', label: t('diary.equipType'), list: 'pm-diary-equipment' },
            { key: 'count', label: t('diary.count'), kind: 'count' },
          ]}
        />
        <RowsEditor
          title={t('diary.visitors')}
          rows={draft.visitors}
          onChange={(visitors) => set({ visitors })}
          addLabel={t('diary.addVisitor')}
          blank={{ name: '', org: '', purpose: '' }}
          fields={[
            { key: 'name', label: t('diary.visitorName') },
            { key: 'org', label: t('diary.visitorOrg') },
            { key: 'purpose', label: t('diary.visitorPurpose') },
          ]}
        />
        <Field label={t('diary.issues')} hint={t('diary.issuesHint')} optional>
          <Textarea rows={3} value={draft.issues} onChange={(e) => set({ issues: e.target.value })} />
        </Field>

        <datalist id="pm-diary-trades">
          {trades.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
        <datalist id="pm-diary-equipment">
          {equipment.map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </div>
    </Drawer>
  );
}

/**
 * Side card of the daily report (screen only): the day's diary at a
 * glance and the button that opens the editor (record.work only).
 */
export function DiaryCard({ day, dayLabel, diary, canEdit, onSave }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [planAssignments, setPlanAssignments] = useState(() => getDayPlans(loadPlans(), day));
  const entry = diary.days[day];
  const empty = !entry || isDiaryDayEmpty(entry);
  const totals = empty ? null : diaryTotals(entry);
  const lastEdit = useLastChange('pm-site-diary', `days/${day}`, entry);
  const Icon = entry ? WEATHER_ICONS[entry.weather] : null;

  const openEditor = () => {
    setPlanAssignments(getDayPlans(loadPlans(), day));
    setOpen(true);
  };

  return (
    <Card
      title={t('diary.title')}
      subtitle={formatDay(day)}
      titleAs="h2"
      className="ui-no-print"
      actions={
        canEdit && !empty ? <IconButton icon={Pencil} label={t('diary.edit')} variant="secondary" size="sm" onClick={openEditor} /> : null
      }
    >
      <div className={d.card}>
        {empty ? (
          <>
            <p className={s.muted}>{t('diary.cardEmpty')}</p>
            {canEdit && planAssignments.length > 0 && <p className={s.muted}>{t('diary.planHint')}</p>}
          </>
        ) : (
          <>
            <ul className={d.summary}>
              {entry.weather && (
                <li>
                  {Icon && <Icon size={16} aria-hidden="true" />}
                  {t(`diary.weather.${entry.weather}`)}
                  {entry.maxTemp !== null && entry.maxTemp !== undefined && ` · ${formatNumber(entry.maxTemp)} ${t('diary.celsius')}`}
                </li>
              )}
              {entry.hours !== null && entry.hours !== undefined && <li>{`${t('diary.hours')}: ${formatNumber(entry.hours)} ${t('diary.hoursUnit')}`}</li>}
              <li>{t('diary.workersTotal', { count: formatNumber(totals.workers) })}</li>
              <li>{t('diary.equipTotal', { count: formatNumber(totals.equipment) })}</li>
              {totals.visitors > 0 && <li>{t('diary.visitorsTotal', { count: formatNumber(totals.visitors) })}</li>}
            </ul>
            <HistoryStamps record={entry} last={lastEdit} collection="pm-site-diary" itemId={`days/${day}`} name={formatDay(day)} className={s.footnote} />
          </>
        )}
        {canEdit ? (
          empty && (
            <Button variant="primary" icon={Pencil} onClick={openEditor}>
              {t('diary.fill')}
            </Button>
          )
        ) : (
          <p className={s.footnote}>{t('diary.readOnly')}</p>
        )}
      </div>
      {open && (
        <DiaryEditor
          open={open}
          onOpenChange={setOpen}
          day={day}
          dayLabel={dayLabel}
          diary={diary}
          planAssignments={planAssignments}
          onSave={(draft) => {
            onSave(draft);
            setOpen(false);
          }}
        />
      )}
    </Card>
  );
}
