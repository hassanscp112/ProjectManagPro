import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatNumber } from '../i18n/index.js';
import { useI18n } from '../i18n/useI18n.js';
import { diffFields, valueText } from '../state/historyModel.js';
import { Button } from './Button.jsx';
import { fieldLabel, whenText } from './HistoryFormat.js';
import s from './History.module.css';

const lastField = (segments) => [...segments].reverse().find((seg) => seg.field !== undefined)?.field || '';

/**
 * A change as labelled fields: "Quantity: 10 → 12", "Manpower › Helper:
 * removed", "Affected items: Added: 2.1 …". `resolveValue(field, value)`
 * turns ids into names (contractor, task …); values are bidi-isolated.
 * The first `limit` fields show, the rest behind "Show N more".
 */
export function HistoryDiff({ before, after, resolveValue, limit = 6 }) {
  const { t, dir } = useI18n();
  const [all, setAll] = useState(false);
  const changes = useMemo(() => diffFields(before, after), [before, after]);
  if (changes.length === 0) return <p className={s.muted}>{t('history.noFieldChange')}</p>;

  const words = {
    empty: '—',
    yes: t('history.yes'),
    no: t('history.no'),
    sep: dir === 'rtl' ? '، ' : ', ',
    num: formatNumber,
    items: (n) => t('history.items', { n: formatNumber(n) }),
    date: whenText,
  };
  const text = (field, value) => valueText(resolveValue ? resolveValue(field, value) : value, words);
  const Arrow = dir === 'rtl' ? ArrowLeft : ArrowRight;
  const shown = all ? changes : changes.slice(0, limit);
  // A first version is its values; a deletion, the values it removed.
  const first = before === null || before === undefined;
  const gone = after === null || after === undefined;

  const body = (c) => {
    const field = lastField(c.segments);
    if (c.list && (c.list.added.length || c.list.removed.length)) {
      return (
        <>
          {c.list.added.length > 0 && <ins className={s.ins}>{t('history.listAdded', { items: text(field, c.list.added) })}</ins>}
          {c.list.removed.length > 0 && <del className={s.del}>{t('history.listRemoved', { items: text(field, c.list.removed) })}</del>}
        </>
      );
    }
    if (c.change === 'added' && first) return <ins className={s.ins}><bdi>{text(field, c.after)}</bdi></ins>;
    if (c.change === 'removed' && gone) return <del className={s.del}><bdi>{text(field, c.before)}</bdi></del>;
    if (c.change === 'removed') {
      return (
        <>
          <del className={s.del}><bdi>{text(field, c.before)}</bdi></del>
          <span className={s.muted}>{t('history.removed')}</span>
        </>
      );
    }
    return (
      <>
        <del className={s.del}><bdi>{text(field, c.before)}</bdi></del>
        <Arrow size={14} className={s.arrow} aria-hidden="true" />
        <ins className={s.ins}><bdi>{text(field, c.after)}</bdi></ins>
      </>
    );
  };

  return (
    <>
      <dl className={s.diff} aria-label={t('history.diffLabel')}>
        {shown.map((c) => (
          <div key={c.path} className={s.diffRow}>
            <dt className={s.diffField}>{fieldLabel(c.segments, t)}</dt>
            <dd className={s.diffValue}>{body(c)}</dd>
          </div>
        ))}
      </dl>
      {changes.length > limit && (
        <Button size="sm" variant="ghost" className={s.more} onClick={() => setAll((x) => !x)} aria-expanded={all}>
          {all ? t('history.showLess') : t('history.showMore', { n: formatNumber(changes.length - limit) })}
        </Button>
      )}
    </>
  );
}
