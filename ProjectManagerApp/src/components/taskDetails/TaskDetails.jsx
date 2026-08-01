import { useMemo } from 'react';
import './TaskDetails.css';

const STATUS_OPTIONS = [
  { value: 'not_started', label: 'لم يبدأ', color: '#6B7280' },
  { value: 'in_progress', label: 'قيد التنفيذ', color: '#0284C7' },
  { value: 'completed', label: 'مكتمل', color: '#16A34A' },
  { value: 'on_hold', label: 'متوقف', color: '#EA580C' },
];

const STATUS_MAP = STATUS_OPTIONS.reduce((acc, s) => { acc[s.value] = s; return acc; }, {});

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
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n);
};

const TaskDetails = ({ task, allTasks, computedTasks, isSigned, onUpdateTask, onToggleBoqLink, onLinkExistingBoq, onAddSubTask, onDeleteTask, onJumpToTaskDetails, onBack }) => {
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

  if (!task) {
    return (
      <div className="task-details" dir="rtl">
        <div className="td-empty">لا توجد فقرة محددة.</div>
      </div>
    );
  }

  /* ---------- mutate helpers ---------- */
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
    if (!window.confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;
    patchTask({ elements: elements.filter((el) => el.id !== id) });
  };

  /* ----- columns (quantity types) ----- */
  const addColumn = (preset) => {
    const newCol = {
      id: uid(),
      name: preset?.name || 'نوع كمية',
      unit: preset?.unit || 'م3',
      wasteFactorPct: 0,
      linkedTaskId: null,
    };
    patchTask({ elementColumns: [...columns, newCol] });
  };

  const addDefaultColumns = () => {
    const defaults = [
      { name: 'C25', unit: 'م3' },
      { name: 'C20', unit: 'م3' },
      { name: 'C7', unit: 'م3' },
    ];
    const newCols = defaults.map((d) => ({ id: uid(), ...d, linkedTaskId: null }));
    patchTask({ elementColumns: [...columns, ...newCols] });
  };

  const updateColumn = (id, patch) => {
    patchTask({ elementColumns: columns.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  };

  const deleteColumn = (col) => {
    if (!window.confirm(`حذف نوع الكمية "${col.name}"؟ سيتم حذف قيمه من جميع العناصر.`)) return;
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

  /* ---------- render ---------- */
  return (
    <div className="task-details" dir="rtl">
      {/* Header */}
      <div className="td-header">
        <button className="td-back-btn" onClick={onBack} title="رجوع إلى الجدول">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          رجوع
        </button>
        <div className="td-title-block">
          <span className="td-wbs">{task.wbs || '—'}</span>
          <h2 className="td-title">{task.name || 'فقرة بدون اسم'}</h2>
        </div>
        <div className="td-header-badges">
          <span className="td-badge">{elements.length} عنصر</span>
          <span className="td-badge">{columns.length} نوع كمية</span>
          <span className="td-badge accent">{linkedCount} بند كميات</span>
        </div>
      </div>

      {/* Help banner */}
      <div className="td-help-banner">
        <strong>كيف يعمل هذا؟</strong> أضف العناصر (مثل المنظمات) وأدخل كمياتها حسب النوع
        (C25، C20، C7 ...). سيُحسب المجموع تلقائياً لكل نوع، ومن خلال تفعيل
        <span className="td-help-key"> بند الكميات </span>
        يُنشأ بند فرعي في الجدول (BOQ) ترتبط كميته بهذا المجموع مباشرةً.
      </div>

      {/* Summary cards */}
      <div className="td-summary">
        <div className="td-sum-card">
          <span className="td-sum-label">عدد العناصر</span>
          <span className="td-sum-value">{elements.length}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">مكتملة</span>
          <span className="td-sum-value" style={{ color: '#16A34A' }}>{statusCounts.completed}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">قيد التنفيذ</span>
          <span className="td-sum-value" style={{ color: '#0284C7' }}>{statusCounts.in_progress}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">بنود الكميات المرتبطة</span>
          <span className="td-sum-value">{linkedCount}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">مجموع الكميات</span>
          <span className="td-sum-value">{fmt(totalAllQuantities)}</span>
        </div>
        <div className="td-sum-card">
          <span className="td-sum-label">البنود الفرعية</span>
          <span className="td-sum-value">{directChildren.length}</span>
        </div>
      </div>

      {/* Sub-tasks (bidirectional): all direct children of this task,
           whether created via BOQ checkboxes here or added in the Gantt grid. */}
      {task.isGroup && (
        <div className="td-section">
          <div className="td-section-head">
            <h3>
              البنود الفرعية <span className="td-section-count">({directChildren.length})</span>
            </h3>
            <div className="td-section-actions">
              <button className="td-btn" onClick={() => onAddSubTask?.(task.id)}>
                + إضافة بند فرعي
              </button>
            </div>
          </div>

          {directChildren.length === 0 ? (
            <div className="td-card-empty">
              لا توجد بنود فرعية بعد. أضفها من هنا أو مباشرةً من الجدول — ستظهر هنا تلقائياً.
            </div>
          ) : (
            <div className="td-children-table-wrap">
              <table className="td-children-table">
                <thead>
                  <tr>
                    <th>الرمز</th>
                    <th>الاسم</th>
                    <th>الكمية التعاقدية</th>
                    <th>المنفذة</th>
                    <th>الانحراف</th>
                    <th>الوحدة</th>
                    <th>سعر الوحدة</th>
                    <th>النوع</th>
                    <th>التقدم</th>
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
                            placeholder="اسم البند"
                          />
                        </td>
                        <td className="td-num">
                          {contractLocked ? (
                            <div className="td-locked-stack" title={isBoq ? 'تُدار من مجموع عناصر الفقرة' : 'كمية تعاقدية معتمدة'}>
                              <span className="td-locked-val">{isBoq ? '🔗 ' : '🔒 '}{fmt(c.quantity)}</span>
                              {isBoq && c.elementSum != null && (
                                <span className={`td-recon ${Math.abs(reconDelta) < 0.001 ? 'ok' : 'warn'}`}>
                                  مجموع العناصر: {fmt(c.elementSum)}
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
                          <input
                            className="td-input td-input-num"
                            type="number"
                            value={child.actualQuantity ?? ''}
                            onChange={(e) => patchChild(child, { actualQuantity: e.target.value === '' ? '' : toNum(e.target.value) })}
                            placeholder="0"
                          />
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
                              placeholder="م3"
                            />
                          )}
                        </td>
                        <td className="td-num">
                          {isSigned ? (
                            <span className="td-locked-val" title="سعر تعاقدي معتمد">🔒 {fmt(child.unitPrice)}</span>
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
                            <span className="td-type-badge group">مجموعة</span>
                          ) : isBoq ? (
                            <span className="td-type-badge boq" title={linkedCol ? `مرتبط بنوع الكمية: ${linkedCol.name}` : ''}>
                              BOQ{linkedCol ? ` · ${linkedCol.name}` : ''}
                            </span>
                          ) : (
                            <span className="td-type-badge manual">يدوي</span>
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
                                title="فتح تفاصيل هذا البند"
                              >
                                ≡
                              </button>
                            )}
                            <button
                              className="td-icon-btn danger"
                              onClick={() => onDeleteTask?.(child.id)}
                              title="حذف البند"
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
          <h3>أنواع الكميات والمجاميع</h3>
          <div className="td-section-actions">
            <button className="td-btn ghost" onClick={addDefaultColumns} disabled={columns.length > 0}>
              + أنواع افتراضية (C25/C20/C7)
            </button>
            <button className="td-btn" onClick={() => addColumn()}>+ نوع كمية</button>
          </div>
        </div>

        {columns.length === 0 ? (
          <div className="td-card-empty">
            لا توجد أنواع كميات بعد. اضغط «+ نوع كمية» أو «أنواع افتراضية» للبدء.
          </div>
        ) : (
          <div className="td-types-table-wrap">
            <table className="td-types-table">
              <thead>
                <tr>
                  <th>نوع الكمية</th>
                  <th>الوحدة</th>
                  <th>هدر %</th>
                  <th>المجموع (مع الهدر)</th>
                  <th>بند الكميات (BOQ)</th>
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
                          placeholder="مثال: C25"
                        />
                      </td>
                      <td>
                        <input
                          className="td-input td-input-unit"
                          value={col.unit || ''}
                          onChange={(e) => updateColumn(col.id, { unit: e.target.value })}
                          placeholder="م3"
                        />
                      </td>
                      <td>
                        <input
                          className="td-input td-input-waste"
                          type="number"
                          min="0"
                          value={col.wasteFactorPct ?? 0}
                          onChange={(e) => updateColumn(col.id, { wasteFactorPct: toNum(e.target.value) })}
                          title="نسبة الهدر/الفاقد (مثال: 5 تعني +5% على المجموع)"
                        />
                      </td>
                      <td className="td-num td-sum-cell">
                        <span className="td-sum-eff">
                          {fmt(sums[col.id] * (1 + toNum(col.wasteFactorPct) / 100))}
                        </span>
                        {toNum(col.wasteFactorPct) > 0 && (
                          <span className="td-sum-raw">الخام: {fmt(sums[col.id])}</span>
                        )}
                      </td>
                      <td>
                        {task.isGroup ? (
                          linked ? (
                            <div className="td-boq-linked">
                              <span className="td-boq-text">
                                {linkedTask ? `${linkedTask.wbs || ''} ${linkedTask.name || ''}` : 'مرتبط'}
                              </span>
                              <button
                                className="td-btn ghost xs"
                                onClick={() => handleBoqCheck(col, false)}
                                title="فصل البند (يبقى موجوداً ويحتفظ بآخر قيمة)"
                              >
                                ✕ فصل
                              </button>
                            </div>
                          ) : (
                            <div className="td-boq-actions">
                              <button
                                className="td-btn ghost xs"
                                onClick={() => handleBoqCheck(col, true)}
                                title="إنشاء بند كميات جديد ومربوط بالمجموع"
                              >
                                ＋ بند جديد
                              </button>
                              {linkableLeaves.length > 0 && (
                                <select
                                  className="td-boq-link-select"
                                  value=""
                                  onChange={(e) => {
                                    if (e.target.value) onLinkExistingBoq?.(task.id, col, e.target.value);
                                  }}
                                  title="ربط المجموع ببند كميات موجود مسبقاً (القيمة التعاقدية تبقى كما هي للمطابقة)"
                                >
                                  <option value="">🔗 ربط ببند موجود…</option>
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
                          <span className="td-muted">سجل فقط</span>
                        )}
                      </td>
                      <td>
                        <button className="td-icon-btn danger" onClick={() => deleteColumn(col)} title="حذف النوع">✕</button>
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
          <h3>العناصر</h3>
          <div className="td-section-actions">
            <button className="td-btn" onClick={addElement} disabled={columns.length === 0}>+ إضافة عنصر</button>
          </div>
        </div>

        {columns.length === 0 ? (
          <div className="td-card-empty">
            أضف نوع كمية واحداً على الأقل قبل إدخال العناصر.
          </div>
        ) : elements.length === 0 ? (
          <div className="td-card-empty">
            لا توجد عناصر بعد. اضغط «+ إضافة عنصر» لإضافة أول عنصر (مثلاً منظم رقم 1 مع موقعه وكمياته).
          </div>
        ) : (
          <div className="td-elements-table-wrap">
            <table className="td-elements-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>الاسم</th>
                  <th>الموقع / المحطة</th>
                  <th>الحالة</th>
                  {columns.map((c) => (
                    <th key={c.id} className="td-num">{c.name} {c.unit ? `(${c.unit})` : ''}</th>
                  ))}
                  <th>ملاحظات</th>
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
                          placeholder="مثال: HR-1"
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
                          style={{ borderRight: `3px solid ${st.color}` }}
                        >
                          {STATUS_OPTIONS.map((s) => (
                            <option key={s.value} value={s.value}>{s.label}</option>
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
                        <button className="td-icon-btn danger" onClick={() => deleteElement(el.id)} title="حذف العنصر">✕</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="td-num td-foot-label">المجموع</td>
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
    </div>
  );
};

export default TaskDetails;
