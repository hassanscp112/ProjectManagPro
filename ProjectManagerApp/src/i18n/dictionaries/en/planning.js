// en dictionary — module: planning
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {

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
  'planning.task': 'Task',
  'planning.targetQty': 'Target quantity',
  'planning.executedThisMonth': 'Executed this month',
  'planning.achievement': 'Achievement',
  'planning.note': 'Note',
  'planning.actualTitle': 'Σ approved execution orders within the month',
  'planning.deleteTarget': 'Delete target',
  'planning.otherTasks': 'Other tasks',

  // Weekly view
  'planning.weekHint':
    'Assign crews and teams to tasks for this week — numbers here are indicative, and copying last week is a quick starting point.',
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
  'planning.kpiPpc': 'Percent Plan Complete (PPC)',
  'planning.kpiDoneAssignments': 'Completed assignments',
  'planning.kpiApprovedToday': 'Approved execution orders today',
  'planning.dayEmpty': 'Start by copying yesterday’s plan, then adjust it.',
  'planning.dayEmptySubYesterday':
    'Press “Same as yesterday” to copy yesterday’s assignments into today, or add a new assignment.',
  'planning.dayEmptySubNoYesterday': 'There is no plan for yesterday — add a new assignment and pick the task and crew.',
  'planning.noDayOrders': 'No execution orders yet',
  'planning.alertNoYesterday': 'There is no yesterday plan to copy into today.',
  'planning.confirmReplaceDay': 'Today’s plan is not empty. Replace it with yesterday’s plan?',
};
