import * as Popover from '@radix-ui/react-popover';
import { Command } from 'cmdk';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { filterTasks, rankLeafTasks } from '../utils/TaskRanking.js';
import { IconButton } from './Button.jsx';
import { cx } from './cx.js';
import { useField } from './fieldContext.js';
import s from './Picker.module.css';

const LIMIT = 40;

function TaskItem({ task, selected, onPick }) {
  const { t } = useI18n();
  return (
    <Command.Item value={task.id} onSelect={() => onPick(task.id)} className={s.item}>
      <span className={cx(s.wbs, 'ui-ltr')}>{task.wbs}</span>
      <span className={s.itemText}>
        <span className={s.itemLabel}>{task.name || t('ui.unnamedTask')}</span>
      </span>
      {task.unit && <span className={s.unit}>{task.unit}</span>}
      {selected && <Check size={16} aria-hidden="true" />}
    </Command.Item>
  );
}

/**
 * Searchable leaf-task picker. Recently ordered tasks first, then WBS
 * order (same ranking as everywhere else). `hint(task)` can return a
 * second line under the chosen task, e.g. remaining quantity.
 */
export function TaskPicker({ tasks = [], orders = [], value, onChange, optional = false, placeholder, hint }) {
  const { t } = useI18n();
  const field = useField();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const { recent, rest } = useMemo(() => rankLeafTasks(tasks, orders), [tasks, orders]);
  const matches = useMemo(() => filterTasks([...recent, ...rest], query), [recent, rest, query]);
  const selected = value ? tasks.find((x) => x.id === value) || null : null;

  const pick = (id) => {
    onChange?.(id);
    setOpen(false);
    setQuery('');
  };

  const searching = query.trim() !== '';
  const shownRecent = recent.slice(0, 8);
  const shownRest = rest.slice(0, Math.max(0, LIMIT - shownRecent.length));
  const hidden = searching ? matches.length - LIMIT : recent.length + rest.length - shownRecent.length - shownRest.length;

  return (
    <div className={s.pickerRow}>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            id={field?.id}
            aria-describedby={field?.describedBy}
            className={s.trigger}
          >
            <span className={s.triggerText}>
              {selected ? (
                <>
                  <span className={s.triggerLabel}>
                    <span className="ui-ltr">{selected.wbs}</span> {selected.name || t('ui.unnamedTask')}
                  </span>
                  {hint && hint(selected) && <span className={s.triggerHint}>{hint(selected)}</span>}
                </>
              ) : (
                <span className={cx(s.triggerLabel, s.placeholder)}>{placeholder || t('ui.pickTask')}</span>
              )}
            </span>
            <ChevronDown size={18} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className={cx('ui-portal', s.popover)}>
            <Command shouldFilter={false} label={t('ui.pickTask')}>
              <div className={s.searchRow}>
                <Search size={16} aria-hidden="true" />
                <Command.Input
                  value={query}
                  onValueChange={setQuery}
                  placeholder={t('ui.searchTasks')}
                  className={s.searchInput}
                />
              </div>
              <Command.List className={s.list}>
                <Command.Empty className={s.empty}>{t('ui.noTasks')}</Command.Empty>
                {searching ? (
                  matches.slice(0, LIMIT).map((task) => (
                    <TaskItem key={task.id} task={task} selected={task.id === value} onPick={pick} />
                  ))
                ) : (
                  <>
                    {shownRecent.length > 0 && (
                      <Command.Group heading={t('ui.recentTasks')}>
                        {shownRecent.map((task) => (
                          <TaskItem key={task.id} task={task} selected={task.id === value} onPick={pick} />
                        ))}
                      </Command.Group>
                    )}
                    <Command.Group heading={t('ui.allTasks')}>
                      {shownRest.map((task) => (
                        <TaskItem key={task.id} task={task} selected={task.id === value} onPick={pick} />
                      ))}
                    </Command.Group>
                  </>
                )}
              </Command.List>
              {hidden > 0 && <div className={s.more}>{t('ui.moreTasks', { n: hidden })}</div>}
            </Command>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {optional && selected && <IconButton icon={X} label={t('ui.clear')} onClick={() => onChange?.('')} />}
    </div>
  );
}
