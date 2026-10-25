import { useState, useMemo, useRef, useEffect } from 'react'
import './App.css'
import GanttChart from './components/GanttChart'
import FileManager from './components/FileManager'
import CalculatorView from './components/calculator/CalculatorView'
import DailyReports from './components/reports/DailyReports'
import FinanceManager from './components/finance/FinanceManager'
import Dashboard from './components/dashboard/Dashboard'
import TaskDetails from './components/taskDetails/TaskDetails'
import { GanttEngine } from './utils/GanttEngine'
import { exportAppData, readBackupFile, validateBackup, restoreAppData } from './utils/DataIO'
import OrdersScreen from './components/orders/OrdersScreen'
import PlanningScreen from './components/planning/PlanningScreen'
import ActivityScreen from './components/activity/ActivityScreen'
import MonthlyReport from './components/reports/MonthlyReport'
import TemplatesScreen from './components/templates/TemplatesScreen'
import RegistriesScreen from './components/registries/RegistriesScreen'
import IdentityPicker from './components/registries/IdentityPicker'
import SnapshotsScreen from './components/snapshots/SnapshotsScreen'
import { loadOrdersData } from './utils/OrderEngine'
import { loadRegistries } from './utils/Registries'
import { loadIdentity, hasIdentity } from './utils/Identity'
import { loadAppEvents, logAppEvent } from './utils/ActivityLog'
import { writeAutoSnapshot } from './utils/Snapshots'
import { useI18n } from './i18n/useI18n.js'
import { compactCurrency } from './i18n/index.js'
import LanguageSwitcher from './i18n/LanguageSwitcher.jsx'
const STORAGE_KEY = 'project-manager-gantt-tasks';
const META_KEY = 'project-manager-project-meta';
const PROJECT_START = '2025-08-02';

const DEFAULT_META = { status: 'draft', baseline: null, variations: [] };

const STATUS_KEYS = {
  draft: 'common.statusDraft',
  signed: 'common.statusSigned',
  executing: 'common.statusExecuting',
  completed: 'common.statusCompleted',
};

// Variation-order classification codes (stored on records; labels via i18n).
const VO_CLASS_KEYS = {
  qty: 'app.vo.classQty',
  price: 'app.vo.classPrice',
  scope: 'app.vo.classScope',
  add: 'app.vo.classAdd',
  remove: 'app.vo.classRemove',
};

const INITIAL_TASKS = [
  { id: '0', wbs: '0', name: 'تجهيز الموقع', isGroup: true, manualStart: '2025-08-02', duration: 14, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '0.1', wbs: '0.1', name: 'تجهيز الموقع', isGroup: false, manualStart: '2025-08-02', duration: 14, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  
  { id: '1', wbs: '1', name: 'اولا / الحفريات', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '1.1', wbs: '1.1', name: 'تجهيز المعدات اللازمة وتنفيذ اعمال الحفريات الترابية للقنوات وبموجب الابعاد والمناسيب الواردة في المخططات وتشمل السعر حفر ونقل كافة انواع...', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '1.1.1', wbs: '1.1.1', name: 'حفر القنوات الفرعية', isGroup: false, manualStart: '2025-08-23', duration: 60, quantity: 9413.4, actualQuantity: 9413, unitPrice: 1350, unit: 'م3', dependsOn: '0.1', depType: 'FS', lag: 7 },
  
  { id: '2', wbs: '2', name: 'ثانيا/الاملاءات الترابية', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '2.1', wbs: '2.1', name: 'تجهيز المعدات اللازمة وتنفيذ اعمال الاملاءات الترابية للقنوات وبموجب الابعاد والمناسيب الواردة في المخططات وتشمل السعر حفر ونقل وفرش الترب...', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '2.1.1', wbs: '2.1.1', name: 'دفن القناة الرئيسية MC7', isGroup: false, duration: 30, quantity: 16000, actualQuantity: 0, unitPrice: 5000, unit: 'م3', dependsOn: '1.1.1', depType: 'SS', lag: 0 },
  { id: '2.1.2', wbs: '2.1.2', name: 'دفن القنوات الفرعية', isGroup: false, duration: 238, quantity: 142535.6, actualQuantity: 135000, unitPrice: 6000, unit: 'م3', dependsOn: '2.1.1', depType: 'FS', lag: 16 },
  { id: '2.1.3', wbs: '2.1.3', name: 'دفن القنوات المغذية', isGroup: false, duration: 238, quantity: 95590.6, actualQuantity: 0, unitPrice: 6000, unit: 'م3', dependsOn: '2.1.2', depType: 'FS', lag: -78 },
  
  { id: '3', wbs: '3', name: 'ثالثا/التبطين', isGroup: true, quantity: 0, actualQuantity: 0, unitPrice: 0, unit: '', dependsOn: null, depType: '', lag: 0 },
  { id: '3.1.1', wbs: '3.1.1', name: 'تبطين القناة الرئيسية MC7 بسمك 10 سم', isGroup: false, duration: 17, quantity: 3400, actualQuantity: 0, unitPrice: 18500, unit: 'm2', dependsOn: '1.1.1', depType: 'FF', lag: 0 },
  { id: '3.1.2', wbs: '3.1.2', name: 'تبطين القنوات الفرعية بسمك 8 سم', isGroup: false, duration: 127, quantity: 76087.4, actualQuantity: 0, unitPrice: 17500, unit: 'm2', dependsOn: '3.1.1', depType: 'FF', lag: -90 },
  { id: '3.1.3', wbs: '3.1.3', name: 'تبطين القنوات المغذية بسمك 6 سم', isGroup: false, duration: 198, quantity: 59514, actualQuantity: 0, unitPrice: 16450, unit: 'm2', dependsOn: '3.1.2', depType: 'FF', lag: -78 },
];

const loadInitialTasks = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return INITIAL_TASKS;

    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_TASKS;
  } catch {
    return INITIAL_TASKS;
  }
};

const loadMeta = () => {
  try {
    const saved = localStorage.getItem(META_KEY);
    if (!saved) return { ...DEFAULT_META };
    const parsed = JSON.parse(saved);
    return { ...DEFAULT_META, ...parsed };
  } catch {
    return { ...DEFAULT_META };
  }
};

const createTaskId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const getTaskAndDescendantIds = (tasks, taskId) => {
  const task = tasks.find(item => item.id === taskId);
  if (!task) return new Set();

  const ids = new Set([task.id]);
  if (task.wbs) {
    const prefix = `${task.wbs}.`;
    tasks.forEach(item => {
      if (item.wbs?.startsWith(prefix)) ids.add(item.id);
    });
  }

  return ids;
};

function App() {
  const { t, lang, dir } = useI18n();
  const [tasks, setTasks] = useState(loadInitialTasks);
  const [projectMeta, setProjectMeta] = useState(loadMeta);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [targetFileFolder, setTargetFileFolder] = useState(null);
  const [targetTaskDetails, setTargetTaskDetails] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [viewMode, setViewMode] = useState('week'); // 'week' or 'month'
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [canUndo, setCanUndo] = useState(false);
  const [signOffOpen, setSignOffOpen] = useState(false);
  const [signOffBy, setSignOffBy] = useState('');
  const [voOpen, setVoOpen] = useState(false);
  const [voDraft, setVoDraft] = useState({ taskId: '', field: 'quantity', newValue: '', reason: '', approver: '', urgency: 'medium', classification: '', estCostImpact: '', estScheduleDays: '', clauseRef: 'FIDIC 13.x' });

  // Ecosystem stores (orders / registries / identity / activity). The module
  // screens persist these directly to localStorage; App re-reads them on tab
  // switches so the engine and sibling screens always see fresh data.
  const [ordersData, setOrdersData] = useState(loadOrdersData);
  const [registries, setRegistries] = useState(loadRegistries);
  const [identity, setIdentity] = useState(loadIdentity);
  const [appEvents, setAppEvents] = useState(loadAppEvents);
  const [identityOpen, setIdentityOpen] = useState(() => !hasIdentity());
  const orders = useMemo(() => ordersData?.orders || [], [ordersData]);

  // Backup / restore (data-safety: protect against localStorage loss)
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreInfo, setRestoreInfo] = useState(null);
  const fileInputRef = useRef(null);
  const pendingRestoreRef = useRef(null);

  const historyRef = useRef([]);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(META_KEY, JSON.stringify(projectMeta));
  }, [projectMeta]);

  // First change of the day → automatic checkpoint (version-history layer).
  // writeAutoSnapshot no-ops when today's checkpoint already exists.
  useEffect(() => {
    writeAutoSnapshot(tasks, projectMeta, identity?.name || '');
  }, [tasks, projectMeta, identity]);

  // Module screens own their persistence — App's copies refresh on tab
  // switches so the engine and views always read the latest ledger state.
  const refreshEcosystemStores = () => {
    setOrdersData(loadOrdersData());
    setRegistries(loadRegistries());
    setAppEvents(loadAppEvents());
  };
  const goToTab = (tab) => {
    setActiveTab(tab);
    refreshEcosystemStores();
  };

  const pushToHistory = (stateToSave) => {
    historyRef.current.push(JSON.parse(JSON.stringify(stateToSave)));
    if (historyRef.current.length > 50) historyRef.current.shift();
    setCanUndo(true);
  };

  const undo = () => {
    if (historyRef.current.length > 0) {
      const prevState = historyRef.current.pop();
      setTasks(prevState);
      setCanUndo(historyRef.current.length > 0);
    }
  };

  const engineResult = useMemo(() => {
    return GanttEngine.calculate(tasks, PROJECT_START, projectMeta, orders);
  }, [tasks, projectMeta, orders]);

  const handleUpdateTask = (updatedTask) => {
    const normalizedTask = {
      ...updatedTask,
      dependsOn: updatedTask.dependsOn || null,
      depType: updatedTask.dependsOn ? (updatedTask.depType || 'FS') : '',
      lag: updatedTask.dependsOn ? updatedTask.lag : 0,
    };

    if (!typingTimeoutRef.current) {
      pushToHistory(tasks);
    }
    
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      typingTimeoutRef.current = null;
    }, 1000);

    setTasks(prev => prev.map(t => t.id === normalizedTask.id ? normalizedTask : t));
  };

  const handleAddMainTask = () => {
    pushToHistory(tasks);
    let max = 0;
    tasks.forEach(t => {
      if (t.wbs && !t.wbs.includes('.')) {
        const num = parseInt(t.wbs, 10);
        if (!isNaN(num) && num > max) max = num;
      }
    });
    const newWbs = (max + 1).toString();
    const newTask = {
      id: createTaskId(),
      wbs: newWbs,
      name: t('app.newMainGroup'),
      isGroup: true,
      manualStart: PROJECT_START,
      duration: 1,
      quantity: 0,
      actualQuantity: 0,
      unitPrice: 0,
      unit: '',
      dependsOn: null,
      depType: '',
      lag: 0
    };
    setTasks(prev => [...prev, newTask]);
  };

  const handleAddSubTask = (parentId) => {
    pushToHistory(tasks);
    const parentIndex = tasks.findIndex(t => t.id === parentId);
    if (parentIndex === -1) return;
    const parent = tasks[parentIndex];
    
    const prefix = parent.wbs + '.';
    let maxSuffix = 0;
    let insertIndex = parentIndex;

    tasks.forEach((t, idx) => {
      if (t.wbs && t.wbs.startsWith(prefix)) {
        const parts = t.wbs.split('.');
        const lastPart = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(lastPart) && lastPart > maxSuffix) maxSuffix = lastPart;
        if (idx > insertIndex) insertIndex = idx;
      }
    });

    const newWbs = `${parent.wbs}.${maxSuffix + 1}`;
    const newTask = {
      id: createTaskId(),
      wbs: newWbs,
      name: t('app.newSubTask'),
      isGroup: false,
      manualStart: PROJECT_START,
      duration: 1,
      quantity: 0,
      actualQuantity: 0,
      unitPrice: 0,
      unit: '',
      dependsOn: null,
      depType: '',
      lag: 0
    };

    setTasks(prev => {
      const copy = [...prev];
      copy.splice(insertIndex + 1, 0, newTask);
      return copy;
    });
  };

  const handleDeleteTask = (taskId) => {
    setTaskToDelete(taskId);
  };

  const confirmDeleteTask = () => {
    if (taskToDelete) {
      pushToHistory(tasks);
      setTasks(prev => {
        const idsToDelete = getTaskAndDescendantIds(prev, taskToDelete);
        return prev
          .filter(task => !idsToDelete.has(task.id))
          .map(task => idsToDelete.has(task.dependsOn)
            ? { ...task, dependsOn: null, depType: '', lag: 0 }
            : task
          );
      });
      setTaskToDelete(null);
    }
  };

  const cancelDeleteTask = () => {
    setTaskToDelete(null);
  };

  const handleJumpToTaskFolder = (task) => {
    setTargetFileFolder(task);
    goToTab('files');
  };

  const handleJumpToTaskDetails = (task) => {
    setTargetTaskDetails(task);
    goToTab('taskDetails');
  };

  // Index after which a new BOQ child should be inserted
  // (right after the parent's last contiguous descendant).
  const findBoqInsertIndex = (list, parent) => {
    const prefix = (parent.wbs || '') + '.';
    let idx = list.findIndex(t => t.id === parent.id);
    if (idx === -1) return list.length - 1;
    for (let i = idx + 1; i < list.length; i++) {
      if (list[i].wbs && list[i].wbs.startsWith(prefix)) {
        idx = i;
      } else {
        break;
      }
    }
    return idx;
  };

  const nextBoqWbs = (list, parent) => {
    const prefix = (parent.wbs || '') + '.';
    let maxSuffix = 0;
    list.forEach(t => {
      if (t.wbs && t.wbs.startsWith(prefix)) {
        const parts = t.wbs.split('.');
        const last = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(last) && last > maxSuffix) maxSuffix = last;
      }
    });
    return `${parent.wbs}.${maxSuffix + 1}`;
  };

  // Toggle a quantity-type column's link to a BOQ sub-task leaf.
  // checked = true  -> create a child leaf (if missing) and link it
  // checked = false -> unlink (keep the leaf, retain last sum as manual qty)
  const handleToggleBoqLink = (parentTaskId, column, checked) => {
    pushToHistory(tasks);
    setTasks(prev => {
      const parent = prev.find(t => t.id === parentTaskId);
      if (!parent) return prev;

      if (checked) {
        const existing = (parent.elementColumns || []).find(c => c.id === column.id);
        if (existing?.linkedTaskId) return prev; // already linked

        const newLeaf = {
          id: createTaskId(),
          wbs: nextBoqWbs(prev, parent),
          name: column.name || t('app.newBoqItem'),
          isGroup: false,
          manualStart: parent.manualStart || PROJECT_START,
          duration: 1,
          quantity: 0,
          actualQuantity: 0,
          unitPrice: 0,
          unit: column.unit || '',
          dependsOn: null,
          depType: '',
          lag: 0,
          boqLink: { parentId: parent.id, colId: column.id, mode: 'created' },
        };

        const insertAt = findBoqInsertIndex(prev, parent);
        const withLink = prev.map(t => t.id !== parentTaskId ? t : {
          ...t,
          elementColumns: (t.elementColumns || []).map(c =>
            c.id === column.id ? { ...c, linkedTaskId: newLeaf.id } : c
          ),
        });
        const result = [...withLink];
        result.splice(insertAt + 1, 0, newLeaf);
        return result;
      }

      // unchecked: unlink, keep leaf (remove boqLink marker, retain last sum)
      const linkedTaskId = column.linkedTaskId;
      const sum = (parent.elements || []).reduce((acc, el) => {
        const v = Number(el?.values?.[column.id]);
        return acc + (Number.isFinite(v) ? v : 0);
      }, 0);

      return prev.map(t => {
        if (t.id === parentTaskId) {
          return {
            ...t,
            elementColumns: (t.elementColumns || []).map(c =>
              c.id === column.id ? { ...c, linkedTaskId: null } : c
            ),
          };
        }
        if (linkedTaskId && t.id === linkedTaskId) {
          const cleaned = { ...t };
          delete cleaned.boqLink;
          delete cleaned.boqLinked;
          return { ...cleaned, quantity: sum };
        }
        return t;
      });
    });
  };

  // Link an element column to an EXISTING leaf (post-planning scenario where
  // the BOQ and quantities already exist). The leaf's pre-populated contract
  // quantity stays authoritative; the element-column sum is exposed only for
  // reconciliation (mode 'existing' prevents the engine from overwriting it).
  const handleLinkExistingBoq = (parentTaskId, column, leafTaskId) => {
    if (!leafTaskId) return;
    pushToHistory(tasks);
    setTasks(prev => {
      const leaf = prev.find(t => t.id === leafTaskId);
      if (!leaf) return prev;
      return prev.map(t => {
        if (t.id === leafTaskId) {
          return { ...t, boqLink: { parentId: parentTaskId, colId: column.id, mode: 'existing' } };
        }
        if (t.id === parentTaskId) {
          return {
            ...t,
            elementColumns: (t.elementColumns || []).map(c =>
              c.id === column.id ? { ...c, linkedTaskId: leafTaskId } : c
            ),
          };
        }
        return t;
      });
    });
  };

  // Sign off the planning baseline: freeze BOQ-linked contract quantities
  // (write the live element-sum into raw), snapshot a baseline, and lock
  // contract fields. Re-running it re-baselines (updates the snapshot).
  const handleSignOff = (signedBy) => {
    pushToHistory(tasks);
    const computedById = new Map(engineResult.tasks.map(t => [t.id, t]));
    const frozenTasks = tasks.map(t => {
      const c = computedById.get(t.id);
      if (c && c.boqLinked && typeof c.qty === 'number') {
        return { ...t, quantity: c.qty };
      }
      return t;
    });
    const baselineTasks = {};
    frozenTasks.forEach(t => {
      baselineTasks[t.id] = {
        quantity: t.quantity,
        unitPrice: t.unitPrice,
        unit: t.unit,
        duration: t.duration,
        manualStart: t.manualStart,
        name: t.name,
        wbs: t.wbs,
      };
    });
    setTasks(frozenTasks);
    setProjectMeta(prev => ({
      ...prev,
      status: prev.status === 'draft' ? 'signed' : prev.status,
      baseline: {
        signedAt: new Date().toISOString(),
        signedBy: signedBy || (prev.baseline && prev.baseline.signedBy) || '',
        tasks: baselineTasks,
      },
    }));
    logAppEvent({
      actor: signedBy || identity.name,
      kind: 'lifecycle',
      summary: `${t('app.modal.signOffLog')} (${frozenTasks.filter(task => task.isGroup === false).length} ${t('app.modal.signOffLogCount')})`,
      refType: 'baseline',
      refId: 'latest',
    });
  };

  const handleSetStatus = (status) => {
    setProjectMeta(prev => {
      logAppEvent({
        actor: identity.name,
        kind: 'lifecycle',
        summary: `${t('app.vo.statusChanged')} «${STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status}»`,
        refType: 'project',
        refId: 'status',
      });
      return { ...prev, status };
    });
  };

  // Raise a Variation Order: change a locked contract field (quantity/unitPrice)
  // and log it with reason + approver + FIDIC-style metadata.
  const handleRaiseVariation = () => {
    const { taskId, field, newValue, reason, approver, urgency, classification, estCostImpact, estScheduleDays, clauseRef } = voDraft;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !field) return;
    const oldValue = task[field];
    pushToHistory(tasks);
    const parsedNew = newValue === '' ? '' : Number(newValue);
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, [field]: parsedNew } : t)));
    // Cost impact fallback: derive from the quantity delta at contract price.
    const derivedCostImpact = (estCostImpact === '' && field === 'quantity' && Number.isFinite(Number(newValue)))
      ? Math.max(0, Number(newValue) - Number(oldValue)) * (Number(task.unitPrice) || 0)
      : null;
    const vo = {
      id: createTaskId(),
      date: new Date().toISOString(),
      taskId,
      taskWbs: task.wbs,
      taskName: task.name,
      type: field === 'unitPrice' ? 'price' : 'qty',
      field,
      oldValue,
      newValue: parsedNew,
      reason: reason || '',
      approver: approver || '',
      urgency: urgency || 'medium',
      classification: classification || (field === 'unitPrice' ? 'price' : 'qty'),
      estCostImpact: estCostImpact === '' ? derivedCostImpact : Number(estCostImpact),
      estScheduleDays: estScheduleDays === '' ? null : Number(estScheduleDays),
      clauseRef: clauseRef || '',
      status: 'issued',
    };
    setProjectMeta(prev => ({ ...prev, variations: [...(prev.variations || []), vo] }));
    setVoDraft({ taskId: '', field: 'quantity', newValue: '', reason: '', approver: '', urgency: 'medium', classification: '', estCostImpact: '', estScheduleDays: '', clauseRef: 'FIDIC 13.x' });
  };

  const formatCurrency = (val) => compactCurrency(val, lang);

  const voClassLabel = (c) => (VO_CLASS_KEYS[c] ? t(VO_CLASS_KEYS[c]) : c);

  const identityInitials = (() => {
    const name = (identity?.name || '').trim();
    if (!name) return '؟';
    return name.split(/\s+/).slice(0, 2).map(w => w[0]).join('');
  })();

  // Template generator callback: append the generated task tree to the
  // project, re-numbering its WBS past the current top-level sections.
  const handleGenerateFromTemplate = (generated, meta) => {
    if (!Array.isArray(generated) || generated.length === 0) return;
    pushToHistory(tasks);

    let maxMain = 0;
    tasks.forEach(t => {
      if (t.wbs && !t.wbs.includes('.')) {
        const num = parseInt(t.wbs, 10);
        if (!isNaN(num) && num > maxMain) maxMain = num;
      }
    });

    const remapped = generated.map(t => {
      const parts = String(t.wbs || '').split('.');
      const first = parseInt(parts[0], 10);
      if (!isNaN(first)) parts[0] = String(first + maxMain);
      return { ...t, wbs: parts.join('.') };
    });

    setTasks(prev => [...prev, ...remapped]);
    logAppEvent({
      actor: identity.name,
      kind: 'template',
      summary: `${t('app.template.generatedLog')} «${meta?.templateName || ''}» — ${remapped.length} ${t('app.template.itemsLog')}`,
      refType: 'template',
      refId: meta?.templateId || '',
    });
    goToTab('gantt');
  };

  const deletePreview = useMemo(() => {
    if (!taskToDelete) return null;
    const idsToDelete = getTaskAndDescendantIds(tasks, taskToDelete);
    const dependencyCount = tasks.filter(task => idsToDelete.has(task.dependsOn)).length;
    return {
      task: tasks.find(task => task.id === taskToDelete),
      count: idsToDelete.size,
      dependencyCount,
    };
  }, [taskToDelete, tasks]);

  // Trigger a JSON download of all app data (tasks, baseline, finance, …).
  const handleExport = () => {
    const filename = exportAppData();
    // brief visual hint via the warnings-free path
    console.log('Backup exported:', filename);
  };

  // User clicked import → open the file picker.
  const handleImportClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  // File chosen → read + validate, then show a confirmation modal before applying.
  const handleImportFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    // reset so selecting the same file again re-fires onChange
    if (event.target) event.target.value = '';
    if (!file) return;
    try {
      const parsed = await readBackupFile(file);
      const result = validateBackup(parsed);
      if (!result.ok) {
        alert(result.reason);
        return;
      }
      pendingRestoreRef.current = parsed;
      setRestoreInfo(result.stats);
      setRestoreOpen(true);
    } catch (err) {
        alert(err.message || t('app.modal.readFail'));
    }
  };

  // Confirmed → write to localStorage and reload so all components re-init.
  const handleConfirmRestore = () => {
    try {
      const parsed = pendingRestoreRef.current;
      if (!parsed) return;
      restoreAppData(parsed);
      window.location.reload();
    } catch (err) {
        alert(err.message || t('app.modal.restoreFail'));
      setRestoreOpen(false);
    }
  };

  const totalDays = engineResult.projectDuration;

  return (
    <div className="app-root" dir={dir}>
      {/* ── SIDEBAR (Right side due to RTL) ── */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">ProjectManager</div>
        <nav className="sidebar-nav">
          <a href="#" className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('dashboard'); }}>{t('app.nav.dashboard')}</a>
          <a href="#" className={`nav-item ${activeTab === 'gantt' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('gantt'); }}>{t('app.nav.gantt')}</a>
          <a href="#" className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('orders'); }}>{t('app.nav.orders')}</a>
          <a href="#" className={`nav-item ${activeTab === 'planning' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('planning'); }}>{t('app.nav.planning')}</a>
          <a href="#" className={`nav-item ${activeTab === 'files' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('files'); }}>{t('app.nav.files')}</a>
          <a href="#" className={`nav-item ${activeTab === 'calc' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('calc'); }}>{t('app.nav.calc')}</a>
          <a href="#" className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('reports'); }}>{t('app.nav.reports')}</a>
          <a href="#" className={`nav-item ${activeTab === 'monthly' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('monthly'); }}>{t('app.nav.monthly')}</a>
          <a href="#" className={`nav-item ${activeTab === 'activity' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('activity'); }}>{t('app.nav.activity')}</a>
          <a href="#" className={`nav-item ${activeTab === 'snapshots' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('snapshots'); }}>{t('app.nav.snapshots')}</a>
          <a href="#" className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('finance'); }}>{t('app.nav.finance')}</a>
          <a href="#" className={`nav-item ${activeTab === 'registries' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('registries'); }}>{t('app.nav.registries')}</a>
          <a href="#" className={`nav-item ${activeTab === 'templates' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); goToTab('templates'); }}>{t('app.nav.templates')}</a>
        </nav>
      </aside>

      {/* ── MAIN WORKSPACE ── */}
      <div className="app-workspace">
        
        {/* Top Header Bar */}
        <header className="workspace-topbar">
          <div className="breadcrumbs">مشروع استصلاح اراضي واسط / عقد 5 لسنة 2023 / غرب الغراف / ايسر MC7</div>
          <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <LanguageSwitcher />
            <div
              className="user-profile"
              style={{ cursor: 'pointer' }}
              onClick={() => setIdentityOpen(true)}
              title={identity?.name ? `${identity.name}${identity.role ? ' — ' + identity.role : ''} ${t('app.identity.current')}` : t('app.identity.setUser')}
            >
              {identityInitials}
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="workspace-content" style={{ display: 'flex', flexDirection: 'column' }}>
          
          {activeTab === 'dashboard' ? (
            <Dashboard tasks={engineResult.tasks} summary={engineResult} />
          ) : activeTab === 'orders' ? (
            <OrdersScreen tasks={tasks} identity={identity} />
          ) : activeTab === 'planning' ? (
            <PlanningScreen tasks={tasks} computedTasks={engineResult.tasks} orders={orders} registries={registries} />
          ) : activeTab === 'activity' ? (
            <ActivityScreen orders={orders} variations={projectMeta.variations || []} appEvents={appEvents} tasks={tasks} registries={registries} />
          ) : activeTab === 'snapshots' ? (
            <SnapshotsScreen tasks={tasks} projectMeta={projectMeta} identity={identity} onRestored={() => window.location.reload()} />
          ) : activeTab === 'monthly' ? (
            <MonthlyReport summary={engineResult} computedTasks={engineResult.tasks} orders={orders} variations={projectMeta.variations || []} projectMeta={projectMeta} registries={registries} />
          ) : activeTab === 'registries' ? (
            <RegistriesScreen onChange={setRegistries} />
          ) : activeTab === 'templates' ? (
            <TemplatesScreen onGenerate={handleGenerateFromTemplate} tasks={tasks} />
          ) : activeTab === 'taskDetails' ? (
            <TaskDetails
              task={tasks.find(t => t.id === targetTaskDetails?.id) || targetTaskDetails}
              allTasks={tasks}
              computedTasks={engineResult.tasks}
              isSigned={!!projectMeta.baseline}
              orders={orders}
              registries={registries}
              identity={identity}
              onUpdateTask={handleUpdateTask}
              onToggleBoqLink={handleToggleBoqLink}
              onLinkExistingBoq={handleLinkExistingBoq}
              onAddSubTask={handleAddSubTask}
              onDeleteTask={handleDeleteTask}
              onJumpToTaskDetails={handleJumpToTaskDetails}
              onBack={() => goToTab('gantt')}
            />
          ) : activeTab === 'files' ? (
            <FileManager tasks={engineResult.tasks} targetTask={targetFileFolder} />
          ) : activeTab === 'calc' ? (
            <CalculatorView />
          ) : activeTab === 'reports' ? (
            <DailyReports tasks={tasks} orders={orders} registries={registries} identity={identity} />
          ) : activeTab === 'finance' ? (
            <FinanceManager />
          ) : activeTab === 'gantt' ? (
            <>
              {/* Compact KPI Strip */}
              <div className="compact-kpi-strip">
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">{t('app.kpi.totalCost')}</span>
                  <span className="kpi-compact-value">{formatCurrency(engineResult.projectTotalCost)}</span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">{t('app.kpi.progress')}</span>
                  <span className="kpi-compact-value">{engineResult.projectTotalProgress.toFixed(2)}%</span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">{t('app.kpi.planned')}</span>
                  <span className="kpi-compact-value">{engineResult.projectPlannedProgress.toFixed(2)}%</span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">{t('app.kpi.deviation')}</span>
                  <span className={`kpi-compact-value ${engineResult.projectDeviation < 0 ? 'negative-deviation' : 'positive-deviation'}`} style={{ color: engineResult.projectDeviation < 0 ? 'var(--apple-red)' : 'var(--apple-green)' }}>
                    {engineResult.projectDeviation > 0 ? '+' : ''}{engineResult.projectDeviation.toFixed(2)}%
                  </span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">{t('app.kpi.duration')}</span>
                  <span className="kpi-compact-value">{totalDays} {t('app.kpi.days')}</span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">{t('app.kpi.activeItems')}</span>
                  <span className="kpi-compact-value">{engineResult.tasks.filter(t => !t.isGroup).length}</span>
                </div>
                <div className={`kpi-compact-card ${engineResult.warnings.length ? 'warning' : ''}`}>
                  <span className="kpi-compact-label">{t('app.kpi.warnings')}</span>
                  <span className="kpi-compact-value">{engineResult.warnings.length}</span>
                </div>
              </div>

              {/* Workspace Toolbar */}
              <div className="workspace-toolbar" style={{ gap: '12px' }}>
                {/* Project lifecycle control */}
                <div className="project-lifecycle-control">
                  {projectMeta.status === 'draft' ? (
                    <button className="apple-btn primary" onClick={() => { setSignOffBy(''); setSignOffOpen(true); }}>
                      {t('app.toolbar.signOff')}
                    </button>
                  ) : (
                    <>
                      <span className={`project-status-badge status-${projectMeta.status}`}>
                        {STATUS_KEYS[projectMeta.status] ? t(STATUS_KEYS[projectMeta.status]) : projectMeta.status}
                      </span>
                      {projectMeta.status === 'signed' && (
                        <button className="apple-btn secondary" onClick={() => handleSetStatus('executing')}>
                          {t('app.toolbar.startExecution')}
                        </button>
                      )}
                      {projectMeta.status === 'executing' && (
                        <button className="apple-btn secondary" onClick={() => handleSetStatus('completed')}>
                          {t('app.toolbar.complete')}
                        </button>
                      )}
                      <button className="apple-btn secondary" onClick={() => { setSignOffBy(projectMeta.baseline?.signedBy || ''); setSignOffOpen(true); }} title={t('app.toolbar.reBaselineTitle')}>
                        {t('app.toolbar.reBaseline')}
                      </button>
                      <button className="apple-btn secondary" onClick={() => setVoOpen(true)} title={t('app.toolbar.voTitle')}>
                        {t('app.toolbar.voButton')} ({(projectMeta.variations || []).length})
                      </button>
                    </>
                  )}
                </div>
                <div className="view-mode-toggle" style={{ display: 'flex', background: 'var(--bg-surface)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-soft)', marginRight: 'auto' }}>
                  <button 
                    className={`toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
                    onClick={() => setViewMode('week')}
                    style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'week' ? 'var(--apple-blue-action)' : 'transparent', color: viewMode === 'week' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
                  >
                    {t('app.toolbar.weeks')}
                  </button>
                  <button 
                    className={`toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
                    onClick={() => setViewMode('month')}
                    style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'month' ? 'var(--apple-blue-action)' : 'transparent', color: viewMode === 'month' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
                  >
                    {t('app.toolbar.months')}
                  </button>
                </div>

                {isEditMode && canUndo && (
                  <button className="apple-btn secondary" onClick={undo} title={t('app.toolbar.undoTitle')}>
                    {t('app.toolbar.undo')}
                  </button>
                )}
                <button
                  className="apple-btn secondary"
                  onClick={handleExport}
                  title={t('app.toolbar.backupTitle')}
                >
                  {t('app.toolbar.backup')}
                </button>
                <button
                  className="apple-btn secondary"
                  onClick={handleImportClick}
                  title={t('app.toolbar.restoreTitle')}
                >
                  {t('app.toolbar.restore')}
                </button>
                <button
                  className={`apple-btn ${isEditMode ? 'primary' : 'secondary'}`}
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  {isEditMode ? t('app.toolbar.endEdit') : t('app.toolbar.editMode')}
                </button>
              </div>

              {/* Hidden file input for backup restore */}
              <input
                type="file"
                accept="application/json,.json"
                ref={fileInputRef}
                onChange={handleImportFile}
                style={{ display: 'none' }}
              />

              {/* Full Screen Gantt Chart */}
              <div className="gantt-full-wrapper">
                <GanttChart
                  tasks={engineResult.tasks}
                  onUpdateTask={handleUpdateTask}
                  projectStart={PROJECT_START}
                  isEditMode={isEditMode}
                  isSigned={!!projectMeta.baseline}
                  viewMode={viewMode}
                  onAddMainTask={handleAddMainTask}
                  onAddSubTask={handleAddSubTask}
                  onDeleteTask={handleDeleteTask}
                  onJumpToTaskFolder={handleJumpToTaskFolder}
                  onJumpToTaskDetails={handleJumpToTaskDetails}
                />
              </div>
            </>
          ) : null}
          
        </main>
      </div>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {taskToDelete && (
        <div className="modal-overlay" onClick={cancelDeleteTask}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">!</div>
            <h3 className="modal-title">{t('app.modal.deleteTitle')}</h3>
            <p className="modal-text">
              {t('app.modal.deleteConfirm')} {deletePreview?.task?.wbs || t('app.modal.deleteThis')}؟
              {deletePreview?.count > 1 && ` ${t('app.modal.deleteLinkedPrefix')} ${deletePreview.count} ${t('app.modal.deleteLinkedSuffix')}`}
              {deletePreview?.dependencyCount > 0 && ` ${t('app.modal.deleteDepsPrefix')} ${deletePreview.dependencyCount} ${t('app.modal.deleteDepsSuffix')}`}
            </p>
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={cancelDeleteTask}>{t('common.cancel')}</button>
              <button className="apple-btn destructive" onClick={confirmDeleteTask}>{t('app.modal.deleteAction')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIGN-OFF MODAL ── */}
      {signOffOpen && (
        <div className="modal-overlay" onClick={() => setSignOffOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🔒</div>
            <h3 className="modal-title">{t('app.modal.signOffTitle')}</h3>
            <p className="modal-text">
              {t('app.modal.signOffText')}
            </p>
            <input
              className="modal-input"
              placeholder={t('app.modal.signOffName')}
              value={signOffBy}
              onChange={e => setSignOffBy(e.target.value)}
            />
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setSignOffOpen(false)}>{t('common.cancel')}</button>
              <button className="apple-btn primary" onClick={() => { handleSignOff(signOffBy); setSignOffOpen(false); }}>
                {t('app.modal.signOffAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESTORE CONFIRMATION MODAL ── */}
      {restoreOpen && restoreInfo && (
        <div className="modal-overlay" onClick={() => setRestoreOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">⬆</div>
            <h3 className="modal-title">{t('app.modal.restoreTitle')}</h3>
            <p className="modal-text">
              {t('app.modal.restoreText', { keys: restoreInfo.keys, kb: (restoreInfo.bytes / 1024).toFixed(0) })}
            </p>
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setRestoreOpen(false)}>{t('common.cancel')}</button>
              <button className="apple-btn primary" onClick={handleConfirmRestore}>{t('app.modal.restoreAction')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── VARIATION ORDERS PANEL ── */}
      {voOpen && (
        <div className="modal-overlay" onClick={() => setVoOpen(false)}>
          <div className="modal-content vo-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">📝</div>
            <h3 className="modal-title">{t('app.vo.title')}</h3>
            <p className="modal-text">{t('app.vo.text')}</p>
            <div className="vo-form">
              <select
                className="modal-input"
                value={voDraft.taskId}
                onChange={e => {
                  const t = tasks.find(x => x.id === e.target.value);
                  setVoDraft({ ...voDraft, taskId: e.target.value, newValue: t ? String(t[voDraft.field] ?? '') : '' });
                }}
              >
                <option value="">{t('app.vo.pickTask')}</option>
                {tasks.filter(t => !t.isGroup).map(t => (
                  <option key={t.id} value={t.id}>{t.wbs} — {t.name}</option>
                ))}
              </select>
              <select
                className="modal-input"
                value={voDraft.field}
                onChange={e => {
                  const t = tasks.find(x => x.id === voDraft.taskId);
                  setVoDraft({ ...voDraft, field: e.target.value, newValue: t ? String(t[e.target.value] ?? '') : '' });
                }}
              >
                <option value="quantity">{t('app.vo.contractQty')}</option>
                <option value="unitPrice">{t('app.vo.unitPriceField')}</option>
              </select>
              <input className="modal-input" type="number" placeholder={t('app.vo.newValue')} value={voDraft.newValue} onChange={e => setVoDraft({ ...voDraft, newValue: e.target.value })} />
              <div className="vo-form-row" style={{ display: 'flex', gap: '8px' }}>
                <select className="modal-input" value={voDraft.urgency} onChange={e => setVoDraft({ ...voDraft, urgency: e.target.value })} title={t('app.vo.classification')}>
                  <option value="low">{t('app.vo.urgencyLow')}</option>
                  <option value="medium">{t('app.vo.urgencyMedium')}</option>
                  <option value="high">{t('app.vo.urgencyHigh')}</option>
                </select>
                <select className="modal-input" value={voDraft.classification} onChange={e => setVoDraft({ ...voDraft, classification: e.target.value })} title={t('app.vo.classification')}>
                  <option value="">{t('app.vo.classAuto')}</option>
                  <option value="qty">{t('app.vo.classQty')}</option>
                  <option value="price">{t('app.vo.classPrice')}</option>
                  <option value="scope">{t('app.vo.classScope')}</option>
                  <option value="add">{t('app.vo.classAdd')}</option>
                  <option value="remove">{t('app.vo.classRemove')}</option>
                </select>
              </div>
              <div className="vo-form-row" style={{ display: 'flex', gap: '8px' }}>
                <input className="modal-input" type="number" placeholder={t('app.vo.costImpact')} value={voDraft.estCostImpact} onChange={e => setVoDraft({ ...voDraft, estCostImpact: e.target.value })} title={t('app.vo.costImpactTitle')} />
                <input className="modal-input" type="number" placeholder={t('app.vo.scheduleImpact')} value={voDraft.estScheduleDays} onChange={e => setVoDraft({ ...voDraft, estScheduleDays: e.target.value })} />
              </div>
              <input className="modal-input" placeholder={t('app.vo.changeReason')} value={voDraft.reason} onChange={e => setVoDraft({ ...voDraft, reason: e.target.value })} />
              <div className="vo-form-row" style={{ display: 'flex', gap: '8px' }}>
                <input className="modal-input" placeholder={t('app.vo.approver')} value={voDraft.approver} onChange={e => setVoDraft({ ...voDraft, approver: e.target.value })} />
                <input className="modal-input" placeholder={t('app.vo.clauseRef')} value={voDraft.clauseRef} onChange={e => setVoDraft({ ...voDraft, clauseRef: e.target.value })} />
              </div>
              <button className="apple-btn primary" disabled={!voDraft.taskId} onClick={handleRaiseVariation}>{t('app.vo.record')}</button>
            </div>
            <div className="vo-list">
              {(projectMeta.variations || []).length === 0 ? (
                <p className="vo-empty">{t('app.vo.empty')}</p>
              ) : (
                [...(projectMeta.variations || [])].reverse().map(v => (
                  <div key={v.id} className="vo-item">
                    <div className="vo-item-head">
                      <strong>{v.taskWbs} {v.taskName}</strong>
                      <span className="vo-field">{v.field === 'unitPrice' ? t('app.vo.unitPriceField') : t('app.vo.qtyField')}</span>
                      {v.urgency === 'high' && <span className="vo-urgency high">{t('app.vo.urgencyHigh')}</span>}
                      </div>
                    <div className="vo-delta">{String(v.oldValue)} ← <strong>{String(v.newValue)}</strong></div>
                    {v.classification && <div className="vo-class">{voClassLabel(v.classification)}{v.clauseRef ? ` · ${v.clauseRef}` : ''}</div>}
                    {(v.estCostImpact > 0 || v.estScheduleDays != null) && (
                      <div className="vo-impact">
                        {v.estCostImpact > 0 && <span>{t('app.vo.impactCost')} {formatCurrency(v.estCostImpact)}</span>}
                        {v.estScheduleDays != null && v.estScheduleDays !== 0 && <span>{t('app.vo.impactSchedule')} {v.estScheduleDays > 0 ? '+' : ''}{v.estScheduleDays} {t('app.vo.impactDays')}</span>}
                      </div>
                    )}
                    {v.reason && <div className="vo-reason">{t('app.vo.reasonPrefix')} {v.reason}</div>}
                    <div className="vo-meta">{v.approver}{v.approver && ' · '}{new Date(v.date).toLocaleDateString('en-GB')}</div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setVoOpen(false)}>{t('common.close')}</button>
            </div>
          </div>
        </div>
      )}
      {/* ── IDENTITY PICKER (who is using the app) ── */}
      <IdentityPicker
        open={identityOpen}
        onClose={() => setIdentityOpen(false)}
        onSaved={(saved) => {
          setIdentity(saved);
          setAppEvents(loadAppEvents());
        }}
      />
    </div>
  );
}

export default App
