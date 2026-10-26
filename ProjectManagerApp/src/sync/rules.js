// ─────────────────────────────────────────────────────────────
// rules — which role may write which record, on this device.
//
// The server enforces the same rules with row-level security
// (app_private.collection_rules + the approval trigger); checking them here
// first means a refused change is undone at once, offline too, instead of
// travelling to the server to be refused. COLLECTION_RULES must match the
// SQL table — src/sync/__tests__/sqlMirror.test.js compares them.
//
// A rule: [collection, part, whenField, whenValue, action]
//   part      the list inside the store ('' = the store is the list,
//             '$doc' = everything outside the lists)
//   when…     the rule applies when data[whenField] === whenValue; the
//             rule without a condition applies otherwise
//   action    a permissions.js action, or alternatives joined by '|'
// ─────────────────────────────────────────────────────────────

import { can } from '../utils/permissions.js';
import { storeFor } from '../utils/storeRegistry.js';
import { DOC_ITEM, parseItemKey, stableStringify } from './itemDiff.js';

/** FileDB records travel as items of this collection (one per file). */
export const FILES_COLLECTION = 'files';
export const FILES_ENTRY = { key: FILES_COLLECTION, scope: 'project', lists: [{ path: '', idField: 'id' }], sync: true };

/** The project list is synced through the server's projects table, not items. */
export const PROJECTS_COLLECTION = 'pm-projects';

const ANY_WRITER = 'record.work|finance.edit|certificates.prepare|plan.edit';

export const COLLECTION_RULES = [
  ['project-manager-gantt-tasks', '', '', '', 'plan.edit'],
  ['project-manager-project-meta', DOC_ITEM, '', '', 'plan.signOff'],
  ['project-manager-project-meta', 'variations', '', '', 'vo.draft'],
  ['project-manager-project-meta', 'variations', 'status', 'approved', 'vo.approve'],
  ['project-manager-finance-data', DOC_ITEM, '', '', 'finance.edit'],
  ['project-manager-finance-data', 'machinery', '', '', 'finance.edit'],
  ['project-manager-finance-data', 'materials', '', '', 'finance.edit'],
  ['project-manager-finance-data', 'pettyCash', '', '', 'finance.edit'],
  ['project-manager-finance-data', 'payroll', '', '', 'finance.edit'],
  ['project-manager-finance-config', DOC_ITEM, '', '', 'finance.edit'],
  ['pm-calculator-templates', '', '', '', 'plan.edit'],
  ['project-manager-daily-reports', '', '', '', 'record.work'],
  ['pm-orders', DOC_ITEM, '', '', 'record.work|finance.edit'],
  ['pm-orders', 'orders', '', '', 'record.work'],
  ['pm-orders', 'orders', 'family', 'expense', 'finance.edit'],
  ['pm-registries', DOC_ITEM, '', '', 'people.edit'],
  ['pm-registries', 'contractors', '', '', 'people.edit'],
  ['pm-registries', 'teams', '', '', 'people.edit'],
  ['pm-registries', 'workers', '', '', 'people.edit'],
  ['pm-plans', DOC_ITEM, '', '', 'record.work'],
  ['pm-rate-library', DOC_ITEM, '', '', 'plan.edit'],
  ['pm-rate-library', 'items', '', '', 'plan.edit'],
  ['pm-templates', DOC_ITEM, '', '', 'plan.edit'],
  ['pm-templates', 'templates', '', '', 'plan.edit'],
  ['pm-activity', '', '', '', ANY_WRITER],
  ['pm-certificates', DOC_ITEM, '', '', 'certificates.prepare'],
  ['pm-certificates', 'certificates', '', '', 'certificates.prepare'],
  ['pm-certificates', 'certificates', 'status', 'issued', 'certificates.issue'],
  ['pm-site-diary', DOC_ITEM, '', '', 'record.work'],
  ['pm-delays', DOC_ITEM, '', '', 'record.work'],
  ['pm-delays', 'events', '', '', 'record.work'],
  [FILES_COLLECTION, '', '', '', 'files.edit'],
];

/** The registry entry describing a collection (files included). */
export const entryFor = (collection) => (collection === FILES_COLLECTION ? FILES_ENTRY : storeFor(collection));

/** 'org' for stores shared by every project (people, templates, rates), else 'project'. */
export const scopeOf = (collection) => {
  const entry = entryFor(collection);
  if (!entry) return null;
  return entry.scope === 'global' ? 'org' : 'project';
};

/** The action(s) writing this version of a record needs; null = not syncable. */
export const writeAction = (collection, key, data) => {
  const entry = entryFor(collection);
  const parsed = entry ? parseItemKey(entry, key) : null;
  if (!parsed) return null;
  const part = parsed.doc ? DOC_ITEM : parsed.path;
  const rules = COLLECTION_RULES.filter(([c, p]) => c === collection && p === part);
  const special = rules.find(([, , field, value]) => field && data && String(data[field]) === value);
  const plain = rules.find(([, , field]) => !field);
  return (special || plain)?.[4] || null;
};

/** True when `role` may write this version of a record. */
export const canWriteVersion = (role, collection, key, data) => {
  const action = writeAction(collection, key, data);
  return Boolean(action) && action.split('|').some((a) => can(role, a));
};

const isFormal = (data) => Boolean(data) && (data.tier || '') !== 'quick';

/**
 * May `actor` ({ id, role }) make this change? Mirrors the server: the role
 * must be allowed to write both the version before and the version after,
 * and approving a formal order needs the approve right and someone other
 * than the recorder (`recordedBy` = the server's recorder id; null when
 * unknown). Changing or deleting an approved formal order also needs it.
 * Returns { ok: true } or { ok: false, reason }.
 */
export const checkChange = (actor, { collection, key, before, after, recordedBy = null, importing = false }) => {
  const role = actor?.role;
  if (before && !canWriteVersion(role, collection, key, before)) return { ok: false, reason: 'role' };
  if (after && !canWriteVersion(role, collection, key, after)) return { ok: false, reason: 'role' };
  if (!before && !after) return { ok: false, reason: 'empty' };

  const entry = entryFor(collection);
  const parsed = entry ? parseItemKey(entry, key) : null;
  if (collection === 'pm-orders' && parsed?.path === 'orders') {
    const formal = isFormal(after) || isFormal(before);
    const wasApproved = before?.status === 'approved';
    const nowApproved = after?.status === 'approved';
    if (formal && nowApproved && !wasApproved) {
      if (!before) return importing ? { ok: true } : { ok: false, reason: 'approveUnrecorded' };
      if (!can(role, 'orders.approve')) return { ok: false, reason: 'notApprover' };
      if (recordedBy && actor?.id && recordedBy === actor.id) return { ok: false, reason: 'ownRecord' };
    } else if (formal && wasApproved && (!after || stableStringify(after) !== stableStringify(before))) {
      if (!can(role, 'orders.approve')) return { ok: false, reason: 'notApprover' };
    }
  }
  return { ok: true };
};
