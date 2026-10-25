// Engine warnings ({ code, params, message }) in the UI language. The engine
// stays untranslated; unknown codes fall back to its Arabic message.

const WARNING_KEYS = {
  duplicateWbs: 'schedule.warnDuplicateWbs',
  overExecuted: 'schedule.warnOverExecuted',
  invalidDepType: 'schedule.warnInvalidDepType',
  dependencyCycle: 'schedule.warnDependencyCycle',
  selfDependency: 'schedule.warnSelfDependency',
  missingPredecessor: 'schedule.warnMissingPredecessor',
};

export const warningText = (t, w) => {
  if (typeof w === 'string') return w;
  const key = WARNING_KEYS[w?.code];
  return key ? t(key, w.params) : w?.message || '';
};

/** All of a task's warnings as one tooltip text. */
export const warningsTitle = (t, warnings = []) => warnings.map((w) => warningText(t, w)).join('\n');
