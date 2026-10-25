// Route table (hash URLs: http://localhost:5173/#/schedule/task/2.1.2).
// Refresh and shared links land on the same screen.
// Two levels: the projects level (/projects, /templates, /rates — no project
// open) and everything else, which runs inside the open project (ProjectGate).

import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate } from 'react-router';
import { RouteErrorPage } from './ErrorPage.jsx';
import ProjectGate from './ProjectGate.jsx';
import PortfolioLayout from './portfolio/PortfolioLayout.jsx';
import ProjectsPage from './portfolio/ProjectsPage.jsx';
import HomePage from './home/HomePage.jsx';
import MorePage from './pages/MorePage.jsx';
import RecordLogPage from './record/RecordLogPage.jsx';
import RecordNewPage from './record/RecordNewPage.jsx';
import RecordPendingPage from './record/RecordPendingPage.jsx';

// Home and Record (the daily screens) load with the app; every other area
// loads its code on first visit. The router waits for it before switching,
// so the old page stays until the new one is ready.
const page = (load) => ({ lazy: () => load().then((m) => ({ Component: m.default })) });

const screenRoutes = [
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
  // Templates and rates moved up to the projects level; old links still work.
  { path: 'library/templates', element: <Navigate to="/templates" replace /> },
  { path: 'library/templates/new', element: <Navigate to="/templates/new" replace /> },
  { path: 'library/rates', element: <Navigate to="/rates" replace /> },
  { path: 'library/files', ...page(() => import('./library/FilesPage.jsx')) },
  { path: 'library/files/:taskId', ...page(() => import('./library/FilesPage.jsx')) },
  { path: 'people', element: <Navigate to="/people/contractors" replace /> },
  { path: 'people/:kind', ...page(() => import('./people/PeoplePage.jsx')) },
  { path: 'settings', ...page(() => import('./settings/SettingsPage.jsx')) },
  { path: 'more', element: <MorePage /> },
];

// A crashing screen (or lazy code that fails to load) shows the error page
// inside the shell, so the navigation still works; a crashing shell shows it
// full-window.
const appRoutes = {
  element: <ProjectGate />,
  errorElement: <RouteErrorPage />,
  children: [{ errorElement: <RouteErrorPage inline />, children: screenRoutes }],
};

// The level above every project.
const portfolioRoutes = {
  element: <PortfolioLayout />,
  errorElement: <RouteErrorPage />,
  children: [
    {
      errorElement: <RouteErrorPage inline />,
      children: [
        { path: 'projects', element: <ProjectsPage /> },
        { path: 'projects/new', ...page(() => import('./portfolio/NewProjectPage.jsx')) },
        { path: 'templates', ...page(() => import('./templates/TemplatesPage.jsx')) },
        { path: 'templates/new', ...page(() => import('./templates/TemplateBuilderPage.jsx')) },
        { path: 'rates', ...page(() => import('./templates/RatesPage.jsx')) },
      ],
    },
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
  portfolioRoutes,
  ...devRoutes,
  { path: '*', element: <Navigate to="/" replace /> },
]);
