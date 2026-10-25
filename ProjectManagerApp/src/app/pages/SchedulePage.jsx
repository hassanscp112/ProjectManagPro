// Gantt page — the old App.jsx "gantt" tab, moved verbatim (legacy markup
// and classes) onto its own route. Rebuilt with src/ui in Phase 4.

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import GanttChart from '../../components/GanttChart';
import { compactCurrency } from '../../i18n/index.js';
import { useI18n } from '../../i18n/useI18n.js';
import { EMPTY_VO_DRAFT, PROJECT_START, STATUS_KEYS, VO_CLASS_KEYS } from '../../state/projectModel.js';
import { useProject } from '../../state/projectContext.js';
import { exportAppData, readBackupFile, restoreAppData, validateBackup } from '../../utils/DataIO';
import { Page } from '../Page.jsx';

export default function SchedulePage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const {
    tasks,
    projectMeta,
    engineResult,
    updateTask,
    addMainTask,
    addSubTask,
    requestDeleteTask,
    undo,
    canUndo,
    ganttView,
    setGanttView,
    signOff,
    setStatus,
    raiseVariation,
  } = useProject();
  const { isEditMode, viewMode } = ganttView;
  const setIsEditMode = (on) => setGanttView((v) => ({ ...v, isEditMode: on }));
  const setViewMode = (mode) => setGanttView((v) => ({ ...v, viewMode: mode }));

  const [signOffOpen, setSignOffOpen] = useState(false);
  const [signOffBy, setSignOffBy] = useState('');
  const [voOpen, setVoOpen] = useState(false);
  const [voDraft, setVoDraft] = useState(EMPTY_VO_DRAFT);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreInfo, setRestoreInfo] = useState(null);
  const fileInputRef = useRef(null);
  const pendingRestoreRef = useRef(null);

  const formatCurrency = (val) => compactCurrency(val, lang);
  const voClassLabel = (c) => (VO_CLASS_KEYS[c] ? t(VO_CLASS_KEYS[c]) : c);

  const handleRaiseVariation = () => {
    if (raiseVariation(voDraft)) setVoDraft(EMPTY_VO_DRAFT);
  };

  // Trigger a JSON download of all app data (tasks, baseline, finance, …).
  const handleExport = () => {
    const filename = exportAppData();
    console.log('Backup exported:', filename);
  };

  // File chosen → read + validate, then confirm before applying.
  const handleImportFile = async (event) => {
    const file = event.target.files && event.target.files[0];
    if (event.target) event.target.value = ''; // same file again re-fires onChange
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

  // Confirmed → write to localStorage and reload so everything re-initializes.
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

  const toggleStyle = (on) => ({
    padding: '4px 12px',
    borderRadius: '6px',
    border: 'none',
    background: on ? 'var(--apple-blue-action)' : 'transparent',
    color: on ? '#fff' : 'var(--text-secondary)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    transition: 'all 0.2s',
  });

  return (
    <Page area="schedule" fill>
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
          <span
            className={`kpi-compact-value ${engineResult.projectDeviation < 0 ? 'negative-deviation' : 'positive-deviation'}`}
            style={{ color: engineResult.projectDeviation < 0 ? 'var(--apple-red)' : 'var(--apple-green)' }}
          >
            {engineResult.projectDeviation > 0 ? '+' : ''}
            {engineResult.projectDeviation.toFixed(2)}%
          </span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('app.kpi.duration')}</span>
          <span className="kpi-compact-value">
            {engineResult.projectDuration} {t('app.kpi.days')}
          </span>
        </div>
        <div className="kpi-compact-card">
          <span className="kpi-compact-label">{t('app.kpi.activeItems')}</span>
          <span className="kpi-compact-value">{engineResult.tasks.filter((x) => !x.isGroup).length}</span>
        </div>
        <div className={`kpi-compact-card ${engineResult.warnings.length ? 'warning' : ''}`}>
          <span className="kpi-compact-label">{t('app.kpi.warnings')}</span>
          <span className="kpi-compact-value">{engineResult.warnings.length}</span>
        </div>
      </div>

      {/* Workspace Toolbar */}
      <div className="workspace-toolbar" style={{ gap: '12px' }}>
        <div className="project-lifecycle-control">
          {projectMeta.status === 'draft' ? (
            <button
              className="apple-btn primary"
              onClick={() => {
                setSignOffBy('');
                setSignOffOpen(true);
              }}
            >
              {t('app.toolbar.signOff')}
            </button>
          ) : (
            <>
              <span className={`project-status-badge status-${projectMeta.status}`}>
                {STATUS_KEYS[projectMeta.status] ? t(STATUS_KEYS[projectMeta.status]) : projectMeta.status}
              </span>
              {projectMeta.status === 'signed' && (
                <button className="apple-btn secondary" onClick={() => setStatus('executing')}>
                  {t('app.toolbar.startExecution')}
                </button>
              )}
              {projectMeta.status === 'executing' && (
                <button className="apple-btn secondary" onClick={() => setStatus('completed')}>
                  {t('app.toolbar.complete')}
                </button>
              )}
              <button
                className="apple-btn secondary"
                onClick={() => {
                  setSignOffBy(projectMeta.baseline?.signedBy || '');
                  setSignOffOpen(true);
                }}
                title={t('app.toolbar.reBaselineTitle')}
              >
                {t('app.toolbar.reBaseline')}
              </button>
              <button className="apple-btn secondary" onClick={() => setVoOpen(true)} title={t('app.toolbar.voTitle')}>
                {t('app.toolbar.voButton')} ({(projectMeta.variations || []).length})
              </button>
            </>
          )}
        </div>
        <div
          className="view-mode-toggle"
          style={{
            display: 'flex',
            background: 'var(--bg-surface)',
            padding: '2px',
            borderRadius: '8px',
            border: '1px solid var(--border-soft)',
            marginRight: 'auto',
          }}
        >
          <button className={`toggle-btn ${viewMode === 'week' ? 'active' : ''}`} onClick={() => setViewMode('week')} style={toggleStyle(viewMode === 'week')}>
            {t('app.toolbar.weeks')}
          </button>
          <button className={`toggle-btn ${viewMode === 'month' ? 'active' : ''}`} onClick={() => setViewMode('month')} style={toggleStyle(viewMode === 'month')}>
            {t('app.toolbar.months')}
          </button>
        </div>

        {isEditMode && canUndo && (
          <button className="apple-btn secondary" onClick={undo} title={t('app.toolbar.undoTitle')}>
            {t('app.toolbar.undo')}
          </button>
        )}
        <button className="apple-btn secondary" onClick={handleExport} title={t('app.toolbar.backupTitle')}>
          {t('app.toolbar.backup')}
        </button>
        <button className="apple-btn secondary" onClick={() => fileInputRef.current?.click()} title={t('app.toolbar.restoreTitle')}>
          {t('app.toolbar.restore')}
        </button>
        <button className={`apple-btn ${isEditMode ? 'primary' : 'secondary'}`} onClick={() => setIsEditMode(!isEditMode)}>
          {isEditMode ? t('app.toolbar.endEdit') : t('app.toolbar.editMode')}
        </button>
      </div>

      {/* Hidden file input for backup restore */}
      <input type="file" accept="application/json,.json" ref={fileInputRef} onChange={handleImportFile} style={{ display: 'none' }} />

      <div className="gantt-full-wrapper">
        <GanttChart
          tasks={engineResult.tasks}
          onUpdateTask={updateTask}
          projectStart={PROJECT_START}
          isEditMode={isEditMode}
          isSigned={!!projectMeta.baseline}
          viewMode={viewMode}
          onAddMainTask={addMainTask}
          onAddSubTask={addSubTask}
          onDeleteTask={requestDeleteTask}
          onJumpToTaskFolder={(task) => navigate(`/library/files/${encodeURIComponent(task.id)}`)}
          onJumpToTaskDetails={(task) => navigate(`/schedule/task/${encodeURIComponent(task.id)}`)}
        />
      </div>

      {/* ── SIGN-OFF MODAL ── */}
      {signOffOpen && (
        <div className="modal-overlay" onClick={() => setSignOffOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">🔒</div>
            <h3 className="modal-title">{t('app.modal.signOffTitle')}</h3>
            <p className="modal-text">{t('app.modal.signOffText')}</p>
            <input className="modal-input" placeholder={t('app.modal.signOffName')} value={signOffBy} onChange={(e) => setSignOffBy(e.target.value)} />
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setSignOffOpen(false)}>
                {t('common.cancel')}
              </button>
              <button
                className="apple-btn primary"
                onClick={() => {
                  signOff(signOffBy);
                  setSignOffOpen(false);
                }}
              >
                {t('app.modal.signOffAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESTORE CONFIRMATION MODAL ── */}
      {restoreOpen && restoreInfo && (
        <div className="modal-overlay" onClick={() => setRestoreOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">⬆</div>
            <h3 className="modal-title">{t('app.modal.restoreTitle')}</h3>
            <p className="modal-text">{t('app.modal.restoreText', { keys: restoreInfo.keys, kb: (restoreInfo.bytes / 1024).toFixed(0) })}</p>
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setRestoreOpen(false)}>
                {t('common.cancel')}
              </button>
              <button className="apple-btn primary" onClick={handleConfirmRestore}>
                {t('app.modal.restoreAction')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VARIATION ORDERS PANEL ── */}
      {voOpen && (
        <div className="modal-overlay" onClick={() => setVoOpen(false)}>
          <div className="modal-content vo-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">📝</div>
            <h3 className="modal-title">{t('app.vo.title')}</h3>
            <p className="modal-text">{t('app.vo.text')}</p>
            <div className="vo-form">
              <select
                className="modal-input"
                value={voDraft.taskId}
                onChange={(e) => {
                  const task = tasks.find((x) => x.id === e.target.value);
                  setVoDraft({ ...voDraft, taskId: e.target.value, newValue: task ? String(task[voDraft.field] ?? '') : '' });
                }}
              >
                <option value="">{t('app.vo.pickTask')}</option>
                {tasks
                  .filter((x) => !x.isGroup)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.wbs} — {x.name}
                    </option>
                  ))}
              </select>
              <select
                className="modal-input"
                value={voDraft.field}
                onChange={(e) => {
                  const task = tasks.find((x) => x.id === voDraft.taskId);
                  setVoDraft({ ...voDraft, field: e.target.value, newValue: task ? String(task[e.target.value] ?? '') : '' });
                }}
              >
                <option value="quantity">{t('app.vo.contractQty')}</option>
                <option value="unitPrice">{t('app.vo.unitPriceField')}</option>
              </select>
              <input
                className="modal-input"
                type="number"
                placeholder={t('app.vo.newValue')}
                value={voDraft.newValue}
                onChange={(e) => setVoDraft({ ...voDraft, newValue: e.target.value })}
              />
              <div className="vo-form-row" style={{ display: 'flex', gap: '8px' }}>
                <select className="modal-input" value={voDraft.urgency} onChange={(e) => setVoDraft({ ...voDraft, urgency: e.target.value })} title={t('app.vo.classification')}>
                  <option value="low">{t('app.vo.urgencyLow')}</option>
                  <option value="medium">{t('app.vo.urgencyMedium')}</option>
                  <option value="high">{t('app.vo.urgencyHigh')}</option>
                </select>
                <select
                  className="modal-input"
                  value={voDraft.classification}
                  onChange={(e) => setVoDraft({ ...voDraft, classification: e.target.value })}
                  title={t('app.vo.classification')}
                >
                  <option value="">{t('app.vo.classAuto')}</option>
                  <option value="qty">{t('app.vo.classQty')}</option>
                  <option value="price">{t('app.vo.classPrice')}</option>
                  <option value="scope">{t('app.vo.classScope')}</option>
                  <option value="add">{t('app.vo.classAdd')}</option>
                  <option value="remove">{t('app.vo.classRemove')}</option>
                </select>
              </div>
              <div className="vo-form-row" style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="modal-input"
                  type="number"
                  placeholder={t('app.vo.costImpact')}
                  value={voDraft.estCostImpact}
                  onChange={(e) => setVoDraft({ ...voDraft, estCostImpact: e.target.value })}
                  title={t('app.vo.costImpactTitle')}
                />
                <input
                  className="modal-input"
                  type="number"
                  placeholder={t('app.vo.scheduleImpact')}
                  value={voDraft.estScheduleDays}
                  onChange={(e) => setVoDraft({ ...voDraft, estScheduleDays: e.target.value })}
                />
              </div>
              <input className="modal-input" placeholder={t('app.vo.changeReason')} value={voDraft.reason} onChange={(e) => setVoDraft({ ...voDraft, reason: e.target.value })} />
              <div className="vo-form-row" style={{ display: 'flex', gap: '8px' }}>
                <input className="modal-input" placeholder={t('app.vo.approver')} value={voDraft.approver} onChange={(e) => setVoDraft({ ...voDraft, approver: e.target.value })} />
                <input className="modal-input" placeholder={t('app.vo.clauseRef')} value={voDraft.clauseRef} onChange={(e) => setVoDraft({ ...voDraft, clauseRef: e.target.value })} />
              </div>
              <button className="apple-btn primary" disabled={!voDraft.taskId} onClick={handleRaiseVariation}>
                {t('app.vo.record')}
              </button>
            </div>
            <div className="vo-list">
              {(projectMeta.variations || []).length === 0 ? (
                <p className="vo-empty">{t('app.vo.empty')}</p>
              ) : (
                [...(projectMeta.variations || [])].reverse().map((v) => (
                  <div key={v.id} className="vo-item">
                    <div className="vo-item-head">
                      <strong>
                        {v.taskWbs} {v.taskName}
                      </strong>
                      <span className="vo-field">{v.field === 'unitPrice' ? t('app.vo.unitPriceField') : t('app.vo.qtyField')}</span>
                      {v.urgency === 'high' && <span className="vo-urgency high">{t('app.vo.urgencyHigh')}</span>}
                    </div>
                    <div className="vo-delta">
                      {String(v.oldValue)} ← <strong>{String(v.newValue)}</strong>
                    </div>
                    {v.classification && (
                      <div className="vo-class">
                        {voClassLabel(v.classification)}
                        {v.clauseRef ? ` · ${v.clauseRef}` : ''}
                      </div>
                    )}
                    {(v.estCostImpact > 0 || v.estScheduleDays != null) && (
                      <div className="vo-impact">
                        {v.estCostImpact > 0 && (
                          <span>
                            {t('app.vo.impactCost')} {formatCurrency(v.estCostImpact)}
                          </span>
                        )}
                        {v.estScheduleDays != null && v.estScheduleDays !== 0 && (
                          <span>
                            {t('app.vo.impactSchedule')} {v.estScheduleDays > 0 ? '+' : ''}
                            {v.estScheduleDays} {t('app.vo.impactDays')}
                          </span>
                        )}
                      </div>
                    )}
                    {v.reason && (
                      <div className="vo-reason">
                        {t('app.vo.reasonPrefix')} {v.reason}
                      </div>
                    )}
                    <div className="vo-meta">
                      {v.approver}
                      {v.approver && ' · '}
                      {new Date(v.date).toLocaleDateString('en-GB')}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="modal-actions">
              <button className="apple-btn secondary" onClick={() => setVoOpen(false)}>
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
