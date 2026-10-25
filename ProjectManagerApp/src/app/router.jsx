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
import {
  ActivityPage,
  BoqCalculatorPage,
  DailyReportsPage,
  FilesPage,
  FinancePage,
  MonthlyReportPage,
  PeoplePage,
  SettingsPage,
  TaskDetailsPage,
  TemplatesPage,
} from './pages/legacyPages.jsx';

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
    { path: 'reports/daily', element: <DailyReportsPage /> },
    { path: 'reports/monthly', element: <MonthlyReportPage /> },
    { path: 'reports/activity', element: <ActivityPage /> },
    { path: 'finance', element: <FinancePage /> },
    { path: 'library', element: <Navigate to="/library/boq" replace /> },
    { path: 'library/boq', element: <BoqCalculatorPage /> },
    { path: 'library/templates', element: <TemplatesPage /> },
    { path: 'library/files', element: <FilesPage /> },
    { path: 'library/files/:taskId', element: <FilesPage /> },
    { path: 'people', element: <PeoplePage /> },
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
