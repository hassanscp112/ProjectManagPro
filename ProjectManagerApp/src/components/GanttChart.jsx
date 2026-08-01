import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import './GanttChart.css';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEP_TYPE_LABELS = {
  FS: 'FS انتهاء → بدء',
  SS: 'SS بدء → بدء',
  FF: 'FF انتهاء → انتهاء',
  SF: 'SF بدء → انتهاء',
};

/* ────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────── */
const toDate = (value) => {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const fmtNum = (n) => {
  if (n === 0 || n === null || n === undefined || n === '') return '—';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n);
};

const fmtDate = (d) => {
  const dt = toDate(d);
  if (!dt) return '—';
  return dt.toISOString().split('T')[0]; // YYYY-MM-DD compact
};

const fmtPct = (p) => {
  if (p === undefined || p === null) return '—';
  const val = (p * 100);
  return val.toFixed(1) + '%';
};

/* ────────────────────────────────────────────────────────
   Main Component
   ──────────────────────────────────────────────────────── */
const GanttChart = ({ tasks, onUpdateTask, projectStart, isEditMode, viewMode = 'week', onAddMainTask, onAddSubTask, onDeleteTask, onJumpToTaskFolder, onJumpToTaskDetails, isSigned }) => {
  const [hoveredId, setHoveredId] = useState(null);
  const gridBodyRef = useRef(null);
  const timelineBodyRef = useRef(null);
  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const dependencyOptions = useMemo(() => tasks.filter(task => !task.isGroup), [tasks]);

  const getDependencyLabel = (task) => {
    if (!task) return '—';
    return `${task.wbs || task.id} - ${task.name || ''}`;
  };

  const getDependencyDisplay = (dependsOn) => {
    if (!dependsOn) return '—';
    const dependency = taskById.get(dependsOn);
    return dependency ? getDependencyLabel(dependency) : `غير موجود: ${dependsOn}`;
  };

  // Sync scroll between data grid and timeline
  useEffect(() => {
    const grid = gridBodyRef.current;
    const timeline = timelineBodyRef.current;
    if (!grid || !timeline) return;

    let scrolling = null;
    let scrollTimeout = null;

    const syncGridToTimeline = () => {
      if (scrolling === 'timeline') return;
      scrolling = 'grid';
      timeline.scrollTop = grid.scrollTop;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { scrolling = null; }, 50);
    };

    const syncTimelineToGrid = () => {
      if (scrolling === 'grid') return;
      scrolling = 'timeline';
      grid.scrollTop = timeline.scrollTop;
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => { scrolling = null; }, 50);
    };

    grid.addEventListener('scroll', syncGridToTimeline);
    timeline.addEventListener('scroll', syncTimelineToGrid);
    return () => {
      grid.removeEventListener('scroll', syncGridToTimeline);
      timeline.removeEventListener('scroll', syncTimelineToGrid);
      clearTimeout(scrollTimeout);
    };
  }, []);

  const [rowHeights, setRowHeights] = useState({});
  const rowRefs = useRef({});

  useLayoutEffect(() => {
    const observer = new ResizeObserver((entries) => {
      setRowHeights(prev => {
        let changed = false;
        const next = { ...prev };
        for (let entry of entries) {
          const id = entry.target.dataset.taskid;
          if (id) {
            const h = entry.borderBoxSize ? entry.borderBoxSize[0].blockSize : entry.target.offsetHeight;
            if (next[id] !== h) {
              next[id] = h;
              changed = true;
            }
          }
        }
        return changed ? next : prev;
      });
    });

    const currentRefs = rowRefs.current;
    Object.values(currentRefs).forEach(el => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [tasks]);

  /* ── Timeline math ── */
  let minDate = null;
  let maxDate = null;
  tasks.forEach(t => {
    const taskStart = toDate(t.startDate);
    const taskEnd = toDate(t.endDate);
    if (taskStart && (!minDate || taskStart < minDate)) minDate = taskStart;
    if (taskEnd && (!maxDate || taskEnd > maxDate)) maxDate = taskEnd;
  });
  
  const today = new Date(new Date().setUTCHours(0, 0, 0, 0));
  
  // Fallback if somehow there are no dates
  if (!minDate) minDate = toDate(projectStart) || today;
  if (!maxDate) maxDate = new Date(minDate);

  maxDate.setUTCDate(maxDate.getUTCDate() + 21); // 3-week buffer

  const totalDays = Math.max(1, Math.round((maxDate - minDate) / DAY_MS));
  const DAY_WIDTH = viewMode === 'week' ? 12 : 3; // 12px/day for week view, 3px/day for month view
  const timelineWidth = totalDays * DAY_WIDTH;

  // Generate date array to build tiers
  const datesArray = [];
  let currentDate = new Date(minDate);
  for (let i = 0; i < totalDays; i++) {
    datesArray.push(new Date(currentDate));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  // Calculate Header Tiers (Year -> Month -> Week)
  const years = [];
  const months = [];
  const weeks = [];

  let currentYear = null;
  let yearDays = 0;

  let currentMonth = null;
  let monthDays = 0;

  let currentWeekNum = null;
  let weekDays = 0;

  for (let i = 0; i < totalDays; i++) {
    const d = datesArray[i];
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1; // 1 to 12
    const dateNum = d.getUTCDate(); // 1 to 31

    // Determine calendar week within the month (1, 2, 3, or 4)
    let wNum = 1;
    if (dateNum > 7 && dateNum <= 14) wNum = 2;
    else if (dateNum > 14 && dateNum <= 21) wNum = 3;
    else if (dateNum > 21) wNum = 4;

    // Year logic
    if (y !== currentYear) {
      if (currentYear !== null) years.push({ label: currentYear, days: yearDays });
      currentYear = y;
      yearDays = 0;
    }
    yearDays++;

    // Month logic
    if (m !== currentMonth) {
      if (currentMonth !== null) months.push({ label: currentMonth, days: monthDays });
      currentMonth = m;
      monthDays = 0;
    }
    monthDays++;

    // Week logic
    // Week changes either because wNum changed, OR month changed (so wNum resets or jumps)
    const tierWeekKey = `${y}-${m}-W${wNum}`;
    if (currentWeekNum !== tierWeekKey) {
      if (currentWeekNum !== null) weeks.push({ label: currentWeekNum.split('-W')[1], days: weekDays });
      currentWeekNum = tierWeekKey;
      weekDays = 0;
    }
    weekDays++;
  }

  // Push remainders
  if (yearDays > 0) years.push({ label: currentYear, days: yearDays });
  if (monthDays > 0) months.push({ label: currentMonth, days: monthDays });
  if (weekDays > 0) weeks.push({ label: currentWeekNum.split('-W')[1], days: weekDays });


  const getRightOffset = (dateStr) => {
    const d = toDate(dateStr);
    if (!d) return 0;
    const diff = (d - minDate) / DAY_MS;
    return diff * DAY_WIDTH;
  };

  const getWidth = (dur) => {
    return (Number(dur) || 0) * DAY_WIDTH;
  };

  /* ── Handlers ── */
  const handleChange = (id, field, rawValue) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    onUpdateTask({ ...task, [field]: rawValue });
  };

  const handleDependencyChange = (task, dependsOn) => {
    onUpdateTask({
      ...task,
      dependsOn: dependsOn || null,
      depType: dependsOn ? (task.depType || 'FS') : '',
      lag: dependsOn ? (task.lag || 0) : 0,
    });
  };

  const handleDepTypeChange = (task, depType) => {
    onUpdateTask({
      ...task,
      depType: depType || '',
    });
  };

  return (
    <div className="gantt-wrapper">
      {/* ════════════════ DATA GRID ════════════════ */}
      <div className="data-grid">
        {/* Header */}
        <div className="dg-header">
          <div className="dg-cell c-wbs">المعرّف</div>
          <div className="dg-cell c-name">الفقرة</div>
          <div className="dg-cell c-dur">الأيام</div>
          <div className="dg-cell c-qty">الكمية</div>
          <div className="dg-cell c-actq">المنفذ</div>
          <div className="dg-cell c-price">السعر</div>
          <div className="dg-cell c-amt">مبلغ الفقرة</div>
          <div className="dg-cell c-unit">الوحدة</div>
          <div className="dg-cell c-pct">الإنجاز</div>
          <div className="dg-cell c-date">تاريخ البدء</div>
          <div className="dg-cell c-date">تاريخ الانتهاء</div>
          <div className="dg-cell c-depid">السابقة</div>
          <div className="dg-cell c-deptype">العلاقة</div>
          <div className="dg-cell c-lag">الفجوة</div>
        </div>

        {/* Body */}
        <div className="dg-body" ref={gridBodyRef}>
          {tasks.map(task => {
            const isHovered = hoveredId === task.id;
            const warningText = task.warnings?.join('\n') || '';
            const depth = task.wbs ? (task.wbs.match(/\./g) || []).length : 0;
            const indentWidth = depth * 22;
            const wbsClass = depth === 0 ? "wbs-main" : "wbs-sub";
            
            // Render Group Row exactly like Excel
            if (task.isGroup) {
              return (
                <div 
                  key={task.id} 
                  data-taskid={task.id}
                  ref={el => rowRefs.current[task.id] = el}
                  className={`dg-row group ${task.warnings?.length ? 'has-warning' : ''} ${isHovered ? 'active' : ''}`}
                  onMouseEnter={() => setHoveredId(task.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="dg-cell c-wbs mono">
                    {task.warnings?.length > 0 && <span className="row-warning" title={warningText}>!</span>}
                    {isEditMode ? <input className="cell-input center" value={task.wbs || ''} onChange={e => handleChange(task.id, 'wbs', e.target.value)} /> : <span className={wbsClass}>{task.wbs}</span>}
                  </div>
                  <div className="dg-cell c-name" style={isEditMode ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } : { display: 'flex', alignItems: 'center' }}>
                    <div className="task-name-wrapper">
                      <div className="tree-indent" style={{ width: indentWidth }}></div>
                      {depth > 0 && <span className="tree-indicator">↳</span>}
                      {isEditMode ? <input className="cell-input" value={task.name || ''} onChange={e => handleChange(task.id, 'name', e.target.value)} style={{ fontWeight: 'bold', marginRight: '8px' }} /> : <strong title={task.name}>{task.name}</strong>}
                      {!isEditMode && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: 'auto' }}>
                          <button
                            className="jump-to-folder-btn"
                            onClick={(e) => { e.stopPropagation(); onJumpToTaskFolder?.(task); }}
                            title="عرض ملفات الفقرة"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', color: 'var(--apple-blue-action)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                          </button>
                          <button
                            className="jump-to-details-btn"
                            onClick={(e) => { e.stopPropagation(); onJumpToTaskDetails?.(task); }}
                            title="تفاصيل الفقرة والعناصر"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', color: 'var(--apple-blue-action)' }}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path></svg>
                          </button>
                        </div>
                      )}
                    </div>
                    {isEditMode && (
                      <div style={{ display: 'flex', gap: '8px', marginRight: 'auto' }}>
                        <button className="add-subtask-btn" onClick={() => onAddSubTask(task.id)}>
                          + فرعية
                        </button>
                        <button className="delete-task-btn" onClick={() => onDeleteTask(task.id)} title="حذف">
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="dg-cell c-dur">
                    <span className="center">{task.duration}</span>
                  </div>
                  <div className="dg-cell c-qty num">—</div>
                  <div className="dg-cell c-actq num">—</div>
                  <div className="dg-cell c-price num">—</div>
                  <div className="dg-cell c-amt num">{fmtNum(task.totalCost)}</div>
                  <div className="dg-cell c-unit center">—</div>
                  <div className="dg-cell c-pct">
                    <span className="progress-pill">
                      {fmtPct(task.progress)}
                    </span>
                  </div>
                  <div className="dg-cell c-date mono">{fmtDate(task.startDate)}</div>
                  <div className="dg-cell c-date mono">{fmtDate(task.endDate)}</div>
                  <div className="dg-cell c-depid center">—</div>
                  <div className="dg-cell c-deptype center">—</div>
                  <div className="dg-cell c-lag center">—</div>
                </div>
              );
            }

            return (
              <div
                key={task.id}
                data-taskid={task.id}
                ref={el => rowRefs.current[task.id] = el}
                className={`dg-row ${task.warnings?.length ? 'has-warning' : ''} ${isHovered ? 'active' : ''}`}
                onMouseEnter={() => setHoveredId(task.id)}
                onMouseLeave={() => setHoveredId(null)}
              >
                <div className="dg-cell c-wbs mono">
                  {task.warnings?.length > 0 && <span className="row-warning" title={warningText}>!</span>}
                  {isEditMode ? <input className="cell-input center" value={task.wbs || ''} onChange={e => handleChange(task.id, 'wbs', e.target.value)} /> : <span className={wbsClass}>{task.wbs}</span>}
                </div>
                <div className="dg-cell c-name" title={isEditMode ? undefined : task.name} style={isEditMode ? { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } : { display: 'flex', alignItems: 'center' }}>
                  <div className="task-name-wrapper">
                    <div className="tree-indent" style={{ width: indentWidth }}></div>
                    {depth > 0 && <span className="tree-indicator">↳</span>}
                    {isEditMode ? <input className="cell-input" value={task.name || ''} onChange={e => handleChange(task.id, 'name', e.target.value)} style={{ marginRight: '8px' }} /> : <span className="task-name-text">{task.name}</span>}
                    {!isEditMode && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginRight: 'auto' }}>
                        <button
                          className="jump-to-folder-btn"
                          onClick={(e) => { e.stopPropagation(); onJumpToTaskFolder?.(task); }}
                          title="عرض ملفات الفقرة"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', color: 'var(--apple-blue-action)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                        </button>
                        <button
                          className="jump-to-details-btn"
                          onClick={(e) => { e.stopPropagation(); onJumpToTaskDetails?.(task); }}
                          title="تفاصيل الفقرة والعناصر"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px', color: 'var(--apple-blue-action)' }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"></path></svg>
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditMode && (
                    <button className="delete-task-btn" onClick={() => onDeleteTask(task.id)} title="حذف" style={{ marginRight: 'auto' }}>
                      ✕
                    </button>
                  )}
                </div>
                <div className="dg-cell c-dur">
                  {isEditMode ? <input className="cell-input center" type="number" value={task.duration ?? ''} onChange={e => handleChange(task.id, 'duration', e.target.value)} /> : <span className="center">{task.duration}</span>}
                </div>
                <div className="dg-cell c-qty num">
                  {isEditMode ? (
                    task.boqLinked
                      ? <span className="locked-cell" title="تُدار من تفاصيل الفقرة (العناصر)">🔗 {fmtNum(task.quantity)}</span>
                      : isSigned
                        ? <span className="locked-cell" title="كمية تعاقدية معتمدة — تُعدّل عبر أمر تغيير">🔒 {fmtNum(task.quantity)}</span>
                        : <input className="cell-input center" type="number" value={task.quantity ?? ''} onChange={e => handleChange(task.id, 'quantity', e.target.value)} />
                  ) : fmtNum(task.quantity)}
                </div>
                <div className="dg-cell c-actq">
                  {isEditMode ? <input className="cell-input center" type="number" value={task.actualQuantity ?? ''} onChange={e => handleChange(task.id, 'actualQuantity', e.target.value)} /> : fmtNum(task.actualQuantity)}
                </div>
                <div className="dg-cell c-price num">
                  {isEditMode ? (
                    isSigned
                      ? <span className="locked-cell" title="سعر تعاقدي معتمد — يُعدّل عبر أمر تغيير">🔒 {fmtNum(task.unitPrice)}</span>
                      : <input className="cell-input center" type="number" value={task.unitPrice ?? ''} onChange={e => handleChange(task.id, 'unitPrice', e.target.value)} />
                  ) : fmtNum(task.unitPrice)}
                </div>
                <div className="dg-cell c-amt num">
                  {fmtNum(task.totalCost)}
                </div>
                <div className="dg-cell c-unit">
                  {isEditMode ? (
                    task.boqLinked
                      ? <span className="locked-cell" title="تُدار من تفاصيل الفقرة (العناصر)">🔗 {task.unit || '—'}</span>
                      : isSigned
                        ? <span className="locked-cell" title="وحدة تعاقدية معتمدة">🔒 {task.unit || '—'}</span>
                        : <input className="cell-input center" value={task.unit || ''} onChange={e => handleChange(task.id, 'unit', e.target.value)} />
                  ) : (task.unit || '—')}
                </div>
                <div className="dg-cell c-pct">
                  <span className="progress-pill">
                    {fmtPct(task.progress)}
                  </span>
                </div>
                <div className="dg-cell c-date mono">
                  {isEditMode && !task.dependsOn ? (
                    <input 
                      className="cell-input center mono" 
                      type="date" 
                      value={task.manualStart || ''} 
                      onChange={e => handleChange(task.id, 'manualStart', e.target.value)} 
                      style={{ padding: '0 2px', fontSize: '0.8rem' }}
                    />
                  ) : (
                    fmtDate(task.startDate)
                  )}
                </div>
                <div className="dg-cell c-date mono">{fmtDate(task.endDate)}</div>
                <div className="dg-cell c-depid">
                  {isEditMode ? (
                    <select
                      className="cell-select dependency-select"
                      value={task.dependsOn || ''}
                      onChange={e => handleDependencyChange(task, e.target.value)}
                    >
                      <option value="">بدون سابقة</option>
                      {task.dependsOn && !dependencyOptions.some(dep => dep.id === task.dependsOn) && (
                        <option value={task.dependsOn}>{getDependencyDisplay(task.dependsOn)}</option>
                      )}
                      {dependencyOptions
                        .filter(dep => dep.id !== task.id)
                        .map(dep => (
                          <option key={dep.id} value={dep.id}>
                            {getDependencyLabel(dep)}
                          </option>
                        ))}
                    </select>
                  ) : (
                    <span className="dependency-display" title={getDependencyDisplay(task.dependsOn)}>
                      {getDependencyDisplay(task.dependsOn)}
                    </span>
                  )}
                </div>
                <div className="dg-cell c-deptype">
                  {isEditMode ? 
                    <select
                      className="cell-select center relation-select"
                      value={task.depType || ''}
                      onChange={e => handleDepTypeChange(task, e.target.value)}
                      disabled={!task.dependsOn}
                    >
                      <option value="">—</option>
                      {Object.entries(DEP_TYPE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  : task.depType}
                </div>
                <div className="dg-cell c-lag">
                  {isEditMode ? (
                    <input
                      className="cell-input center"
                      type="number"
                      value={task.lag ?? 0}
                      onChange={e => handleChange(task.id, 'lag', e.target.value)}
                      disabled={!task.dependsOn}
                    />
                  ) : task.lag}
                </div>
              </div>
            );
          })}
          
          {isEditMode && (
            <div className="add-main-task-row">
              <button className="add-main-btn" onClick={onAddMainTask}>
                + إضافة مجموعة رئيسية جديدة
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="gantt-divider"></div>

      {/* ════════════════ TIMELINE ════════════════ */}
      <div className="timeline-panel" ref={timelineBodyRef}>
        
        {/* Multi-tier Header */}
        <div className="tl-header-container" style={{ width: `${timelineWidth}px` }}>
          {/* Year Tier */}
          <div className="tl-tier tier-year">
            {years.map((y, i) => (
              <div key={i} className="tl-tier-cell" style={{ width: `${y.days * DAY_WIDTH}px` }}>
                {y.label}
              </div>
            ))}
          </div>

          {/* Month Tier */}
          <div className="tl-tier tier-month" style={{ flex: viewMode === 'month' ? 1 : undefined }}>
            {months.map((m, i) => (
              <div key={i} className="tl-tier-cell" style={{ width: `${m.days * DAY_WIDTH}px` }}>
                {m.label}
              </div>
            ))}
          </div>

          {/* Week Tier (Only in Week View) */}
          {viewMode === 'week' && (
            <div className="tl-tier tier-week">
              {weeks.map((w, i) => (
                <div key={i} className="tl-tier-cell" style={{ width: `${w.days * DAY_WIDTH}px` }}>
                  {w.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="tl-body">
          <div className="tl-scroll-content" style={{ position: 'relative', width: `${timelineWidth}px`, minHeight: '100%' }}>
            {/* Gridlines perfectly aligned with boundaries */}
            <div className="tl-gridlines" aria-hidden="true">
               {viewMode === 'week' ? weeks.map((w, i) => (
                <div key={i} className="tl-gridline" style={{ width: `${w.days * DAY_WIDTH}px` }}></div>
              )) : months.map((m, i) => (
                <div key={i} className="tl-gridline" style={{ width: `${m.days * DAY_WIDTH}px` }}></div>
              ))}
            </div>

            {/* Today Line Indicator */}
            {(() => {
              const todayObj = new Date();
              const todayMs = Date.UTC(todayObj.getFullYear(), todayObj.getMonth(), todayObj.getDate());
              const minDateMs = minDate.getTime();
              const diffDays = (todayMs - minDateMs) / DAY_MS;
              
              // If today is within the timeline, show it. If it's past maxDate, clamp it to the far left.
              if (diffDays >= 0) {
                const rightOffset = Math.min(diffDays, totalDays) * DAY_WIDTH;
                const isOutOfBounds = diffDays > totalDays;
                return (
                  <div 
                    className="tl-today-line" 
                    style={{ 
                      right: `${rightOffset}px`, 
                      position: 'absolute', 
                      top: 0, 
                      bottom: 0, 
                      width: isOutOfBounds ? '4px' : '2px', 
                      backgroundColor: 'var(--apple-red)', 
                      zIndex: 10, 
                      pointerEvents: 'none',
                      opacity: isOutOfBounds ? 0.5 : 1
                    }}
                    title={isOutOfBounds ? "تاريخ اليوم (خارج نطاق المشروع)" : "تاريخ اليوم (نسبة الانجاز المخطط)"}
                  >
                    <div style={{ position: 'absolute', top: '-20px', right: '-4px', width: '10px', height: '10px', backgroundColor: 'var(--apple-red)', borderRadius: '50%' }}></div>
                  </div>
                );
              }
              return null;
            })()}

          {tasks.map((task, index) => {
            const isHovered = hoveredId === task.id;
            const right = getRightOffset(task.startDate);
            const width = getWidth(task.duration);
            const progressPct = (task.progress || 0) * 100;
            const plannedPct = (task.plannedProgress || 0) * 100;

            return (
              <div
                key={task.id}
                data-taskid={task.id}
                className={`tl-row ${isHovered ? 'active' : ''}`}
                onMouseEnter={() => setHoveredId(task.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{ height: rowHeights[task.id] ? `${rowHeights[task.id]}px` : undefined }}
              >
                {task.startDate && (
                  <div
                    className={`bar-container ${task.isGroup ? 'bar-group' : ''}`}
                    style={{
                      right: `${right}px`,
                      width: `${width}px`,
                    }}
                  >
                    {task.isGroup ? (
                      <div className="bar-group-shape">
                        <div className="bar-group-line"></div>
                        <div className="bar-group-diamond right"></div>
                        <div className="bar-group-diamond left"></div>
                      </div>
                    ) : (
                      <div className="bar-track">
                        <div
                          className="bar-fill"
                          style={{
                            width: `${progressPct}%`,
                            zIndex: 2
                          }}
                          title={`الانجاز الفعلي: ${progressPct.toFixed(1)}%`}
                        ></div>
                        <div
                          className="bar-planned-fill"
                          style={{
                            position: 'absolute',
                            top: '50%',
                            right: 0,
                            height: '4px',
                            marginTop: '-2px',
                            backgroundColor: '#fbbf24', /* Tailwind Yellow 400 */
                            boxShadow: '0 0 2px rgba(0,0,0,0.5)',
                            width: `${plannedPct}%`,
                            zIndex: 3,
                            borderRadius: '2px',
                            pointerEvents: 'none'
                          }}
                          title={`الانجاز المخطط: ${plannedPct.toFixed(1)}%`}
                        ></div>
                      </div>
                    )}

                    {/* Tooltip */}
                    {isHovered && !task.isGroup && (
                      <div 
                        className="bar-tooltip" 
                        style={index < 2 ? { top: 'calc(100% + 12px)', bottom: 'auto' } : { bottom: 'calc(100% + 12px)', top: 'auto' }}
                      >
                        <div className="tt-name">{task.name}</div>
                        <div className="tt-row">
                          <span>{fmtPct(task.progress)}</span>
                          <span className="tt-sep">|</span>
                          <span>{fmtDate(task.startDate)} → {fmtDate(task.endDate)}</span>
                        </div>
                        <div className="tt-row dim">
                          <span>{task.duration} يوم</span>
                          <span className="tt-sep">|</span>
                          <span>{fmtNum(task.actualQuantity)} / {fmtNum(task.quantity)} {task.unit}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
            
            {isEditMode && (
              <div style={{ height: '84px', flexShrink: 0 }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
