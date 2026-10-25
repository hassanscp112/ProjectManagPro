import { ORDER_TYPE_LIST } from '../../utils/OrderEngine';
import { useI18n } from '../../i18n/useI18n.js';
import './OrderTypePicker.css';

/**
 * Order-type chips grouped by family: value (on-site work) / expense.
 * Clicking the already-active chip lets the parent toggle the form closed.
 */
const OrderTypePicker = ({ value, onSelect }) => {
  const { t, dir } = useI18n();
  const groups = [
    { key: 'value', labelKey: 'orders.groupValue' },
    { key: 'expense', labelKey: 'orders.groupExpense' },
  ];

  return (
    <div className="otp-root" dir={dir}>
      {groups.map((g) => (
        <div className={`otp-group otp-family-${g.key}`} key={g.key}>
          <span className="otp-group-label">{t(g.labelKey)}</span>
          <div className="otp-chips">
            {ORDER_TYPE_LIST.filter((ot) => ot.family === g.key).map((ot) => (
              <button
                type="button"
                key={ot.type}
                className={`otp-chip ${value === ot.type ? 'active' : ''}`}
                onClick={() => onSelect?.(ot.type)}
                title={ot.tier === 'formal' ? t('orders.formalChipHint') : t('orders.quickChipHint')}
              >
                <span className="otp-chip-icon">{ot.icon}</span>
                {ot.label}
                {ot.tier === 'formal' && <span className="otp-chip-tier">{t('orders.tierFormal')}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderTypePicker;
