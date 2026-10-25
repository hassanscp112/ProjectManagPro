import { useMemo, useState } from 'react';
import './SnapshotsScreen.css';
import {
  loadSnapshots,
  createNamedSnapshot,
  deleteNamedSnapshot,
  renameNamedSnapshot,
  restoreSnapshot,
  snapshotsStats,
} from '../../utils/Snapshots';
import { useI18n } from '../../i18n/useI18n.js';

// ── small local helpers ─────────────────────────────────────────────────────

// dd/mm/yyyy (en-GB digits keep dates readable next to localized labels)
const fmtDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB');
};

const timeOf = (iso) => (iso && iso.length >= 16 ? iso.slice(11, 16) : '');

const variationsOf = (meta) => (Array.isArray(meta?.variations) ? meta.variations : []);

const tasksOf = (snap) => (Array.isArray(snap?.tasks) ? snap.tasks : []);

const leafCount = (list) => list.filter((t) => t && t.isGroup === false).length;

// ── component ───────────────────────────────────────────────────────────────

const SnapshotsScreen = ({ tasks, projectMeta, identity, onRestored }) => {
  const { t, dir } = useI18n();
  const [snapshots, setSnapshots] = useState(() => loadSnapshots());
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const actorName = identity?.name || '';

  // Every mutation persists to localStorage BEFORE refresh() re-reads it, so
  // the stats strip stays in sync with the tables after each action.
  const [stats, setStats] = useState(() => snapshotsStats());

  const refresh = () => {
    setSnapshots(loadSnapshots());
    setStats(snapshotsStats());
  };

  /* ── named snapshot actions ── */

  const handleCreate = () => {
    createNamedSnapshot(newName, tasks, projectMeta, actorName);
    setNewName('');
    refresh();
  };

  const handleDelete = (snap) => {
    if (!window.confirm(t('snapshots.deleteConfirm', { name: snap.name }))) return;
    deleteNamedSnapshot(snap.id);
    if (renamingId === snap.id) setRenamingId(null);
    refresh();
  };

  const startRename = (snap) => {
    setRenamingId(snap.id);
    setRenameValue(snap.name || '');
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      renameNamedSnapshot(renamingId, renameValue);
      refresh();
    }
    setRenamingId(null);
    setRenameValue('');
  };

  /* ── restore flow ── */

  const handleRestore = (label, snapTasks, snapMeta) => {
    const ok = window.confirm(t('snapshots.restoreConfirm', { label }));
    if (!ok) return;
    restoreSnapshot({ tasks: snapTasks, projectMeta: snapMeta });
    if (onRestored) onRestored();
    else window.location.reload();
  };

  /* ── derived lists (newest first) ── */

  const autoRows = useMemo(
    () => Object.keys(snapshots.auto).sort((a, b) => b.localeCompare(a)),
    [snapshots]
  );

  const namedRows = useMemo(
    () =>
      [...snapshots.named]
        .filter(Boolean)
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
    [snapshots]
  );

  const kbSize = (stats.totalBytes / 1024).toFixed(1);

  /* ── render ── */

  return (
    <div className="snapshots-screen" dir={dir}>
      <header className="snaps-header">
        <h2>{t('snapshots.title')}</h2>
        <p>{t('snapshots.subtitle')}</p>
      </header>

      {/* ── summary strip ── */}
      <div className="snaps-summary">
        <div className="snaps-stat-card">
          <span className="snaps-stat-label">{t('snapshots.statAutoCount')}</span>
          <span className="snaps-stat-value mono">{stats.autoCount}</span>
        </div>
        <div className="snaps-stat-card">
          <span className="snaps-stat-label">{t('snapshots.statNamedCount')}</span>
          <span className="snaps-stat-value mono">{stats.namedCount}</span>
        </div>
        <div className="snaps-stat-card">
          <span className="snaps-stat-label">{t('snapshots.statSize')}</span>
          <span className="snaps-stat-value mono">
            {kbSize} {t('snapshots.sizeUnit')}
          </span>
        </div>
      </div>

      {/* ── section 1: automatic daily checkpoints ── */}
      <section className="snaps-section">
        <div className="snaps-section-head">
          <h3>
            {t('snapshots.autoTitle')} <span className="snaps-section-count">({autoRows.length})</span>
          </h3>
          <span className="snaps-section-hint">{t('snapshots.autoHint')}</span>
        </div>

        {autoRows.length === 0 ? (
          <div className="snaps-empty">{t('snapshots.autoEmpty')}</div>
        ) : (
          <div className="snaps-table-wrap">
            <table className="snaps-table">
              <thead>
                <tr>
                  <th>{t('snapshots.colDate')}</th>
                  <th>{t('snapshots.colCreatedTime')}</th>
                  <th>{t('snapshots.colTasksCount')}</th>
                  <th>{t('snapshots.colVariations')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {autoRows.map((dateKey) => {
                  const snap = snapshots.auto[dateKey];
                  const snapTasks = tasksOf(snap);
                  return (
                    <tr key={dateKey}>
                      <td className="mono snaps-date-cell">{fmtDate(dateKey)}</td>
                      <td
                        className="mono"
                        title={snap.actor ? t('snapshots.createdBy', { name: snap.actor }) : undefined}
                      >
                        {timeOf(snap.createdAt) || '—'}
                      </td>
                      <td
                        className="mono"
                        title={t('snapshots.leafTasksHint', { n: leafCount(snapTasks) })}
                      >
                        {snapTasks.length}
                      </td>
                      <td className="mono">{variationsOf(snap.projectMeta).length}</td>
                      <td>
                        <button
                          className="apple-btn secondary snaps-action-btn"
                          onClick={() =>
                            handleRestore(fmtDate(dateKey), snapTasks, snap.projectMeta)
                          }
                        >
                          {t('snapshots.restore')}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── section 2: named snapshots ── */}
      <section className="snaps-section">
        <div className="snaps-section-head">
          <h3>
            {t('snapshots.namedTitle')}{' '}
            <span className="snaps-section-count">({namedRows.length})</span>
          </h3>
          <span className="snaps-section-hint">{t('snapshots.namedHint')}</span>
        </div>

        <div className="snaps-create-row">
          <input
            className="snaps-name-input"
            type="text"
            placeholder={t('snapshots.namePlaceholder')}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
            }}
          />
          <button
            className="apple-btn primary"
            onClick={handleCreate}
            title={t('snapshots.createTitle')}
          >
            {t('snapshots.createNow')}
          </button>
        </div>

        {namedRows.length === 0 ? (
          <div className="snaps-empty">{t('snapshots.namedEmpty')}</div>
        ) : (
          <div className="snaps-table-wrap">
            <table className="snaps-table">
              <thead>
                <tr>
                  <th>{t('snapshots.colName')}</th>
                  <th>{t('snapshots.colDate')}</th>
                  <th>{t('snapshots.colTasks')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {namedRows.map((snap) => (
                  <tr key={snap.id}>
                    <td className="snaps-name-cell">
                      {renamingId === snap.id ? (
                        <input
                          className="snaps-name-input inline"
                          type="text"
                          value={renameValue}
                          autoFocus
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename();
                            if (e.key === 'Escape') {
                              setRenamingId(null);
                              setRenameValue('');
                            }
                          }}
                        />
                      ) : (
                        <span title={snap.actor ? t('snapshots.createdBy', { name: snap.actor }) : undefined}>
                          {snap.name}
                        </span>
                      )}
                    </td>
                    <td className="mono snaps-date-cell">
                      {fmtDate(snap.createdAt)}
                      {timeOf(snap.createdAt) && (
                        <span className="snaps-time"> · {timeOf(snap.createdAt)}</span>
                      )}
                    </td>
                    <td className="mono" title={t('snapshots.leafTasksHint', { n: leafCount(tasksOf(snap)) })}>
                      {tasksOf(snap).length}
                    </td>
                    <td>
                      <div className="snaps-row-actions">
                        {renamingId === snap.id ? (
                          <>
                            <button
                              className="apple-btn secondary snaps-action-btn"
                              onClick={commitRename}
                              disabled={!renameValue.trim()}
                            >
                              {t('common.save')}
                            </button>
                            <button
                              className="apple-btn secondary snaps-action-btn"
                              onClick={() => {
                                setRenamingId(null);
                                setRenameValue('');
                              }}
                            >
                              {t('common.cancel')}
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="apple-btn secondary snaps-action-btn"
                              onClick={() => handleRestore(snap.name, tasksOf(snap), snap.projectMeta)}
                            >
                              {t('snapshots.restore')}
                            </button>
                            <button
                              className="apple-btn secondary snaps-action-btn"
                              onClick={() => startRename(snap)}
                            >
                              {t('snapshots.rename')}
                            </button>
                            <button
                              className="apple-btn destructive snaps-action-btn"
                              onClick={() => handleDelete(snap)}
                            >
                              {t('common.delete')}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── scope note ── */}
      <div className="snaps-note">
        <strong>{t('snapshots.scopeNoteTitle')}</strong> {t('snapshots.scopeNote')}
      </div>
    </div>
  );
};

export default SnapshotsScreen;
