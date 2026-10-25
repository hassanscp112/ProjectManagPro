import { RouterProvider } from 'react-router';
import { router } from './app/router.jsx';
import { ProjectProvider } from './state/ProjectProvider.jsx';

// The app: project store + hash router. Screens and the shell live in
// src/app/; project state and actions in src/state/ (see docs/02-architecture.md).
function App() {
  return (
    <ProjectProvider>
      <RouterProvider router={router} />
    </ProjectProvider>
  );
}

export default App;
