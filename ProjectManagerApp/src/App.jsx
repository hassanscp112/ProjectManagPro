import { RouterProvider } from 'react-router';
import { AppErrorBoundary } from './app/ErrorPage.jsx';
import { router } from './app/router.jsx';

// The app: the hash router. Screens and the shells live in src/app/; the
// project store (state/ProjectProvider) is mounted per project by
// app/ProjectGate (see docs/02-architecture.md). Crashes are caught by the
// router (errorElement); the boundary catches anything above it.
function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  );
}

export default App;
