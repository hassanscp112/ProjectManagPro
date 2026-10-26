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

  // ── tab 2: per-task history ──
  'activity.taskSearchPlaceholder': 'Search for a task (code or name)…',
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

  // ── app event kinds (pm-activity `kind`, shown under the event) ──
  'activity.kind.certificate': 'Payment certificate',
  'activity.kind.lifecycle': 'Project status',
  'activity.kind.project': 'Project',
  'activity.kind.template': 'Template',
  'activity.kind.other': 'Event',

  // ── the server's timeline (everyone's changes) ──
  'activity.sourceServer': "Everyone's changes, from the server's history.",
  'activity.sourceOffline': "Offline: this device's records are shown. Everyone's changes show when the connection is back.",
  'activity.sourceFail': "The server could not be read: this device's records are shown.",
  'activity.waitingTitle': 'Waiting to sync ({n})',
  'activity.typeLabel': 'Type',
  'activity.type.all': 'Everything',
  'activity.type.value': 'Work orders',
  'activity.type.expense': 'Expenses',
  'activity.type.variation': 'Variation orders',
  'activity.type.plan': 'Plan items',
  'activity.type.diary': 'Site diary',
  'activity.type.delays': 'Delays',
  'activity.type.certificates': 'Payment certificates',
  'activity.type.photos': 'Photos and files',
  'activity.type.events': 'Events',
  'activity.type.shared': 'People, templates and rates',
  'activity.personLabel': 'Person',
  'activity.everyone': 'Everyone',
  'activity.loadOlder': 'Load older changes',
  'activity.loading': 'Loading…',
  'activity.retry': 'Try again',

  // ── tab: what did one person do ──
  'activity.tabPerson': 'By person',
  'activity.periodLabel': 'Period',
  'activity.period.today': 'Today',
  'activity.period.week': 'Last 7 days',
  'activity.period.month': 'Last 30 days',
  'activity.period.custom': 'Dates…',
  'activity.pickPerson': 'Pick a person to see what they did.',
  'activity.personEmpty': 'Nothing by {name} in this period.',
  'activity.statChanges': 'Changes',
  'activity.statDays': 'Active days',
  'activity.statWaiting': 'Waiting to sync',
  'activity.statRefused': 'Not kept',
  'activity.statOrders': 'Orders',
  'activity.statVariations': 'Variation orders',
  'activity.statEvents': 'Events',
  'activity.byType': 'By type',
  'activity.personLocalHint': 'Without a server, people are the names recorded on this device.',
};
