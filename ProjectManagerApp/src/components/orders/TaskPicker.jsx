import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { filterTasks, rankLeafTasks } from '../../utils/TaskRanking.js';
import './TaskPicker.css';

/**
 * Searchable leaf-task picker: filters tasks (!isGroup) by wbs/name substring
 * and ranks them recent-first (tasks with more recent orders on top), so the
 * common case is one click away.
 */
const TaskPicker = ({ tasks = [], orders = [], value, onChange, optional = false }) => {
  const { t, dir } = useI18n();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  // Leaf tasks ranked: recently-ordered first (latest order wins), then WBS order.
  const ranked = useMemo(() => {
    const { recent, rest } = rankLeafTasks(tasks, orders);
    return [...recent, ...rest];
  }, [tasks, orders]);

  const filtered = useMemo(() => filterTasks(ranked, query), [ranked, query]);

  // Close the dropdown on any click outside.
  useEffect(() => {
    const onDocMouseDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  const selected = value ? tasks.find((t) => t.id === value) || null : null;
  const placeholder = optional ? t('orders.taskPickerOptional') : t('orders.taskPickerSearch');

  const handlePick = (task) => {
    onChange?.(task.id);
    setOpen(false);
    setQuery('');
  };

  const handleClear = () => {
    onChange?.('');
    setQuery('');
  };

  const shownResults = filtered.slice(0, 40);

  return (
    <div className="tp-root" ref={rootRef} dir={dir}>
      <div className="tp-control">
        <input
          className="tp-input"
          type="text"
          value={open ? query : selected ? `${selected.wbs || ''} — ${selected.name || ''}` : query}
          placeholder={placeholder}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        {selected && (
          <button type="button" className="tp-clear" onClick={handleClear} title={t('orders.removeTask')}>
            ✕
          </button>
        )}
      </div>

      {open && (
        <div className="tp-dropdown">
          {shownResults.length === 0 ? (
            <div className="tp-empty">{t('orders.noMatchingTasks')}</div>
          ) : (
            shownResults.map((task) => (
              <button
                type="button"
                key={task.id}
                className={`tp-item ${value === task.id ? 'active' : ''}`}
                onClick={() => handlePick(task)}
              >
                <span className="tp-item-wbs">{task.wbs}</span>
                <span className="tp-item-name">{task.name || t('orders.unnamedTask')}</span>
                {task.unit ? <span className="tp-item-unit">{task.unit}</span> : null}
              </button>
            ))
          )}
          {filtered.length > 40 && (
            <div className="tp-more">{t('orders.moreTasks', { n: filtered.length - 40 })}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskPicker;
