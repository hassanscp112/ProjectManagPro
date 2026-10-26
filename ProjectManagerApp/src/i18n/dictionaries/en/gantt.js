// en dictionary — module: gantt
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // Data-grid column headers
  'gantt.colId': 'ID',
  'gantt.colItem': 'Item',
  'gantt.colDays': 'Days',
  'gantt.colAmount': 'Item Amount',
  'gantt.colProgress': 'Progress',
  'gantt.colStart': 'Start Date',
  'gantt.colEnd': 'End Date',
  'gantt.colPredecessor': 'Predecessor',
  'gantt.colRelation': 'Relation',
  'gantt.colLag': 'Lag',
  // Dependencies
  'gantt.noDependency': 'No predecessor',
  'gantt.notFound': 'Not found: {id}',
  'gantt.depFS': 'FS Finish → Start',
  'gantt.depSS': 'SS Start → Start',
  'gantt.depFF': 'FF Finish → Finish',
  'gantt.depSF': 'SF Start → Finish',
  // Locked cells (signed contract / managed values)
  'gantt.lockedFromDetails': 'Managed from item details (elements)',
  'gantt.lockedContractQty': 'Approved contract quantity — modify via a change order',
  'gantt.lockedContractPrice': 'Approved contract price — modify via a change order',
  'gantt.lockedContractUnit': 'Approved contract unit',
  'gantt.autoFromWorkOrders': 'Calculated automatically from work orders',
  // Timeline & tooltips
  'gantt.onCriticalPath': 'On the critical path',
  // Row actions & editing
  'gantt.addMainGroup': 'Add new main group',
  // Several predecessors in one cell
  'gantt.colPredecessors': 'Predecessors',
  'gantt.linksHelp': 'Item numbers, e.g. 2.1FS+3; 2.4SS — type FS/SS/FF/SF (FS if left out), lag in working days, add d for calendar days',
  'gantt.linksInvalid': 'Not found: {items}',
};
