import { Check, Info, TriangleAlert, X } from 'lucide-react';
import { cx } from './cx.js';
import s from './StatusBadge.module.css';

// Every status carries a shape as well as a color (never color alone).
const ICONS = { success: Check, warning: TriangleAlert, danger: X, accent: Info };

/**
 * Status pill. tone: neutral · accent · success · warning · danger.
 * icon: true (tone default) · false · a lucide component · 'dot'.
 */
export function StatusBadge({ tone = 'neutral', icon = true, size = 'sm', className, children, ...rest }) {
  let mark = null;
  if (icon === 'dot') {
    mark = <span className={s.dot} aria-hidden="true" />;
  } else if (icon) {
    const Icon = icon === true ? ICONS[tone] : icon;
    if (Icon) mark = <Icon size={size === 'md' ? 14 : 12} strokeWidth={2.5} aria-hidden="true" />;
  }
  return (
    <span {...rest} className={cx(s.badge, s[tone], size === 'md' && s.md, className)}>
      {mark}
      {children}
    </span>
  );
}
