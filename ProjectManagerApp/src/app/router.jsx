// Route table (hash URLs: http://localhost:5173/#/schedule/task/2.1.2).
// Refresh and shared links land on the same screen.

import { lazy, Suspense } from 'react';
import { createHashRouter, Navigate } from 'react-router';
import AppLayout from './AppLayout.jsx';
import HomePage from './home/HomePage.jsx';
import MorePage from './pages/MorePage.jsx';
import BaselinePage from './schedule/BaselinePage.jsx';
import LookaheadPage from './schedule/LookaheadPage.jsx';
import SchedulePage from './schedule/SchedulePage.jsx';
import RecordLogPage from './record/RecordLogPage.jsx';
import RecordNewPage from './record/RecordNewPage.jsx';
import RecordPendingPage from './record/RecordPendingPage.jsx';
import ActivityPage from './reports/ActivityPage.jsx';
import DailyReportPage from './reports/DailyReportPage.jsx';
import MonthlyReportPage from './reports/MonthlyReportPage.jsx';
import FinancePage from './finance/FinancePage.jsx';
import BoqPage from './library/BoqPage.jsx';
import FilesPage from './library/FilesPage.jsx';
import RatesPage from './library/RatesPage.jsx';
import TemplateBuilderPage from './library/TemplateBuilderPage.jsx';
import TemplatesPage from './library/TemplatesPage.jsx';
import { TaskDetailsPage } from './pages/legacyPages.jsx';
import PeoplePage from './people/PeoplePage.jsx';
import SettingsPage from './settings/SettingsPage.jsx';

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
      element: <SchedulePage />,
      children: [
        { index: true, element: null },
        { path: 'task/:taskId', element: null },
      ],
    },
    { path: 'schedule/task/:taskId/details', element: <TaskDetailsPage /> },
    { path: 'schedule/lookahead', element: <LookaheadPage /> },
    { path: 'schedule/baseline', element: <BaselinePage /> },
    { path: 'reports', element: <Navigate to="/reports/daily" replace /> },
    { path: 'reports/daily', element: <DailyReportPage /> },
    { path: 'reports/monthly', element: <MonthlyReportPage /> },
    { path: 'reports/activity', element: <ActivityPage /> },
    { path: 'finance', element: <Navigate to="/finance/machinery" replace /> },
    { path: 'finance/:ledger', element: <FinancePage /> },
    { path: 'library', element: <Navigate to="/library/boq" replace /> },
    { path: 'library/boq', element: <BoqPage /> },
    { path: 'library/templates', element: <TemplatesPage /> },
    { path: 'library/templates/new', element: <TemplateBuilderPage /> },
    { path: 'library/rates', element: <RatesPage /> },
    { path: 'library/files', element: <FilesPage /> },
    { path: 'library/files/:taskId', element: <FilesPage /> },
    { path: 'people', element: <Navigate to="/people/contractors" replace /> },
    { path: 'people/:kind', element: <PeoplePage /> },
    { path: 'settings', element: <SettingsPage /> },
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
