import { useI18n } from '../../i18n/useI18n.js';
import { ORDER_TYPE_LIST } from '../../utils/OrderEngine.js';
import { cx } from '../../ui/index.js';
import { TYPE_ICONS } from './orderMeta.js';
import s from './Record.module.css';

const GROUPS = [
  { family: 'value', hintKey: 'record.groupValueHint' },
  { family: 'expense', hintKey: 'record.groupExpenseHint' },
];

/**
 * The 9 order types as cards in two groups (work / expenses). Each card
 * says whether the type is approved on save or needs approval.
 * compactExpenses: phone layout, expenses as 2-column rows.
 */
export default function OrderTypeCards({ value, onSelect, compactExpenses = false }) {
  const { t } = useI18n();
  return (
    <div className={s.groups}>
      {GROUPS.map((g) => {
        const compact = compactExpenses && g.family === 'expense';
        return (
          <div key={g.family} className={s.group}>
            <span className={s.groupLabel}>{t(g.hintKey)}</span>
            <div className={cx(s.cards, compact && s.cardsCompact)}>
              {ORDER_TYPE_LIST.filter((ot) => ot.family === g.family).map((ot) => {
                const Icon = TYPE_ICONS[ot.type];
                return (
                  <button
                    key={ot.type}
                    type="button"
                    aria-pressed={value === ot.type}
                    className={s.card}
                    onClick={() => onSelect(ot.type)}
                  >
                    {Icon && <Icon size={20} aria-hidden="true" className={s.cardIcon} />}
                    <span className={s.cardLabel}>{ot.label}</span>
                    {!compact && (
                      <span className={s.cardTier}>{ot.tier === 'formal' ? t('record.tierFormal') : t('record.tierQuick')}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
