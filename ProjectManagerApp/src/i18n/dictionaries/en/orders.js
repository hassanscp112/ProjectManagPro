// en dictionary — module: orders
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // ── Order type labels (OrderEngine display metadata) ──
  'orders.typeQuickWork': 'Quick Work Order',
  'orders.typeCompletion': 'Completion / Handover Order',
  'orders.typeConcreteTest': 'Concrete Cube Test Order',
  'orders.typeSoilTest': 'Soil Compaction Test Order',
  'orders.typeMaterial': 'Material Purchase',
  'orders.typePayroll': 'Payroll',
  'orders.typeMachinery': 'Machinery & Equipment',
  'orders.typeFuel': 'Fuel',
  'orders.typeOtherExpense': 'Other Expense',

  // ── Field labels (shared across types) ──
  'orders.fWorkDate': 'Work Date',
  'orders.fTestDate': 'Test Date',
  'orders.fContractor': 'Executing Contractor',
  'orders.fTask': 'BOQ Item',
  'orders.fTaskOptional': 'BOQ Item (optional)',
  'orders.fElement': 'Element',
  'orders.fSampleRef': 'Sample No.',
  'orders.fResult': 'Result',
  'orders.fDepth': 'Depth',
  'orders.fAmount': 'Amount',
  'orders.fRecipient': 'Recipient',
  'orders.fDescription': 'Description',
  'orders.fNote': 'Note',

  // ── Field placeholders ──
  'orders.phUnit': 'm³',
  'orders.phLocationCompletion': 'e.g. Culvert 12 — 0+250',
  'orders.phLocationConcrete': 'e.g. Culvert 3 — 0+950',
  'orders.phLocationSoil': 'e.g. 0+250, right side of canal',
  'orders.phHandoverNote': 'Handover notes',
  'orders.phSampleRef': 'e.g. C25-041',
  'orders.phResult': 'e.g. 28.5 MPa',
  'orders.phDepth': 'e.g. 2.5 m',
  'orders.phDensity': 'Field density …',
  'orders.phMaterial': 'Material type and purchase location',
  'orders.phPayroll': 'Period / number of days …',
  'orders.phMachinery': 'Machine and hours operated',
  'orders.phFuel': 'Machine and liters',
  'orders.phOther': 'Expense description',

  // ── Families / groups ──
  'orders.familyValue': 'Value / Production',
  'orders.familyExpense': 'Expense',
  'orders.groupValue': 'On-Site Work',
  'orders.groupExpense': 'Expenses',

  // ── Who widget (recipient / contractor) ──
  'orders.whoKindContractor': 'Contractor',
  'orders.whoKindTeam': 'Team',
  'orders.whoKindWorkers': 'Workers',
  'orders.whoKindNone': 'None',
  'orders.noContractor': '— No contractor —',
  'orders.chooseContractor': '— Select contractor —',
  'orders.chooseTeam': '— Select team —',
  'orders.noRecipient': 'No recipient specified',
  'orders.noWorkers': 'No workers in the registries — add them from the Resources screen.',
  'orders.unknownContractor': 'Unknown contractor',
  'orders.unknownTeam': 'Unknown team',
  'orders.workerCount': '{n} workers',
  'orders.listSep': ', ',

  // ── Element select ──
  'orders.noElements': '— No elements for this BOQ item —',
  'orders.noElement': '— No element —',
  'orders.elementFallback': 'Element',

  // ── KPI strip ──
  'orders.kpiTodayOrders': "Today's Work Orders",
  'orders.kpiTodayQty': "Today's Quantities",
  'orders.kpiTodayExpenses': "Today's Expenses",
  'orders.kpiWeekOrders': "This Week's Orders",
  'orders.kpiWeekExpenses': "This Week's Expenses",

  // ── New-order card ──
  'orders.newOrder': '⚡ New Order',
  'orders.newOrderSub': 'Every site operation is recorded here — pick a type, fill the fields, save.',
  'orders.saveOrder': 'Save Order',
  'orders.quickTierHint': 'Quick order — approved immediately on save.',
  'orders.formalTierHint': 'Formal order — recorded as "Recorded" and requires explicit approval.',
  'orders.pickTypeHint':
    'Pick an order type above to start — quick orders are approved instantly, formal ones need approval.',
  'orders.fillRequired': 'Please fill in: {fields}',
  'orders.currencySuffix': 'IQD',

  // ── Flash messages ──
  'orders.flashSaved': '✓ {type} recorded successfully',
  'orders.flashSavedApproved': '✓ {type} recorded and approved',
  'orders.flashApproved': '✓ Order approved',
  'orders.flashDeleted': 'Order deleted',

  // ── Orders log ──
  'orders.logTitle': 'Orders Log',
  'orders.logCount': '{count} order(s)',
  'orders.filteredTag': 'filtered',
  'orders.clearFilters': 'Clear Filters',
  'orders.fromDate': 'From Date',
  'orders.toDate': 'To Date',
  'orders.allTypes': 'All Types',
  'orders.contractor': 'Contractor',
  'orders.allParties': 'All Parties',
  'orders.task': 'BOQ Item',
  'orders.allTasks': 'All BOQ Items',
  'orders.party': 'Party',
  'orders.qtyOrAmount': 'Quantity / Amount',
  'orders.noMatching': 'No matching orders yet.',
  'orders.approveOrder': 'Approve Order',
  'orders.deleteOrder': 'Delete Order',
  'orders.theOrder': 'the order',

  // ── Modals ──
  'orders.deleteConfirmTitle': 'Confirm Order Deletion',
  'orders.deleteConfirmText':
    '"{type}" dated {date}{taskRef} will be deleted. This action cannot be undone.',
  'orders.approveText':
    'Enter the approver name to approve "{type}" dated {date}. Once approved, the quantity counts toward executed work.',
  'orders.approverPlaceholder': 'Approver name / signature',

  // ── OrderTypePicker ──
  'orders.tierFormal': 'Formal',
  'orders.formalChipHint': 'Formal order — starts as "Recorded" and requires approval',
  'orders.quickChipHint': 'Quick order — approved on save',

  // ── TaskPicker ──
  'orders.taskPickerOptional': 'BOQ item (optional) — search…',
  'orders.taskPickerSearch': 'Search BOQ items…',
  'orders.removeTask': 'Clear BOQ item',
  'orders.noMatchingTasks': 'No matching BOQ items',
  'orders.unnamedTask': 'Unnamed BOQ item',
  'orders.moreTasks': '… {n} more — refine your search',
};
