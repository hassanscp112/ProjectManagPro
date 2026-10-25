// ─────────────────────────────────────────────────────────────
// TaskRanking — ordering and search for task pickers.
//
// Leaf tasks with recent orders come first (latest order wins),
// then the rest in numeric WBS order (1.2 before 1.10). Shared by
// the legacy orders TaskPicker and the new src/ui TaskPicker so
// both rank identically.
// ─────────────────────────────────────────────────────────────

/** Numeric WBS segment compare: '1.2' sorts before '1.10'. */
export const wbsCompare = (a, b) => {
  const av = (a.wbs || '').split('.').map((n) => parseInt(n, 10) || 0);
  const bv = (b.wbs || '').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(av.length, bv.length);
  for (let i = 0; i < len; i++) {
    const x = av[i] || 0;
    const y = bv[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
};

/**
 * Rank leaf tasks for picking. Returns { recent, rest }: `recent` holds
 * tasks that have orders (newest recordedAt first), `rest` the others
 * in WBS order. Group tasks are skipped.
 */
export const rankLeafTasks = (tasks = [], orders = []) => {
  const lastOrderAt = new Map();
  (orders || []).forEach((o) => {
    if (!o || !o.taskId) return;
    const at = o.recordedAt || '';
    const prev = lastOrderAt.get(o.taskId);
    if (prev === undefined || at > prev) lastOrderAt.set(o.taskId, at);
  });
  const recent = [];
  const rest = [];
  (tasks || []).forEach((t) => {
    if (!t || t.isGroup) return;
    if (lastOrderAt.has(t.id)) recent.push(t);
    else rest.push(t);
  });
  recent.sort((a, b) => (lastOrderAt.get(b.id) || '').localeCompare(lastOrderAt.get(a.id) || ''));
  rest.sort(wbsCompare);
  return { recent, rest };
};

/** Case-insensitive substring match on "wbs name". Empty query matches all. */
export const filterTasks = (tasks, query) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) return tasks;
  return tasks.filter((t) => `${t.wbs || ''} ${t.name || ''}`.toLowerCase().includes(q));
};
