// The app's information architecture. Two levels:
//   projects level (PORTFOLIO_AREAS): the project list, templates, rates —
//     shared by every project;
//   inside a project: 7 areas (+ Settings), their routes and sub-pages.
// Labels are dictionary keys.

import {
  BookOpen,
  CalendarRange,
  ClipboardList,
  Ellipsis,
  FileText,
  FolderKanban,
  HardHat,
  House,
  LayoutTemplate,
  SlidersHorizontal,
  Tags,
  Users,
  Wallet,
} from 'lucide-react';

export const AREAS = [
  { key: 'home', labelKey: 'ui.navHome', icon: House, path: '/' },
  { key: 'record', labelKey: 'ui.navRecord', icon: ClipboardList, path: '/record' },
  { key: 'schedule', labelKey: 'ui.navSchedule', icon: CalendarRange, path: '/schedule' },
  { key: 'reports', labelKey: 'ui.navReports', icon: FileText, path: '/reports/daily' },
  { key: 'finance', labelKey: 'ui.navFinance', icon: Wallet, path: '/finance/machinery' },
  { key: 'library', labelKey: 'ui.navLibrary', icon: BookOpen, path: '/library/boq' },
  { key: 'people', labelKey: 'ui.navPeople', icon: Users, path: '/people/contractors' },
];

/** The level above the projects (routes outside any project). */
export const PORTFOLIO_AREAS = [
  { key: 'projects', labelKey: 'projects.navProjects', icon: FolderKanban, path: '/projects' },
  { key: 'templates', labelKey: 'app.nav.templates', icon: LayoutTemplate, path: '/templates' },
  { key: 'rates', labelKey: 'templates.tabRates', icon: Tags, path: '/rates' },
  { key: 'work-types', labelKey: 'templates.navWorkTypes', icon: HardHat, path: '/work-types' },
];

export const SETTINGS_AREA = { key: 'settings', labelKey: 'ui.navSettings', icon: SlidersHorizontal, path: '/settings' };

export const MORE_AREA = { key: 'more', labelKey: 'ui.more', icon: Ellipsis, path: '/more' };

/** Sub-pages per area (rendered as tabs under the page title). */
export const AREA_TABS = {
  record: [
    { to: '/record', labelKey: 'record.tabNew', end: true },
    { to: '/record/log', labelKey: 'record.tabLog' },
    { to: '/record/pending', labelKey: 'record.tabPending' },
  ],
  schedule: [
    { to: '/schedule', labelKey: 'schedule.tabGantt', end: true, alsoActive: ['/schedule/task/'] },
    { to: '/schedule/lookahead', labelKey: 'schedule.tabLookahead' },
    { to: '/schedule/baseline', labelKey: 'schedule.tabBaseline' },
    { to: '/schedule/resources', labelKey: 'schedule.tabResources' },
  ],
  reports: [
    { to: '/reports/daily', labelKey: 'app.nav.reports' },
    { to: '/reports/monthly', labelKey: 'app.nav.monthly' },
    { to: '/reports/activity', labelKey: 'app.nav.activity' },
    { to: '/reports/delays', labelKey: 'diary.delaysTab' },
  ],
  finance: [
    { to: '/finance/machinery', labelKey: 'finance.tabMachineryShort' },
    { to: '/finance/materials', labelKey: 'finance.tabMaterialsShort' },
    { to: '/finance/pettyCash', labelKey: 'finance.tabPettyCashShort' },
    { to: '/finance/payroll', labelKey: 'finance.tabPayrollShort' },
    { to: '/finance/certificates', labelKey: 'certificates.tab' },
    { to: '/finance/lists', labelKey: 'finance.tabLists' },
  ],
  library: [
    { to: '/library/boq', labelKey: 'app.nav.calc' },
    { to: '/library/files', labelKey: 'app.nav.files' },
  ],
  settings: [
    { to: '/settings', labelKey: 'settings.tabGeneral', end: true },
    { to: '/settings/users', labelKey: 'account.tabUsers' },
    { to: '/settings/server', labelKey: 'account.tabServer' },
  ],
  people: [
    { to: '/people/contractors', labelKey: 'registries.tabContractors' },
    { to: '/people/teams', labelKey: 'registries.tabTeams' },
    { to: '/people/workers', labelKey: 'registries.tabWorkers' },
  ],
};

/** Area key for a router pathname ('/schedule/task/2.1.2' → 'schedule'). */
export const areaKeyForPath = (pathname) => {
  const first = (pathname || '/').split('/').filter(Boolean)[0];
  if (!first) return 'home';
  return first;
};

/** Hash href for a router path (the app uses hash URLs). */
export const hrefFor = (path) => `#${path}`;
