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

  // Warnings before saving ("Save anyway?")
  'record.warnTitle': 'Save anyway?',
  'record.warnIntro': 'Check this before saving:',
  'record.saveAnyway': 'Save anyway',
  'record.warnBack': 'Go back',
  'record.warnDuplicate': 'An order just like this is already recorded: same type, item, date, quantity and party.',
  'record.warnOverLeft': '{qty} {unit} is more than what is left on this item’s contract ({left} {unit}).',
  'record.warnOverLeftPending': '{qty} {unit} is more than what is left on this item’s contract ({left} {unit}, after {pending} {unit} awaiting approval).',
  'record.warnAmountOutlier': 'The amount {amount} is more than {factor} times the usual for this type (median {median}).',
  'record.warnFutureDate': 'The date is in the future (today is {today}).',
  'record.warnBeforeStart': 'The date is before the project start ({start}).',

  // Who may approve
  'record.cannotApproveOwn': 'You recorded it',
  'record.cannotApproveRole': 'Your role cannot approve',
  'record.cannotApproveCertified': 'In an issued certificate',
  'record.notApproved': 'Not approved',
  'record.cannotApproveOwnBody': 'Someone else must approve an order you recorded.',
  'record.cannotApproveRoleBody': 'Your role in this project does not include approving orders.',

  // Locked by an issued payment certificate
  'record.inCertificate': 'In certificate No. {number}',
  'record.inCertificateMain': 'In main-contract certificate No. {number}',
  'record.inCertificateShort': 'Cert. {number}',
  'record.certificateSub': 'Certificate No. {number} · {party}',
  'record.certificateMain': 'Main-contract certificate No. {number}',
  'record.lockedTitle': 'This order is in an issued certificate',
  'record.lockedDelete': 'It cannot be deleted: an issued certificate stays exactly as it was issued.',
  'record.lockedApprove': 'It cannot be approved again: an issued certificate stays exactly as it was issued.',
  'record.lockedIn': 'Certified in:',
};
