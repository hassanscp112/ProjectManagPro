import { useId } from 'react';
import { cx } from './cx.js';
import s from './Card.module.css';

const PAD = { none: s.padNone, sm: s.padSm, md: s.padMd, lg: s.padLg };
const TONE = { success: s.toneSuccess, warning: s.toneWarning, danger: s.toneDanger, accent: s.toneAccent };

/**
 * Card — the basic surface: background step + border + shadow, so it
 * stays separated from the page on any screen. With `title` it renders
 * a header and labels the region for screen readers.
 */
export function Card({
  as: Comp = 'section',
  title,
  titleAs: TitleTag = 'h2',
  subtitle,
  actions,
  padding = 'md',
  className,
  children,
  ...rest
}) {
  const titleId = useId();
  const hasHeader = Boolean(title || actions);
  return (
    <Comp
      {...rest}
      aria-labelledby={title ? titleId : rest['aria-labelledby']}
      className={cx(s.card, PAD[padding], className)}
    >
      {hasHeader && (
        <div className={s.header}>
          <div className={s.titles}>
            {title && (
              <TitleTag id={titleId} className={s.title}>
                {title}
              </TitleTag>
            )}
            {subtitle && <span className={s.subtitle}>{subtitle}</span>}
          </div>
          {actions && <div className={s.actions}>{actions}</div>}
        </div>
      )}
      {children}
    </Comp>
  );
}

/** Headline number: muted label, big value (+ unit), optional footer line or extras. */
export function StatCard({ label, value, unit, tone, footer, children, className, ...rest }) {
  return (
    <div {...rest} className={cx(s.card, s.padMd, s.stat, className)}>
      <span className={s.statLabel}>{label}</span>
      <div className={s.statValueRow}>
        <span className={cx(s.statValue, TONE[tone])}>{value}</span>
        {unit && <span className={s.statUnit}>{unit}</span>}
      </div>
      {children}
      {footer && <span className={s.statFooter}>{footer}</span>}
    </div>
  );
}
