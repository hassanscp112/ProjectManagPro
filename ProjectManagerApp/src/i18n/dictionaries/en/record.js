// en dictionary — module: record (the rebuilt Record area, src/app/record/).
// Order types, field labels and log wording are reused from orders.*.
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // Sub-pages
  'record.tabNew': 'New order',
  'record.tabLog': 'Order log',
  'record.tabPending': 'Pending approval',

  // Type picker
  'record.whatToRecord': 'What do you want to record?',
  'record.groupValueHint': 'Work — counts toward progress',
  'record.groupExpenseHint': 'Expenses — counts toward actual cost',
  'record.tierQuick': 'Quick · approved on save',
  'record.tierFormal': 'Formal · needs approval',
  'record.repeatLast': 'Repeat last order',

  // Form
  'record.required': 'Required',
  'record.save': 'Save',
  'record.saveNext': 'Save and record next',
  'record.enterHint': 'Press Enter to save · the same type stays open for the next one',
  'record.qtyStatus': '{done} of {total} {unit} done · {left} left',
  'record.unitHint': 'Type a unit if the BOQ item has none',

  // Results
  'record.savedApproved': '{type} recorded and approved',
  'record.savedRecorded': '{type} recorded, awaiting approval',
  'record.approved': 'Order approved',
  'record.deleted': 'Order deleted',
  'record.doneTitle': 'Recorded',
  'record.doneApproved': 'Approved — already in the schedule and daily report',
  'record.doneRecorded': 'Saved as recorded — awaiting approval',
  'record.againSameType': 'Record another of this type',
  'record.otherType': 'Another type',
  'record.backHome': 'Back to Home',

  // Side panel / lists
  'record.today': 'Recorded today',
  'record.todayEmpty': 'Nothing recorded today yet.',
  'record.pendingEmptyTitle': 'Nothing waiting for approval',
  'record.pendingEmptyBody': 'Formal orders (completion, concrete and soil tests) wait here until someone approves them.',
  'record.logEmptyBody': 'Change the filters or record a new order.',
  'record.showAll': 'Show all',
  'record.filters': 'Filters',
  'record.approverLabel': 'Approver name',

  // Photos
  'record.saving': 'Saving…',
  'record.photosPreparing': 'Preparing photos…',
  'record.photosNotSaved': 'Order saved without its photos',
  'record.photosNotSavedBody': 'The photos could not be stored on this device (storage full or blocked).',
  'record.donePhotos': 'Photos attached: {n}',
};
