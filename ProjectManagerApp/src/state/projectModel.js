// ─────────────────────────────────────────────────────────────
// projectModel — the task tree and project lifecycle as pure functions.
//
// Moved out of the old App.jsx with identical behavior. Every function
// takes the current data and returns new data; nothing here touches
// React or storage (ProjectProvider does that), so all of it is tested
// in __tests__/projectModel.test.js. Text such as default task names
// is passed in by the caller (already translated).
// ─────────────────────────────────────────────────────────────

export const TASKS_STORAGE_KEY = 'project-manager-gantt-tasks';
export const META_STORAGE_KEY = 'project-manager-project-meta';
export const PROJECT_START = '2025-08-02';

export const DEFAULT_META = { status: 'draft', baseline: null, variations: [] };

/** Lifecycle status → dictionary key for its label. */
export const STATUS_KEYS = {
  draft: 'common.statusDraft',
  signed: 'common.statusSigned',
  executing: 'common.statusExecuting',
  completed: 'common.statusCompleted',
};

/** Variation-order classification codes (stored on records; labels via i18n). */
export const VO_CLASS_KEYS = {
  qty: 'app.vo.classQty',
  price: 'app.vo.classPrice',
  scope: 'app.vo.classScope',
  add: 'app.vo.classAdd',
  remove: 'app.vo.classRemove',
};

export const EMPTY_VO_DRAFT = {
  taskId: '',
  field: 'quantity',
  newValue: '',
  reason: '',
  approver: '',
  urgency: 'medium',
  classification: '',
  estCostImpact: '',
  estScheduleDays: '',
  clauseRef: 'FIDIC 13.x',
};

/** The real canal-contract WBS, used only when storage is empty. */
export const INITIAL_TASKS = [
  { id: '0', wbs: '0', name: 'تجهيز الموقع', isGroup: true, manualStart: '2025-08-02', duration: 14, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '0.1', wbs: '0.1', name: 'تجهيز الموقع', isGroup: false, manualStart: '2025-08-02', duration: 14, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },

  { id: '1', wbs: '1', name: 'اولا / الحفريات', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '1.1', wbs: '1.1', name: 'تجهيز المعدات اللازمة وتنفيذ اعمال الحفريات الترابية للقنوات وبموجب الابعاد والمناسيب الواردة في المخططات وتشمل السعر حفر ونقل كافة انواع...', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '1.1.1', wbs: '1.1.1', name: 'حفر القنوات الفرعية', isGroup: false, manualStart: '2025-08-23', duration: 60, quantity: 9413.4, actualQuantity: 9413, unitPrice: 1350, unit: 'م3', dependsOn: '0.1', depType: 'FS', lag: 7 },

  { id: '2', wbs: '2', name: 'ثانيا/الاملاءات الترابية', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '2.1', wbs: '2.1', name: 'تجهيز المعدات اللازمة وتنفيذ اعمال الاملاءات الترابية للقنوات وبموجب الابعاد والمناسيب الواردة في المخططات وتشمل السعر حفر ونقل وفرش الترب...', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '2.1.1', wbs: '2.1.1', name: 'دفن القناة الرئيسية MC7', isGroup: false, duration: 30, quantity: 16000, actualQuantity: 0, unitPrice: 5000, unit: 'م3', dependsOn: '1.1.1', depType: 'SS', lag: 0 },
  { id: '2.1.2', wbs: '2.1.2', name: 'دفن القنوات الفرعية', isGroup: false, duration: 238, quantity: 142535.6, actualQuantity: 135000, unitPrice: 6000, unit: 'م3', dependsOn: '2.1.1', depType: 'FS', lag: 16 },
  { id: '2.1.3', wbs: '2.1.3', name: 'دفن القنوات المغذية', isGroup: false, duration: 238, quantity: 95590.6, actualQuantity: 0, unitPrice: 6000, unit: 'م3', dependsOn: '2.1.2', depType: 'FS', lag: -78 },

  { id: '3', wbs: '3', name: 'ثالثا/التبطين', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '3.1.1', wbs: '3.1.1', name: 'تبطين القناة الرئيسية MC7 بسمك 10 سم', isGroup: false, duration: 17, quantity: 3400, actualQuantity: 0, unitPrice: 18500, unit: 'm2', dependsOn: '1.1.1', depType: 'FF', lag: 0 },
  { id: '3.1.2', wbs: '3.1.2', name: 'تبطين القنوات الفرعية بسمك 8 سم', isGroup: false, duration: 127, quantity: 76087.4, actualQuantity: 0, unitPrice: 17500, unit: 'm2', dependsOn: '3.1.1', depType: 'FF', lag: -90 },
  { id: '3.1.3', wbs: '3.1.3', name: 'تبطين القنوات المغذية بسمك 6 سم', isGroup: false, duration: 198, quantity: 59514, actualQuantity: 0, unitPrice: 16450, unit: 'm2', dependsOn: '3.1.2', depType: 'FF', lag: -78 },
];

/* ─────────────── Loading / ids ─────────────── */

/** Stored task tree, or the seed tree when storage is empty or broken. */
export const loadTasks = (storage = globalThis.localStorage) => {
  try {
    const saved = storage?.getItem(TASKS_STORAGE_KEY);
    if (!saved) return INITIAL_TASKS;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_TASKS;
  } catch {
    return INITIAL_TASKS;
  }
};

/** Stored project meta merged over the defaults. */
export const loadMeta = (storage = globalThis.localStorage) => {
  try {
    const saved = storage?.getItem(META_STORAGE_KEY);
    if (!saved) return { ...DEFAULT_META };
    return { ...DEFAULT_META, ...JSON.parse(saved) };
  } catch {
    return { ...DEFAULT_META };
  }
};

/** crypto.randomUUID with a time-based fallback (house convention). */
export const createTaskId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

/* ─────────────── Tree helpers ─────────────── */

/** The task's id plus every descendant id (by WBS prefix). */
export const getTaskAndDescendantIds = (tasks, taskId) => {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return new Set();
  const ids = new Set([task.id]);
  if (task.wbs) {
    const prefix = `${task.wbs}.`;
    tasks.forEach((item) => {
      if (item.wbs?.startsWith(prefix)) ids.add(item.id);
    });
  }
  return ids;
};

const maxTopLevelWbs = (tasks) => {
  let max = 0;
  tasks.forEach((t) => {
    if (t.wbs && !t.wbs.includes('.')) {
      const num = parseInt(t.wbs, 10);
      if (!isNaN(num) && num > max) max = num;
    }
  });
  return max;
};

const nextChildWbs = (tasks, parent) => {
  const prefix = (parent.wbs || '') + '.';
  let maxSuffix = 0;
  tasks.forEach((t) => {
    if (t.wbs && t.wbs.startsWith(prefix)) {
      const parts = t.wbs.split('.');
      const last = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(last) && last > maxSuffix) maxSuffix = last;
    }
  });
  return `${parent.wbs}.${maxSuffix + 1}`;
};

const blankTask = ({ id, wbs, name, isGroup, start }) => ({
  id,
  wbs,
  name,
  isGroup,
  manualStart: start,
  duration: 1,
  quantity: 0,
  actualQuantity: 0,
  unitPrice: 0,
  unit: '',
  dependsOn: null,
  depType: '',
  lag: 0,
});

/* ─────────────── Task edits ─────────────── */

/** Clean a task coming from an editor: no dependency → no type, no lag. */
export const normalizeTaskUpdate = (task) => ({
  ...task,
  dependsOn: task.dependsOn || null,
  depType: task.dependsOn ? task.depType || 'FS' : '',
  lag: task.dependsOn ? task.lag : 0,
});

export const replaceTask = (tasks, updated) => tasks.map((t) => (t.id === updated.id ? updated : t));

/** Append a new top-level group numbered after the highest section. */
export const addMainTask = (tasks, { id, name, start = PROJECT_START }) => [
  ...tasks,
  blankTask({ id, wbs: String(maxTopLevelWbs(tasks) + 1), name, isGroup: true, start }),
];

/** Insert a new leaf after the parent's last descendant. */
export const addSubTask = (tasks, parentId, { id, name, start = PROJECT_START }) => {
  const parentIndex = tasks.findIndex((t) => t.id === parentId);
  if (parentIndex === -1) return tasks;
  const parent = tasks[parentIndex];
  const prefix = parent.wbs + '.';
  let insertIndex = parentIndex;
  tasks.forEach((t, idx) => {
    if (t.wbs && t.wbs.startsWith(prefix) && idx > insertIndex) insertIndex = idx;
  });
  const copy = [...tasks];
  copy.splice(insertIndex + 1, 0, blankTask({ id, wbs: nextChildWbs(tasks, parent), name, isGroup: false, start }));
  return copy;
};

/** Remove a task and its descendants; clear dependencies pointing at them. */
export const deleteTaskCascade = (tasks, taskId) => {
  const ids = getTaskAndDescendantIds(tasks, taskId);
  return tasks
    .filter((task) => !ids.has(task.id))
    .map((task) => (ids.has(task.dependsOn) ? { ...task, dependsOn: null, depType: '', lag: 0 } : task));
};

/** What a delete would remove: { task, count, dependencyCount } or null. */
export const describeDelete = (tasks, taskId) => {
  if (!taskId) return null;
  const ids = getTaskAndDescendantIds(tasks, taskId);
  return {
    task: tasks.find((task) => task.id === taskId),
    count: ids.size,
    dependencyCount: tasks.filter((task) => ids.has(task.dependsOn)).length,
  };
};

/* ─────────────── BOQ links ─────────────── */

// Index after which a new BOQ child goes: the parent's last contiguous descendant.
const findBoqInsertIndex = (list, parent) => {
  const prefix = (parent.wbs || '') + '.';
  let idx = list.findIndex((t) => t.id === parent.id);
  if (idx === -1) return list.length - 1;
  for (let i = idx + 1; i < list.length; i++) {
    if (list[i].wbs && list[i].wbs.startsWith(prefix)) idx = i;
    else break;
  }
  return idx;
};

/**
 * Link / unlink an element column to a BOQ leaf.
 * checked → create a child leaf (if not linked yet) and link it;
 * unchecked → unlink, keep the leaf with the column's last sum as quantity.
 */
export const toggleBoqLink = (tasks, parentTaskId, column, checked, { id, name }) => {
  const parent = tasks.find((t) => t.id === parentTaskId);
  if (!parent) return tasks;

  if (checked) {
    const existing = (parent.elementColumns || []).find((c) => c.id === column.id);
    if (existing?.linkedTaskId) return tasks;
    const newLeaf = {
      ...blankTask({
        id,
        wbs: nextChildWbs(tasks, parent),
        name: column.name || name,
        isGroup: false,
        start: parent.manualStart || PROJECT_START,
      }),
      unit: column.unit || '',
      boqLink: { parentId: parent.id, colId: column.id, mode: 'created' },
    };
    const insertAt = findBoqInsertIndex(tasks, parent);
    const withLink = tasks.map((t) =>
      t.id !== parentTaskId
        ? t
        : {
            ...t,
            elementColumns: (t.elementColumns || []).map((c) => (c.id === column.id ? { ...c, linkedTaskId: newLeaf.id } : c)),
          }
    );
    const result = [...withLink];
    result.splice(insertAt + 1, 0, newLeaf);
    return result;
  }

  const linkedTaskId = column.linkedTaskId;
  const sum = (parent.elements || []).reduce((acc, el) => {
    const v = Number(el?.values?.[column.id]);
    return acc + (Number.isFinite(v) ? v : 0);
  }, 0);
  return tasks.map((t) => {
    if (t.id === parentTaskId) {
      return {
        ...t,
        elementColumns: (t.elementColumns || []).map((c) => (c.id === column.id ? { ...c, linkedTaskId: null } : c)),
      };
    }
    if (linkedTaskId && t.id === linkedTaskId) {
      const cleaned = { ...t };
      delete cleaned.boqLink;
      delete cleaned.boqLinked;
      return { ...cleaned, quantity: sum };
    }
    return t;
  });
};

/**
 * Link an element column to an EXISTING leaf. The leaf's contract quantity
 * stays authoritative (mode 'existing'); the column sum is for reconciliation.
 */
export const linkExistingBoq = (tasks, parentTaskId, column, leafTaskId) => {
  if (!leafTaskId || !tasks.some((t) => t.id === leafTaskId)) return tasks;
  return tasks.map((t) => {
    if (t.id === leafTaskId) return { ...t, boqLink: { parentId: parentTaskId, colId: column.id, mode: 'existing' } };
    if (t.id === parentTaskId) {
      return {
        ...t,
        elementColumns: (t.elementColumns || []).map((c) => (c.id === column.id ? { ...c, linkedTaskId: leafTaskId } : c)),
      };
    }
    return t;
  });
};

/* ─────────────── Lifecycle ─────────────── */

/**
 * Sign off (or re-baseline): freeze BOQ-linked contract quantities into the
 * raw tasks, snapshot the baseline, move draft → signed.
 */
export const signOffProject = (tasks, computedTasks, meta, signedBy, signedAt) => {
  const computedById = new Map(computedTasks.map((t) => [t.id, t]));
  const frozenTasks = tasks.map((t) => {
    const c = computedById.get(t.id);
    return c && c.boqLinked && typeof c.qty === 'number' ? { ...t, quantity: c.qty } : t;
  });
  const baselineTasks = {};
  frozenTasks.forEach((t) => {
    baselineTasks[t.id] = {
      quantity: t.quantity,
      unitPrice: t.unitPrice,
      unit: t.unit,
      duration: t.duration,
      manualStart: t.manualStart,
      name: t.name,
      wbs: t.wbs,
    };
  });
  return {
    tasks: frozenTasks,
    meta: {
      ...meta,
      status: meta.status === 'draft' ? 'signed' : meta.status,
      baseline: {
        signedAt,
        signedBy: signedBy || (meta.baseline && meta.baseline.signedBy) || '',
        tasks: baselineTasks,
      },
    },
    leafCount: frozenTasks.filter((task) => task.isGroup === false).length,
  };
};

/**
 * Apply a Variation Order to a locked contract field (quantity / unitPrice)
 * and build its FIDIC-style record. Returns { tasks, vo } or null.
 */
export const applyVariation = (tasks, draft, { id, date }) => {
  const { taskId, field, newValue, reason, approver, urgency, classification, estCostImpact, estScheduleDays, clauseRef } = draft;
  const task = tasks.find((t) => t.id === taskId);
  if (!task || !field) return null;
  const oldValue = task[field];
  const parsedNew = newValue === '' ? '' : Number(newValue);
  // Cost impact fallback: the quantity increase at contract price.
  // Rounded to 2 decimals so float noise (…399.999999966) never gets stored.
  const derivedCostImpact =
    estCostImpact === '' && field === 'quantity' && Number.isFinite(Number(newValue))
      ? Math.round(Math.max(0, Number(newValue) - Number(oldValue)) * (Number(task.unitPrice) || 0) * 100) / 100
      : null;
  return {
    tasks: tasks.map((t) => (t.id === taskId ? { ...t, [field]: parsedNew } : t)),
    vo: {
      id,
      date,
      taskId,
      taskWbs: task.wbs,
      taskName: task.name,
      type: field === 'unitPrice' ? 'price' : 'qty',
      field,
      oldValue,
      newValue: parsedNew,
      reason: reason || '',
      approver: approver || '',
      urgency: urgency || 'medium',
      classification: classification || (field === 'unitPrice' ? 'price' : 'qty'),
      estCostImpact: estCostImpact === '' ? derivedCostImpact : Number(estCostImpact),
      estScheduleDays: estScheduleDays === '' ? null : Number(estScheduleDays),
      clauseRef: clauseRef || '',
      status: 'issued',
    },
  };
};

/** Append a generated template tree, renumbering its top level past the current sections. */
export const appendGeneratedTasks = (tasks, generated) => {
  const maxMain = maxTopLevelWbs(tasks);
  const remapped = generated.map((t) => {
    const parts = String(t.wbs || '').split('.');
    const first = parseInt(parts[0], 10);
    if (!isNaN(first)) parts[0] = String(first + maxMain);
    return { ...t, wbs: parts.join('.') };
  });
  return { tasks: [...tasks, ...remapped], added: remapped.length };
};

/** Formal orders still awaiting approval (the Record badge). */
export const countPendingApprovals = (orders = []) =>
  orders.filter((o) => o && o.tier === 'formal' && o.status === 'recorded').length;
