import * as Tooltip from '@radix-ui/react-tooltip';
import { cx } from './cx.js';
import s from './Button.module.css';
import tip from './Tooltip.module.css';

const ICON_SIZE = { sm: 16, md: 18, lg: 20 };

/**
 * Button. Variants: primary (one per view) · secondary (default) ·
 * outline · ghost · danger. Sizes sm 36px · md 44px · lg 52px.
 * `as="a"` renders a link styled as a button (pass href).
 */
export function Button({
  as: Comp = 'button',
  variant = 'secondary',
  size = 'md',
  block = false,
  icon: Icon,
  iconEnd: IconEnd,
  className,
  children,
  ref,
  ...rest
}) {
  const typeProps = Comp === 'button' ? { type: rest.type || 'button' } : {};
  const px = ICON_SIZE[size] || 18;
  return (
    <Comp
      ref={ref}
      {...typeProps}
      {...rest}
      className={cx(s.button, s[variant], s[size], block && s.block, className)}
    >
      {Icon && <Icon size={px} aria-hidden="true" className={s.icon} />}
      {children}
      {IconEnd && <IconEnd size={px} aria-hidden="true" className={s.icon} />}
    </Comp>
  );
}

/**
 * Square icon-only button. `label` is required: it becomes the
 * accessible name and the hover tooltip. tooltip={false} for buttons
 * that receive focus automatically (dialog close), where a tooltip
 * would pop up on open.
 */
export function IconButton({ icon: Icon, label, variant = 'ghost', size = 'md', tooltip = true, className, ref, ...rest }) {
  const px = ICON_SIZE[size] || 18;
  const button = (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={tooltip ? undefined : label}
      {...rest}
      className={cx(s.button, s.iconOnly, s[variant], s[size], className)}
    >
      <Icon size={px} aria-hidden="true" />
    </button>
  );
  if (!tooltip) return button;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{button}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className={cx('ui-portal', tip.content)} sideOffset={6}>
          {label}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
