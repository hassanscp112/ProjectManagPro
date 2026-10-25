// en dictionary — module: home (the rebuilt Home screen, src/app/home/).
// EVM labels, chart series and units are reused from dashboard.*.
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // Headline numbers
  'home.progressActual': 'Actual progress',
  'home.plannedOf': 'Planned {value}',
  'home.spi': 'Schedule performance (SPI)',
  'home.cpi': 'Cost performance (CPI)',
  'home.ev': 'Earned value (EV)',
  'home.ofBac': 'of contract value {bac}',
  'home.deviation': '{value} pts vs plan',
  'home.actualCost': 'Actual cost {ac}',
  'home.watch': 'Watch',

  // Needs attention
  'home.attention': 'Needs your attention',
  'home.countOverdue': '{n} late',
  'home.countActive': '{n} in progress',
  'home.countUpcoming': '{n} starting soon',
  'home.countDone': '{n} done',
  'home.statusCounts': 'BOQ item status',
  'home.dueWas': 'was due {date}',
  'home.dueOn': 'due {date}',
  'home.startsOn': 'starts {date}',
  'home.critical': 'Critical',
  'home.pctDone': '{pct} done',
  'home.allClear': 'Nothing late or due soon',
  'home.allClearBody': 'Every BOQ item is on time.',
  'home.openSchedule': 'Open the schedule',
  'home.moreInSchedule': '{n} more in the schedule',

  // Sections + orders
  'home.sections': 'Progress by section',
  'home.sectionFigures': '{ev} of {bac}',
  'home.recent': 'Recently recorded',
  'home.recentEmpty': 'No orders recorded yet.',
  'home.allOrders': 'Order log',

  // S-curve
  'home.evmFigures': 'Earned value figures',
  'home.sCurveAria': 'S-curve: planned {pv}, earned {ev}, actual {ac} to date',
};
