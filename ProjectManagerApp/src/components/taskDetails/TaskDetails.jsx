import { useMemo, useState } from 'react';
import { useI18n } from '../../i18n/useI18n.js';
import { compactCurrency, formatCurrency, formatNumber } from '../../i18n/index.js';
import { resolveWho } from '../../utils/Registries';
import { ORDER_TYPES } from '../../utils/OrderEngine';
import './TaskDetails.css';

// Element statuses — values are stable codes; labels resolve via i18n.
const STATUS_OPTIONS = [
  { value: 'not_started', color: '#6B7280' },
  { value: 'in_progress', color: '#0284C7' },
  { value: 'completed', color: '#16A34A' },
  { value: 'on_hold', color: '#EA580C' },
];

const STATUS_MAP = STATUS_OPTIONS.reduce((acc, s) => { acc[s.value] = s; return acc; }, {});

// Read-mode sort: in-progress first, then on-hold, then not-started, completed last.
const STATUS_SORT = { in_progress: 0, on_hold: 1, not_started: 2, completed: 3 };

const DAY_MS = 24 * 60 * 60 * 1000;

const uid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `id_${Date.now()}_${Math.random().toString(36).slice(2)}`;

const toNum = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const fmt = (n) => {
  if (n === null || n === undefined || n === '' || Number(n) === 0) return '—';
  return formatNumber(n);
};

const clamp01 = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(1, n);
};

const fmtPct = (v) => `${Math.round(clamp01(v) * 100)}%`;

const orderMeta = (type, fallbackLabel) => ORDER_TYPES[type] || { label: type || fallbackLabel, icon: '•' };

/* ---------- tiny read-mode presentational helpers ---------- */

const Bar = ({ value, slim, empty }) => {
  const v = clamp01(value);
  if (empty) return <div className={`td-bar${slim ? ' slim' : ''} empty`} />;
  return (
    <div
      className={`td-bar${slim ? ' slim' : ''}`}
      role="progressbar"
      aria-valuenow={Math.round(v * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`td-bar-fill${v >= 1 ? ' done' : ''}`} style={{ width: `${v * 100}%` }} />
    </div>
  );
};

const StatusChip = ({ status, label }) => {
  const st = STATUS_MAP[status] || STATUS_MAP.not_started;
  return (
    <span className="td-chip" style={{ color: st.color }}>
      <span className="td-chip-dot" />
      {label}
    </span>
  );
};

const OrderStatusBadge = ({ status, label }) => (
  <span className={`td-ostatus ${status === 'approved' ? 'approved' : 'recorded'}`}>
    {label}
  </span>
);

const TaskDetails = ({
  // existing (required) contract — unchanged
  task,
  allTasks,
  computedTasks,
  isSigned,
  onUpdateTask,
  onToggleBoqLink,
  onLinkExistingBoq,
  onAddSubTask,
  onDeleteTask,
  onJumpToTaskDetails,
  onBack,
  // new optional props — fully guarded, App wiring works without them
  orders,
  registries,
  identity,
}) => {
  const { t, lang, isRTL, dir } = useI18n();

  const [mode, setMode] = useState('read');
  const [showCompleted, setShowCompleted] = useState(false);

  // Locale-aware currency (same compaction as the app-wide helper).
  const fmtMoney = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v) || v === 0) return '—';
    return compactCurrency(v, lang);
  };

  const statusLabel = (value) => t(`taskDetails.status.${value}`);

  // Simple singular/plural counter label: countLabel(3, '…One', '…Many').
  const countLabel = (n, oneKey, manyKey) => t(n === 1 ? oneKey : manyKey, { n });

  const columns = useMemo(
    () => (Array.isArray(task?.elementColumns) ? task.elementColumns : []),
    [task]
  );
  const elements = useMemo(
    () => (Array.isArray(task?.elements) ? task.elements : []),
    [task]
  );

  // Per-column sums across all elements
  const sums = useMemo(() => {
    const map = {};
    columns.forEach((c) => { map[c.id] = 0; });
    elements.forEach((el) => {
      columns.forEach((c) => {
        map[c.id] += toNum(el?.values?.[c.id]);
      });
    });
    return map;
  }, [columns, elements]);

  const statusCounts = useMemo(() => {
    const counts = { not_started: 0, in_progress: 0, completed: 0, on_hold: 0 };
    elements.forEach((el) => {
      if (counts[el.status] !== undefined) counts[el.status] += 1;
    });
    return counts;
  }, [elements]);

  const linkedCount = useMemo(
    () => columns.filter((c) => !!c.linkedTaskId).length,
    [columns]
  );

  const totalAllQuantities = useMemo(
    () => columns.reduce((acc, c) => acc + (sums[c.id] || 0), 0),
    [columns, sums]
  );

  const taskById = useMemo(() => new Map((allTasks || []).map((t) => [t.id, t])), [allTasks]);

  const computedById = useMemo(
    () => new Map((computedTasks || []).map((t) => [t.id, t])),
    [computedTasks]
  );

  // Direct WBS children of this task (bidirectional: includes BOQ leaves
  // created here AND sub-tasks added directly in the Gantt grid).
  const directChildren = useMemo(() => {
    if (!task?.wbs || !task.isGroup) return [];
    const prefix = `${task.wbs}.`;
    const parentDepth = task.wbs.split('.').length;
    return (allTasks || [])
      .filter((t) => t.wbs && t.wbs.startsWith(prefix) && t.wbs.split('.').length === parentDepth + 1)
      .sort((a, b) => {
        const ap = (a.wbs || '').split('.').map((n) => parseInt(n, 10) || 0);
        const bp = (b.wbs || '').split('.').map((n) => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
          const av = ap[i] || 0;
          const bv = bp[i] || 0;
          if (av !== bv) return av - bv;
        }
        return 0;
      });
  }, [allTasks, task]);

  // Existing leaf children that can be linked to an element column
  // (post-planning scenario: BOQ leaves already carry contract quantities).
  // Excludes groups and leaves already BOQ-linked to another column.
  const linkableLeaves = useMemo(
    () => directChildren.filter((c) => !c.isGroup && !c.boqLink),
    [directChildren]
  );

  /* ---------- read-mode derived data (all guarded) ---------- */

  const taskId = task?.id ?? null;

  // Opening a different task always lands in read mode (the report view).
  // Render-time reset (React's documented "adjust state when a prop changes"
  // pattern — no effect, no cascading render).
  const [lastTaskId, setLastTaskId] = useState(taskId);
  if (taskId !== lastTaskId) {
    setLastTaskId(taskId);
    setMode('read');
    setShowCompleted(false);
  }

  // Computed self: engine-enriched values (progress/costs/schedule), raw task fallback.
  const computedSelf = useMemo(
    () => (taskId ? computedById.get(taskId) || task : null),
    [computedById, task, taskId]
  );

  const overallProgress = useMemo(() => clamp01(computedSelf?.progress), [computedSelf]);

  const schedule = useMemo(() => {
    const src = computedSelf || {};
    const start = src.startDate || null;
    const end = src.endDate || null;
    let days = null;
    if (start && end) {
      const s = Date.parse(start);
      const e = Date.parse(end);
      if (Number.isFinite(s) && Number.isFinite(e)) days = Math.max(0, Math.round((e - s) / DAY_MS));
    }
    return { start, end, days };
  }, [computedSelf]);

  // Scope = this task + every WBS descendant (orders on any of them count here).
  const scopeIds = useMemo(() => {
    const ids = new Set();
    if (!task?.id) return ids;
    ids.add(task.id);
    if (task.wbs) {
      const prefix = `${task.wbs}.`;
      (allTasks || []).forEach((t) => {
        if (t.wbs && t.wbs.startsWith(prefix)) ids.add(t.id);
      });
    }
    return ids;
  }, [allTasks, task]);

  const hasOrdersProp = Array.isArray(orders);

  const taskOrders = useMemo(() => {
    if (!hasOrdersProp || scopeIds.size === 0) return [];
    return orders
      .filter((o) => o && scopeIds.has(o.taskId))
      .slice()
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }, [orders, scopeIds, hasOrdersProp]);

  const latestOrders = useMemo(() => taskOrders.slice(0, 10), [taskOrders]);

  // Per-contractor rollup of this task's orders (qty executed + money out + count).
  const contractorRollup = useMemo(() => {
    const map = new Map();
    taskOrders.forEach((o) => {
      if (o.who?.kind !== 'contractor' || !o.who.contractorId) return;
      const contractor = (registries?.contractors || []).find((c) => c.id === o.who.contractorId);
      const entry = map.get(o.who.contractorId) || {
        name: contractor?.name || t('taskDetails.unknownContractor'),
        qty: 0,
        expense: 0,
        count: 0,
      };
      if (o.family === 'value') entry.qty += toNum(o.quantity);
      else entry.expense += toNum(o.amount);
      entry.count += 1;
      map.set(o.who.contractorId, entry);
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [taskOrders, registries, t]);

  const readStats = useMemo(() => ({
    tests: taskOrders.filter((o) => o.type === 'concrete_test' || o.type === 'soil_test').length,
    completions: taskOrders.filter((o) => o.type === 'completion').length,
    expenses: taskOrders.filter((o) => o.family === 'expense').reduce((s, o) => s + toNum(o.amount), 0),
  }), [taskOrders]);

  const money = useMemo(() => {
    const contract = toNum(computedSelf?.totalCost);
    const executed = toNum(computedSelf?.actualCost);
    return {
      contract,
      executed,
      deviation: executed - contract,
      expenses: readStats.expenses,
    };
  }, [computedSelf, readStats]);

  // Per quantity-type card: contract / executed / remaining + progress bar.
  // Linked columns read their BOQ leaf (computed); unlinked columns show the
  // column sum (with waste) as a take-off estimate.
  const qtyRows = useMemo(() => columns.map((col) => {
    const rawSum = sums[col.id] || 0;
    const waste = toNum(col.wasteFactorPct);
    const columnContract = rawSum * (1 + waste / 100);
    const leaf = col.linkedTaskId ? computedById.get(col.linkedTaskId) : null;
    const contract = leaf ? toNum(leaf.quantity) : columnContract;
    const executed = leaf ? toNum(leaf.actualQty) : null;
    const remaining = executed != null ? contract - executed : null;
    const pctValue = leaf && contract > 0 ? clamp01(executed / contract) : null;
    const reconDelta = leaf && leaf.elementSum != null ? toNum(leaf.elementSum) - contract : null;
    return { col, leaf, contract, executed, remaining, pctValue, reconDelta, rawSum, waste };
  }), [columns, sums, computedById]);

  // Elements map sort: in-progress → on-hold → not-started → completed (original order stable).
  const sortedElements = useMemo(
    () => elements
      .map((el, idx) => ({ el, idx }))
      .sort((a, b) =>
        ((STATUS_SORT[a.el.status] ?? STATUS_SORT.not_started) - (STATUS_SORT[b.el.status] ?? STATUS_SORT.not_started))
        || (a.idx - b.idx)),
    [elements]
  );

  const visibleElements = showCompleted
    ? sortedElements
    : sortedElements.filter((row) => row.el.status !== 'completed');

  const hiddenCompleted = sortedElements.length - visibleElements.length;

  if (!task) {
    return (
      <div className="task-details" dir={dir}>
        <div className="td-empty">{t('taskDetails.noTaskSelected')}</div>
      </div>
    );
  }

  /* ---------- mutate helpers (edit mode) ---------- */
  const patchTask = (patch) => onUpdateTask({ ...task, ...patch });

  const patchChild = (child, patch) => onUpdateTask({ ...child, ...patch });

  /* ----- elements ----- */
  const addElement = () => {
    const newEl = { id: uid(), name: '', location: '', status: 'not_started', notes: '', values: {} };
    patchTask({ elements: [...elements, newEl] });
  };

  const updateElement = (id, patch) => {
    patchTask({ elements: elements.map((el) => (el.id === id ? { ...el, ...patch } : el)) });
  };

  const updateElementValue = (id, colId, value) => {
    patchTask({
      elements: elements.map((el) => {
        if (el.id !== id) return el;
        return { ...el, values: { ...el.values, [colId]: value === '' ? '' : toNum(value) } };
      }),
    });
  };

  const deleteElement = (id) => {
    if (!window.confirm(t('taskDetails.confirmDeleteElement'))) return;
    patchTask({ elements: elements.filter((el) => el.id !== id) });
  };

  /* ----- columns (quantity types) ----- */
  const addColumn = (preset) => {
    const newCol = {
      id: uid(),
      name: preset?.name || t('taskDetails.qtyTypeFallback'),
      unit: preset?.unit || t('taskDetails.unitPlaceholder'),
      wasteFactorPct: 0,
      linkedTaskId: null,
    };
    patchTask({ elementColumns: [...columns, newCol] });
  };

  const addDefaultColumns = () => {
    const unit = t('taskDetails.unitPlaceholder');
    const defaults = [
      { name: 'C25', unit },
      { name: 'C20', unit },
      { name: 'C7', unit },
    ];
    const newCols = defaults.map((d) => ({ id: uid(), ...d, linkedTaskId: null }));
    patchTask({ elementColumns: [...columns, ...newCols] });
  };

  const updateColumn = (id, patch) => {
    patchTask({ elementColumns: columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const deleteColumn = (col) => {
    if (!window.confirm(t('taskDetails.confirmDeleteType', { name: col.name }))) return;
    if (col.linkedTaskId) onToggleBoqLink?.(task.id, col, false);
    patchTask({
      elementColumns: columns.filter((c) => c.id !== col.id),
      elements: elements.map((el) => {
        const v = { ...el.values };
        delete v[col.id];
        return { ...el, values: v };
      }),
    });
  };

  const handleBoqCheck = (col, checked) => {
    onToggleBoqLink?.(task.id, col, checked);
  };

  /* ---------- shared: mode toggle ---------- */
  const modeToggle = (
    <div className="td-mode-toggle" role="group" aria-label={t('taskDetails.viewModeAria')}>
      <button
        type="button"
        className={`td-mode-btn${mode === 'read' ? ' active' : ''}`}
        onClick={() => setMode('read')}
        title={t('taskDetails.viewTitle')}
      >
        👁 {t('taskDetails.view')}
      </button>
      <button
        type="button"
        className={`td-mode-btn edit${mode === 'edit' ? ' active' : ''}${isSigned ? ' warn' : ''}`}
        onClick={() => setMode('edit')}
        title={isSigned ? t('taskDetails.editTitleSigned') : t('taskDetails.editTitle')}
      >
        ✏️ {t('common.edit')}
      </button>
    </div>
  );

  /* ════════════════════════════ READ MODE ════════════════════════════ */
  const renderRead = () => (
    <>
      {/* 1 — Header strip */}
      <div className="td-header td-read-header">
        <button className="td-back-btn" onClick={onBack} title={t('taskDetails.backToGrid')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          {t('common.back')}
        </button>
        <div className="td-title-block">
          <span className="td-wbs">{task.wbs || '—'}</span>
          <h2 className="td-title">{task.name || t('taskDetails.untitledItem')}</h2>
          <div className="td-header-badges">
            <span className="td-badge">{task.isGroup ? t('taskDetails.groupBadge') : t('taskDetails.workItemBadge')}</span>
            {isSigned && <span className="td-badge lock">🔒 {t('taskDetails.signedContract')}</span>}
            {elements.length > 0 && <span className="td-badge">{countLabel(elements.length, 'taskDetails.elementOne', 'taskDetails.elementsMany')}</span>}
            {columns.length > 0 && <span className="td-badge">{countLabel(columns.length, 'taskDetails.qtyTypeOne', 'taskDetails.qtyTypesMany')}</span>}
            {linkedCount > 0 && <span className="td-badge accent">{countLabel(linkedCount, 'taskDetails.boqOne', 'taskDetails.boqMany')}</span>}
            {identity?.name && (
              <span className="td-badge" title={t('taskDetails.currentUser')}>
                👤 {identity.name}{identity.role ? ` — ${identity.role}` : ''}
              </span>
            )}
          </div>
        </div>
        <div className="td-read-stat td-read-stat-progress">
          <span className="td-read-stat-label">{t('taskDetails.completionPct')}</span>
          <span className="td-read-progress-num">{fmtPct(overallProgress)}</span>
          <Bar value={overallProgress} />
        </div>
        <div className="td-read-stat">
          <span className="td-read-stat-label">{t('taskDetails.scheduleWindow')}</span>
          <span className="td-sched-dates">
            {schedule.start || '—'}{schedule.end ? ` ${isRTL ? '←' : '→'} ${schedule.end}` : ''}
          </span>
          <span className="td-sched-days">
            {schedule.days != null
              ? countLabel(schedule.days, 'taskDetails.dayOne', 'taskDetails.daysMany')
              : t('taskDetails.noDuration')}
          </span>
        </div>
        {modeToggle}
      </div>

      {/* 2 — What & how much: quantities by type */}
      <div className="td-section">
        <div className="td-section-head">
          <h3>{t('taskDetails.secQuantities')} <span className="td-section-count">{t('taskDetails.secQuantitiesSub')}</span></h3>
        </div>

        <div className="td-overall-card">
          <div className="td-overall-top">
            <span className="td-overall-label">{t('taskDetails.overallProgress')}</span>
            <span className="td-overall-num">{fmtPct(overallProgress)}</span>
          </div>
          <Bar value={overallProgress} />
          <div className="td-overall-meta">
            {task.isGroup
              ? t('taskDetails.rollupFromChildren', { n: directChildren.length })
              : t('taskDetails.executedOfTotal', {
                executed: fmt(computedSelf?.actualQty),
                total: fmt(computedSelf?.qty),
                unit: computedSelf?.unit || '',
              })}
          </div>
        </div>

        {qtyRows.length === 0 ? (
          <div className="td-card-empty">
            {t('taskDetails.qtyEmpty')}
          </div>
        ) : (
          <div className="td-qty-grid">
            {qtyRows.map((r) => (
              <div key={r.col.id} className="td-qty-card">
                <div className="td-qty-head">
                  <span className="td-qty-name">{r.col.name || t('taskDetails.qtyTypeFallback')}</span>
                  {r.col.unit && <span className="td-qty-unit">{r.col.unit}</span>}
                  {r.leaf && (
                    <span className="td-qty-boq" title={t('taskDetails.linkedBoqTitle')}>
                      🔗 {r.leaf.wbs || t('taskDetails.itemWord')}
                    </span>
                  )}
                </div>
                <div className="td-qty-stats">
                  <div className="td-qty-stat">
                    <span>{t('taskDetails.statContract')}</span>
                    <b>{fmt(r.contract)}</b>
                  </div>
                  <div className="td-qty-stat">
                    <span>{t('taskDetails.statExecuted')}</span>
                    <b>{r.executed != null ? fmt(r.executed) : '—'}</b>
                  </div>
                  <div className="td-qty-stat">
                    <span>{t('taskDetails.statRemaining')}</span>
                    <b className={r.remaining != null && r.remaining < 0 ? 'td-remaining-over' : ''}>
                      {r.remaining != null ? fmt(r.remaining) : '—'}
                    </b>
                  </div>
                </div>
                {r.pctValue != null ? (
                  <Bar value={r.pctValue} />
                ) : (
                  <Bar empty />
                )}
                <div className="td-qty-foot">
                  {r.waste > 0 && (
                    <span title={t('taskDetails.wasteChipTitle')}>{t('taskDetails.wasteChip', { n: r.waste })}</span>
                  )}
                  {r.reconDelta != null && (
                    <span className={`td-recon ${Math.abs(r.reconDelta) < 0.001 ? 'ok' : 'warn'}`}>
                      {t('taskDetails.elementSumLabel', { n: fmt(r.leaf.elementSum) })}
                      {Math.abs(r.reconDelta) >= 0.001
                        ? ` ${t('taskDetails.reconDelta', { n: fmt(r.reconDelta) })}`
                        : ` ${t('taskDetails.reconMatch')}`}
                    </span>
                  )}
                  {!r.leaf && <span className="td-muted">{t('taskDetails.calcQuantityNote')}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3 — Where the work stands: elements map */}
      <div className="td-section">
        <div className="td-section-head">
          <h3>{t('taskDetails.secWorkStatus')} <span className="td-section-count">({countLabel(elements.length, 'taskDetails.elementOne', 'taskDetails.elementsMany')})</span></h3>
          <div className="td-section-actions td-status-chips">
            {statusCounts.in_progress > 0 && (
              <span className="td-chip" style={{ color: STATUS_MAP.in_progress.color }}>{statusCounts.in_progress} {t('taskDetails.status.in_progress')}</span>
            )}
            {statusCounts.on_hold > 0 && (
              <span className="td-chip" style={{ color: STATUS_MAP.on_hold.color }}>{statusCounts.on_hold} {t('taskDetails.status.on_hold')}</span>
            )}
            {statusCounts.not_started > 0 && (
              <span className="td-chip" style={{ color: STATUS_MAP.not_started.color }}>{statusCounts.not_started} {t('taskDetails.status.not_started')}</span>
            )}
            {statusCounts.completed > 0 && (
              <>
                <span className="td-chip" style={{ color: STATUS_MAP.completed.color }}>{statusCounts.completed} {t('taskDetails.status.completed')}</span>
                <button className="td-btn ghost xs" onClick={() => setShowCompleted((v) => !v)}>
                  {showCompleted ? t('taskDetails.hideCompleted') : t('taskDetails.showCompleted')}
                </button>
              </>
            )}
          </div>
        </div>

        {elements.length === 0 ? (
          <div className="td-card-empty">
            {t('taskDetails.mapEmpty')}
          </div>
        ) : (
          <div className="td-map-table-wrap">
            <table className="td-map-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('common.name')}</th>
                  <th>{t('taskDetails.locationStation')}</th>
                  <th>{t('common.status')}</th>
                  {columns.map((c) => (
                    <th key={c.id} className="td-num">{c.name} {c.unit ? `(${c.unit})` : ''}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleElements.map(({ el, idx }) => (
                  <tr key={el.id} className={el.status === 'completed' ? 'is-completed' : ''}>
                    <td className="td-rownum">{idx + 1}</td>
                    <td className="td-map-name">
                      {el.name || '—'}
                      {el.notes && <span className="td-map-notes">{el.notes}</span>}
                    </td>
                    <td>{el.location || '—'}</td>
                    <td><StatusChip status={el.status} label={statusLabel(el.status)} /></td>
                    {columns.map((c) => (
                      <td key={c.id} className="td-num td-map-qty">{fmt(el?.values?.[c.id])}</td>
                    ))}
                  </tr>
                ))}
                {visibleElements.length === 0 && (
                  <tr>
                    <td colSpan={4 + columns.length} className="td-map-hiddennote">
                      {t('taskDetails.allHiddenNote', { n: hiddenCompleted })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4 — Who & what's new: orders on this task / its descendants */}
      <div className="td-section">
        <div className="td-section-head">
          <h3>{t('taskDetails.secOrders')} <span className="td-section-count">({countLabel(taskOrders.length, 'taskDetails.orderOne', 'taskDetails.ordersMany')})</span></h3>
        </div>

        {taskOrders.length === 0 ? (
          <div className="td-card-empty">
            {hasOrdersProp ? t('taskDetails.ordersEmptyLinked') : t('taskDetails.ordersEmptyNoProp')}
          </div>
        ) : (
          <>
            <div className="td-orders-table-wrap">
              <table className="td-orders-table">
                <thead>
                  <tr>
                    <th>{t('common.date')}</th>
                    <th>{t('common.type')}</th>
                    <th>{t('taskDetails.executedBy')}</th>
                    <th className="td-num">{t('taskDetails.qtyOrAmount')}</th>
                    <th>{t('common.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {latestOrders.map((o) => {
                    const meta = orderMeta(o.type, t('taskDetails.orderWord'));
                    const whoText = resolveWho(registries, o.who);
                    return (
                      <tr key={o.id}>
                        <td className="td-o-date">{o.date || '—'}</td>
                        <td className="td-o-type">{meta.icon} {meta.label}</td>
                        <td>{whoText !== '—' ? whoText : (o.location ? `📍 ${o.location}` : '—')}</td>
                        <td className="td-num td-o-qty">
                          {o.family === 'expense'
                            ? fmtMoney(o.amount)
                            : `${fmt(o.quantity)}${o.unit ? ` ${o.unit}` : ''}`}
                        </td>
                        <td><OrderStatusBadge status={o.status} label={t(o.status === 'approved' ? 'common.approved' : 'common.recorded')} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {taskOrders.length > latestOrders.length && (
              <div className="td-muted td-more-note">
                {t('taskDetails.moreOrdersNote', { shown: latestOrders.length, total: taskOrders.length })}
              </div>
            )}
            {contractorRollup.length > 0 && (
              <div className="td-rollup">
                <span className="td-rollup-title">{t('taskDetails.rollupTitle')}</span>
                {contractorRollup.map((r) => (
                  <div key={r.name + r.count} className="td-rollup-card">
                    <b>{r.name}</b>
                    <span>{countLabel(r.count, 'taskDetails.orderOne', 'taskDetails.ordersMany')}</span>
                    {r.qty > 0 && <span>{t('taskDetails.executedQtyLabel')} {fmt(r.qty)}</span>}
                    {r.expense > 0 && <span>{t('taskDetails.expensesLabel')} {fmtMoney(r.expense)}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* 5 — Money */}
      <div className="td-section">
        <div className="td-section-head">
          <h3>{t('taskDetails.secMoney')}</h3>
        </div>
        <div className="td-money-grid">
          <div className="td-money-card">
            <span className="td-money-label">{t('taskDetails.moneyContract')}</span>
            <span className="td-money-val">{fmtMoney(money.contract)}</span>
            {!task.isGroup && (
              <span className="td-money-sub">
                {fmt(computedSelf?.qty)} × {formatCurrency(computedSelf?.price, lang)}{computedSelf?.unit ? ` / ${computedSelf.unit}` : ''}
              </span>
            )}
          </div>
          <div className="td-money-card">
            <span className="td-money-label">{t('taskDetails.moneyExecuted')}</span>
            <span className="td-money-val">{fmtMoney(money.executed)}</span>
            <span className="td-money-sub">
              {task.isGroup ? t('taskDetails.moneyExecSubGroup') : t('taskDetails.moneyExecSubLeaf')}
            </span>
          </div>
          <div className="td-money-card">
            <span className="td-money-label">{t('taskDetails.moneyDeviation')}</span>
            <span className={`td-money-val ${money.deviation > 0 ? 'pos' : money.deviation < 0 ? 'neg' : ''}`}>
              {money.deviation === 0 ? '—' : `${money.deviation > 0 ? '+' : ''}${fmtMoney(money.deviation)}`}
            </span>
            <span className="td-money-sub">
              {money.deviation === 0
                ? t('taskDetails.moneyDevMatch')
                : money.deviation > 0
                  ? t('taskDetails.moneyDevOver')
                  : t('taskDetails.moneyDevUnder')}
            </span>
          </div>
          <div className="td-money-card">
            <span className="td-money-label">{t('taskDetails.moneyExpenses')}</span>
            <span className="td-money-val">{hasOrdersProp ? fmtMoney(money.expenses) : '—'}</span>
            <span className="td-money-sub">{t('taskDetails.moneyExpensesSub')}</span>
          </div>
        </div>
      </div>

      {/* 6 — Evidence */}
      <div className="td-section">
        <div className="td-section-head">
          <h3>{t('taskDetails.secEvidence')}</h3>
        </div>
        <div className="td-evidence-grid">
          <div className="td-evidence-card">
            <span className="td-evidence-icon">🧪</span>
            <span className="td-evidence-num">{hasOrdersProp ? readStats.tests : '—'}</span>
            <span className="td-evidence-label">{t('taskDetails.evidenceTests')}</span>
          </div>
          <div className="td-evidence-card">
            <span className="td-evidence-icon">📋</span>
            <span className="td-evidence-num">{hasOrdersProp ? readStats.completions : '—'}</span>
            <span className="td-evidence-label">{t('taskDetails.evidenceCompletions')}</span>
          </div>
          <div className="td-evidence-card placeholder" title={t('taskDetails.evidenceFilesTitle')}>
            <span className="td-evidence-icon">📁</span>
            <span className="td-evidence-num">—</span>
            <span className="td-evidence-label">{t('taskDetails.evidenceFiles')}</span>
          </div>
        </div>
      </div>

      {/* 7 — Sub-items (read) */}
      {task.isGroup && (
        <div className="td-section">
          <div className="td-section-head">
            <h3>{t('taskDetails.secChildren')} <span className="td-section-count">({directChildren.length})</span></h3>
            <span className="td-muted">{t('taskDetails.childrenHint')}</span>
          </div>

          {directChildren.length === 0 ? (
            <div className="td-card-empty">{t('taskDetails.childrenEmptyRead')}</div>
          ) : (
            <div className="td-children-table-wrap">
              <table className="td-children-table td-children-readonly">
                <thead>
                  <tr>
                    <th>{t('taskDetails.colCode')}</th>
                    <th>{t('common.name')}</th>
                    <th>{t('common.contractQty')}</th>
                    <th>{t('taskDetails.colExecutedQty')}</th>
                    <th>{t('common.variance')}</th>
                    <th>{t('common.unit')}</th>
                    <th>{t('taskDetails.colUnitPrice')}</th>
                    <th>{t('common.type')}</th>
                    <th>{t('common.progress')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {directChildren.map((child) => {
                    const c = computedById.get(child.id) || child;
                    const isBoq = !!child.boqLink;
                    const linkedCol = isBoq ? columns.find((col) => col.id === child.boqLink.colId) : null;
                    const variance = c.execVariance != null ? c.execVariance : (toNum(c.actualQuantity) - toNum(c.quantity));
                    return (
                      <tr key={child.id}>
                        <td className="td-rownum">{child.wbs}</td>
                        <td className="td-ro-name">{child.name || '—'}</td>
                        <td className="td-num">
                          <span className="td-locked-val" title={isBoq ? t('taskDetails.managedFromElements') : t('taskDetails.contractQtyTitle')}>
                            {isBoq ? '🔗 ' : (isSigned ? '🔒 ' : '')}{fmt(c.quantity)}
                          </span>
                        </td>
                        <td className="td-num">
                          {c.orderSource && c.orderSource.manual === false ? (
                            <span className="td-locked-val" title={t('taskDetails.fromOrdersTitle', {
                              count: c.orderSource.orderCount,
                              formal: c.orderSource.formalQty,
                              quick: c.orderSource.quickQty,
                            })}>
                              🔗 {fmt(c.actualQty)}
                            </span>
                          ) : (
                            <span className="td-plain-num">{fmt(c.actualQty)}</span>
                          )}
                        </td>
                        <td className="td-num">
                          <span className={`td-variance ${variance > 0 ? 'pos' : variance < 0 ? 'neg' : ''}`}>
                            {variance === 0 ? '—' : `${variance > 0 ? '+' : ''}${fmt(variance)}`}
                          </span>
                        </td>
                        <td className="td-num">{c.unit || '—'}</td>
                        <td className="td-num">
                          <span className="td-plain-num" title={isSigned ? t('taskDetails.approvedContractPrice') : ''}>
                            {isSigned ? '🔒 ' : ''}{fmt(child.unitPrice)}
                          </span>
                        </td>
                        <td>
                          {child.isGroup ? (
                            <span className="td-type-badge group">{t('taskDetails.typeGroup')}</span>
                          ) : isBoq ? (
                            <span className="td-type-badge boq" title={linkedCol ? t('taskDetails.linkedToQtyType', { name: linkedCol.name }) : ''}>
                              BOQ{linkedCol ? ` · ${linkedCol.name}` : ''}
                            </span>
                          ) : (
                            <span className="td-type-badge manual">{t('taskDetails.typeManual')}</span>
                          )}
                        </td>
                        <td className="td-num">
                          <div className="td-progress-cell">
                            {c.progress != null && c.progress > 0 ? (
                              <>
                                <Bar value={c.progress} slim />
                                <span className="td-progress-txt">{(c.progress * 100).toFixed(0)}%</span>
                              </>
                            ) : '—'}
                          </div>
                        </td>
                        <td>
                          {child.isGroup && (
                            <button
                              className="td-icon-btn"
                              onClick={() => onJumpToTaskDetails?.(child)}
                              title={t('taskDetails.openChildDetails')}
                            >
                              ≡
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </>
  );

  /* ════════════════════════════ EDIT MODE ════════════════════════════ */
  const renderEdit = () => (
    <>
      {/* Header */}
      <div className="td-header">
        <button className="td-back-btn" onClick={onBack} title={t('taskDetails.backToGrid')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          {t('common.back')}
        </button>
        <div className="td-title-block">
          <span className="td-wbs">{task.wbs || '—'}</span>
          <h2 className="td-title">{task.name || t('taskDetails.untitledItem')}</h2>
        </div>
        <div className="td-header-badges">
          <span className="td-badge">{countLabel(elements.length, 'taskDetails.elementOne', 'taskDetails.elementsMany')}</span>
          <span className="td-badge">{countLabel(columns.length, 'taskDetails.qtyTypeOne', 'taskDetails.qtyTypesMany')}</span>
          <span className="td-badge accent">{countLabel(linkedCount, 'taskDetails.boqOne', 'taskDetails.boqMany')}</span>
        </div>
        {modeToggle}
      </div>

      {/* Help banner (edit mode only) */}
      <div className="td-help-banner">
        <strong>{t('taskDetails.helpTitle')}</strong>{' '}
        {t('taskDetails.helpPre')} <span className="td-help-key">{t('taskDetails.helpKey')}</span>{' '}
        {t('taskDetails.helpPost')}
      </div>

      {/* Summary cards */}
      <div className="td-summary">
        <div className="td-sum-card">
          <span className="td-sum-label">{t('taskDetails.sumElements')}</span>
          <span className="td-sum-value">{elements.length}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">{t('taskDetails.sumCompleted')}</span>
          <span className="td-sum-value" style={{ color: '#16A34A' }}>{statusCounts.completed}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">{t('taskDetails.sumInProgress')}</span>
          <span className="td-sum-value" style={{ color: '#0284C7' }}>{statusCounts.in_progress}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">{t('taskDetails.sumLinkedBoq')}</span>
          <span className="td-sum-value">{linkedCount}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">{t('taskDetails.sumTotalQty')}</span>
          <span className="td-sum-value">{fmt(totalAllQuantities)}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">{t('taskDetails.secChildren')}</span>
          <span className="td-sum-value">{directChildren.length}</span>
        </div>
      </div>

      {/* Sub-tasks (bidirectional): all direct children of this task,
           whether created via BOQ checkboxes here or added in the Gantt grid. */}
      {task.isGroup && (
        <div className="td-section">
          <div className="td-section-head">
            <h3>
              {t('taskDetails.secChildren')} <span className="td-section-count">({directChildren.length})</span>
            </h3>
            <div className="td-section-actions">
              <button className="td-btn" onClick={() => onAddSubTask?.(task.id)}>
                {t('taskDetails.addChild')}
              </button>
            </div>
          </div>

          {directChildren.length === 0 ? (
            <div className="td-card-empty">
              {t('taskDetails.childrenEmptyEdit')}
            </div>
          ) : (
            <div className="td-children-table-wrap">
              <table className="td-children-table">
                <thead>
                  <tr>
                    <th>{t('taskDetails.colCode')}</th>
                    <th>{t('common.name')}</th>
                    <th>{t('common.contractQty')}</th>
                    <th>{t('taskDetails.colExecutedQty')}</th>
                    <th>{t('common.variance')}</th>
                    <th>{t('common.unit')}</th>
                    <th>{t('taskDetails.colUnitPrice')}</th>
                    <th>{t('common.type')}</th>
                    <th>{t('common.progress')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {directChildren.map((child) => {
                    const c = computedById.get(child.id) || child;
                    const isBoq = !!child.boqLink;
                    const linkedCol = isBoq ? columns.find((col) => col.id === child.boqLink.colId) : null;
                    const contractLocked = isBoq || isSigned;
                    const variance = c.execVariance != null ? c.execVariance : (toNum(c.actualQuantity) - toNum(c.quantity));
                    const reconDelta = isBoq && c.elementSum != null ? (toNum(c.elementSum) - toNum(c.quantity)) : null;
                    return (
                      <tr key={child.id}>
                        <td className="td-rownum">{child.wbs}</td>
                        <td>
                          <input
                            className="td-input"
                            value={child.name || ''}
                            onChange={(e) => patchChild(child, { name: e.target.value })}
                            placeholder={t('taskDetails.childNamePlaceholder')}
                          />
                        </td>
                        <td className="td-num">
                          {contractLocked ? (
                            <div className="td-locked-stack" title={isBoq ? t('taskDetails.managedFromElements') : t('taskDetails.approvedContractQty')}>
                              <span className="td-locked-val">{isBoq ? '🔗 ' : '🔒 '}{fmt(c.quantity)}</span>
                              {isBoq && c.elementSum != null && (
                                <span className={`td-recon ${Math.abs(reconDelta) < 0.001 ? 'ok' : 'warn'}`}>
                                  {t('taskDetails.elementSumLabel', { n: fmt(c.elementSum) })}
                                </span>
                              )}
                            </div>
                          ) : (
                            <input
                              className="td-input td-input-num"
                              type="number"
                              value={child.quantity ?? ''}
                              onChange={(e) => patchChild(child, { quantity: e.target.value === '' ? '' : toNum(e.target.value) })}
                              placeholder="0"
                            />
                          )}
                        </td>
                        <td className="td-num">
                          {c.orderSource && c.orderSource.manual === false ? (
                            <div className="td-locked-stack" title={t('taskDetails.fromOrdersTitle', {
                              count: c.orderSource.orderCount,
                              formal: c.orderSource.formalQty,
                              quick: c.orderSource.quickQty,
                            })}>
                              <span className="td-locked-val">🔗 {fmt(c.actualQty)}</span>
                            </div>
                          ) : (
                            <input
                              className="td-input td-input-num"
                              type="number"
                              value={child.actualQuantity ?? ''}
                              onChange={(e) => patchChild(child, { actualQuantity: e.target.value === '' ? '' : toNum(e.target.value) })}
                              placeholder="0"
                            />
                          )}
                        </td>
                        <td className="td-num">
                          <span className={`td-variance ${variance > 0 ? 'pos' : variance < 0 ? 'neg' : ''}`}>
                            {variance === 0 ? '—' : `${variance > 0 ? '+' : ''}${fmt(variance)}`}
                          </span>
                        </td>
                        <td>
                          {contractLocked ? (
                            <span className="td-locked-val">{c.unit || '—'}</span>
                          ) : (
                            <input
                              className="td-input td-input-unit"
                              value={child.unit || ''}
                              onChange={(e) => patchChild(child, { unit: e.target.value })}
                              placeholder={t('taskDetails.unitPlaceholder')}
                            />
                          )}
                        </td>
                        <td className="td-num">
                          {isSigned ? (
                            <span className="td-locked-val" title={t('taskDetails.approvedContractPrice')}>🔒 {fmt(child.unitPrice)}</span>
                          ) : (
                            <input
                              className="td-input td-input-num"
                              type="number"
                              value={child.unitPrice ?? ''}
                              onChange={(e) => patchChild(child, { unitPrice: e.target.value === '' ? '' : toNum(e.target.value) })}
                              placeholder="0"
                            />
                          )}
                        </td>
                        <td>
                          {child.isGroup ? (
                            <span className="td-type-badge group">{t('taskDetails.typeGroup')}</span>
                          ) : isBoq ? (
                            <span className="td-type-badge boq" title={linkedCol ? t('taskDetails.linkedToQtyType', { name: linkedCol.name }) : ''}>
                              BOQ{linkedCol ? ` · ${linkedCol.name}` : ''}
                            </span>
                          ) : (
                            <span className="td-type-badge manual">{t('taskDetails.typeManual')}</span>
                          )}
                        </td>
                        <td className="td-num">
                          {c.progress != null && c.progress > 0
                            ? `${(c.progress * 100).toFixed(0)}%`
                            : '—'}
                        </td>
                        <td>
                          <div className="td-row-actions">
                            {child.isGroup && (
                              <button
                                className="td-icon-btn"
                                onClick={() => onJumpToTaskDetails?.(child)}
                                title={t('taskDetails.openChildDetails')}
                              >
                                ≡
                              </button>
                            )}
                            <button
                              className="td-icon-btn danger"
                              onClick={() => onDeleteTask?.(child.id)}
                              title={t('taskDetails.deleteChild')}
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Quantity Types (columns) manager */}
      <div className="td-section">
        <div className="td-section-head">
          <h3>{t('taskDetails.secQtyTypes')}</h3>
          <div className="td-section-actions">
            <button className="td-btn ghost" onClick={addDefaultColumns} disabled={columns.length > 0}>
              {t('taskDetails.btnDefaults')}
            </button>
            <button className="td-btn" onClick={() => addColumn()}>{t('taskDetails.btnAddType')}</button>
          </div>
        </div>

        {columns.length === 0 ? (
          <div className="td-card-empty">
            {t('taskDetails.typesEmpty')}
          </div>
        ) : (
          <div className="td-types-table-wrap">
            <table className="td-types-table">
              <thead>
                <tr>
                  <th>{t('taskDetails.colQtyType')}</th>
                  <th>{t('common.unit')}</th>
                  <th>{t('taskDetails.colWaste')}</th>
                  <th>{t('taskDetails.colTotalWithWaste')}</th>
                  <th>{t('taskDetails.colBoq')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col) => {
                  const linked = !!col.linkedTaskId;
                  const linkedTask = linked ? taskById.get(col.linkedTaskId) : null;
                  return (
                    <tr key={col.id}>
                      <td>
                        <input
                          className="td-input"
                          value={col.name || ''}
                          onChange={(e) => updateColumn(col.id, { name: e.target.value })}
                          placeholder={t('taskDetails.namePlaceholder')}
                        />
                      </td>
                      <td>
                        <input
                          className="td-input td-input-unit"
                          value={col.unit || ''}
                          onChange={(e) => updateColumn(col.id, { unit: e.target.value })}
                          placeholder={t('taskDetails.unitPlaceholder')}
                        />
                      </td>
                      <td>
                        <input
                          className="td-input td-input-waste"
                          type="number"
                          min="0"
                          value={col.wasteFactorPct ?? 0}
                          onChange={(e) => updateColumn(col.id, { wasteFactorPct: toNum(e.target.value) })}
                          title={t('taskDetails.wasteTitle')}
                        />
                      </td>
                      <td className="td-num td-sum-cell">
                        <span className="td-sum-eff">
                          {fmt(sums[col.id] * (1 + toNum(col.wasteFactorPct) / 100))}
                        </span>
                        {toNum(col.wasteFactorPct) > 0 && (
                          <span className="td-sum-raw">{t('taskDetails.rawLabel', { n: fmt(sums[col.id]) })}</span>
                        )}
                      </td>
                      <td>
                        {task.isGroup ? (
                          linked ? (
                            <div className="td-boq-linked">
                              <span className="td-boq-text">
                                {linkedTask ? `${linkedTask.wbs || ''} ${linkedTask.name || ''}` : t('taskDetails.boqLinkedFallback')}
                              </span>
                              <button
                                className="td-btn ghost xs"
                                onClick={() => handleBoqCheck(col, false)}
                                title={t('taskDetails.unlinkTitle')}
                              >
                                {t('taskDetails.btnUnlink')}
                              </button>
                            </div>
                          ) : (
                            <div className="td-boq-actions">
                              <button
                                className="td-btn ghost xs"
                                onClick={() => handleBoqCheck(col, true)}
                                title={t('taskDetails.newBoqTitle')}
                              >
                                {t('taskDetails.btnNewBoq')}
                              </button>
                              {linkableLeaves.length > 0 && (
                                <select
                                  className="td-boq-link-select"
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) onLinkExistingBoq?.(task.id, col, e.target.value);
                                  }}
                                  title={t('taskDetails.linkExistingTitle')}
                                >
                                  <option value="">{t('taskDetails.linkExisting')}</option>
                                  {linkableLeaves.map((lf) => (
                                    <option key={lf.id} value={lf.id}>
                                      {`${lf.wbs || ''} ${lf.name || ''} — ${fmt(lf.quantity)} ${lf.unit || ''}`}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )
                        ) : (
                          <span className="td-muted">{t('taskDetails.recordOnly')}</span>
                        )}
                      </td>
                      <td>
                        <button className="td-icon-btn danger" onClick={() => deleteColumn(col)} title={t('taskDetails.deleteType')}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Elements table */}
      <div className="td-section">
        <div className="td-section-head">
          <h3>{t('taskDetails.secElements')}</h3>
          <div className="td-section-actions">
            <button className="td-btn" onClick={addElement} disabled={columns.length === 0}>{t('taskDetails.btnAddElement')}</button>
          </div>
        </div>

        {columns.length === 0 ? (
          <div className="td-card-empty">
            {t('taskDetails.elementsNeedType')}
          </div>
        ) : elements.length === 0 ? (
          <div className="td-card-empty">
            {t('taskDetails.elementsEmpty')}
          </div>
        ) : (
          <div className="td-elements-table-wrap">
            <table className="td-elements-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>{t('common.name')}</th>
                  <th>{t('taskDetails.locationStation')}</th>
                  <th>{t('common.status')}</th>
                  {columns.map((c) => (
                    <th key={c.id} className="td-num">{c.name} {c.unit ? `(${c.unit})` : ''}</th>
                  ))}
                  <th>{t('common.notes')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {elements.map((el, idx) => {
                  const st = STATUS_MAP[el.status] || STATUS_MAP.not_started;
                  return (
                    <tr key={el.id}>
                      <td className="td-rownum">{idx + 1}</td>
                      <td>
                        <input
                          className="td-input"
                          value={el.name || ''}
                          onChange={(e) => updateElement(el.id, { name: e.target.value })}
                          placeholder={t('taskDetails.elementNamePlaceholder')}
                        />
                      </td>
                      <td>
                        <input
                          className="td-input"
                          value={el.location || ''}
                          onChange={(e) => updateElement(el.id, { location: e.target.value })}
                          placeholder="0+250"
                        />
                      </td>
                      <td>
                        <select
                          className="td-select"
                          value={el.status || 'not_started'}
                          onChange={(e) => updateElement(el.id, { status: e.target.value })}
                          style={{ borderInlineStart: `3px solid ${st.color}` }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{statusLabel(s.value)}</option>
                          ))}
                        </select>
                      </td>
                      {columns.map((c) => (
                        <td key={c.id} className="td-num">
                          <input
                            className="td-input td-input-num"
                            type="number"
                            value={el.values?.[c.id] ?? ''}
                            onChange={(e) => updateElementValue(el.id, c.id, e.target.value)}
                            placeholder="0"
                          />
                        </td>
                      ))}
                      <td>
                        <input
                          className="td-input td-input-notes"
                          value={el.notes || ''}
                          onChange={(e) => updateElement(el.id, { notes: e.target.value })}
                        />
                      </td>
                      <td>
                        <button className="td-icon-btn danger" onClick={() => deleteElement(el.id)} title={t('taskDetails.deleteElement')}>✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="td-num td-foot-label">{t('common.total')}</td>
                  {columns.map((c) => (
                    <td key={c.id} className="td-num td-foot-sum">{fmt(sums[c.id])}</td>
                  ))}
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </>
  );

  /* ---------- render ---------- */
  return (
    <div className="task-details" dir={dir}>
      {mode === 'read' ? renderRead() : renderEdit()}
    </div>
  );
};

export default TaskDetails;
