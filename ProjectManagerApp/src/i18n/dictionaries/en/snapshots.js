// en dictionary — module: snapshots
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // ── header ──
  'snapshots.title': 'Snapshots & Restore Points',
  'snapshots.subtitle':
    'Full captures of the project state (tasks, baseline and variation orders) — for quick restores and for seeing how the project looked at any given moment. The activity log documents what happened; these snapshots preserve the complete shape of the data when they were taken.',

  // ── summary strip ──
  'snapshots.statAutoCount': 'Daily Snapshots',
  'snapshots.statNamedCount': 'Named Snapshots',
  'snapshots.statSize': 'Size',
  'snapshots.sizeUnit': 'KB',

  // ── section 1: automatic daily checkpoints ──
  'snapshots.autoTitle': 'Automatic Daily Snapshots',
  'snapshots.autoHint': 'Only the last 14 days are kept',
  'snapshots.autoEmpty':
    'No daily snapshots yet. One is created automatically on the first change made to the project each day — a quick end-of-workday safety net that requires no action from you.',
  'snapshots.colDate': 'Date',
  'snapshots.colCreatedTime': 'Created At',
  'snapshots.colTasksCount': 'Tasks',
  'snapshots.colVariations': 'Variations',
  'snapshots.createdBy': 'Created by: {name}',
  'snapshots.leafTasksHint': '{n} active tasks (excluding groups)',

  // ── section 2: named snapshots ──
  'snapshots.namedTitle': 'Named Snapshots',
  'snapshots.namedHint': 'User-kept restore points — never deleted automatically',
  'snapshots.namePlaceholder': 'Snapshot name (e.g. September report, before handover)…',
  'snapshots.createNow': '+ Create Snapshot Now',
  'snapshots.createTitle': 'Save a snapshot of the current project state under the entered name',
  'snapshots.namedEmpty':
    'No named snapshots yet. Create one before major experiments or with every important report — for example "before handover" or "September report" — so you can return to it whenever needed.',
  'snapshots.colName': 'Name',
  'snapshots.colTasks': 'Tasks',

  // ── actions ──
  'snapshots.restore': 'Restore',
  'snapshots.rename': 'Rename',

  // ── confirm dialogs ──
  'snapshots.deleteConfirm': 'Permanently delete the named snapshot "{name}"? This cannot be undone.',
  'snapshots.restoreConfirm':
    'The current project data (tasks, baseline and variation orders) will be replaced with the contents of snapshot "{label}".\nThis action cannot be directly undone — you can only restore another snapshot afterwards.\nContinue?',

  // ── scope note card ──
  'snapshots.scopeNoteTitle': 'What do these snapshots cover?',
  'snapshots.scopeNote':
    'Snapshots capture the full project task list together with the baseline, variation orders and project state. Work orders, planning, calculations and the rest keep their own storage and are unaffected by a restore. The full backup (the entire data file) remains available from the Gantt toolbar.',
};
