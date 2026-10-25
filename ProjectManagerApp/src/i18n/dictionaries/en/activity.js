// en dictionary — module: activity
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // ── header ──
  'activity.title': 'Activity & Log',
  'activity.subtitle':
    'Every work order, expense, variation order and app event, dated and attributed — the visible face of the event log.',

  // ── tabs ──
  'activity.tabFeed': 'Activity Feed',
  'activity.tabTask': 'Task History',
  'activity.tabHeatmap': 'Activity Heatmap',

  // ── feed filter chips ──
  'activity.chipAll': 'All',
  'activity.chipValue': 'Work Orders',
  'activity.chipExpense': 'Expenses',
  'activity.chipVariation': 'Variation Orders',
  'activity.chipEvent': 'Events',

  // ── feed filters ──
  'activity.fromDate': 'From',
  'activity.toDate': 'To',
  'activity.actorLabel': 'Recorded By',
  'activity.actorPlaceholder': 'Filter by recorder…',
  'activity.entryCount': '{n} entries',
  'activity.feedEmpty': 'No entries match the selected filters.',
  'activity.loadMore': 'Show more ({n} remaining)',

  // ── feed entry figures ──
  'activity.amount': 'Amount',
  'activity.value': 'Value',

  // ── who attribution (registries lookup) ──
  'activity.whoContractor': 'Contractor: {name}',
  'activity.whoContractorOnly': 'Contractor',
  'activity.whoTeam': 'Team: {name}',
  'activity.whoTeamOnly': 'Team',
  'activity.whoWorkers': 'Workers: {names}',
  'activity.whoWorkersMore': 'Workers: {names} +{extra}',
  'activity.whoWorkersOnly': 'Workers',
  'activity.listSeparator': ', ',

  // ── tab 2: per-task history ──
  'activity.taskSearchPlaceholder': 'Search for a task (code or name)…',
  'activity.taskClearSelection': 'Clear selection',
  'activity.taskNoMatch': 'No matching task.',
  'activity.executedFromLog': 'Executed (from log)',
  'activity.executedValue': 'Executed Value',
  'activity.contractValue': 'Contract Value',
  'activity.recordings': 'Entries',
  'activity.ofWhichApproved': '{n} approved',
  'activity.taskEmptyStory': 'No entries or events linked to this task yet.',

  // ── tab 3: heatmap ──
  'activity.scope': 'Scope',
  'activity.scopeWholeProject': 'Whole project',
  'activity.legendLess': 'Less',
  'activity.legendMore': 'More',
  'activity.recordedDays': 'Recorded days (last 90 days)',
  'activity.emptyDays': 'Empty days (last 90 days)',
  'activity.emptyDayNote': 'Day without records — work may be unrecorded',
  'activity.approvedValue': 'Approved value',
  'activity.ordersRecorded': 'Orders recorded',
  'activity.orderCountUnit': 'orders',
  'activity.dayAriaLabel': '{date}: {value} — {count} orders',
  'activity.dayDetailsTitle': 'Day details',
  'activity.emptyDayWarning':
    'Day without records — work may be unrecorded. Click another day on the map to view it.',

  // sparse weekday gutter labels (rows run Saturday → Friday)
  'activity.weekdaySat': 'Sat',
  'activity.weekdayMon': 'Mon',
  'activity.weekdayWed': 'Wed',
  'activity.weekdayFri': 'Fri',

  // ── order types + feed fallback titles (ActivityLog.js) ──
  'activity.typeQuickWork': 'Quick work',
  'activity.typeCompletion': 'Completion order',
  'activity.typeConcreteTest': 'Concrete test',
  'activity.typeSoilTest': 'Soil test',
  'activity.typeMaterial': 'Material receipt',
  'activity.typePayroll': 'Payroll',
  'activity.typeMachinery': 'Machinery hire',
  'activity.typeFuel': 'Fuel',
  'activity.typeOtherExpense': 'Other expense',
  'activity.defaultOrderTitle': 'Work order',
  'activity.variationUnitPrice': 'Variation — unit price',
  'activity.variationContractQty': 'Variation — contract quantity',
  'activity.defaultEventTitle': 'Event',
  // ── rebuilt Activity (Phase 5) ──
  'activity.pickTask': 'Pick an item to see its whole history.',
};
