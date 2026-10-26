import { RouterProvider } from 'react-router';
import SyncRuntime from './app/account/SyncRuntime.jsx';
import { AppErrorBoundary } from './app/ErrorPage.jsx';
import { router } from './app/router.jsx';
import UpdatePrompt from './app/UpdatePrompt.jsx';

// The app: the hash router. Screens and the shells live in src/app/; the
// project store (state/ProjectProvider) is mounted per project by
// app/ProjectGate (see docs/02-architecture.md). Crashes are caught by the
// router (errorElement); the boundary catches anything above it.
// SyncRuntime starts the server sync and sends every route to #/login while
// a server is set and nobody is signed in (src/sync).
// UpdatePrompt registers the service worker and offers new versions.
function App() {
  return (
    <AppErrorBoundary>
      <SyncRuntime router={router} />
      <RouterProvider router={router} />
      <UpdatePrompt />
    </AppErrorBoundary>
  );
}

export default App;
