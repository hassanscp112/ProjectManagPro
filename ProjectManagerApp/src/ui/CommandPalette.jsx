import * as RadixDialog from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { Search } from 'lucide-react';
import { useI18n } from '../i18n/useI18n.js';
import { cx } from './cx.js';
import overlay from './Overlay.module.css';
import s from './Picker.module.css';

/**
 * Ctrl K search across the app. groups: [{ heading, items: [{ id,
 * label, hint, icon, keywords, onSelect }] }]. Pair with
 * useHotkey('k', …) to open it from the keyboard.
 */
export function CommandPalette({ open, onOpenChange, groups, placeholder }) {
  const { t } = useI18n();
  const run = (fn) => {
    onOpenChange(false);
    fn?.();
  };
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className={cx('ui-portal', overlay.overlay)} />
        <RadixDialog.Content className={cx('ui-portal', overlay.panel, s.palette)}>
          <RadixDialog.Title className="ui-visually-hidden">{t('ui.search')}</RadixDialog.Title>
          <RadixDialog.Description className="ui-visually-hidden">
            {placeholder || t('ui.searchPlaceholder')}
          </RadixDialog.Description>
          <Command label={t('ui.search')}>
            <div className={s.searchRow}>
              <Search size={18} aria-hidden="true" />
              <Command.Input className={s.searchInput} placeholder={placeholder || t('ui.searchPlaceholder')} />
            </div>
            <Command.List className={s.list}>
              <Command.Empty className={s.empty}>{t('ui.noResults')}</Command.Empty>
              {groups.map((g) => (
                <Command.Group key={g.heading} heading={g.heading}>
                  {g.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Command.Item
                        key={item.id}
                        value={`${item.label} ${item.hint || ''} ${item.id}`}
                        keywords={item.keywords}
                        onSelect={() => run(item.onSelect)}
                        className={s.item}
                      >
                        {Icon && <Icon size={18} aria-hidden="true" />}
                        <span className={s.itemText}>
                          <span className={s.itemLabel}>{item.label}</span>
                          {item.hint && <span className={s.itemHint}>{item.hint}</span>}
                        </span>
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              ))}
            </Command.List>
          </Command>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
