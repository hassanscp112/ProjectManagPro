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

const STORAGE_KEY = 'project-manager-gantt-tasks';
const META_KEY = 'project-manager-project-meta';
const PROJECT_START = '2025-08-02';

const DEFAULT_META = { status: 'draft', baseline: null, variations: [] };

const STATUS_LABELS = {
  draft: 'مسودة',
  signed: 'معتمد',
  executing: 'قيد التنفيذ',
  completed: 'مكتمل',
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
  const [voDraft, setVoDraft] = useState({ taskId: '', field: 'quantity', newValue: '', reason: '', approver: '' });

  const historyRef = useRef([]);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(META_KEY, JSON.stringify(projectMeta));
  }, [projectMeta]);

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
    return GanttEngine.calculate(tasks, PROJECT_START, projectMeta);
  }, [tasks, projectMeta]);

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
      name: 'مجموعة رئيسية جديدة',
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
      name: 'مهمة فرعية جديدة',
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
    setActiveTab('files');
  };

  const handleJumpToTaskDetails = (task) => {
    setTargetTaskDetails(task);
    setActiveTab('taskDetails');
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
          name: column.name || 'بند كميات',
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
  };

  const handleSetStatus = (status) => {
    setProjectMeta(prev => ({ ...prev, status }));
  };

  // Raise a Variation Order: change a locked contract field (quantity/unitPrice)
  // and log it with reason + approver.
  const handleRaiseVariation = () => {
    const { taskId, field, newValue, reason, approver } = voDraft;
    const task = tasks.find(t => t.id === taskId);
    if (!task || !field) return;
    const oldValue = task[field];
    pushToHistory(tasks);
    const parsedNew = newValue === '' ? '' : Number(newValue);
    setTasks(prev => prev.map(t => (t.id === taskId ? { ...t, [field]: parsedNew } : t)));
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
    };
    setProjectMeta(prev => ({ ...prev, variations: [...(prev.variations || []), vo] }));
    setVoDraft({ taskId: '', field: 'quantity', newValue: '', reason: '', approver: '' });
  };

  const formatCurrency = (val) => {
    if (val >= 1e9) return `${(val / 1e9).toFixed(2)} مليار د.ع`;
    if (val >= 1e6) return `${(val / 1e6).toFixed(1)} مليون د.ع`;
    return new Intl.NumberFormat('en-US').format(val) + ' د.ع';
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

  const totalDays = engineResult.projectDuration;

  return (
    <div className="app-root">
      {/* ── SIDEBAR (Right side due to RTL) ── */}
      <aside className="app-sidebar">
        <div className="sidebar-logo">ProjectManager</div>
        <nav className="sidebar-nav">
          <a href="#" className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('dashboard'); }}>لوحة القيادة</a>
          <a href="#" className={`nav-item ${activeTab === 'gantt' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('gantt'); }}>جدول تقدم العمل</a>
          <a href="#" className={`nav-item ${activeTab === 'files' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('files'); }}>الملفات</a>
          <a href="#" className={`nav-item ${activeTab === 'calc' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('calc'); }}>حاسبة الكميات</a>
          <a href="#" className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('reports'); }}>التقارير اليومية</a>
          <a href="#" className={`nav-item ${activeTab === 'finance' ? 'active' : ''}`} onClick={(e) => { e.preventDefault(); setActiveTab('finance'); }}>الحسابات والتكاليف</a>
          <a href="#" className="nav-item">الموارد البشرية</a>
          <a href="#" className="nav-item">المشتريات والمواد</a>
          <a href="#" className="nav-item">الإعدادات</a>
        </nav>
      </aside>

      {/* ── MAIN WORKSPACE ── */}
      <div className="app-workspace">
        
        {/* Top Header Bar */}
        <header className="workspace-topbar">
          <div className="breadcrumbs">مشروع استصلاح اراضي واسط / عقد 5 لسنة 2023 / غرب الغراف / ايسر MC7</div>
          <div className="user-profile">AH</div>
        </header>

        {/* Content Area */}
        <main className="workspace-content" style={{ display: 'flex', flexDirection: 'column' }}>
          
          {activeTab === 'dashboard' ? (
            <Dashboard tasks={engineResult.tasks} summary={engineResult} />
          ) : activeTab === 'taskDetails' ? (
            <TaskDetails
              task={tasks.find(t => t.id === targetTaskDetails?.id) || targetTaskDetails}
              allTasks={tasks}
              computedTasks={engineResult.tasks}
              isSigned={!!projectMeta.baseline}
              onUpdateTask={handleUpdateTask}
              onToggleBoqLink={handleToggleBoqLink}
              onLinkExistingBoq={handleLinkExistingBoq}
              onAddSubTask={handleAddSubTask}
              onDeleteTask={handleDeleteTask}
              onJumpToTaskDetails={handleJumpToTaskDetails}
              onBack={() => setActiveTab('gantt')}
            />
          ) : activeTab === 'files' ? (
            <FileManager tasks={engineResult.tasks} targetTask={targetFileFolder} />
          ) : activeTab === 'calc' ? (
            <CalculatorView />
          ) : activeTab === 'reports' ? (
            <DailyReports tasks={engineResult.tasks} />
          ) : activeTab === 'finance' ? (
            <FinanceManager />
          ) : activeTab === 'gantt' ? (
            <>
              {/* Compact KPI Strip */}
              <div className="compact-kpi-strip">
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">الكلفة الكلية</span>
                  <span className="kpi-compact-value">{formatCurrency(engineResult.projectTotalCost)}</span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">نسبة الانجاز</span>
                  <span className="kpi-compact-value">{engineResult.projectTotalProgress.toFixed(2)}%</span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">الانجاز المخطط</span>
                  <span className="kpi-compact-value">{engineResult.projectPlannedProgress.toFixed(2)}%</span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">نسبة الانحراف</span>
                  <span className={`kpi-compact-value ${engineResult.projectDeviation < 0 ? 'negative-deviation' : 'positive-deviation'}`} style={{ color: engineResult.projectDeviation < 0 ? 'var(--apple-red)' : 'var(--apple-green)' }}>
                    {engineResult.projectDeviation > 0 ? '+' : ''}{engineResult.projectDeviation.toFixed(2)}%
                  </span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">مدة المشروع</span>
                  <span className="kpi-compact-value">{totalDays} يوم</span>
                </div>
                <div className="kpi-compact-card">
                  <span className="kpi-compact-label">الفقرات الفعالة</span>
                  <span className="kpi-compact-value">{engineResult.tasks.filter(t => !t.isGroup).length}</span>
                </div>
                <div className={`kpi-compact-card ${engineResult.warnings.length ? 'warning' : ''}`}>
                  <span className="kpi-compact-label">التنبيهات</span>
                  <span className="kpi-compact-value">{engineResult.warnings.length}</span>
                </div>
              </div>

              {/* Workspace Toolbar */}
              <div className="workspace-toolbar" style={{ gap: '12px' }}>
                {/* Project lifecycle control */}
                <div className="project-lifecycle-control">
                  {projectMeta.status === 'draft' ? (
                    <button className="apple-btn primary" onClick={() => { setSignOffBy(''); setSignOffOpen(true); }}>
                      🔒 توقيع واعتماد المشروع
                    </button>
                  ) : (
                    <>
                      <span className={`project-status-badge status-${projectMeta.status}`}>
                        {STATUS_LABELS[projectMeta.status] || projectMeta.status}
                      </span>
                      {projectMeta.status === 'signed' && (
                        <button className="apple-btn secondary" onClick={() => handleSetStatus('executing')}>
                          ▶ بدء التنفيذ
                        </button>
                      )}
                      {projectMeta.status === 'executing' && (
                        <button className="apple-btn secondary" onClick={() => handleSetStatus('completed')}>
                          ✓ إكمال المشروع
                        </button>
                      )}
                      <button className="apple-btn secondary" onClick={() => { setSignOffBy(projectMeta.baseline?.signedBy || ''); setSignOffOpen(true); }} title="إعادة أخذ الخط الأساس">
                        ↻ إعادة الاعتماد
                      </button>
                      <button className="apple-btn secondary" onClick={() => setVoOpen(true)} title="أوامر التغيير">
                        📝 أوامر التغيير ({(projectMeta.variations || []).length})
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
                    أسابيع
                  </button>
                  <button 
                    className={`toggle-btn ${viewMode === 'month' ? 'active' : ''}`}
                    onClick={() => setViewMode('month')}
                    style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: viewMode === 'month' ? 'var(--apple-blue-action)' : 'transparent', color: viewMode === 'month' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.2s' }}
                  >
                    أشهر
                  </button>
                </div>

                {isEditMode && canUndo && (
                  <button className="apple-btn secondary" onClick={undo} title="تراجع عن التغيير الأخير">
                    ↩ تراجع
                  </button>
                )}
                <button 
                  className={`apple-btn ${isEditMode ? 'primary' : 'secondary'}`} 
                  onClick={() => setIsEditMode(!isEditMode)}
                >
                  {isEditMode ? 'إنهاء التعديل' : 'وضع التعديل'}
                </button>
              </div>

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
            <h3 className="modal-title">تأكيد الحذف</h3>
            <p className="modal-text">
              هل أنت متأكد من حذف {deletePreview?.task?.wbs || 'هذه الفقرة'}؟
              {deletePreview?.count > 1 && ` سيتم حذف ${deletePreview.count} فقرات مرتبطة بها.`}
              {deletePreview?.dependencyCount > 0 && ` وسيتم إلغاء ${deletePreview.dependencyCount} علاقات تعتمد عليها.`}
            </p>
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={cancelDeleteTask}>إلغاء</button>
              <button className="apple-btn destructive" onClick={confirmDeleteTask}>حذف الفقرة</button>
            </div>
          </div>
        </div>
      )}

      {/* ── SIGN-OFF MODAL ── */}
      {signOffOpen && (
        <div className="modal-overlay" onClick={() => setSignOffOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">🔒</div>
            <h3 className="modal-title">توقيع واعتماد المشروع</h3>
            <p className="modal-text">
              سيتم تجميد الكميات التعاقدية والأسعار كخط أساس (Baseline). بعد الاعتماد، أي تعديل على الكميات التعاقدية أو النطاق يتطلب أمر تغيير (Variation Order)، بينما تبقى الكميات المنفذة قابلة للتحديث.
            </p>
            <input
              className="modal-input"
              placeholder="اسم المعتمد / التوقيع"
              value={signOffBy}
              onChange={e => setSignOffBy(e.target.value)}
            />
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setSignOffOpen(false)}>إلغاء</button>
              <button className="apple-btn primary" onClick={() => { handleSignOff(signOffBy); setSignOffOpen(false); }}>
                اعتماد وتوقيع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VARIATION ORDERS PANEL ── */}
      {voOpen && (
        <div className="modal-overlay" onClick={() => setVoOpen(false)}>
          <div className="modal-content vo-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-icon">📝</div>
            <h3 className="modal-title">أوامر التغيير (Variation Orders)</h3>
            <p className="modal-text">عدّل الكميات التعاقدية أو الأسعار المعتمدة. يُسجَّل كل تغيير مع سببه ومعتمده ويظهر الانحراف عن الخط الأساس.</p>
            <div className="vo-form">
              <select
                className="modal-input"
                value={voDraft.taskId}
                onChange={e => {
                  const t = tasks.find(x => x.id === e.target.value);
                  setVoDraft({ ...voDraft, taskId: e.target.value, newValue: t ? String(t[voDraft.field] ?? '') : '' });
                }}
              >
                <option value="">— اختر البند —</option>
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
                <option value="quantity">الكمية التعاقدية</option>
                <option value="unitPrice">سعر الوحدة</option>
              </select>
              <input className="modal-input" type="number" placeholder="القيمة الجديدة" value={voDraft.newValue} onChange={e => setVoDraft({ ...voDraft, newValue: e.target.value })} />
              <input className="modal-input" placeholder="سبب التغيير" value={voDraft.reason} onChange={e => setVoDraft({ ...voDraft, reason: e.target.value })} />
              <input className="modal-input" placeholder="المعتمد" value={voDraft.approver} onChange={e => setVoDraft({ ...voDraft, approver: e.target.value })} />
              <button className="apple-btn primary" disabled={!voDraft.taskId} onClick={handleRaiseVariation}>تسجيل أمر التغيير</button>
            </div>
            <div className="vo-list">
              {(projectMeta.variations || []).length === 0 ? (
                <p className="vo-empty">لا توجد أوامر تغيير بعد.</p>
              ) : (
                [...(projectMeta.variations || [])].reverse().map(v => (
                  <div key={v.id} className="vo-item">
                    <div className="vo-item-head">
                      <strong>{v.taskWbs} {v.taskName}</strong>
                      <span className="vo-field">{v.field === 'unitPrice' ? 'سعر الوحدة' : 'الكمية'}</span>
                    </div>
                    <div className="vo-delta">{String(v.oldValue)} ← <strong>{String(v.newValue)}</strong></div>
                    {v.reason && <div className="vo-reason">السبب: {v.reason}</div>}
                    <div className="vo-meta">{v.approver}{v.approver && ' · '}{new Date(v.date).toLocaleDateString('en-GB')}</div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setVoOpen(false)}>إغلاق</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App
