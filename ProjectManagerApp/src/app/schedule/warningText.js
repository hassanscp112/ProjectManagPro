// Engine warnings ({ code, params, message }) in the UI language. The engine
// stays untranslated; unknown codes fall back to its Arabic message.

import { resourceLabel } from '../../state/resourcesModel.js';
import { formatDay } from '../record/orderMeta.js';

const WARNING_KEYS = {
  duplicateWbs: 'schedule.warnDuplicateWbs',
  overExecuted: 'schedule.warnOverExecuted',
  invalidDepType: 'schedule.warnInvalidDepType',
  dependencyCycle: 'schedule.warnDependencyCycle',
  selfDependency: 'schedule.warnSelfDependency',
  missingPredecessor: 'schedule.warnMissingPredecessor',
  resourceOverload: 'schedule.warnResourceOverload',
};

export const warningText = (t, w) => {
  if (typeof w === 'string') return w;
  const key = WARNING_KEYS[w?.code];
  if (w?.code === 'resourceOverload') {
    const p = w.params || {};
    return t(key, { resource: resourceLabel(t, p.resource || ''), from: formatDay(p.from), to: formatDay(p.to) });
  }
  return key ? t(key, w.params) : w?.message || '';
};

/** All of a task's warnings as one tooltip text. */
export const warningsTitle = (t, warnings = []) => warnings.map((w) => warningText(t, w)).join('\n');
