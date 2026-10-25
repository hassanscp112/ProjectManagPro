import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../i18n/useI18n.js';
import { logAppEvent, loadAppEvents, ACTIVITY_STORAGE_KEY } from '../utils/ActivityLog';
import { GanttEngine } from '../utils/GanttEngine';
import { IDENTITY_STORAGE_KEY, hasIdentity, loadIdentity } from '../utils/Identity';
import { ORDERS_STORAGE_KEY, loadOrdersData } from '../utils/OrderEngine';
import { REGISTRIES_STORAGE_KEY, loadRegistries } from '../utils/Registries';
import { writeAutoSnapshot } from '../utils/Snapshots';
import { onStoreChange } from '../utils/storeEvents.js';
import { ProjectContext } from './projectContext.js';
import {
  META_STORAGE_KEY,
  PROJECT_START,
  STATUS_KEYS,
  TASKS_STORAGE_KEY,
  addMainTask,
  addSubTask,
  appendGeneratedTasks,
  applyVariation,
  countPendingApprovals,
  createTaskId,
  deleteTaskCascade,
  describeDelete,
  linkExistingBoq,
  loadMeta,
  loadTasks,
  normalizeTaskUpdate,
  replaceTask,
  signOffProject,
  toggleBoqLink,
} from './projectModel.js';

const UNDO_LIMIT = 50;
const TYPING_DEBOUNCE_MS = 1000;

/**
 * The project store: task tree, project meta and the ecosystem stores
 * (orders, registries, identity, activity), the engine result computed
 * from them, undo, and every action that changes them. Replaces the state
 * that used to live in App.jsx; behavior is unchanged.
 *
 * Persistence: tasks and meta are written here on every change; the other
 * stores are written by their utils owners, which announce the change
 * (storeEvents) so this provider re-reads them right away.
 */
export function ProjectProvider({ children }) {
  const { t } = useI18n();
  const [tasks, setTasks] = useState(loadTasks);
  const [projectMeta, setProjectMeta] = useState(loadMeta);
  const [ordersData, setOrdersData] = useState(loadOrdersData);
  const [registries, setRegistries] = useState(loadRegistries);
  const [identity, setIdentity] = useState(loadIdentity);
  const [appEvents, setAppEvents] = useState(loadAppEvents);
  const [identityOpen, setIdentityOpen] = useState(() => !hasIdentity());
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [ganttView, setGanttView] = useState({ isEditMode: false, viewMode: 'week' });
  const orders = useMemo(() => ordersData?.orders || [], [ordersData]);

  const historyRef = useRef([]);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify(projectMeta));
  }, [projectMeta]);

  // First change of the day → automatic checkpoint (no-op if today's exists).
  useEffect(() => {
    writeAutoSnapshot(tasks, projectMeta, identity?.name || '');
  }, [tasks, projectMeta, identity]);

  /** Re-read the stores other screens persist directly. */
  const refreshStores = useCallback(() => {
    setOrdersData(loadOrdersData());
    setRegistries(loadRegistries());
    setAppEvents(loadAppEvents());
  }, []);

  // Live refresh when one of the ecosystem stores changes: in this tab
  // (storeEvents from the utils owners) or in another open tab (the
  // browser's `storage` event; key null = storage cleared).
  useEffect(() => {
    const reload = (key) => {
      if (key === null || key === ORDERS_STORAGE_KEY) setOrdersData(loadOrdersData());
      if (key === null || key === REGISTRIES_STORAGE_KEY) setRegistries(loadRegistries());
      if (key === null || key === ACTIVITY_STORAGE_KEY) setAppEvents(loadAppEvents());
      if (key === null || key === IDENTITY_STORAGE_KEY) setIdentity(loadIdentity());
    };
    const offStore = onStoreChange(reload);
    const onStorage = (e) => reload(e.key);
    window.addEventListener('storage', onStorage);
    return () => {
      offStore();
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const engineResult = useMemo(
    () => GanttEngine.calculate(tasks, PROJECT_START, projectMeta, orders),
    [tasks, projectMeta, orders]
  );

  /* ── undo ── */
  const pushToHistory = (snapshot) => {
    historyRef.current.push(JSON.parse(JSON.stringify(snapshot)));
    if (historyRef.current.length > UNDO_LIMIT) historyRef.current.shift();
    setCanUndo(true);
  };

  const undo = () => {
    if (historyRef.current.length === 0) return;
    setTasks(historyRef.current.pop());
    setCanUndo(historyRef.current.length > 0);
  };

  /* ── task edits ── */

  // Typing in a grid cell produces many updates: one undo step per burst.
  const updateTask = (updatedTask) => {
    if (!typingTimeoutRef.current) pushToHistory(tasks);
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, TYPING_DEBOUNCE_MS);
    const normalized = normalizeTaskUpdate(updatedTask);
    setTasks((prev) => replaceTask(prev, normalized));
  };

  const addMain = () => {
    pushToHistory(tasks);
    setTasks((prev) => addMainTask(prev, { id: createTaskId(), name: t('app.newMainGroup') }));
  };

  const addSub = (parentId) => {
    pushToHistory(tasks);
    setTasks((prev) => addSubTask(prev, parentId, { id: createTaskId(), name: t('app.newSubTask') }));
  };

  const requestDeleteTask = (taskId) => setTaskToDelete(taskId);
  const cancelDeleteTask = () => setTaskToDelete(null);
  const confirmDeleteTask = () => {
    if (!taskToDelete) return;
    pushToHistory(tasks);
    setTasks((prev) => deleteTaskCascade(prev, taskToDelete));
    setTaskToDelete(null);
  };
  const deletePreview = useMemo(() => describeDelete(tasks, taskToDelete), [tasks, taskToDelete]);

  const setBoqLink = (parentTaskId, column, checked) => {
    pushToHistory(tasks);
    const id = createTaskId();
    setTasks((prev) => toggleBoqLink(prev, parentTaskId, column, checked, { id, name: t('app.newBoqItem') }));
  };

  const linkBoqToExisting = (parentTaskId, column, leafTaskId) => {
    if (!leafTaskId) return;
    pushToHistory(tasks);
    setTasks((prev) => linkExistingBoq(prev, parentTaskId, column, leafTaskId));
  };

  /* ── lifecycle ── */

  const signOff = (signedBy) => {
    pushToHistory(tasks);
    const result = signOffProject(tasks, engineResult.tasks, projectMeta, signedBy, new Date().toISOString());
    setTasks(result.tasks);
    setProjectMeta(result.meta);
    logAppEvent({
      actor: signedBy || identity.name,
      kind: 'lifecycle',
      summary: `${t('app.modal.signOffLog')} (${result.leafCount} ${t('app.modal.signOffLogCount')})`,
      refType: 'baseline',
      refId: 'latest',
    });
  };

  const setStatus = (status) => {
    logAppEvent({
      actor: identity.name,
      kind: 'lifecycle',
      summary: `${t('app.vo.statusChanged')} «${STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status}»`,
      refType: 'project',
      refId: 'status',
    });
    setProjectMeta((prev) => ({ ...prev, status }));
  };

  /** Returns true when the variation was recorded. */
  const raiseVariation = (draft) => {
    const result = applyVariation(tasks, draft, { id: createTaskId(), date: new Date().toISOString() });
    if (!result) return false;
    pushToHistory(tasks);
    setTasks(result.tasks);
    setProjectMeta((prev) => ({ ...prev, variations: [...(prev.variations || []), result.vo] }));
    return true;
  };

  /** Append a template's tree; returns true when anything was added. */
  const generateFromTemplate = (generated, meta) => {
    if (!Array.isArray(generated) || generated.length === 0) return false;
    pushToHistory(tasks);
    const result = appendGeneratedTasks(tasks, generated);
    setTasks(result.tasks);
    logAppEvent({
      actor: identity.name,
      kind: 'template',
      summary: `${t('app.template.generatedLog')} «${meta?.templateName || ''}» — ${result.added} ${t('app.template.itemsLog')}`,
      refType: 'template',
      refId: meta?.templateId || '',
    });
    return true;
  };

  const value = {
    // data
    tasks,
    projectMeta,
    orders,
    lastWhoByType: ordersData?.lastWhoByType || {},
    registries,
    identity,
    appEvents,
    engineResult,
    pendingApprovals: countPendingApprovals(orders),
    // stores
    refreshStores,
    setRegistries,
    // identity dialog
    identityOpen,
    openIdentity: () => setIdentityOpen(true),
    closeIdentity: () => setIdentityOpen(false),
    onIdentitySaved: (saved) => {
      setIdentity(saved);
      setAppEvents(loadAppEvents());
    },
    // tasks
    updateTask,
    addMainTask: addMain,
    addSubTask: addSub,
    requestDeleteTask,
    cancelDeleteTask,
    confirmDeleteTask,
    taskToDelete,
    deletePreview,
    setBoqLink,
    linkBoqToExisting,
    undo,
    canUndo,
    ganttView,
    setGanttView,
    // lifecycle
    signOff,
    setStatus,
    raiseVariation,
    generateFromTemplate,
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
