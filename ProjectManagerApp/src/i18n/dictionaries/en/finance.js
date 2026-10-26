// en dictionary — module: finance
// Keep keys in sync with ar/finance.js.
export default {
  // Screen header / summary cards / tabs
  'finance.totalCosts': 'Total Costs (Project)',
  'finance.cardMachinery': 'Machinery (incl. Fuel)',
  'finance.cardMaterials': 'Construction Materials',
  'finance.cardPettyCash': 'Daily Expenses',
  'finance.cardPayroll': 'Payroll',

  // Shared ledger UI
  'finance.dateFrom': 'From Date',
  'finance.dateTo': 'To Date',
  'finance.all': 'All',
  'finance.thAction': 'Action',
  'finance.periodTotal': 'Period Total:',

  // Machinery ledger
  'finance.addMachineryRecord': 'Add Comprehensive Machinery Record',
  'finance.machineType': 'Machine Type',
  'finance.driverName': 'Driver Name',
  'finance.thMachine': 'Machine',
  'finance.thDriver': 'Driver',
  'finance.thFuelCost': 'Fuel Cost',
  'finance.thTotalPrice': 'Total Price',

  // Materials ledger
  'finance.addMaterialRecord': 'Add Material Record',
  'finance.receiptNo': 'Receipt No.',
  'finance.materialType': 'Material Type',
  'finance.thMaterial': 'Material',
  'finance.thDetails': 'Details',
  'finance.saveRecord': 'Save Record',

  // Petty cash ledger
  'finance.addPettyExpense': 'Add Daily Expense',
  'finance.expenseType': 'Expense Type',
  'finance.thAmount': 'Amount',

  // Payroll ledger
  'finance.paySalary': 'Pay Salary',
  'finance.filterEmployee': 'Employee Name',
  'finance.savePayment': 'Save Payment',
  'finance.thBaseSalary': 'Base Salary',
  'finance.thAdvanceStatus': 'Advance (Status)',
  'finance.thNetPaid': 'Amount Paid (Net)',

  // Settings tab
  'finance.settingsDesc': 'Edit the employees, machinery, and expense type names that appear in the dropdown lists across all entry screens.',
  'finance.cfgMachines': 'Machine Types',
  'finance.cfgEmployees': 'Employees & Workers',
  'finance.cfgMaterials': 'Construction Material Types',
  'finance.cfgExpenseTypes': 'Daily Expense Types',
  'finance.cfgMachineSizes': 'Machine Sizes',
  'finance.cfgStatuses': 'Advance Statuses',
  'finance.addNewPlaceholder': 'Add new...',
  // ── rebuilt Finance (Phase 6) ──
  'finance.tabMachineryShort': 'Machinery',
  'finance.tabMaterialsShort': 'Materials',
  'finance.tabPettyCashShort': 'Petty cash',
  'finance.tabPayrollShort': 'Payroll',
  'finance.tabLists': 'Lists',
  'finance.addRecord': 'Add record',
  'finance.noRecords': 'No records match.',
  'finance.count': '{n} records',
  'finance.costLine': '{h} h × {rate} = {total}',
  'finance.liters': '{n} L',
  'finance.removeItem': 'Remove {item}',
  // ── Ledgers as views over expense orders (WS7) ──
  'finance.addAsOrder': 'Saved as an expense order — it shows in the order log too',
  'finance.unitPriceLine': '× {price} per unit',
  // The old ledger and its one-time move into expense orders
  'finance.legacyTitle': 'The old finance ledger is not in these tables yet',
  'finance.legacyBody':
    'Expenses are now recorded as expense orders, and these tables show those orders. The old ledger still holds {n} records ({total}). Move them once: a backup downloads first, and the old ledger is kept, read-only.',
  'finance.legacyNoRight': 'Someone who can edit finance can move them.',
  'finance.migrateButton': 'Review the move ({n} records)',
  'finance.migrateMoreButton': 'Move {n} more',
  'finance.migrateTitle': 'Move the old ledger into expense orders',
  'finance.migrateIntro': 'A dry run — nothing has changed yet. Each old record becomes one approved expense order with its original date and amount.',
  'finance.migrateLedger': 'Ledger',
  'finance.migrateBecomes': '→ {type}',
  'finance.migrateOldRecords': 'Old records',
  'finance.migrateOldTotal': 'Old total',
  'finance.migrateAlready': 'Already moved',
  'finance.migrateToAdd': 'To move',
  'finance.migrateAddTotal': 'Amount to move',
  'finance.migrateAll': 'All ledgers',
  'finance.migrateStepBackup': 'First a full backup file downloads (before-finance-migration).',
  'finance.migrateStepOrders': 'Then each record becomes an approved expense order: same date, same amount, recorded by its original author or by you.',
  'finance.migrateStepKept': 'The old ledger is never deleted: it stays as it is, read-only. Moving again never adds a record twice.',
  'finance.migrateConfirm': 'Download backup and move {n}',
  'finance.migrating': 'Moving…',
  'finance.migrateBackupFailed': 'The backup could not be made, so nothing was moved.',
  'finance.migrateDone': '{n} records moved into expense orders',
  'finance.migratedOn': 'The old ledger was moved into expense orders on {date} by {name} ({n} records). It is kept, read-only.',
  'finance.someone': 'a user',
  'finance.migrateNewSince': '{n} records were added to the old ledger since then.',
  'finance.migrateCheck': 'Compare the old ledger with its orders',
  'finance.migrateOrders': 'Orders',
  'finance.migrateOrdersTotal': 'Orders total',
};
