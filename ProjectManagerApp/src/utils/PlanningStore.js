// ═══════════════════════════════════════════════════════════
// PlanningStore — persistence + helpers for the rolling
// lookahead plans (monthly targets / weekly assignments /
// daily crews). Plain JS, localStorage only, no dependencies.
//
// Storage key: 'pm-plans'
//   {
//     months: { 'YYYY-MM':    { targets:     [{ id, taskId, quantity, note }] } },
//     weeks:  { 'YYYY-Www':   { assignments: [{ id, taskId, who, note }] } },
//     days:   { 'YYYY-MM-DD': { assignments: [{ id, taskId, who, note }] } },
//   }
// who = { kind: 'count' | 'team' | 'workers' | 'contractor',
//         count?, teamId?, workerIds?, contractorId? }
// ═══════════════════════════════════════════════════════════

import { loadLanguage, translate } from '../i18n/index.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const PLANS_STORAGE_KEY = 'pm-plans';

const WHO_KINDS = ['count', 'team', 'workers', 'contractor'];

export const createPlanId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `plan_${Date.now()}_${Math.random().toString(36).slice(2)}`;

/* ─────────────────────────────────────────────
   Date helpers (plain JS, UTC-safe)
   ───────────────────────────────────────────── */

const parseYmd = (dateStr) => {
  if (typeof dateStr !== 'string') return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatYmd = (date) => date.toISOString().split('T')[0];

export const todayStr = () => formatYmd(new Date());

export const addDaysDate = (dateStr, days) => {
  const date = parseYmd(dateStr);
  if (!date) return dateStr;
  date.setUTCDate(date.getUTCDate() + days);
  return formatYmd(date);
};

// 'YYYY-MM-DD' -> 'YYYY-MM'
export const monthKey = (dateStr) =>
  typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)
    ? dateStr.slice(0, 7)
    : '';

export const addMonthsKey = (mKey, delta) => {
  const parts = String(mKey || '').split('-').map(Number);
  if (parts.length !== 2 || parts.some((p) => !Number.isFinite(p))) return mKey;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

// ISO-8601 week: Monday starts the week, the week holding Jan 4 is week 1.
// 'YYYY-MM-DD' -> 'YYYY-Www'
export const isoWeekKey = (dateStr) => {
  const date = parseYmd(dateStr);
  if (!date) return '';
  const dayNum = (date.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3); // this week's Thursday decides the ISO year
  const isoYear = date.getUTCFullYear();
  const jan4 = new Date(Date.UTC(isoYear, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const week1Thursday = new Date(Date.UTC(isoYear, 0, 4 - jan4DayNum + 3));
  const week = 1 + Math.round((date.getTime() - week1Thursday.getTime()) / WEEK_MS);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
};

// 'YYYY-Www' -> { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } (Monday … Sunday),
// or null when the key is malformed / the week doesn't exist (e.g. W53 of a short year).
export const isoWeekRange = (weekKey) => {
  const match = /^(\d{4})-W(\d{1,2})$/.exec(String(weekKey || ''));
  if (!match) return null;
  const year = Number(match[1]);
  const week = Number(match[2]);
  if (week < 1 || week > 53) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4DayNum = (jan4.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(year, 0, 4 - jan4DayNum));
  monday.setUTCDate(monday.getUTCDate() + (week - 1) * 7);
  const expected = `${year}-W${String(week).padStart(2, '0')}`;
  if (isoWeekKey(formatYmd(monday)) !== expected) return null;
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  return { start: formatYmd(monday), end: formatYmd(sunday) };
};

export const addWeeksKey = (weekKey, delta) => {
  const range = isoWeekRange(weekKey);
  if (!range) return weekKey;
  return isoWeekKey(addDaysDate(range.start, delta * 7));
};

/* ─────────────────────────────────────────────
   who normalization + display
   ───────────────────────────────────────────── */

// Keeps whatever fields are present (validated), so switching picker modes
// never destroys data: loose → tight, never blocks.
export const normalizeWho = (who) => {
  const w = who && typeof who === 'object' ? who : {};
  const normalized = { kind: WHO_KINDS.includes(w.kind) ? w.kind : 'count' };
  const count = Number(w.count);
  if (w.count !== undefined && w.count !== null && Number.isFinite(count)) {
    normalized.count = Math.max(0, count);
  }
  if (typeof w.teamId === 'string' && w.teamId) normalized.teamId = w.teamId;
  if (typeof w.contractorId === 'string' && w.contractorId) normalized.contractorId = w.contractorId;
  if (Array.isArray(w.workerIds)) normalized.workerIds = w.workerIds.filter((id) => typeof id === 'string' && id);
  return normalized;
};

const teamSizeOf = (team) => {
  if (!team) return 0;
  const size = Number(team.defaultSize);
  if (Number.isFinite(size) && size > 0) return size;
  return Array.isArray(team.memberWorkerIds) ? team.memberWorkerIds.length : 0;
};

// → '12 عامل' / 'فريق: طقم علي (10)' / 'أحمد، حسين +1'
// English ('12 workers' / 'Team: Ali crew (10)') when `lang` is 'en';
// every other language keeps the Arabic literals above unchanged.
const whoText = (lang, ar, key, vars) => (lang === 'en' ? translate(lang, key, vars) : ar);

export const whoLabel = (who, registries, lang = loadLanguage()) => {
  const w = normalizeWho(who);
  const regs = registries && typeof registries === 'object' ? registries : {};

  if (w.kind === 'team') {
    const team = (regs.teams || []).find((t) => t && t.id === w.teamId);
    if (!team) return whoText(lang, 'فريق غير محدد', 'planning.teamUnspecified');
    const size = teamSizeOf(team);
    const name = team.name || whoText(lang, 'بدون اسم', 'planning.unnamed');
    return `${whoText(lang, 'فريق:', 'planning.teamPrefix')} ${name}${size ? ` (${size})` : ''}`;
  }
  if (w.kind === 'contractor') {
    const contractor = (regs.contractors || []).find((c) => c && c.id === w.contractorId);
    if (!contractor) return whoText(lang, 'مقاول غير محدد', 'planning.contractorUnspecified');
    return `${whoText(lang, 'مقاول:', 'planning.contractorPrefix')} ${
      contractor.name || whoText(lang, 'بدون اسم', 'planning.unnamed')
    }`;
  }
  if (w.kind === 'workers') {
    const ids = w.workerIds || [];
    if (!ids.length) return whoText(lang, 'لم يُحدد عمال', 'planning.workersUnspecified');
    const byId = new Map((regs.workers || []).map((wk) => [wk.id, wk]));
    const names = ids
      .map((id) => (byId.get(id) ? byId.get(id).name || whoText(lang, 'عامل', 'planning.workerFallback') : null))
      .filter(Boolean);
    if (!names.length) return whoText(lang, `${ids.length} عامل`, 'planning.workersCount', { count: ids.length });
    const sep = whoText(lang, '، ', 'planning.listSeparator');
    if (names.length <= 2) return names.join(sep);
    return `${names.slice(0, 2).join(sep)} +${names.length - 2}`;
  }
  // count
  const count = Number(w.count);
  if (!Number.isFinite(count) || count <= 0) return whoText(lang, 'لم يُحدد العدد', 'planning.countUnspecified');
  if (count === 1) return whoText(lang, 'عامل واحد', 'planning.oneWorker');
  if (count === 2) return whoText(lang, 'عاملان', 'planning.twoWorkers');
  return whoText(lang, `${count} عامل`, 'planning.workersCount', { count });
};

/* ─────────────────────────────────────────────
   Load / save
   ───────────────────────────────────────────── */

const normalizePlans = (raw) => {
  const plans = { months: {}, weeks: {}, days: {} };
  if (!raw || typeof raw !== 'object') return plans;

  const months = raw.months && typeof raw.months === 'object' ? raw.months : {};
  Object.entries(months).forEach(([key, value]) => {
    if (!/^\d{4}-\d{2}$/.test(key) || !value || typeof value !== 'object') return;
    const targets = Array.isArray(value.targets)
      ? value.targets.filter((t) => t && typeof t === 'object' && t.id && t.taskId)
      : [];
    if (targets.length) plans.months[key] = { targets };
  });

  ['weeks', 'days'].forEach((scope) => {
    const bucket = raw[scope] && typeof raw[scope] === 'object' ? raw[scope] : {};
    Object.entries(bucket).forEach(([key, value]) => {
      const keyOk = scope === 'weeks' ? /^\d{4}-W\d{2}$/.test(key) : /^\d{4}-\d{2}-\d{2}$/.test(key);
      if (!keyOk || !value || typeof value !== 'object') return;
      const assignments = Array.isArray(value.assignments)
        ? value.assignments
            .filter((a) => a && typeof a === 'object' && a.id && a.taskId)
            .map((a) => ({ ...a, who: normalizeWho(a.who) }))
        : [];
      if (assignments.length) plans[scope][key] = { assignments };
    });
  });

  return plans;
};

export const loadPlans = () => {
  try {
    const saved = localStorage.getItem(PLANS_STORAGE_KEY);
    if (!saved) return { months: {}, weeks: {}, days: {} };
    return normalizePlans(JSON.parse(saved));
  } catch {
    return { months: {}, weeks: {}, days: {} };
  }
};

export const savePlans = (plans) => {
  try {
    localStorage.setItem(PLANS_STORAGE_KEY, JSON.stringify(plans));
  } catch {
    // storage full / unavailable — planning continues in memory
  }
};

/* ─────────────────────────────────────────────
   Read helpers
   ───────────────────────────────────────────── */

export const getMonthPlans = (plans, mKey) => {
  const bucket = plans && plans.months && plans.months[mKey];
  return bucket && Array.isArray(bucket.targets) ? bucket.targets : [];
};

const getAssignments = (plans, scope, key) => {
  const bucket = plans && plans[scope] && plans[scope][key];
  return bucket && Array.isArray(bucket.assignments) ? bucket.assignments : [];
};

export const getWeekPlans = (plans, weekKey) => getAssignments(plans, 'weeks', weekKey);

export const getDayPlans = (plans, dateStr) => getAssignments(plans, 'days', dateStr);

/* ─────────────────────────────────────────────
   Write helpers (all immutable — return NEW plans)
   ───────────────────────────────────────────── */

const setScopeBucket = (plans, scope, key, bucket) => {
  const scopeObj = { ...plans[scope] };
  if (bucket === null) delete scopeObj[key];
  else scopeObj[key] = bucket;
  return { ...plans, [scope]: scopeObj };
};

// target = { id, taskId, quantity, note }
export const upsertTarget = (plans, mKey, target) => {
  const list = getMonthPlans(plans, mKey);
  const idx = list.findIndex((t) => t.id === target.id);
  const next = idx === -1 ? [...list, target] : list.map((t, i) => (i === idx ? target : t));
  return setScopeBucket(plans, 'months', mKey, { targets: next });
};

export const deleteTarget = (plans, mKey, targetId) => {
  const next = getMonthPlans(plans, mKey).filter((t) => t.id !== targetId);
  return setScopeBucket(plans, 'months', mKey, next.length ? { targets: next } : null);
};

// scope: 'weeks' | 'days' — assignment = { id, taskId, who, note }
export const upsertAssignment = (plans, scope, key, assignment) => {
  const list = getAssignments(plans, scope, key);
  const normalized = { ...assignment, who: normalizeWho(assignment.who) };
  const idx = list.findIndex((a) => a.id === normalized.id);
  const next = idx === -1 ? [...list, normalized] : list.map((a, i) => (i === idx ? normalized : a));
  return setScopeBucket(plans, scope, key, { assignments: next });
};

export const deleteAssignment = (plans, scope, key, assignmentId) => {
  const next = getAssignments(plans, scope, key).filter((a) => a.id !== assignmentId);
  return setScopeBucket(plans, scope, key, next.length ? { assignments: next } : null);
};

// Same-as-yesterday / same-as-last-week: copy source period's assignments
// into the target period with fresh ids. mode 'replace' (default) drops the
// target's current assignments; 'merge' appends after them.
export const cloneDayPlan = (plans, sourceDateStr, targetDateStr, mode = 'replace') =>
  cloneAssignments(plans, 'days', sourceDateStr, targetDateStr, mode);

export const cloneWeekPlan = (plans, sourceWeekKey, targetWeekKey, mode = 'replace') =>
  cloneAssignments(plans, 'weeks', sourceWeekKey, targetWeekKey, mode);

const cloneAssignments = (plans, scope, sourceKey, targetKey, mode) => {
  const source = getAssignments(plans, scope, sourceKey);
  if (!source.length || sourceKey === targetKey) return plans;
  const copies = source.map((a) => ({
    ...a,
    id: createPlanId(),
    who: normalizeWho(a.who),
  }));
  const existing = mode === 'merge' ? getAssignments(plans, scope, targetKey) : [];
  return setScopeBucket(plans, scope, targetKey, { assignments: [...existing, ...copies] });
};
