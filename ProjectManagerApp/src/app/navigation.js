// The app's information architecture: 7 areas (+ Settings), their routes
// and the sub-pages inside each area. Labels are dictionary keys.

import {
  BookOpen,
  CalendarRange,
  ClipboardList,
  Ellipsis,
  FileText,
  House,
  SlidersHorizontal,
  Users,
  Wallet,
} from 'lucide-react';

export const AREAS = [
  { key: 'home', labelKey: 'ui.navHome', icon: House, path: '/' },
  { key: 'record', labelKey: 'ui.navRecord', icon: ClipboardList, path: '/record' },
  { key: 'schedule', labelKey: 'ui.navSchedule', icon: CalendarRange, path: '/schedule' },
  { key: 'reports', labelKey: 'ui.navReports', icon: FileText, path: '/reports/daily' },
  { key: 'finance', labelKey: 'ui.navFinance', icon: Wallet, path: '/finance' },
  { key: 'library', labelKey: 'ui.navLibrary', icon: BookOpen, path: '/library/boq' },
  { key: 'people', labelKey: 'ui.navPeople', icon: Users, path: '/people' },
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
    { to: '/schedule', labelKey: 'app.nav.gantt', end: true },
    { to: '/schedule/lookahead', labelKey: 'app.nav.planning' },
  ],
  reports: [
    { to: '/reports/daily', labelKey: 'app.nav.reports' },
    { to: '/reports/monthly', labelKey: 'app.nav.monthly' },
    { to: '/reports/activity', labelKey: 'app.nav.activity' },
  ],
  library: [
    { to: '/library/boq', labelKey: 'app.nav.calc' },
    { to: '/library/templates', labelKey: 'app.nav.templates' },
    { to: '/library/files', labelKey: 'app.nav.files' },
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
