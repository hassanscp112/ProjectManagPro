import { useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { FOLDER_ORDER_PHOTOS } from '../../state/libraryModel.js';
import { buildOrderFromDraft, latestOrder, missingRequiredFields, repeatOrderDraft } from '../../state/orderForm.js';
import { useProject } from '../../state/projectContext.js';
import { useToast } from '../../ui/index.js';
import { deleteFiles, saveFile } from '../../utils/FileDB.js';
import { currentActor } from '../../utils/Identity.js';
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
 * Store the photos for an order → their file ids. All or nothing: when one
 * fails, the ones already stored are removed again and it throws.
 */
const storePhotos = async (orderId, photos) => {
  const ids = [];
  try {
    for (const p of photos) ids.push((await saveFile(FOLDER_ORDER_PHOTOS, p.file, { orderId })).id);
    return ids;
  } catch (err) {
    await deleteFiles(ids).catch(() => {});
    throw err;
  }
};

/**
 * The new-order draft: pick a type, edit fields, add photos, save. Saving
 * validates required fields (errors show only after a save attempt),
 * stores the photos, then the order with their ids as `evidence`, and
 * resolves to the order; the caller decides what comes next.
 * `initialDraft` opens the form prefilled (e.g. "repeat last order").
 * `photos` ([{ id, file, busy? }], see ui/PhotoPicker) sit beside the draft;
 * every new draft starts without photos.
 */
export function useOrderEntry(initialDraft = null) {
  const { t } = useI18n();
  const toast = useToast();
  const { tasks, identity } = useProject();
  const [draft, setDraft] = useState(initialDraft);
  const [photos, setPhotos] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false); // blocks a second submit before re-render
  const spec = draft ? ORDER_TYPES[draft.type] : null;
  const missing = useMemo(() => missingRequiredFields(draft, spec), [draft, spec]);
  const photosBusy = photos.some((p) => p.busy);

  // Smart defaults are read from storage, so a just-saved "who" applies at once.
  const freshDraft = (type) => createOrderDraft(type, { lastWho: loadOrdersData().lastWhoByType });

  const reset = (next) => {
    setShowErrors(false);
    setPhotos([]);
    setDraft(next);
  };

  const start = (type) => reset(freshDraft(type));

  const startFrom = (prefilled) => reset(prefilled);

  const clear = () => reset(null);

  const patch = (changes) => setDraft((d) => (d ? { ...d, ...changes } : d));

  /** Choosing a task autofills its BOQ unit and resets the element. */
  const setTask = (taskId) => {
    const task = tasks.find((x) => x.id === taskId) || null;
    patch({ taskId, elementId: '', unit: task?.unit || '' });
  };

  /**
   * Resolves to the saved order, or null when required fields are missing,
   * photos are still being prepared or a save is already running. When the
   * photos cannot be stored (IndexedDB full or blocked) the order is saved
   * without them and a warning shows.
   */
  const save = async () => {
    if (!draft || !spec || savingRef.current || photosBusy) return null;
    if (missing.length > 0) {
      setShowErrors(true);
      return null;
    }
    savingRef.current = true;
    setSaving(true);
    try {
      const id = createOrderId();
      const ready = photos.filter((p) => p.file);
      let evidence = [];
      if (ready.length > 0) {
        try {
          evidence = await storePhotos(id, ready);
        } catch {
          toast({ title: t('record.photosNotSaved'), description: t('record.photosNotSavedBody'), tone: 'danger', duration: 8000 });
        }
      }
      const order = buildOrderFromDraft(draft, spec, {
        tasks,
        userName: identity?.name || '',
        recordedById: currentActor().id,
        id,
        now: new Date().toISOString(),
        evidence,
      });
      addOrder(order);
      setShowErrors(false);
      setPhotos([]);
      return order;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  return {
    draft,
    spec,
    missing,
    showErrors,
    photos,
    setPhotos,
    photosBusy,
    saving,
    start,
    startFrom,
    clear,
    patch,
    setTask,
    save,
    freshDraft,
  };
}
