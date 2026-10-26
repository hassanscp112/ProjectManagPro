// Field values in words for the history diff: ids → names (people, tasks),
// codes → their labels. Used as HistoryDiff's resolveValue.

import { recordName } from '../../state/historyModel.js';
import { eventKindKey } from '../../state/reportsModel.js';
import { whenText } from '../../ui/HistoryFormat.js';
import { resolveWhoLabel } from '../../utils/OrderEngine.js';
import { orderSubject, typeLabel } from '../record/orderMeta.js';

const asArray = (v) => (Array.isArray(v) ? v : []);

/**
 * A record's name as the rest of the app says it: "type · item" for an
 * order, a day as a date, '' for a store's '$doc' part.
 */
export const displayName = (collection, version, itemId) => {
  if (collection === 'pm-orders' && version?.type) {
    const subject = orderSubject(version);
    return subject ? `${typeLabel(version.type)} · ${subject}` : typeLabel(version.type);
  }
  if (itemId === '$doc') return '';
  const name = recordName(version, itemId);
  return /^\d{4}-\d{2}-\d{2}$/.test(name) ? whenText(name) : name;
};

/**
 * (field, value) → what to show. Unknown ids and codes pass through.
 * { collection, t, tasks, registries }
 */
export function valueResolver({ collection, t, tasks = [], registries = {} }) {
  const label = (key, fallback) => {
    const text = t(key);
    return text && text !== key ? text : fallback;
  };
  const byId = (list) => new Map(asArray(list).map((x) => [x.id, x]));
  const taskById = byId(tasks);
  const contractors = byId(registries.contractors);
  const teams = byId(registries.teams);
  const workers = byId(registries.workers);
  const task = (id) => {
    const x = taskById.get(id);
    return x ? `${x.wbs || ''} ${x.name || ''}`.trim() : id;
  };
  const named = (map) => (id) => map.get(id)?.name || id;
  const many = (fn) => (v) => (Array.isArray(v) ? v.map(fn) : fn(v));

  const fields = {
    taskId: many(task),
    taskIds: many(task),
    dependsOn: many(task),
    contractorId: many(named(contractors)),
    teamId: many(named(teams)),
    workerIds: many(named(workers)),
    memberWorkerIds: many(named(workers)),
    foremanWorkerId: many(named(workers)),
    evidence: (v) => (Array.isArray(v) ? t('history.items', { n: v.length }) : v),
    weather: (v) => label(`diary.weather.${v}`, v),
    cause: (v) => label(`diary.cause.${v}`, v),
  };
  if (collection === 'pm-orders') {
    fields.type = (v) => typeLabel(v);
    fields.status = (v) => label(`common.${v}`, v);
    fields.family = (v) => label(v === 'value' ? 'orders.familyValue' : 'orders.familyExpense', v);
    fields.tier = (v) => label(v === 'quick' ? 'record.tierQuick' : 'record.tierFormal', v);
    fields.who = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? resolveWhoLabel(v, registries) : v);
  }
  if (collection === 'pm-activity') fields.kind = (v) => label(eventKindKey(v), v);
  if (collection === 'pm-delays') fields.status = (v) => label(`diary.status.${v}`, v);
  if (collection === 'pm-certificates') fields.status = (v) => label(v === 'issued' ? 'certificates.statusIssued' : 'certificates.statusDraft', v);

  return (field, value) => (fields[field] && value !== null && value !== undefined && value !== '' ? fields[field](value) : value);
}
