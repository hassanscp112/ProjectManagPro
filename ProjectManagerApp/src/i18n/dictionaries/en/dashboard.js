// en dictionary — module: dashboard
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  'dashboard.welcome': 'Welcome to the Project Management System.',
  'dashboard.welcomeSubtitle':
    'Choose a core module to manage tasks, assets, and financial flows across the system.',

  // Task-status summary cards
  'dashboard.cardOverdue': 'Overdue Tasks (High Priority)',
  'dashboard.cardActive': 'In Progress (Medium Priority)',
  'dashboard.cardUpcoming': 'Upcoming Tasks',
  'dashboard.cardCompleted': 'Completed Tasks',

  // Earned Value Management
  'dashboard.evmTitle': 'Earned Value Management Analysis (EVM)',
  'dashboard.evmBac': 'Budget at Completion (BAC)',
  'dashboard.evmPv': 'Planned Value (PV)',
  'dashboard.evmEv': 'Earned Value (EV)',
  'dashboard.evmAc': 'Actual Cost (AC)',
  'dashboard.evmSpi': 'Schedule Performance Index (SPI)',
  'dashboard.evmCpi': 'Cost Performance Index (CPI)',
  'dashboard.evmEac': 'Estimate at Completion (EAC)',
  'dashboard.evmVac': 'Variance at Completion (VAC)',
  'dashboard.aheadOfSchedule': 'Ahead of schedule',
  'dashboard.behindSchedule': 'Behind schedule',
  'dashboard.underBudget': 'Under budget',
  'dashboard.overBudget': 'Over budget',
  'dashboard.budgetOverrun': 'Budget overrun',

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
  'dashboard.wbsTitle': 'EVM Analysis by Work Package (WBS)',
  'dashboard.wbsSubtitle':
    'Schedule Performance Index (SPI) and Cost Performance Index (CPI) per major group, with Budget (BAC) and Actual Cost (AC).',
  'dashboard.colCode': 'Code',
  'dashboard.colItemCount': 'Items',
  'dashboard.colBac': 'BAC ({unit})',
  'dashboard.colPv': 'PV ({unit})',
  'dashboard.colEv': 'EV ({unit})',
  'dashboard.colAc': 'AC ({unit})',
  'dashboard.currencyUnit': 'IQD',

  // Required-tasks (action items) table
  'dashboard.actionTitle': 'Action Items (by Priority)',
  'dashboard.colTaskName': 'Task Name',
  'dashboard.colStartDate': 'Start Date',
  'dashboard.colEndDate': 'End Date',
  'dashboard.colProgress': 'Progress',
  'dashboard.colPriority': 'Priority / Status',
  'dashboard.noActionItems': 'No action items at the moment.',
  'dashboard.priorityCritical': 'Overdue (High)',
  'dashboard.priorityMedium': 'In Progress (Medium)',
  'dashboard.priorityLow': 'Starting Soon (Normal)',
};
