// en dictionary — module: taskDetails
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  /* ---------- generic ---------- */
  'taskDetails.untitledItem': 'Untitled item',
  'taskDetails.dayOne': '{n} day',
  'taskDetails.daysMany': '{n} days',

  /* ---------- header badges & counters ---------- */
  'taskDetails.groupBadge': 'Group',
  'taskDetails.workItemBadge': 'Work item',
  'taskDetails.signedContract': 'Signed contract',
  'taskDetails.elementOne': '{n} element',
  'taskDetails.elementsMany': '{n} elements',
  'taskDetails.boqOne': '{n} BOQ item',
  'taskDetails.boqMany': '{n} BOQ items',
  'taskDetails.orderOne': '{n} order',
  'taskDetails.ordersMany': '{n} orders',

  /* ---------- mode toggle ---------- */
  'taskDetails.viewModeAria': 'View mode',
  'taskDetails.view': 'View',
  'taskDetails.editTitleSigned': 'Project is signed — contract quantities and prices stay locked even in Edit mode',

  /* ---------- element status (values stay codes) ---------- */
  'taskDetails.status.not_started': 'Not started',
  'taskDetails.status.in_progress': 'In progress',
  'taskDetails.status.completed': 'Completed',
  'taskDetails.status.on_hold': 'On hold',

  /* ---------- read: quantities ---------- */
  'taskDetails.secQuantities': 'What & how much',
  'taskDetails.secQuantitiesSub': '(quantities by type)',
  'taskDetails.overallProgress': 'Overall item progress',
  'taskDetails.rollupFromChildren': 'Auto-rolled up from {n} sub-items (value-weighted)',
  'taskDetails.executedOfTotal': 'Executed {executed} of {total} {unit}',
  'taskDetails.qtyTypeFallback': 'Quantity type',
  'taskDetails.linkedBoqTitle': 'Linked to a BOQ item — quantities are managed from the elements',
  'taskDetails.statContract': 'Contract',
  'taskDetails.statExecuted': 'Executed',
  'taskDetails.statRemaining': 'Remaining',
  'taskDetails.wasteChip': 'Waste {n}%',
  'taskDetails.wasteChipTitle': 'Waste factor applied on top of the element sum',
  'taskDetails.elementSumLabel': 'Element sum: {n}',
  'taskDetails.reconDelta': '(delta {n})',
  'taskDetails.reconMatch': '(reconciled)',
  'taskDetails.calcQuantityNote': 'Calculated from elements — not linked to a BOQ item',

  /* ---------- read: elements map ---------- */
  'taskDetails.secWorkStatus': 'Where the work stands',
  'taskDetails.locationStation': 'Location / Station',
  'taskDetails.hideCompleted': 'Hide completed',
  'taskDetails.showCompleted': 'Show completed',

  /* ---------- read: orders feed ---------- */
  'taskDetails.secOrders': "Who & what's new",
  'taskDetails.rollupTitle': 'Contractors on this item:',
  'taskDetails.unknownContractor': 'Unknown contractor',
  'taskDetails.executedQtyLabel': 'Executed qty',
  'taskDetails.expensesLabel': 'Expenses',

  /* ---------- read: money ---------- */
  'taskDetails.secMoney': 'Money',
  'taskDetails.moneyContract': 'Contract value',
  'taskDetails.moneyExecuted': 'Executed value',
  'taskDetails.moneyDeviation': 'Financial variance',
  'taskDetails.moneyExpenses': 'Linked expenses',
  'taskDetails.moneyExecSubGroup': 'Σ from sub-items',
  'taskDetails.moneyExecSubLeaf': 'Executed qty × unit price',
  'taskDetails.moneyDevMatch': 'Matches the contract value',
  'taskDetails.moneyDevOver': 'Above the contract value',
  'taskDetails.moneyDevUnder': 'Below the contract value',
  'taskDetails.moneyExpensesSub': 'From work orders on this item and its children',

  /* ---------- read: evidence ---------- */
  'taskDetails.secEvidence': 'Evidence',
  'taskDetails.evidenceTests': 'Tests (concrete / soil)',
  'taskDetails.evidenceCompletions': 'Handover / completion orders',

  /* ---------- sub-items (read + edit) ---------- */
  'taskDetails.secChildren': 'Sub-items',
  'taskDetails.childrenEmptyRead': 'No sub-items under this item yet.',
  'taskDetails.childrenEmptyEdit': 'No sub-items yet. Add them here or directly in the grid — they appear here automatically.',
  'taskDetails.colCode': 'Code',
  'taskDetails.colExecutedQty': 'Executed',
  'taskDetails.colUnitPrice': 'Unit price',
  'taskDetails.managedFromElements': 'Managed from the item’s element sum',
  'taskDetails.approvedContractQty': 'Approved contract quantity',
  'taskDetails.typeGroup': 'Group',
  'taskDetails.typeManual': 'Manual',
  'taskDetails.openChildDetails': 'Open this item’s details',
  'taskDetails.deleteChild': 'Delete item',
  'taskDetails.childNamePlaceholder': 'Item name',

  /* ---------- edit: help banner + summary cards ---------- */
  'taskDetails.helpTitle': 'How does this work?',
  'taskDetails.helpPre': 'Add elements (e.g. manholes) and enter their quantities by type (C25, C20, C7 …). Totals are calculated automatically per type; by enabling',
  'taskDetails.helpKey': 'BOQ item',
  'taskDetails.helpPost': 'a sub-item is created in the grid (BOQ) whose quantity is bound to that total.',

  /* ---------- edit: quantity types manager ---------- */
  'taskDetails.secQtyTypes': 'Quantity types & totals',
  'taskDetails.colQtyType': 'Quantity type',
  'taskDetails.colWaste': 'Waste %',
  'taskDetails.colTotalWithWaste': 'Total (incl. waste)',
  'taskDetails.colBoq': 'BOQ item',
  'taskDetails.namePlaceholder': 'e.g. C25',
  'taskDetails.unitPlaceholder': 'm³',
  'taskDetails.wasteTitle': 'Waste factor (e.g. 5 adds +5% to the total)',
  'taskDetails.rawLabel': 'Raw: {n}',
  'taskDetails.boqLinkedFallback': 'Linked',
  'taskDetails.unlinkTitle': 'Unlink the item (it stays in place and keeps its last value)',
  'taskDetails.newBoqTitle': 'Create a new BOQ item bound to this total',
  'taskDetails.linkExistingTitle': 'Link this total to an existing BOQ item (the contract value stays as-is for reconciliation)',
  'taskDetails.recordOnly': 'Record only',
  'taskDetails.deleteType': 'Delete type',
  'taskDetails.confirmDeleteType': 'Delete quantity type “{name}”? Its values will be removed from all elements.',

  /* ---------- edit: elements table ---------- */
  'taskDetails.secElements': 'Elements',
  'taskDetails.elementsNeedType': 'Add at least one quantity type before entering elements.',
  'taskDetails.elementNamePlaceholder': 'e.g. HR-1',
  'taskDetails.deleteElement': 'Delete element',

  // read: evidence photos
  'taskDetails.evidencePhotos': 'Photos',
  'taskDetails.evidenceLatestPhotos': 'Latest photos',
};
