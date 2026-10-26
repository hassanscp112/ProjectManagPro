import { CloudOff, FilePlus2, History, Pencil, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { cx } from './cx.js';
import { HistoryDiff } from './HistoryDiff.jsx';
import { shortDevice, whenText } from './HistoryFormat.js';
import { StatusBadge } from './StatusBadge.jsx';
import s from './History.module.css';

const OP_ICONS = { insert: FilePlus2, update: Pencil, delete: Trash2, restore: RotateCcw, import: Upload };
const OUTCOME_TONE = { rejected: 'warning', failed: 'danger', pending: 'accent' };
const NOTE_KEYS = [
  ['conflict-lost', 'history.note.conflictLost'],
  ['conflict-won', 'history.note.conflictWon'],
  ['denied', 'history.note.denied'],
];

/** A server note ('conflict-lost:…') in words; a refused change keeps its own text. */
const noteText = (row, t) => {
  if (!row.note) return '';
  const known = NOTE_KEYS.find(([prefix]) => row.note.startsWith(prefix));
  if (known) return t(known[1]);
  return row.outcome === 'failed' ? row.note : '';
};

/**
 * One version of a record: what happened, who, when, on which device,
 * whether it was kept, and its fields before → after. `action` is the
 * slot for a restore button (the page decides who may).
 */
export function HistoryEntry({ row, action, resolveValue, thisDevice, current = false }) {
  const { t } = useI18n();
  const Icon = row.pending ? CloudOff : OP_ICONS[row.op] || History;
  const who = row.actor?.name || t('history.unknownPerson');
  const time = whenText(row.serverAt || row.clientAt);
  const device = row.deviceId ? (row.deviceId === thisDevice ? t('history.thisDevice') : t('history.device', { id: shortDevice(row.deviceId) })) : '';
  const note = noteText(row, t);
  const outcome = row.pending ? (row.outcome === 'failed' ? 'failed' : 'pending') : row.outcome;
  return (
    <article className={cx(s.entry, row.pending && s.entryPending, outcome === 'rejected' && s.entryRejected)}>
      <span className={cx(s.entryIcon, s[`op_${row.op}`])} aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className={s.entryBody}>
        <header className={s.entryHead}>
          <span className={s.entryTitle}>{t(`history.op.${row.op}`)}</span>
          {OUTCOME_TONE[outcome] && (
            <StatusBadge tone={OUTCOME_TONE[outcome]} icon={outcome === 'pending' ? 'dot' : true}>
              {t(`history.outcome.${outcome}`)}
            </StatusBadge>
          )}
          {current && (
            <StatusBadge tone="success" icon={false}>
              {t('history.current')}
            </StatusBadge>
          )}
          {action && <span className={s.entryAction}>{action}</span>}
        </header>
        <p className={s.entryMeta}>
          {[t('history.byOn', { name: who, time }), device].filter(Boolean).join(' · ')}
        </p>
        {row.pending && <p className={s.entryNote}>{t('history.waitingNote')}</p>}
        {row.restoredFrom !== null && row.restoredFrom !== undefined && <p className={s.entryNote}>{t('history.restoredFrom')}</p>}
        {note && <p className={s.entryNote}>{note}</p>}
        <HistoryDiff before={row.before} after={row.after} resolveValue={resolveValue} />
      </div>
    </article>
  );
}

/**
 * A record's versions, newest first (this device's waiting changes on
 * top). `renderAction(row)` fills each entry's action slot; `currentId`
 * marks the version in force.
 */
export function HistoryList({ rows, renderAction, resolveValue, thisDevice, currentId = null }) {
  return (
    <ol className={s.list}>
      {rows.map((row) => (
        <li key={row.id}>
          <HistoryEntry row={row} action={renderAction?.(row)} resolveValue={resolveValue} thisDevice={thisDevice} current={row.id === currentId} />
        </li>
      ))}
    </ol>
  );
}
