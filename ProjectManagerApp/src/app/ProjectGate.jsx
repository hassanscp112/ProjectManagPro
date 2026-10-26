import { Navigate, useLocation } from 'react-router';
import { ProjectProvider } from '../state/ProjectProvider.jsx';
import { needsLogin } from '../sync/session.js';
import { currentProject, lastProjectId, openProject } from '../utils/Projects.js';
import AppLayout from './AppLayout.jsx';
import { usePlanEpoch, useServerConfig, useSession } from './account/useAccount.js';

/**
 * Entry to every route inside a project. Uses the project open in this tab;
 * a deep link in a new tab (e.g. #/schedule/task/2.1) reopens the last
 * project used on this device; otherwise (or for #/) it goes to the
 * projects list. The store is keyed by project so switching starts fresh.
 *
 * With a server set and nobody signed in it goes to #/login first. When
 * the sync engine rewrites this project's plan (a change from the server,
 * or a change it had to undo) the store is remounted, because it keeps the
 * plan in memory and would otherwise save its older copy over it.
 */
export default function ProjectGate() {
  const { pathname, search } = useLocation();
  const session = useSession();
  const config = useServerConfig();
  let project = currentProject();
  if (!project && pathname !== '/') {
    const last = lastProjectId();
    if (last) project = openProject(last);
  }
  const epoch = usePlanEpoch(project?.id || null);
  if (needsLogin(session, config)) return <Navigate to={`/login?next=${encodeURIComponent(pathname + search)}`} replace />;
  if (!project) return <Navigate to="/projects" replace />;
  return (
    <ProjectProvider key={`${project.id}:${epoch}`}>
      <AppLayout />
    </ProjectProvider>
  );
}
