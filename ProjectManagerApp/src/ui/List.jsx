import { cx } from './cx.js';
import s from './List.module.css';

/**
 * Data table in a horizontally scrolling box (wide tables never break
 * the page on a phone). Header cells stick while scrolling.
 * Use className="ui-num" on numeric cells.
 */
export function Table({ minWidth, label, className, children }) {
  return (
    <div className={cx(s.tableWrap, className)} role="region" aria-label={label} tabIndex={label ? 0 : undefined}>
      <table className={s.table} style={minWidth ? { minWidth } : undefined}>
        {children}
      </table>
    </div>
  );
}

/**
 * One row of a list: leading visual, title + subtitle, trailing slot.
 * Renders a link with `href`, a button with `onClick`, else a plain row.
 * `flush` drops the box for dense lists inside a card.
 */
export function ListRow({ leading, title, subtitle, trailing, href, onClick, flush = false, className, ...rest }) {
  const Comp = href ? 'a' : onClick ? 'button' : 'div';
  const extra = Comp === 'button' ? { type: 'button', onClick } : href ? { href, onClick } : {};
  return (
    <Comp {...rest} {...extra} className={cx(s.row, flush && s.flush, className)}>
      {leading && <span className={s.leading}>{leading}</span>}
      <span className={s.text}>
        <span className={s.title}>{title}</span>
        {subtitle && <span className={s.subtitle}>{subtitle}</span>}
      </span>
      {trailing && <span className={s.trailing}>{trailing}</span>}
    </Comp>
  );
}

/** Empty state: an invitation (headline, one line, one action), not an apology. */
export function EmptyState({ icon: Icon, title, body, action, className }) {
  return (
    <div className={cx(s.empty, className)}>
      {Icon && (
        <span className={s.emptyIcon} aria-hidden="true">
          <Icon size={26} />
        </span>
      )}
      <p className={s.emptyTitle}>{title}</p>
      {body && <p className={s.emptyBody}>{body}</p>}
      {action && <div className={s.emptyAction}>{action}</div>}
    </div>
  );
}
