// Route pages that mount the existing screens unchanged inside the new
// shell (Phase 1). Each one is replaced by a rebuilt screen in its phase:
// Schedule P4 · Reports P5 (done) · the rest P6.

import { Navigate, useNavigate, useParams } from 'react-router';
import CalculatorView from '../../components/calculator/CalculatorView';
import FileManager from '../../components/FileManager';
import FinanceManager from '../../components/finance/FinanceManager';
import RegistriesScreen from '../../components/registries/RegistriesScreen';
import SnapshotsScreen from '../../components/snapshots/SnapshotsScreen';
import TaskDetails from '../../components/taskDetails/TaskDetails';
import TemplatesScreen from '../../components/templates/TemplatesScreen';
import { useProject } from '../../state/projectContext.js';
import { Page } from '../Page.jsx';

/** Full task details (element columns, BOQ links) — the "full page" behind the side panel. */
export function TaskDetailsPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const p = useProject();
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

export function FinancePage() {
  return (
    <Page area="finance">
      <FinanceManager />
    </Page>
  );
}

export function BoqCalculatorPage() {
  return (
    <Page area="library">
      <CalculatorView />
    </Page>
  );
}

export function TemplatesPage() {
  const { tasks, generateFromTemplate } = useProject();
  const navigate = useNavigate();
  return (
    <Page area="library">
      <TemplatesScreen
        tasks={tasks}
        onGenerate={(generated, meta) => {
          if (generateFromTemplate(generated, meta)) navigate('/schedule');
        }}
      />
    </Page>
  );
}

export function FilesPage() {
  const { taskId } = useParams();
  const { engineResult } = useProject();
  const targetTask = taskId ? engineResult.tasks.find((x) => x.id === taskId) || null : null;
  return (
    <Page area="library">
      <FileManager tasks={engineResult.tasks} targetTask={targetTask} />
    </Page>
  );
}

export function PeoplePage() {
  const { setRegistries } = useProject();
  return (
    <Page area="people">
      <RegistriesScreen onChange={setRegistries} />
    </Page>
  );
}

export function SettingsPage() {
  const { tasks, projectMeta, identity } = useProject();
  return (
    <Page area="settings">
      <SnapshotsScreen tasks={tasks} projectMeta={projectMeta} identity={identity} onRestored={() => window.location.reload()} />
    </Page>
  );
}
