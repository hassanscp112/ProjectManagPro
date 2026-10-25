import { RouterProvider } from 'react-router';
import { AppErrorBoundary } from './app/ErrorPage.jsx';
import { router } from './app/router.jsx';
import { ProjectProvider } from './state/ProjectProvider.jsx';

// The app: project store + hash router. Screens and the shell live in
// src/app/; project state and actions in src/state/ (see docs/02-architecture.md).
// Screen crashes are caught by the router (errorElement); the boundary
// catches the rest (the project store) so a crash never leaves a blank page.
function App() {
  return (
    <AppErrorBoundary>
      <ProjectProvider>
        <RouterProvider router={router} />
      </ProjectProvider>
    </AppErrorBoundary>
  );
}

export default App;
