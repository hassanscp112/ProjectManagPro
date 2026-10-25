// en dictionary — module: dashboard
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {

  // Earned Value Management
  'dashboard.evmTitle': 'Earned Value Management Analysis (EVM)',
  'dashboard.evmBac': 'Budget at Completion (BAC)',
  'dashboard.evmPv': 'Planned Value (PV)',
  'dashboard.evmEv': 'Earned Value (EV)',
  'dashboard.evmAc': 'Actual Cost (AC)',
  'dashboard.evmEac': 'Estimate at Completion (EAC)',
  'dashboard.evmVac': 'Variance at Completion (VAC)',
  'dashboard.aheadOfSchedule': 'Ahead of schedule',
  'dashboard.behindSchedule': 'Behind schedule',
  'dashboard.underBudget': 'Under budget',
  'dashboard.overBudget': 'Over budget',

  // S-curve
  'dashboard.scurveTitle': 'S-Curve',
  'dashboard.scurveSubtitle':
    'Planned Value (PV) vs Earned Value (EV) vs Actual Cost (AC) across the project timeline.',
  'dashboard.scurveEmpty':
    'Not enough data to draw the S-curve yet. Add WBS items with dates and prices first.',
  'dashboard.seriesPv': 'Planned (PV)',
  'dashboard.seriesEv': 'Earned (EV)',
  'dashboard.seriesAc': 'Actual (AC)',
  'dashboard.todayMarker': 'Today',
  // Compact axis units (appended without a space in English)
  'dashboard.unitBillion': 'B',
  'dashboard.unitMillion': 'M',
  'dashboard.unitThousand': 'K',

  // Per-WBS EVM table
  'dashboard.wbsSubtitle':
    'Schedule Performance Index (SPI) and Cost Performance Index (CPI) per major group, with Budget (BAC) and Actual Cost (AC).',

};
