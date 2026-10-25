import { Navigate, useLocation } from 'react-router';
import { ProjectProvider } from '../state/ProjectProvider.jsx';
import { currentProject, lastProjectId, openProject } from '../utils/Projects.js';
import AppLayout from './AppLayout.jsx';

/**
 * Entry to every route inside a project. Uses the project open in this tab;
 * a deep link in a new tab (e.g. #/schedule/task/2.1) reopens the last
 * project used on this device; otherwise (or for #/) it goes to the
 * projects list. The store is keyed by project so switching starts fresh.
 */
export default function ProjectGate() {
  const { pathname } = useLocation();
  let project = currentProject();
  if (!project && pathname !== '/') {
    const last = lastProjectId();
    if (last) project = openProject(last);
  }
  if (!project) return <Navigate to="/projects" replace />;
  return (
    <ProjectProvider key={project.id}>
      <AppLayout />
    </ProjectProvider>
  );
}
