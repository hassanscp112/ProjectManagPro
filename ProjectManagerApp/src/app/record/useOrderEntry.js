import { useMemo, useState } from 'react';
import { buildOrderFromDraft, latestOrder, missingRequiredFields, repeatOrderDraft } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { ORDER_TYPES, addOrder, createOrderDraft, createOrderId, loadOrdersData } from '../../utils/OrderEngine.js';

/**
 * A prefilled draft requested by the page that navigated here, or null:
 *   { repeatLast: true } — Home's "repeat last order"
 *   { taskId }           — the Schedule panel's "record work on this item"
 *                          (quick work order on that task, its unit filled in)
 */
export const draftFromNavigation = (state, { orders = [], tasks = [] } = {}) => {
  if (state?.repeatLast) return repeatOrderDraft(latestOrder(orders));
  if (state?.taskId) {
    const task = tasks.find((x) => x.id === state.taskId);
    if (!task || task.isGroup) return null;
    const draft = createOrderDraft('quick_work', { lastWho: loadOrdersData().lastWhoByType });
    return draft && { ...draft, taskId: task.id, unit: task.unit || '' };
  }
  return null;
};

/**
 * The new-order draft: pick a type, edit fields, save. Saving validates
 * required fields (errors show only after a save attempt), stores the
 * order and returns it; the caller decides what comes next.
 * `initialDraft` opens the form prefilled (e.g. "repeat last order").
 */
export function useOrderEntry(initialDraft = null) {
  const { tasks, identity } = useProject();
  const [draft, setDraft] = useState(initialDraft);
  const [showErrors, setShowErrors] = useState(false);
  const spec = draft ? ORDER_TYPES[draft.type] : null;
  const missing = useMemo(() => missingRequiredFields(draft, spec), [draft, spec]);

  // Smart defaults are read from storage, so a just-saved "who" applies at once.
  const freshDraft = (type) => createOrderDraft(type, { lastWho: loadOrdersData().lastWhoByType });

  const start = (type) => {
    setShowErrors(false);
    setDraft(freshDraft(type));
  };

  const startFrom = (prefilled) => {
    setShowErrors(false);
    setDraft(prefilled);
  };

  const clear = () => {
    setShowErrors(false);
    setDraft(null);
  };

  const patch = (changes) => setDraft((d) => (d ? { ...d, ...changes } : d));

  /** Choosing a task autofills its BOQ unit and resets the element. */
  const setTask = (taskId) => {
    const task = tasks.find((x) => x.id === taskId) || null;
    patch({ taskId, elementId: '', unit: task?.unit || '' });
  };

  /** Returns the saved order, or null when required fields are missing. */
  const save = () => {
    if (!draft || !spec) return null;
    if (missing.length > 0) {
      setShowErrors(true);
      return null;
    }
    const order = buildOrderFromDraft(draft, spec, {
      tasks,
      userName: identity?.name || '',
      id: createOrderId(),
      now: new Date().toISOString(),
    });
    addOrder(order);
    setShowErrors(false);
    return order;
  };

  return { draft, spec, missing, showErrors, start, startFrom, clear, patch, setTask, save, freshDraft };
}
