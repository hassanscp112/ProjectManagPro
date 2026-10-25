// en dictionary — module: registries
// Keys use the '<module>.<name>' convention; both language files must stay in sync.
export default {
  'registries.title': 'Executing Parties Registry',
  'registries.subtitle':
    'A unified registry serving work orders, daily planning, and payroll: ' +
    'contractors (companies), workers (individuals with a daily rate), ' +
    'and teams (crews of workers led by a foreman).',

  // Tabs + summary strip
  'registries.tabContractors': 'Contractors',
  'registries.tabTeams': 'Teams',
  'registries.tabWorkers': 'Workers',
  'registries.currentIdentity': 'Current User',
  'registries.identityUnset': 'Not set',
  'registries.identityRoleHint': 'Set who is using the app to stamp reports and payroll with their name',
  'registries.change': 'Change',
  'registries.identityPick': 'Set User',

  // Section actions
  'registries.addContractor': '+ Add Contractor',
  'registries.addTeam': '+ Add Team',
  'registries.addWorker': '+ Add Worker',
  'registries.newTeam': 'New Team',

  // Empty states
  'registries.contractorsEmpty':
    'Add the contractors working on site — each work order will later be attributed to one of them.',
  'registries.teamsEmpty':
    'Build teams from the registered workers and assign a foreman to each — ' +
    'work orders and daily planning are attributed to these teams.',
  'registries.workersEmpty':
    'Add site workers with their trade and daily rate — this data is used to build teams and compute daily payroll.',

  // Table headers / labels
  'registries.colContractorName': 'Contractor Name',
  'registries.colPhone': 'Phone',
  'registries.colTrade': 'Trade',
  'registries.colDailyRate': 'Daily Rate ({unit})',
  'registries.colForeman': 'Foreman',
  'registries.colMembers': 'Members',
  'registries.colDefaultSize': 'Default Size',
  'registries.currencyUnit': 'IQD',

  // Placeholders / hints / titles
  'registries.contractorNamePh': 'Contractor / company name',
  'registries.contractorNotesPh': 'Scope of work, contract no.…',
  'registries.teamNamePh': 'Team name (e.g., Waterproofing Team)',
  'registries.teamNotesPh': 'Usual work location, accompanying equipment…',
  'registries.workerNamePh': 'Worker name',
  'registries.tradePh': 'Trade',
  'registries.dailyRateTitle': 'Daily rate in Iraqi dinars',
  'registries.noForeman': '— No foreman —',
  'registries.unnamed': 'Unnamed',
  'registries.noWorkersHint':
    'No workers registered yet — add workers from the "Workers" tab, then build the team from among them.',
  'registries.foremanChipTitle': 'Team foreman',
  'registries.memberChipTitle': 'Team member',
  'registries.sizeTitle':
    "The team's usual size — follows the member count automatically until you edit it manually (clear it to return to auto)",
  'registries.sizeResetTitle': 'Return to automatic size (member count)',
  'registries.sizeAuto': 'Auto',
  'registries.sizeReset': '↻ Auto',
  'registries.deleteContractorTitle': 'Delete contractor',
  'registries.deleteTeamTitle': 'Delete team',
  'registries.deleteWorkerTitle': 'Delete worker',

  // Confirm dialogs ({name} / {count} interpolated)
  'registries.confirmDeleteContractor': 'Delete contractor "{name}"?',
  'registries.confirmDeleteTeam': 'Delete team "{name}"?',
  'registries.confirmDeleteWorker': 'Delete worker "{name}"?',
  'registries.confirmDeleteWorkerTeams': ' It will be removed automatically from {count} team(s).',

  // Trade suggestions (workers datalist)
  'registries.tradeGeneral': 'General laborer',
  'registries.tradeHelper': "Laborer's helper",
  'registries.tradeSteelFixer': 'Steel fixer',
  'registries.tradeFormworkFixer': 'Formwork fixer',
  'registries.tradeCarpenter': 'Carpenter',
  'registries.tradeElectrician': 'Electrician',
  'registries.tradeWelder': 'Welder',
  'registries.tradeMechanic': 'Mechanic',
  'registries.tradeDriver': 'Driver',
  'registries.tradeSurveyor': 'Surveyor',
  'registries.tradeLabTechnician': 'Lab technician',
  'registries.tradeInspector': 'Technical inspector',

  // Identity picker modal
  'registries.idpTitle': 'Who is using the app?',
  'registries.idpText':
    'Your name and role are used to stamp daily reports, work orders, and payroll with your name.',
  'registries.idpNamePh': 'Name (e.g., Eng. Ahmed Karim)',
  'registries.idpRolePh': 'Role (e.g., Site Engineer)',
  'registries.roleSiteEngineer': 'Site Engineer',
  'registries.roleSiteManager': 'Site Manager',
  'registries.roleEngineer': 'Engineer',
  'registries.roleSurveyor': 'Surveyor',
  'registries.roleInspector': 'Technical Inspector',
  'registries.roleAccountant': 'Accountant',
  'registries.roleStorekeeper': 'Storekeeper',

  // resolveWho display strings (utils/Registries.js)
  'registries.whoContractor': 'Contractor: {name}',
  'registries.whoTeam': 'Team: {name}',
  'registries.whoWorkers': 'Workers: {names}',
  'registries.whoWorkersMore': 'Workers: {names} +{count}',
};
