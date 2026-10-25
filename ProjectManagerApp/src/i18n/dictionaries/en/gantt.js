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
};
