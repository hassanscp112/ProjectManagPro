import { useEffect, useMemo, useRef, useState } from 'react';
import { compactCurrency, formatNumber } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import './OrdersScreen.css';
import OrderTypePicker from './OrderTypePicker';
import TaskPicker from './TaskPicker';
import {
  ORDER_TYPES,
  ORDER_TYPE_LIST,
  ORDERS_STORAGE_KEY,
  REGISTRIES_STORAGE_KEY,
  addOrder,
  approveOrder as approveOrderInStore,
  createOrderDraft,
  createOrderId,
  daysAgoStr,
  deleteOrder as deleteOrderInStore,
  loadOrdersData,
  loadRegistries,
  normalizeWhoForSave,
  ordersInRange,
  resolveWhoLabel,
  sumExpenses,
  todayStr,
} from '../../utils/OrderEngine';

const fmtDateDisplay = (iso) => (typeof iso === 'string' && iso ? iso.split('-').reverse().join('/') : '—');

const WHO_KIND_OPTIONS = [
  { value: 'contractor', labelKey: 'orders.whoKindContractor' },
  { value: 'team', labelKey: 'orders.whoKindTeam' },
  { value: 'workers', labelKey: 'orders.whoKindWorkers' },
  { value: 'none', labelKey: 'orders.whoKindNone' },
];

const toNumberOrNull = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * OrdersScreen — the ONE dedicated order-entry screen.
 * Props: { tasks, identity } where tasks is the raw task array and
 * identity is { name, role } of the current user (may be missing).
 */
const OrdersScreen = ({ tasks = [], identity }) => {
  const { t, lang, dir } = useI18n();
  const fmtNum = (n) => formatNumber(n);
  const fmtCurrency = (n) => compactCurrency(n, lang);
  const [ordersData, setOrdersData] = useState(loadOrdersData);
  const [registries, setRegistries] = useState(loadRegistries);
  const [draft, setDraft] = useState(null);
  const [formError, setFormError] = useState('');
  const [saveFlash, setSaveFlash] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [approveTarget, setApproveTarget] = useState(null);
  const [approverName, setApproverName] = useState('');
  const [filters, setFilters] = useState({
    from: '',
    to: '',
    type: 'all',
    contractorId: 'all',
    taskId: 'all',
  });
  const flashTimerRef = useRef(null);

  const orders = ordersData.orders;

  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  // Live refresh when another tab/screen writes orders or registries.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === null || e.key === ORDERS_STORAGE_KEY) setOrdersData(loadOrdersData());
      if (e.key === null || e.key === REGISTRIES_STORAGE_KEY) setRegistries(loadRegistries());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const syncOrders = () => setOrdersData(loadOrdersData());

  const showFlash = (msg) => {
    clearTimeout(flashTimerRef.current);
    setSaveFlash(msg);
    flashTimerRef.current = setTimeout(() => setSaveFlash(''), 2600);
  };

  /* ─────────────── KPI strip ─────────────── */

  const today = todayStr();
  const weekStart = useMemo(() => daysAgoStr(6), []);

  const kpis = useMemo(() => {
    const todays = orders.filter((o) => o.date === today);
    const weekOrders = ordersInRange(orders, weekStart, today);
    const valueToday = todays.filter((o) => o.family === 'value');
    const valueWeek = weekOrders.filter((o) => o.family === 'value');
    const sumQty = (list) => list.reduce((sum, o) => sum + (Number(o.quantity) || 0), 0);
    return {
      todayValueCount: valueToday.length,
      todayQty: sumQty(valueToday),
      todayExpenses: sumExpenses(todays).total,
      weekValueCount: valueWeek.length,
      weekExpenses: sumExpenses(weekOrders).total,
      pendingApproval: orders.filter((o) => o.tier === 'formal' && o.status === 'recorded').length,
    };
  }, [orders, today, weekStart]);

  /* ─────────────── new-order draft ─────────────── */

  const spec = draft ? ORDER_TYPES[draft.type] : null;
  const selectedTask = draft && draft.taskId ? tasks.find((t) => t.id === draft.taskId) || null : null;

  const handleSelectType = (type) => {
    setFormError('');
    if (draft && draft.type === type) {
      setDraft(null);
      return;
    }
    setDraft(createOrderDraft(type, { tasks, lastWho: ordersData.lastWhoByType }));
  };

  const patchDraft = (patch) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const handleDraftTaskChange = (taskId) => {
    const task = tasks.find((t) => t.id === taskId) || null;
    // Autofill the unit from the task's BOQ unit; reset any stale element.
    patchDraft({ taskId, elementId: '', unit: task?.unit || '' });
  };

  const handleWhoKindChange = (kind) => {
    setDraft((d) => {
      if (!d) return d;
      const base = { kind };
      if (kind === 'contractor') {
        base.contractorId = d.who?.kind === 'contractor' ? d.who.contractorId || '' : '';
      } else if (kind === 'team') {
        base.teamId = d.who?.kind === 'team' ? d.who.teamId || '' : '';
      } else if (kind === 'workers') {
        base.workerIds = d.who?.kind === 'workers' ? [...(d.who.workerIds || [])] : [];
      }
      return { ...d, who: base };
    });
  };

  const handleWhoField = (patch) =>
    setDraft((d) => (d ? { ...d, who: { ...d.who, ...patch } } : d));

  const toggleWorker = (workerId) => {
    setDraft((d) => {
      if (!d) return d;
      const ids = d.who?.workerIds || [];
      const next = ids.includes(workerId)
        ? ids.filter((x) => x !== workerId)
        : [...ids, workerId];
      return { ...d, who: { ...d.who, kind: 'workers', workerIds: next } };
    });
  };

  const validateDraft = (d) => {
    const s = ORDER_TYPES[d.type];
    const missing = [];
    s.fields.forEach((f) => {
      if (!f.required) return;
      if (f.kind === 'task' && !d.taskId) missing.push(f.label);
      else if (f.kind === 'number' && !(Number(d.quantity) > 0)) missing.push(f.label);
      else if (f.kind === 'amount' && !(Number(d.amount) > 0)) missing.push(f.label);
      else if ((f.kind === 'text' || f.kind === 'note') && !String(d[f.key] || '').trim())
        missing.push(f.label);
      else if (f.kind === 'date' && !d.date) missing.push(f.label);
    });
    return missing;
  };

  const buildOrder = (d) => {
    const s = ORDER_TYPES[d.type];
    const task = tasks.find((t) => t.id === d.taskId) || null;
    const isValue = s.family === 'value';
    const isQuick = s.tier === 'quick';
    const details = {};
    ['location', 'sampleRef', 'result', 'depth', 'note'].forEach((k) => {
      const v = typeof d[k] === 'string' ? d[k].trim() : '';
      if (v) details[k] = v;
    });
    return {
      id: createOrderId(),
      type: d.type,
      family: s.family,
      tier: s.tier,
      date: d.date,
      recordedAt: new Date().toISOString(),
      recordedBy: identity?.name || '',
      taskId: task ? task.id : null,
      elementId: d.elementId || null,
      taskWbs: task?.wbs || '',
      taskName: task?.name || '',
      who: normalizeWhoForSave(d.who),
      quantity: isValue ? toNumberOrNull(d.quantity) : null,
      unit: isValue ? String(d.unit || '').trim() || task?.unit || null : null,
      amount: isValue ? null : toNumberOrNull(d.amount),
      category: isValue ? null : s.label,
      details,
      evidence: [],
      // Rule: quick orders are approved immediately; formal orders await approval.
      status: isQuick ? 'approved' : 'recorded',
      approvedBy: isQuick ? identity?.name || null : null,
    };
  };

  const handleSave = () => {
    if (!draft) return;
    const missing = validateDraft(draft);
    if (missing.length > 0) {
      setFormError(t('orders.fillRequired', { fields: missing.join(t('orders.listSep')) }));
      return;
    }
    setFormError('');
    const order = buildOrder(draft);
    addOrder(order);
    syncOrders();
    // Fast consecutive entry: re-seed the same type with fresh smart defaults
    // (the just-saved who/date become the new defaults).
    const lastWho = loadOrdersData().lastWhoByType;
    setDraft(createOrderDraft(draft.type, { tasks, lastWho }));
    showFlash(
      order.status === 'approved'
        ? t('orders.flashSavedApproved', { type: ORDER_TYPES[order.type].label })
        : t('orders.flashSaved', { type: ORDER_TYPES[order.type].label })
    );
  };

  const handleCancelDraft = () => {
    setDraft(null);
    setFormError('');
  };

  /* ─────────────── approve / delete ─────────────── */

  const handleApproveClick = (order) => {
    if (identity?.name) {
      approveOrderInStore(order.id, identity.name);
      syncOrders();
      showFlash(t('orders.flashApproved'));
    } else {
      setApproveTarget(order);
      setApproverName('');
    }
  };

  const confirmApprove = () => {
    if (!approveTarget) return;
    approveOrderInStore(approveTarget.id, approverName);
    syncOrders();
    setApproveTarget(null);
    showFlash(t('orders.flashApproved'));
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteOrderInStore(deleteTarget.id);
    syncOrders();
    setDeleteTarget(null);
    showFlash(t('orders.flashDeleted'));
  };

  /* ─────────────── log + filters ─────────────── */

  const leafTasks = useMemo(() => tasks.filter((t) => !t.isGroup), [tasks]);

  const filteredOrders = useMemo(() => {
    return orders
      .filter((o) => {
        if (!o) return false;
        if (filters.from && o.date < filters.from) return false;
        if (filters.to && o.date > filters.to) return false;
        if (filters.type !== 'all' && o.type !== filters.type) return false;
        if (filters.contractorId !== 'all') {
          if (o.who?.kind !== 'contractor' || o.who.contractorId !== filters.contractorId) return false;
        }
        if (filters.taskId !== 'all' && o.taskId !== filters.taskId) return false;
        return true;
      })
      .sort(
        (a, b) =>
          (b.date || '').localeCompare(a.date || '') ||
          (b.recordedAt || '').localeCompare(a.recordedAt || '')
      );
  }, [orders, filters]);

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const resetFilters = () =>
    setFilters({ from: '', to: '', type: 'all', contractorId: 'all', taskId: 'all' });
  const hasActiveFilters =
    !!filters.from ||
    !!filters.to ||
    filters.type !== 'all' ||
    filters.contractorId !== 'all' ||
    filters.taskId !== 'all';

  /* ─────────────── form field renderer (data-driven) ─────────────── */

  const renderField = (f) => {
    const fieldLabel = (
      <label className="ord-field-label">
        {f.label}
        {f.required && <span className="ord-req"> *</span>}
      </label>
    );

    if (f.kind === 'date') {
      return (
        <div className="ord-field" key={f.key}>
          {fieldLabel}
          <input
            type="date"
            className="ord-input"
            value={draft.date || ''}
            onChange={(e) => patchDraft({ date: e.target.value })}
          />
        </div>
      );
    }

    if (f.kind === 'task') {
      return (
        <div className="ord-field" key={f.key}>
          {fieldLabel}
          <TaskPicker
            tasks={tasks}
            orders={orders}
            value={draft.taskId}
            onChange={handleDraftTaskChange}
            optional={!f.required}
          />
        </div>
      );
    }

    if (f.kind === 'element') {
      const elements = Array.isArray(selectedTask?.elements) ? selectedTask.elements : [];
      return (
        <div className="ord-field" key={f.key}>
          {fieldLabel}
          <select
            className="ord-select"
            value={draft.elementId || ''}
            onChange={(e) => patchDraft({ elementId: e.target.value })}
            disabled={elements.length === 0}
          >
            <option value="">
              {elements.length === 0 ? t('orders.noElements') : t('orders.noElement')}
            </option>
            {elements.map((el) => (
              <option key={el.id} value={el.id}>
                {el.name || t('orders.elementFallback')}
                {el.location ? ` (${el.location})` : ''}
              </option>
            ))}
          </select>
        </div>
      );
    }

    if (f.kind === 'number') {
      return (
        <div className="ord-field" key={f.key}>
          {fieldLabel}
          <input
            type="number"
            className="ord-input ord-input-num"
            value={draft.quantity ?? ''}
            placeholder={f.placeholder || '0'}
            onChange={(e) => patchDraft({ quantity: e.target.value })}
          />
        </div>
      );
    }

    if (f.kind === 'unit') {
      return (
        <div className="ord-field ord-field-narrow" key={f.key}>
          {fieldLabel}
          <input
            className="ord-input ord-input-num"
            value={draft.unit || ''}
            placeholder={selectedTask?.unit || f.placeholder || t('orders.phUnit')}
            onChange={(e) => patchDraft({ unit: e.target.value })}
          />
        </div>
      );
    }

    if (f.kind === 'amount') {
      return (
        <div className="ord-field" key={f.key}>
          {fieldLabel}
          <div className="ord-amount-wrap">
            <input
              type="number"
              className="ord-input ord-input-num"
              value={draft.amount ?? ''}
              placeholder="0"
              onChange={(e) => patchDraft({ amount: e.target.value })}
            />
            <span className="ord-amount-suffix">{t('orders.currencySuffix')}</span>
          </div>
        </div>
      );
    }

    if (f.kind === 'text' || f.kind === 'note') {
      return (
        <div className={`ord-field ${f.kind === 'note' ? 'ord-field-wide' : ''}`} key={f.key}>
          {fieldLabel}
          <input
            className="ord-input"
            value={draft[f.key] || ''}
            placeholder={f.placeholder || ''}
            onChange={(e) => patchDraft({ [f.key]: e.target.value })}
          />
        </div>
      );
    }

    if (f.kind === 'who') {
      if (f.mode === 'contractor') {
        const contractorId = draft.who?.kind === 'contractor' ? draft.who.contractorId || '' : '';
        return (
          <div className="ord-field" key={f.key}>
            {fieldLabel}
            <select
              className="ord-select"
              value={contractorId}
              onChange={(e) => handleWhoField({ kind: 'contractor', contractorId: e.target.value })}
            >
              <option value="">{t('orders.noContractor')}</option>
              {registries.contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` — ${c.phone}` : ''}
                </option>
              ))}
            </select>
          </div>
        );
      }

      const whoKind = draft.who?.kind || 'none';
      const workerIds = draft.who?.workerIds || [];
      return (
        <div className="ord-field ord-field-wide" key={f.key}>
          {fieldLabel}
          <div className="ord-who">
            <div className="ord-who-switch">
              {WHO_KIND_OPTIONS.map((k) => (
                <button
                  type="button"
                  key={k.value}
                  className={`ord-who-chip ${whoKind === k.value ? 'active' : ''}`}
                  onClick={() => handleWhoKindChange(k.value)}
                >
                  {t(k.labelKey)}
                </button>
              ))}
            </div>
            {whoKind === 'contractor' && (
              <select
                className="ord-select"
                value={draft.who?.contractorId || ''}
                onChange={(e) => handleWhoField({ contractorId: e.target.value })}
              >
                <option value="">{t('orders.chooseContractor')}</option>
                {registries.contractors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
            {whoKind === 'team' && (
              <select
                className="ord-select"
                value={draft.who?.teamId || ''}
                onChange={(e) => handleWhoField({ teamId: e.target.value })}
              >
                <option value="">{t('orders.chooseTeam')}</option>
                {registries.teams.map((team) => (
                  <option key={team.id} value={team.id}>
                    {team.name}
                  </option>
                ))}
              </select>
            )}
            {whoKind === 'workers' && (
              <div className="ord-workers-box">
                {registries.workers.length === 0 ? (
                  <span className="ord-workers-empty">{t('orders.noWorkers')}</span>
                ) : (
                  registries.workers.map((w) => (
                    <label key={w.id} className="ord-worker-row">
                      <input
                        type="checkbox"
                        checked={workerIds.includes(w.id)}
                        onChange={() => toggleWorker(w.id)}
                      />
                      <span>{w.name}</span>
                      {w.trade && <span className="ord-worker-trade">{w.trade}</span>}
                    </label>
                  ))
                )}
              </div>
            )}
            {whoKind === 'none' && <span className="ord-who-none">{t('orders.noRecipient')}</span>}
          </div>
        </div>
      );
    }

    return null;
  };

  /* ─────────────── render ─────────────── */

  return (
    <div className="orders-screen" dir={dir}>
      {/* ── KPI strip ── */}
      <div className="compact-kpi-strip">
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('orders.kpiTodayOrders')}</span>
          <span className="kpi-compact-value">{kpis.todayValueCount}</span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('orders.kpiTodayQty')}</span>
          <span className="kpi-compact-value">{fmtNum(kpis.todayQty)}</span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('orders.kpiTodayExpenses')}</span>
          <span className="kpi-compact-value">{fmtCurrency(kpis.todayExpenses)}</span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('orders.kpiWeekOrders')}</span>
          <span className="kpi-compact-value">{kpis.weekValueCount}</span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('orders.kpiWeekExpenses')}</span>
          <span className="kpi-compact-value">{fmtCurrency(kpis.weekExpenses)}</span>
        </div>
        <div className={`kpi-compact-card ${kpis.pendingApproval ? 'warning' : ''}`}>
          <span className="kpi-compact-label">{t('common.pending')}</span>
          <span className="kpi-compact-value">{kpis.pendingApproval}</span>
        </div>
      </div>

      {/* ── New order ── */}
      <section className="ord-section-card">
        <div className="ord-card-head">
          <div>
            <h3 className="ord-card-title">{t('orders.newOrder')}</h3>
            <p className="ord-card-sub">{t('orders.newOrderSub')}</p>
          </div>
          {saveFlash && <span className="ord-flash">{saveFlash}</span>}
        </div>

        <OrderTypePicker value={draft?.type || ''} onSelect={handleSelectType} />

        {draft && spec ? (
          <div className="ord-form">
            <div className="ord-form-grid">{spec.fields.map(renderField)}</div>
            {formError && <div className="ord-error">{formError}</div>}
            <div className="ord-actions">
              <button type="button" className="apple-btn primary" onClick={handleSave}>
                {t('orders.saveOrder')}
              </button>
              <button type="button" className="apple-btn secondary" onClick={handleCancelDraft}>
                {t('common.cancel')}
              </button>
              <span className="ord-tier-hint">
                {spec.tier === 'quick' ? t('orders.quickTierHint') : t('orders.formalTierHint')}
              </span>
            </div>
          </div>
        ) : (
          !saveFlash && <div className="ord-hint">{t('orders.pickTypeHint')}</div>
        )}
      </section>

      {/* ── Orders log ── */}
      <section className="ord-section-card">
        <div className="ord-card-head">
          <div>
            <h3 className="ord-card-title">{t('orders.logTitle')}</h3>
            <p className="ord-card-sub">
              {t('orders.logCount', { count: filteredOrders.length })}
              {hasActiveFilters ? ` (${t('orders.filteredTag')})` : ''}
            </p>
          </div>
          {hasActiveFilters && (
            <button type="button" className="apple-btn secondary" onClick={resetFilters}>
              {t('orders.clearFilters')}
            </button>
          )}
        </div>

        <div className="ord-filters">
          <div className="ord-field">
            <label className="ord-field-label">{t('orders.fromDate')}</label>
            <input
              type="date"
              className="ord-input"
              value={filters.from}
              onChange={(e) => setFilter('from', e.target.value)}
            />
          </div>
          <div className="ord-field">
            <label className="ord-field-label">{t('orders.toDate')}</label>
            <input
              type="date"
              className="ord-input"
              value={filters.to}
              onChange={(e) => setFilter('to', e.target.value)}
            />
          </div>
          <div className="ord-field">
            <label className="ord-field-label">{t('common.type')}</label>
            <select
              className="ord-select"
              value={filters.type}
              onChange={(e) => setFilter('type', e.target.value)}
            >
              <option value="all">{t('orders.allTypes')}</option>
              {ORDER_TYPE_LIST.map((ot) => (
                <option key={ot.type} value={ot.type}>
                  {ot.label}
                </option>
              ))}
            </select>
          </div>
          <div className="ord-field">
            <label className="ord-field-label">{t('orders.contractor')}</label>
            <select
              className="ord-select"
              value={filters.contractorId}
              onChange={(e) => setFilter('contractorId', e.target.value)}
            >
              <option value="all">{t('orders.allParties')}</option>
              {registries.contractors.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="ord-field">
            <label className="ord-field-label">{t('orders.task')}</label>
            <select
              className="ord-select"
              value={filters.taskId}
              onChange={(e) => setFilter('taskId', e.target.value)}
            >
              <option value="all">{t('orders.allTasks')}</option>
              {leafTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.wbs} — {task.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="ord-table-wrap">
          {filteredOrders.length === 0 ? (
            <div className="ord-empty">{t('orders.noMatching')}</div>
          ) : (
            <table className="ord-table">
              <thead>
                <tr>
                  <th>{t('common.date')}</th>
                  <th>{t('common.type')}</th>
                  <th>{t('orders.task')}</th>
                  <th>{t('orders.party')}</th>
                  <th>{t('orders.qtyOrAmount')}</th>
                  <th>{t('common.status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="ord-num">{fmtDateDisplay(o.date)}</td>
                    <td>
                      <span className={`ord-badge ${o.family}`}>
                        {ORDER_TYPES[o.type]?.label || o.type}
                      </span>
                    </td>
                    <td className="ord-task-cell">
                      {o.taskId ? (
                        <>
                          <span className="ord-task-wbs">{o.taskWbs}</span> {o.taskName}
                        </>
                      ) : (
                        o.details?.location || '—'
                      )}
                    </td>
                    <td>{resolveWhoLabel(o.who, registries)}</td>
                    <td className="ord-num">
                      {o.family === 'value'
                        ? o.quantity != null
                          ? `${fmtNum(o.quantity)}${o.unit ? ` ${o.unit}` : ''}`
                          : o.details?.result || '—'
                        : o.amount != null
                          ? fmtCurrency(o.amount)
                          : '—'}
                    </td>
                    <td>
                      <span className={`ord-status ${o.status}`}>
                        {o.status === 'approved' ? t('common.approved') : t('common.recorded')}
                      </span>
                    </td>
                    <td>
                      <div className="ord-row-actions">
                        {o.tier === 'formal' && o.status === 'recorded' && (
                          <button
                            type="button"
                            className="ord-row-btn approve"
                            onClick={() => handleApproveClick(o)}
                            title={t('orders.approveOrder')}
                          >
                            ✓ {t('common.approve')}
                          </button>
                        )}
                        <button
                          type="button"
                          className="ord-row-btn danger"
                          onClick={() => setDeleteTarget(o)}
                          title={t('orders.deleteOrder')}
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">!</div>
            <h3 className="modal-title">{t('orders.deleteConfirmTitle')}</h3>
            <p className="modal-text">
              {t('orders.deleteConfirmText', {
                type: ORDER_TYPES[deleteTarget.type]?.label || t('orders.theOrder'),
                date: fmtDateDisplay(deleteTarget.date),
                taskRef: deleteTarget.taskName
                  ? ` (${deleteTarget.taskWbs} ${deleteTarget.taskName})`
                  : '',
              })}
            </p>
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setDeleteTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="apple-btn destructive" onClick={confirmDelete}>
                {t('orders.deleteOrder')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Approve modal (only when no signed-in identity name) ── */}
      {approveTarget && (
        <div className="modal-overlay" onClick={() => setApproveTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">✅</div>
            <h3 className="modal-title">{t('orders.approveOrder')}</h3>
            <p className="modal-text">
              {t('orders.approveText', {
                type: ORDER_TYPES[approveTarget.type]?.label || t('orders.theOrder'),
                date: fmtDateDisplay(approveTarget.date),
              })}
            </p>
            <input
              className="modal-input"
              placeholder={t('orders.approverPlaceholder')}
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
            />
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setApproveTarget(null)}>
                {t('common.cancel')}
              </button>
              <button className="apple-btn primary" onClick={confirmApprove}>
                {t('common.approve')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersScreen;
