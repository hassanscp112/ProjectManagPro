import { useMemo, useState } from 'react';
import { buildOrderFromDraft, missingRequiredFields } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { ORDER_TYPES, addOrder, createOrderDraft, createOrderId, loadOrdersData } from '../../utils/OrderEngine.js';

/**
 * The new-order draft: pick a type, edit fields, save. Saving validates
 * required fields (errors show only after a save attempt), stores the
 * order and returns it; the caller decides what comes next.
 */
export function useOrderEntry() {
  const { tasks, identity } = useProject();
  const [draft, setDraft] = useState(null);
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
