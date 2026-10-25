// ─────────────────────────────────────────────────────────────
// homeModel — what the Home screen shows, as pure functions.
//
// Same rules as the old Dashboard: a leaf task is completed (progress ≥ 1),
// overdue (ended before today), active (today within its dates) or
// upcoming. "Needs attention" = overdue, then active, then tasks starting
// within the next 7 days; critical tasks first inside each group. Dates
// are local 'YYYY-MM-DD' strings. Tested in __tests__/homeModel.test.js.
// ─────────────────────────────────────────────────────────────

const KIND_ORDER = { overdue: 0, active: 1, upcoming: 2 };
const UPCOMING_WINDOW_DAYS = 7;

/** 'YYYY-MM-DD' + n days (local calendar). */
export const addDays = (day, n) => {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Classify one computed leaf task relative to today. */
export const taskStatus = (task, today) => {
  if (task.progress >= 1) return 'completed';
  if (task.endDate && task.endDate < today) return 'overdue';
  if (task.startDate && task.startDate <= today && task.endDate >= today) return 'active';
  if (task.startDate && task.startDate > today) return 'upcoming';
  return null;
};

/**
 * Counts per status plus the attention list:
 * { counts: { overdue, active, upcoming, completed }, items: [{ task, kind }] }.
 */
export const attentionItems = (tasks = [], today) => {
  const counts = { overdue: 0, active: 0, upcoming: 0, completed: 0 };
  const soon = addDays(today, UPCOMING_WINDOW_DAYS);
  const items = [];
  tasks.forEach((task) => {
    if (!task || task.isGroup) return;
    const kind = taskStatus(task, today);
    if (!kind) return;
    counts[kind] += 1;
    if (kind === 'overdue' || kind === 'active' || (kind === 'upcoming' && task.startDate <= soon)) {
      items.push({ task, kind });
    }
  });
  items.sort((a, b) => {
    if (a.kind !== b.kind) return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (!!a.task.isCritical !== !!b.task.isCritical) return a.task.isCritical ? -1 : 1;
    const ka = a.kind === 'upcoming' ? a.task.startDate : a.task.endDate;
    const kb = b.kind === 'upcoming' ? b.task.startDate : b.task.endDate;
    return (ka || '').localeCompare(kb || '');
  });
  return { counts, items };
};

/**
 * SPI / CPI tone: ≥ 1 on track, ≥ 0.9 watch, below that behind. Judged on
 * the value as displayed (2 decimals), so "1.00" is never shown in amber.
 */
export const indexTone = (value) => {
  const v = Math.round((Number(value) || 0) * 100) / 100;
  if (v >= 1) return 'success';
  if (v >= 0.9) return 'warning';
  return 'danger';
};

/** Top-level sections in WBS order with progress = EV / BAC (0–100). */
export const sectionProgress = (perWbsEvm = []) =>
  [...perWbsEvm]
    .sort((a, b) => (parseInt(a.wbs, 10) || 0) - (parseInt(b.wbs, 10) || 0))
    .map((row) => ({ ...row, pct: row.bac > 0 ? Math.min(100, (row.ev / row.bac) * 100) : 0 }));

/** Round an axis maximum up to 1 / 2 / 5 × 10ⁿ so gridlines read well. */
export const niceCeil = (value) => {
  if (!(value > 0)) return 1;
  const base = Math.pow(10, Math.floor(Math.log10(value)));
  const norm = value / base;
  const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10;
  return nice * base;
};

/** Index of the last S-curve point on or before today (-1 if none). */
export const todayIndex = (points = [], today) => {
  let idx = -1;
  points.forEach((p, i) => {
    if (p.date <= today) idx = i;
  });
  return idx;
};
