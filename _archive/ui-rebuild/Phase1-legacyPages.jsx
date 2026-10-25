// The one screen still mounted from the old app: full task details
// (element columns, BOQ links) behind the task panel's "Full details".
// It is light-only, so it keeps the light theme while open.

import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import TaskDetails from '../../components/taskDetails/TaskDetails';
import { useProject } from '../../state/projectContext.js';
import { Page } from '../Page.jsx';

/** Full task details (element columns, BOQ links) — the "full page" behind the side panel. */
export function TaskDetailsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const p = useProject();
  useEffect(() => {
    const root = document.documentElement;
    const before = root.getAttribute('data-theme');
    root.setAttribute('data-theme', 'light');
    return () => (before === null ? root.removeAttribute('data-theme') : root.setAttribute('data-theme', before));
  }, []);
  const task = p.tasks.find((x) => x.id === taskId);
  if (!task) return <Navigate to="/schedule" replace />;
  return (
    <Page area="schedule">
      <TaskDetails
        task={task}
        allTasks={p.tasks}
        computedTasks={p.engineResult.tasks}
        isSigned={!!p.projectMeta.baseline}
        orders={p.orders}
        registries={p.registries}
        identity={p.identity}
        onUpdateTask={p.updateTask}
        onToggleBoqLink={p.setBoqLink}
        onLinkExistingBoq={p.linkBoqToExisting}
        onAddSubTask={p.addSubTask}
        onDeleteTask={p.requestDeleteTask}
        onJumpToTaskDetails={(next) => navigate(`/schedule/task/${encodeURIComponent(next.id)}/details`)}
        onBack={() => navigate(`/schedule/task/${encodeURIComponent(task.id)}`)}
      />
    </Page>
  );
}
