import * as RadixMenu from '@radix-ui/react-dropdown-menu';
import { cx } from './cx.js';
import s from './Overlay.module.css';

/**
 * Dropdown menu. `trigger` must be a single focusable element (e.g. an
 * IconButton). items: [{ label, icon, onSelect, tone: 'danger' } | 'separator'].
 */
export function Menu({ trigger, items, align = 'end' }) {
  return (
    <RadixMenu.Root>
      <RadixMenu.Trigger asChild>{trigger}</RadixMenu.Trigger>
      <RadixMenu.Portal>
        <RadixMenu.Content align={align} sideOffset={6} className={cx('ui-portal', s.menu)}>
          {items.map((item, i) => {
            if (item === 'separator') return <RadixMenu.Separator key={`sep-${i}`} className={s.menuSeparator} />;
            const Icon = item.icon;
            return (
              <RadixMenu.Item
                key={item.label}
                onSelect={item.onSelect}
                className={cx(s.menuItem, item.tone === 'danger' && s.menuItemDanger)}
              >
                {Icon && <Icon size={16} aria-hidden="true" />}
                {item.label}
              </RadixMenu.Item>
            );
          })}
        </RadixMenu.Content>
      </RadixMenu.Portal>
    </RadixMenu.Root>
  );
}
