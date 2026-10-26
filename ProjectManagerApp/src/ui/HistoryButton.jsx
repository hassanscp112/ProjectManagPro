import * as Tooltip from '@radix-ui/react-tooltip';
import { History } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { historyHref, recordStamps } from '../state/historyModel.js';
import { cx } from './cx.js';
import { stampText } from './HistoryFormat.js';
import b from './Button.module.css';
import tip from './Tooltip.module.css';
import s from './History.module.css';

/**
 * Small icon link to an item's history (#/history/:collection/:id).
 * `name` goes into the label ("History: Fill"); `record` adds its
 * "recorded / approved / last edited by" stamps to the tooltip and the
 * accessible name. A click never reaches a clickable row around it.
 * Hidden in print.
 */
export function HistoryButton({ collection, itemId, name, record, size = 'sm', variant = 'ghost', className }) {
  const { t } = useI18n();
  const label = name ? t('history.openFor', { name }) : t('history.open');
  const stamps = record ? recordStamps(record).map((st) => stampText(st, t)) : [];
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <a
          href={historyHref(collection, itemId)}
          aria-label={stamps.length ? `${label} — ${stamps.join(' · ')}` : label}
          className={cx(b.button, b.iconOnly, b[variant], b[size], 'ui-no-print', className)}
          onClick={(e) => e.stopPropagation()}
        >
          <History size={size === 'sm' ? 16 : 18} aria-hidden="true" />
        </a>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={cx('ui-portal', tip.content)} sideOffset={6}>
          {label}
          {stamps.map((line) => (
            <span key={line} className={s.tipLine}>
              {line}
            </span>
          ))}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
