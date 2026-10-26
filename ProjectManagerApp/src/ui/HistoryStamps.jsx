import { useI18n } from '../i18n/useI18n.js';
import { recordStamps } from '../state/historyModel.js';
import { cx } from './cx.js';
import { HistoryButton } from './HistoryButton.jsx';
import { stampText } from './HistoryFormat.js';
import s from './History.module.css';

/**
 * "Recorded by … · Approved by … · Last edited by …" for a record, from
 * its own fields (historyModel recordStamps); `last` = the newest history
 * row when the server knows a later editor. With `collection` + `itemId`
 * a History button follows. `time={false}` drops the times (dense rows).
 */
export function HistoryStamps({ record, last = null, collection, itemId, name, time = true, className }) {
  const { t } = useI18n();
  const stamps = recordStamps(record, { last });
  if (stamps.length === 0 && !collection) return null;
  return (
    <span className={cx(s.stamps, className)}>
      {stamps.map((st) => (
        <span key={st.kind} className={s.stamp}>
          {stampText(st, t, { time })}
        </span>
      ))}
      {collection && <HistoryButton collection={collection} itemId={itemId} name={name} />}
    </span>
  );
}
