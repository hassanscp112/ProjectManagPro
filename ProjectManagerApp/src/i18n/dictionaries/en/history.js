// en dictionary — module: history (who changed what, versions and restore).
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  'history.title': 'History',
  'history.placeholder': 'Item history is being built.',

  // what happened (history rows from src/sync/history.js)
  'history.op.insert': 'Added',
  'history.op.update': 'Changed',
  'history.op.delete': 'Deleted',
  'history.op.restore': 'Restored an earlier version',
  'history.op.import': 'Uploaded from a device',
  'history.outcome.applied': 'Saved',
  'history.outcome.rejected': 'Not kept',
  'history.outcome.pending': 'Waiting to sync',
  'history.outcome.failed': 'Refused by the server',
  'history.note.conflictLost': 'Another version won (newer or approved); this one is kept here.',
  'history.note.conflictWon': 'Won over another version.',
  'history.note.denied': 'The role did not allow this change.',
  'history.byOn': '{name} · {time}',
  'history.unknownPerson': 'Someone',
  'history.device': 'Device {id}',
  'history.restore': 'Restore this version',
  'history.restoreTitle': 'Restore this version?',
  'history.restoreBody': 'It becomes the current version, recorded as a new change by you. Nothing in the history is removed.',
  'history.restored': 'Version restored',
  'history.notShared': 'History is kept on the server: this project is only on this device.',
  'history.offline': 'Offline: only the changes waiting on this device are shown.',
  'history.err.notFound': 'That version could not be found.',
  'history.err.files': 'Files cannot be restored from here.',
  'history.err.role': 'Your role does not allow restoring this.',
  'history.err.notShared': 'This project is not shared on the server.',
};
