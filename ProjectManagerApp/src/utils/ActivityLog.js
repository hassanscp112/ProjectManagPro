import { loadLanguage, translate } from '../i18n/index.js';
import { notifyStoreChange } from './storeEvents.js';
import { projectKey } from './Projects.js';

// ─────────────────────────────────────────────────────────────────────────────
// ActivityLog — the app's unified event ledger utilities.
//
// Three kinds of dated, attributed records flow through the activity system:
//   • orders      (work orders + expenses, passed in as props)
//   • variations  (variation orders on contract fields, passed in as props)
//   • appEvents   (generic app events, persisted HERE in localStorage under
//                  the 'pm-activity' key — capped at 2000 entries)
//
// buildUnifiedFeed() merges all three into one normalized, date-descending
// array that the ActivityScreen renders as a timeline.
// ─────────────────────────────────────────────────────────────────────────────

export const ACTIVITY_STORAGE_KEY = 'pm-activity';
export const MAX_APP_EVENTS = 2000;

// Dictionary keys (activity.* module) for the pinned order `type` values.
// Display labels resolve per active language: translate(loadLanguage(), key).
export const ORDER_TYPE_KEYS = {
  quick_work: 'activity.typeQuickWork',
  completion: 'activity.typeCompletion',
  concrete_test: 'activity.typeConcreteTest',
  soil_test: 'activity.typeSoilTest',
  material: 'activity.typeMaterial',
  payroll: 'activity.typePayroll',
  machinery: 'activity.typeMachinery',
  fuel: 'activity.typeFuel',
  other_expense: 'activity.typeOtherExpense',
};

const createId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const fmtNum = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? '');
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
};

/* ── localStorage app events ─────────────────────────────────────────────── */

export const loadAppEvents = () => {
  try {
    const raw = localStorage.getItem(projectKey(ACTIVITY_STORAGE_KEY));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveAppEvents = (list) => {
  try {
    const arr = Array.isArray(list) ? list : [];
    // Keep the most recent MAX_APP_EVENTS entries (oldest dropped first).
    const capped = arr.length > MAX_APP_EVENTS ? arr.slice(arr.length - MAX_APP_EVENTS) : arr;
    localStorage.setItem(projectKey(ACTIVITY_STORAGE_KEY), JSON.stringify(capped));
    notifyStoreChange(ACTIVITY_STORAGE_KEY);
  } catch {
    // Storage unavailable (quota / private mode) — nothing we can do safely.
  }
};

// Append a generic app event: { actor, kind, summary, refType, refId, payload }.
// Returns the created event record.
export const logAppEvent = ({ actor = '', kind = '', summary = '', refType = '', refId = '', payload = {} }) => {
  const event = {
    id: createId(),
    at: new Date().toISOString(),
    actor,
    kind,
    summary,
    refType,
    refId,
    payload,
  };
  saveAppEvents([...loadAppEvents(), event]);
  return event;
};

/* ── unified feed ────────────────────────────────────────────────────────── */

// Merge orders + variations + appEvents into one normalized array, sorted
// date DESC (newest first). Entry shape:
//   { id, at, date, actor, kind: 'order'|'variation'|'event',
//     family, title, subtitle, tone: 'value'|'expense'|'variation'|'neutral',
//     refTaskId, payload: { order?|variation?|event? } }
export const buildUnifiedFeed = ({ orders = [], variations = [], appEvents = [] } = {}) => {
  const entries = [];
  const lang = loadLanguage();

  (Array.isArray(orders) ? orders : []).forEach((order) => {
    if (!order) return;
    const date = String(order.date || '').slice(0, 10);
    entries.push({
      id: order.id,
      at: order.recordedAt || (date ? `${date}T00:00:00` : ''),
      date,
      actor: order.recordedBy || '',
      kind: 'order',
      family: order.family || '',
      title: ORDER_TYPE_KEYS[order.type]
        ? translate(lang, ORDER_TYPE_KEYS[order.type])
        : translate(lang, 'activity.defaultOrderTitle'),
      subtitle: order.details?.note || order.category || '',
      tone: order.family === 'value' ? 'value' : 'expense',
      refTaskId: order.taskId || '',
      payload: { order },
    });
  });

  (Array.isArray(variations) ? variations : []).forEach((variation) => {
    if (!variation) return;
    const date = String(variation.date || '').slice(0, 10);
    entries.push({
      id: variation.id,
      at: variation.date || (date ? `${date}T00:00:00` : ''),
      date,
      actor: variation.approver || '',
      kind: 'variation',
      family: '',
      title: translate(
        lang,
        variation.field === 'unitPrice'
          ? 'activity.variationUnitPrice'
          : 'activity.variationContractQty'
      ),
      subtitle: variation.reason || '',
      tone: 'variation',
      refTaskId: variation.taskId || '',
      payload: { variation },
    });
  });

  (Array.isArray(appEvents) ? appEvents : []).forEach((event) => {
    if (!event) return;
    const date = String(event.at || '').slice(0, 10);
    entries.push({
      id: event.id,
      at: event.at || '',
      date,
      actor: event.actor || '',
      kind: 'event',
      family: '',
      title: event.summary || translate(lang, 'activity.defaultEventTitle'),
      subtitle: event.kind || '',
      tone: 'neutral',
      refTaskId: event.refType === 'task' ? event.refId : '',
      payload: { event },
    });
  });

  entries.sort(
    (a, b) => (b.date || '').localeCompare(a.date || '') || (b.at || '').localeCompare((a.at || ''))
  );
  return entries;
};

/* ── formatting / valuation helpers ──────────────────────────────────────── */

// '9,413 ← 10,200' style diff strings (old value on the right, new on the
// left — same direction the VO modal uses). Non-numeric values pass through.
export const formatDiff = (before, after) => `${fmtNum(before)} ← ${fmtNum(after)}`;

// Value of a work order in IQD: quantity × unitPrice of the matching task
// (0 when the task or its price is missing).
export const orderValueInIQD = (order, tasks = []) => {
  if (!order || !order.taskId) return 0;
  const task = (Array.isArray(tasks) ? tasks : []).find((t) => t && t.id === order.taskId);
  const price = Number(task?.unitPrice);
  const qty = Number(order.quantity);
  if (!Number.isFinite(price) || !Number.isFinite(qty)) return 0;
  return qty * price;
};
