// ─────────────────────────────────────────────────────────────
// permissions — who may do what. Pure rules, no storage.
//
// Every action a role can be refused goes through can(role, action) (or the
// useCan() hook in components), so screens never compare role names
// themselves. The matrix is the one in plans/roadmap-plan.md; the server
// enforces the same rules (row-level security) once accounts exist.
// Role codes are data — labels come from the dictionaries
// (`account.role.<code>`).
// ─────────────────────────────────────────────────────────────

export const ROLES = ['admin', 'pm', 'office', 'site', 'accountant', 'viewer'];

/** Until accounts exist, the one local user may do everything. */
export const DEFAULT_ROLE = 'admin';

export const ACTIONS = {
  'members.manage': ['admin'],
  'plan.edit': ['admin', 'pm', 'office'], // tasks, BOQ, templates, rates (before sign-off)
  'plan.signOff': ['admin', 'pm'], // sign off, re-baseline, start, complete
  'plan.lookahead': ['admin', 'pm', 'office', 'site'], // week and day plans (month targets need plan.edit)
  'vo.draft': ['admin', 'pm', 'office'],
  'vo.approve': ['admin', 'pm'],
  'record.work': ['admin', 'pm', 'office', 'site'], // work and test orders, diary, photos, delays
  'orders.approve': ['admin', 'pm', 'office'], // never one's own order (see canApproveRecord)
  'finance.edit': ['admin', 'pm', 'site', 'accountant'], // expense orders and ledgers
  'certificates.prepare': ['admin', 'pm', 'office', 'accountant'],
  'certificates.issue': ['admin', 'pm'],
  'people.edit': ['admin', 'pm', 'office'],
  'files.edit': ['admin', 'pm', 'office', 'site'],
  read: ROLES,
};

/** True when `role` may perform `action`. Unknown roles or actions: false. */
export const can = (role, action) => (ACTIONS[action] || []).includes(role);

/** Every action a role may perform (for the users screen). */
export const actionsFor = (role) => Object.keys(ACTIONS).filter((action) => can(role, action));

/**
 * Approving a recorded item (formal order, certificate …) needs the approve
 * right AND someone other than the person who recorded it. Records carry
 * the recorder's id when accounts exist, else only a name.
 */
export const canApproveRecord = (actor, record, action = 'orders.approve') => {
  if (!actor || !can(actor.role, action)) return false;
  if (record?.recordedById && actor.id) return record.recordedById !== actor.id;
  if (record?.recordedBy && actor.name && actor.id) return record.recordedBy !== actor.name;
  return true; // no accounts yet: one local user approves their own records, as before
};
