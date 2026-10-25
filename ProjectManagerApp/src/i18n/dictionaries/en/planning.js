// en dictionary — module: planning
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  // Shell
  'planning.title': 'Rolling Lookahead Planning',
  'planning.subtitle':
    'The master schedule defines what must be delivered this month — weekly and daily plans are rolling and provisional, firming up as the horizon approaches.',
  'planning.viewMonth': 'Monthly',
  'planning.viewWeek': 'Weekly',
  'planning.viewDay': 'Daily',

  // Period navigation
  'planning.prevMonth': 'Previous month',
  'planning.prevWeek': 'Previous week',
  'planning.prevDay': 'Previous day',
  'planning.nextMonth': 'Next month',
  'planning.nextWeek': 'Next week',
  'planning.nextDay': 'Next day',
  'planning.weekLabel': 'Week {week} / {year}',
  'planning.goToToday': 'Jump to today’s date',

  // whoLabel affixes (PlanningStore)
  'planning.countUnspecified': 'Count not set',
  'planning.oneWorker': '1 worker',
  'planning.twoWorkers': '2 workers',
  'planning.workersCount': '{count} workers',
  'planning.teamPrefix': 'Team:',
  'planning.teamUnspecified': 'Team not set',
  'planning.contractorPrefix': 'Contractor:',
  'planning.contractorUnspecified': 'Contractor not set',
  'planning.workersUnspecified': 'No workers set',
  'planning.unnamed': 'Unnamed',
  'planning.workerFallback': 'Worker',
  'planning.listSeparator': ', ',

  // WhoPicker
  'planning.whoModeCount': 'Count',
  'planning.whoModeTeam': 'Team',
  'planning.whoModeWorkers': 'Workers',
  'planning.workersCountInput': 'Number of workers',
  'planning.selectTeam': 'Select team',
  'planning.selectTeamOption': '— Select a team —',
  'planning.defaultTeamName': 'Team',
  'planning.noWorkersInRegistry': 'No workers in the registry yet — add them from Human Resources.',

  // Monthly view
  'planning.monthHint':
    'Set the monthly target quantity per task — the monthly plan is deliberately indicative; its numbers firm up progressively across the weekly and daily plans.',
  'planning.kpiMonthTargets': 'Monthly targets',
  'planning.kpiTargetSum': 'Target total',
  'planning.kpiActualExecuted': 'Actually executed',
  'planning.kpiAchievementRate': 'Achievement rate',
  'planning.emptyNoTasks':
    'The project has no tasks yet — add them in the schedule first, then come back to set monthly targets.',
  'planning.unnamedSection': 'Unnamed section',
  'planning.addTarget': '+ Add target',
  'planning.emptySectionTargets':
    'No targets for this section in {month} yet — add one and set the task and its target quantity.',
  'planning.task': 'Task',
  'planning.targetQty': 'Target quantity',
  'planning.executedThisMonth': 'Executed this month',
  'planning.achievement': 'Achievement',
  'planning.note': 'Note',
  'planning.deletedTask': 'Deleted task',
  'planning.taskFallback': 'Task',
  'planning.targetQtyTitle': 'Target quantity for this month',
  'planning.actualTitle': 'Σ approved execution orders within the month',
  'planning.noteOptional': 'Note (optional)',
  'planning.deleteTarget': 'Delete target',
  'planning.otherTasks': 'Other tasks',

  // Weekly view
  'planning.weekHint':
    'Assign crews and teams to tasks for this week — numbers here are indicative, and copying last week is a quick starting point.',
  'planning.copyLastWeek': '⧉ Copy from last week',
  'planning.addAssignment': '+ Add assignment',
  'planning.weekEmpty': 'No assignments for this week yet.',
  'planning.weekEmptySub':
    'Start by copying last week’s assignments and adjusting them, or add a new assignment and pick the task and crew.',
  'planning.crew': 'Crew',
  'planning.deleteAssignment': 'Delete assignment',
  'planning.alertNoLastWeek': 'There are no assignments in last week to copy.',
  'planning.confirmReplaceWeek':
    'This week already contains assignments. Replace them with last week’s assignments?',

  // Daily view
  'planning.dayHint':
    'Today’s plan carries firm numbers — task, crew and note — and is measured by the Percent Plan Complete (PPC) at the end of the day.',
  'planning.sameAsYesterday': '⧉ Same as yesterday',
  'planning.kpiPpc': 'Percent Plan Complete (PPC)',
  'planning.kpiDoneAssignments': 'Completed assignments',
  'planning.kpiApprovedToday': 'Approved execution orders today',
  'planning.dayEmpty': 'Start by copying yesterday’s plan, then adjust it.',
  'planning.dayEmptySubYesterday':
    'Press “Same as yesterday” to copy yesterday’s assignments into today, or add a new assignment.',
  'planning.dayEmptySubNoYesterday': 'There is no plan for yesterday — add a new assignment and pick the task and crew.',
  'planning.dayOrdersLabel': 'Execution orders on this day:',
  'planning.noDayOrders': 'No execution orders yet',
  'planning.approvedSum': 'Approved: {sum} {unit}',
  'planning.doneBadge': 'Done ✓',
  'planning.pendingBadge': 'Awaiting execution',
  'planning.alertNoYesterday': 'There is no yesterday plan to copy into today.',
  'planning.confirmReplaceDay': 'Today’s plan is not empty. Replace it with yesterday’s plan?',
};
