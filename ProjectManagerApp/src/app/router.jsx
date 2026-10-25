// Route table (hash URLs: http://localhost:5173/#/schedule/task/2.1.2).
// Refresh and shared links land on the same screen.

import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate } from 'react-router';
import AppLayout from './AppLayout.jsx';
import HomePage from './home/HomePage.jsx';
import MorePage from './pages/MorePage.jsx';
import RecordLogPage from './record/RecordLogPage.jsx';
import RecordNewPage from './record/RecordNewPage.jsx';
import RecordPendingPage from './record/RecordPendingPage.jsx';

// Home and Record (the daily screens) load with the app; every other area
// loads its code on first visit. The router waits for it before switching,
// so the old page stays until the new one is ready.
const page = (load) => ({ lazy: () => load().then((m) => ({ Component: m.default })) });

const appRoutes = {
  element: <AppLayout />,
  children: [
    { index: true, element: <HomePage /> },
    { path: 'record', element: <RecordNewPage /> },
    { path: 'record/log', element: <RecordLogPage /> },
    { path: 'record/pending', element: <RecordPendingPage /> },
    // The task panel is a child route so the Gantt stays mounted while it opens/closes.
    {
      path: 'schedule',
      ...page(() => import('./schedule/SchedulePage.jsx')),
      children: [
        { index: true, element: null },
        { path: 'task/:taskId', element: null },
      ],
    },
    { path: 'schedule/task/:taskId/details', ...page(() => import('./schedule/TaskDetailsPage.jsx')) },
    { path: 'schedule/lookahead', ...page(() => import('./schedule/LookaheadPage.jsx')) },
    { path: 'schedule/baseline', ...page(() => import('./schedule/BaselinePage.jsx')) },
    { path: 'reports', element: <Navigate to="/reports/daily" replace /> },
    { path: 'reports/daily', ...page(() => import('./reports/DailyReportPage.jsx')) },
    { path: 'reports/monthly', ...page(() => import('./reports/MonthlyReportPage.jsx')) },
    { path: 'reports/activity', ...page(() => import('./reports/ActivityPage.jsx')) },
    { path: 'finance', element: <Navigate to="/finance/machinery" replace /> },
    { path: 'finance/:ledger', ...page(() => import('./finance/FinancePage.jsx')) },
    { path: 'library', element: <Navigate to="/library/boq" replace /> },
    { path: 'library/boq', ...page(() => import('./library/BoqPage.jsx')) },
    { path: 'library/templates', ...page(() => import('./library/TemplatesPage.jsx')) },
    { path: 'library/templates/new', ...page(() => import('./library/TemplateBuilderPage.jsx')) },
    { path: 'library/rates', ...page(() => import('./library/RatesPage.jsx')) },
    { path: 'library/files', ...page(() => import('./library/FilesPage.jsx')) },
    { path: 'library/files/:taskId', ...page(() => import('./library/FilesPage.jsx')) },
    { path: 'people', element: <Navigate to="/people/contractors" replace /> },
    { path: 'people/:kind', ...page(() => import('./people/PeoplePage.jsx')) },
    { path: 'settings', ...page(() => import('./settings/SettingsPage.jsx')) },
    { path: 'more', element: <MorePage /> },
  ],
};

// Dev-only component review page (not part of production builds).
const UiReview = import.meta.env.DEV ? lazy(() => import('../dev/UiReview.jsx')) : null;
const devRoutes = UiReview
  ? [
      {
        path: 'dev/ui',
        element: (
          <Suspense fallback={null}>
            <UiReview />
          </Suspense>
        ),
      },
    ]
  : [];

export const router = createHashRouter([
  { path: '/', ...appRoutes },
  ...devRoutes,
  { path: '*', element: <Navigate to="/" replace /> },
]);
