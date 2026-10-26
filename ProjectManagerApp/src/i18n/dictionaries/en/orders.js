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

  // ── Expense details (values from the finance lists; amount computed) ──
  'orders.fMachineType': 'Machine type',
  'orders.fMachineSize': 'Machine size',
  'orders.fDriver': 'Driver',
  'orders.fMachineHours': 'Machine hours',
  'orders.fMachineRate': 'Rate per hour (machine)',
  'orders.fDriverHours': 'Driver hours',
  'orders.fDriverRate': 'Rate per hour (driver)',
  'orders.fFuelLiters': 'Fuel (liters)',
  'orders.fFuelPrice': 'Price per liter',
  'orders.fMaterial': 'Material',
  'orders.fMaterialQty': 'Quantity',
  'orders.fMaterialUnit': 'Unit',
  'orders.fUnitPrice': 'Unit price',
  'orders.fReceipt': 'Receipt no.',
  'orders.phReceipt': 'e.g. 1452',
  'orders.fEmployee': 'Employee / driver',
  'orders.fSalary': 'Base salary',
  'orders.fAdvance': 'Advance',
  'orders.fPayStatus': 'Advance status',
  'orders.fExpenseType': 'Expense type',
  'orders.fAmountComputed': 'Amount (computed)',
  'orders.fAmountNet': 'Net paid (computed)',
  'orders.chooseOption': '— Choose —',
  'orders.uHours': 'h',
  'orders.uLiters': 'L',
  'orders.partMachine': 'Machine',
  'orders.partDriver': 'Driver',
  'orders.partFuel': 'Fuel',
  'orders.partMaterial': 'Material',
  'orders.partLine': '{label}: {qty} × {rate} = {total}',
  'orders.lineSalary': 'Salary {amount}',
  'orders.lineAdvanceDeducted': 'Less advance {amount} (deducted)',
  'orders.lineAdvanceKept': 'The advance is not deducted from this salary',
  'orders.computedNotPositive': 'Fill in the fields above: the amount must be more than 0',

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

  // ── Who widget (recipient / contractor) ──
  'orders.unknownContractor': 'Unknown contractor',
  'orders.unknownTeam': 'Unknown team',
  'orders.workerCount': '{n} workers',
  'orders.listSep': ', ',

  // ── Element select ──
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
  'orders.fillRequired': 'Please fill in: {fields}',
  'orders.currencySuffix': 'IQD',

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

  // ── Modals ──
  'orders.deleteConfirmTitle': 'Confirm Order Deletion',
  'orders.deleteConfirmText':
    '"{type}" dated {date}{taskRef} will be deleted. This action cannot be undone.',
  'orders.approveText':
    'Enter the approver name to approve "{type}" dated {date}. Once approved, the quantity counts toward executed work.',
  'orders.approverPlaceholder': 'Approver name / signature',

  // Photo evidence
  'orders.photosButton': 'Order photos ({n})',
  'orders.photosTitle': 'Photos · {type} · {date}',
  'orders.photosLoadFailed': 'The photos could not be loaded from this device.',
  'orders.deleteConfirmPhotos': 'Its photos ({n}) will be deleted too.',
};
