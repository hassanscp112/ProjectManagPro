import { Hourglass, Pencil, Plus, Printer, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { delayDays, delayErrors, delayTotals, filterDelays, noticeCheck, noticeWarns, sortDelays } from '../../state/diaryModel.js';
import { DELAYS_STORAGE_KEY, DELAY_CAUSES, DELAY_STATUSES, loadDelays, removeDelay, saveDelays, upsertDelay } from '../../utils/Delays.js';
import { todayStr } from '../../utils/OrderEngine.js';
import { onStoreChange } from '../../utils/storeEvents.js';
import {
  Button,
  Card,
  ConfirmDialog,
  Drawer,
  EmptyState,
  Field,
  IconButton,
  Input,
  NumberInput,
  Select,
  StatusBadge,
  TaskPicker,
  Textarea,
  cx,
  useToast,
} from '../../ui/index.js';
import { issueStamp } from '../dates.js';
import { Page } from '../Page.jsx';
import { formatDay } from '../record/orderMeta.js';
import { useCan } from '../useCan.js';
import { ChoiceField } from './DiaryParts.jsx';
import { ReportSheet, SheetSection } from './ReportSheet.jsx';
import d from './Diary.module.css';
import s from './Reports.module.css';

const STATUS_TONE = { draft: 'neutral', submitted: 'accent', granted: 'success', rejected: 'danger' };
const NOTICE_TONE = { ok: 'success', late: 'warning', overdue: 'danger', open: 'neutral' };

const blankDelay = (today) => ({
  title: '',
  cause: 'weather',
  start: today,
  end: '',
  taskIds: [],
  excusable: true,
  noticeDate: '',
  daysClaimed: '',
  status: 'draft',
  daysGranted: '',
  notes: '',
});

/** The notice check as a short badge (table, cards). */
function NoticeBadge({ event, today }) {
  const { t } = useI18n();
  const check = noticeCheck(event, today);
  if (check.state === 'none') return null;
  const label =
    check.state === 'open' ? t('diary.notice.openShort', { deadline: formatDay(check.deadline) }) : t(`diary.notice.${check.state}Short`);
  return (
    <StatusBadge tone={NOTICE_TONE[check.state]} icon={check.state === 'open' ? 'dot' : true}>
      {label}
    </StatusBadge>
  );
}

/** The notice check in words (editor). */
function noticeMessage(check, t) {
  if (check.state === 'late') return t('diary.notice.late', { days: check.daysAfter });
  if (check.state === 'overdue') return t('diary.notice.overdue', { deadline: formatDay(check.deadline) });
  if (check.state === 'open') return t('diary.notice.open', { deadline: formatDay(check.deadline), days: check.daysLeft });
  return '';
}

const periodText = (e, t) => `${formatDay(e.start)} – ${e.end ? formatDay(e.end) : t('diary.ongoing')}`;

/** Add or edit one delay event (drawer; a bottom sheet on phones). */
function DelayEditor({ initial, today, onSave, onDelete, onClose }) {
  const { t } = useI18n();
  const { tasks, orders } = useProject();
  const [draft, setDraft] = useState(initial);
  const [tried, setTried] = useState(false);
  const set = (patch) => setDraft((x) => ({ ...x, ...patch }));
  const errors = delayErrors(draft);
  const errorText = (key) => (tried && errors[key] ? t(errors[key] === 'beforeStart' ? 'diary.endBeforeStart' : 'record.required') : undefined);
  const check = noticeCheck(draft, today);
  const days = delayDays(draft, today);
  const taskById = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);
  const isNew = !initial.id;

  const save = () => {
    setTried(true);
    if (Object.keys(errors).length) return;
    onSave(draft);
  };

  return (
    <Drawer
      open
      onOpenChange={(open) => !open && onClose()}
      title={isNew ? t('diary.newDelay') : t('diary.editDelay')}
      description={initial.recordedBy ? t('diary.recordedBy', { name: initial.recordedBy }) : undefined}
      footer={
        <>
          {!isNew && (
            <Button variant="danger" onClick={() => onDelete(initial)}>
              {t('diary.deleteDelay')}
            </Button>
          )}
          <span className={d.footerSpread} />
          <Button onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={save}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className={d.editor}>
        <Field label={t('diary.delayTitle')} hint={t('diary.delayTitleHint')} error={errorText('title')}>
          <Input data-autofocus value={draft.title} onChange={(e) => set({ title: e.target.value })} />
        </Field>
        <ChoiceField
          label={t('diary.cause')}
          value={draft.cause}
          onChange={(cause) => set({ cause })}
          options={DELAY_CAUSES.map((c) => ({ value: c, label: t(`diary.cause.${c}`) }))}
        />
        <div className={d.pair}>
          <Field label={t('diary.start')} error={errorText('start')}>
            <Input type="date" value={draft.start} onChange={(e) => set({ start: e.target.value })} />
          </Field>
          <Field label={t('diary.end')} hint={t('diary.endHint')} error={errorText('end')} optional>
            <Input type="date" value={draft.end} min={draft.start || undefined} onChange={(e) => set({ end: e.target.value })} />
          </Field>
        </div>
        {days > 0 && <p className={d.info}>{`${t('diary.colDays')}: ${t('diary.days', { count: formatNumber(days) })}${draft.end ? '' : ` · ${t('diary.ongoing')}`}`}</p>}

        <Field label={t('diary.affected')} optional>
          <TaskPicker tasks={tasks} orders={orders} value="" placeholder={t('diary.addItem')} onChange={(id) => id && !draft.taskIds.includes(id) && set({ taskIds: [...draft.taskIds, id] })} />
        </Field>
        {draft.taskIds.length > 0 && (
          <ul className={d.items}>
            {draft.taskIds.map((id) => {
              const task = taskById.get(id);
              const name = task ? `${task.wbs} ${task.name}` : id;
              return (
                <li key={id} className={d.item}>
                  <span className={d.itemText}>{name}</span>
                  <IconButton icon={X} size="sm" label={t('diary.removeItem', { name })} onClick={() => set({ taskIds: draft.taskIds.filter((x) => x !== id) })} />
                </li>
              );
            })}
          </ul>
        )}

        <ChoiceField
          label={t('diary.excusableLabel')}
          hint={t('diary.excusableHint')}
          value={draft.excusable ? 'yes' : 'no'}
          onChange={(v) => set({ excusable: v === 'yes' })}
          options={[
            { value: 'yes', label: t('diary.excusable') },
            { value: 'no', label: t('diary.notExcusable') },
          ]}
        />

        <Field label={t('diary.noticeDate')} hint={t('diary.noticeHint')} optional>
          <Input type="date" value={draft.noticeDate} onChange={(e) => set({ noticeDate: e.target.value })} />
        </Field>
        {noticeMessage(check, t) && (
          <p className={noticeWarns(check) ? d.warn : d.info} role={noticeWarns(check) ? 'alert' : undefined}>
            {noticeMessage(check, t)}
          </p>
        )}

        <ChoiceField
          label={t('common.status')}
          value={draft.status}
          onChange={(status) => set({ status })}
          options={DELAY_STATUSES.map((x) => ({ value: x, label: t(`diary.status.${x}`) }))}
        />
        <div className={d.pair}>
          <Field label={t('diary.daysClaimed')} optional>
            <NumberInput min={0} unit={t('diary.colDays')} value={draft.daysClaimed || ''} onChange={(e) => set({ daysClaimed: e.target.value })} />
          </Field>
          {draft.status === 'granted' && (
            <Field label={t('diary.daysGranted')}>
              <NumberInput min={0} unit={t('diary.colDays')} value={draft.daysGranted || ''} onChange={(e) => set({ daysGranted: e.target.value })} />
            </Field>
          )}
        </div>

        <Field label={t('common.notes')} optional>
          <Textarea rows={3} value={draft.notes} onChange={(e) => set({ notes: e.target.value })} />
        </Field>
      </div>
    </Drawer>
  );
}

/**
 * /reports/delays — the delay register: every event that held the works
 * up, its notice (FIDIC 20.1, 28 days), the days claimed and granted;
 * totals with overlapping days counted once; printable.
 */
export default function DelaysPage() {
  const { t } = useI18n();
  const toast = useToast();
  const allowed = useCan();
  const canEdit = allowed('record.work');
  const { tasks } = useProject();
  const today = todayStr();
  const [state, setState] = useState(loadDelays);
  const [status, setStatus] = useState('all');
  const [cause, setCause] = useState('all');
  const [editing, setEditing] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [stamp, setStamp] = useState(() => issueStamp());

  // Saved on each edit (below); re-read when it changes elsewhere (sync).
  useEffect(() => onStoreChange((key) => key === DELAYS_STORAGE_KEY && setState(loadDelays())), []);

  const taskById = useMemo(() => new Map(tasks.map((x) => [x.id, x])), [tasks]);
  const shown = useMemo(() => sortDelays(filterDelays(state.events, { status, cause })), [state.events, status, cause]);
  const totals = useMemo(() => delayTotals(shown, today), [shown, today]);

  const commit = (next) => {
    saveDelays(next);
    setState(next);
  };
  const print = () => {
    setStamp(issueStamp());
    setTimeout(() => window.print(), 50);
  };
  const open = (e) => canEdit && setEditing({ ...e, daysClaimed: e.daysClaimed || '', daysGranted: e.daysGranted || '' });
  const itemNames = (e) =>
    e.taskIds
      .map((id) => taskById.get(id))
      .filter(Boolean)
      .map((x) => `${x.wbs} ${x.name}`.trim());
  const claimText = (e) => `${formatNumber(e.daysClaimed)} / ${e.status === 'granted' ? formatNumber(e.daysGranted) : '—'}`;

  const filtersOn = status !== 'all' || cause !== 'all';
  const figures = [
    ['diary.totalEvents', totals.count],
    ['diary.totalDays', totals.days],
    ['diary.excusableDays', totals.excusableDays],
    ['diary.claimed', totals.claimed],
    ['diary.granted', totals.granted],
    ['diary.pending', totals.pending],
    ['diary.noticeWarnings', totals.noticeWarnings, totals.noticeWarnings > 0],
  ];

  return (
    <Page area="reports">
      <div className={cx(s.toolbar, 'ui-no-print')}>
        <div className={d.filters}>
          <Select className={d.filterSelect} aria-label={t('common.status')} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">{t('diary.allStatuses')}</option>
            {DELAY_STATUSES.map((x) => (
              <option key={x} value={x}>
                {t(`diary.status.${x}`)}
              </option>
            ))}
          </Select>
          <Select className={d.filterSelect} aria-label={t('diary.cause')} value={cause} onChange={(e) => setCause(e.target.value)}>
            <option value="all">{t('diary.allCauses')}</option>
            {DELAY_CAUSES.map((x) => (
              <option key={x} value={x}>
                {t(`diary.cause.${x}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className={s.spacer} />
        {canEdit && (
          <Button icon={Plus} onClick={() => setEditing(blankDelay(today))}>
            {t('diary.newDelay')}
          </Button>
        )}
        <Button variant="primary" icon={Printer} onClick={print}>
          {t('reports.print')}
        </Button>
      </div>

      {state.events.length === 0 ? (
        <Card padding="md">
          <EmptyState
            icon={Hourglass}
            title={t('diary.emptyTitle')}
            body={t('diary.emptyBody')}
            action={
              canEdit ? (
                <Button variant="primary" icon={Plus} onClick={() => setEditing(blankDelay(today))}>
                  {t('diary.newDelay')}
                </Button>
              ) : null
            }
          />
        </Card>
      ) : (
        <ReportSheet
          title={t('diary.registerTitle')}
          period={t('diary.asOf', { day: formatDay(today) })}
          stamp={stamp}
          extra={
            filtersOn ? (
              <StatusBadge tone="accent" icon={false}>
                {[status !== 'all' && t(`diary.status.${status}`), cause !== 'all' && t(`diary.cause.${cause}`)].filter(Boolean).join(' · ')}
              </StatusBadge>
            ) : null
          }
        >
          <SheetSection>
            <dl className={s.figures}>
              {figures.map(([key, value, warn]) => (
                <div key={key} className={s.figure}>
                  <dt>{t(key)}</dt>
                  <dd className={warn ? d.toneWarning : undefined}>{formatNumber(value)}</dd>
                </div>
              ))}
            </dl>
            <p className={s.footnote}>{t('diary.footnote')}</p>
          </SheetSection>

          <SheetSection title={`${t('diary.registerTitle')} (${shown.length})`}>
            {shown.length === 0 ? (
              <p className={s.muted}>{t('diary.noMatch')}</p>
            ) : (
              <>
                <div className={cx(s.tableWrap, d.registerTable)}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>{t('diary.colEvent')}</th>
                        <th>{t('diary.colPeriod')}</th>
                        <th className={s.num}>{t('diary.colDays')}</th>
                        <th>{t('diary.excusableLabel')}</th>
                        <th>{t('diary.colNotice')}</th>
                        <th className={s.num}>{t('diary.colClaim')}</th>
                        <th>{t('common.status')}</th>
                        {canEdit && (
                          <th className="ui-no-print">
                            <span className="ui-visually-hidden">{t('common.actions')}</span>
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {shown.map((e) => {
                        const items = itemNames(e);
                        return (
                          <tr key={e.id} className={canEdit ? d.rowButton : undefined} onClick={() => open(e)}>
                            <td>
                              <span className={d.eventTitle}>{e.title}</span>
                              <span className={d.eventMeta}>
                                {[t(`diary.cause.${e.cause}`), e.recordedBy && t('diary.recordedBy', { name: e.recordedBy })].filter(Boolean).join(' · ')}
                              </span>
                              {items.length > 0 && <span className={d.eventMeta}>{items.join(' · ')}</span>}
                            </td>
                            <td className={s.num}>{periodText(e, t)}</td>
                            <td className={s.num}>{formatNumber(delayDays(e, today))}</td>
                            <td>{e.excusable ? t('diary.excusable') : t('diary.notExcusable')}</td>
                            <td>
                              {e.noticeDate ? <span className={s.num}>{formatDay(e.noticeDate)} </span> : null}
                              <NoticeBadge event={e} today={today} />
                            </td>
                            <td className={s.num}>{claimText(e)}</td>
                            <td>
                              <StatusBadge tone={STATUS_TONE[e.status]}>{t(`diary.status.${e.status}`)}</StatusBadge>
                            </td>
                            {canEdit && (
                              <td className="ui-no-print">
                                <IconButton
                                  icon={Pencil}
                                  size="sm"
                                  label={`${t('common.edit')}: ${e.title}`}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    open(e);
                                  }}
                                />
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2}>{t('common.total')}</td>
                        <td className={s.num}>{formatNumber(totals.days)}</td>
                        <td colSpan={2} />
                        <td className={s.num}>{`${formatNumber(totals.claimed)} / ${formatNumber(totals.granted)}`}</td>
                        <td />
                        {canEdit && <td className="ui-no-print" />}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                <ul className={d.cards}>
                  {shown.map((e) => {
                    const Comp = canEdit ? 'button' : 'div';
                    return (
                      <li key={e.id}>
                        <Comp type={canEdit ? 'button' : undefined} className={d.delayCard} onClick={canEdit ? () => open(e) : undefined}>
                          <span className={d.eventTitle}>{e.title}</span>
                          <span className={d.eventMeta}>
                            {`${t(`diary.cause.${e.cause}`)} · ${periodText(e, t)} · ${t('diary.days', { count: formatNumber(delayDays(e, today)) })}`}
                          </span>
                          <span className={d.eventMeta}>{`${t('diary.colClaim')}: ${claimText(e)}`}</span>
                          <span className={d.badges}>
                            <StatusBadge tone={STATUS_TONE[e.status]}>{t(`diary.status.${e.status}`)}</StatusBadge>
                            <StatusBadge tone={e.excusable ? 'accent' : 'neutral'} icon={false}>
                              {e.excusable ? t('diary.excusable') : t('diary.notExcusable')}
                            </StatusBadge>
                            <NoticeBadge event={e} today={today} />
                          </span>
                        </Comp>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </SheetSection>

          <div className={s.signatures}>
            {['reports.signPreparer', 'reports.signSiteManager', 'reports.signApproval'].map((key) => (
              <div key={key} className={s.sign}>
                <strong>{t(key)}</strong>
                <div className={s.signLine} />
                <span className={s.footnote}>{t('reports.signDate')}</span>
              </div>
            ))}
          </div>
        </ReportSheet>
      )}

      {editing && (
        <DelayEditor
          initial={editing}
          today={today}
          onClose={() => setEditing(null)}
          onSave={(draft) => {
            commit(upsertDelay(state, draft));
            setEditing(null);
            toast({ title: t('diary.delaySaved') });
          }}
          onDelete={(e) => setToDelete(e)}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('diary.deleteTitle')}
        message={toDelete?.title || ''}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={() => {
          commit(removeDelay(state, toDelete.id));
          setEditing(null);
          toast({ title: t('diary.delayDeleted') });
        }}
      />
    </Page>
  );
}
