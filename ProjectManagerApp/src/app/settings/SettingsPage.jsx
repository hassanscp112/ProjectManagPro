import { CalendarRange, Download, History, Pencil, Plus, RotateCcw, ShieldCheck, Trash2, Upload, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { STATUS_KEYS } from '../../state/projectModel.js';
import { useProject } from '../../state/projectContext.js';
import { createNamedSnapshot, deleteNamedSnapshot, loadSnapshots, renameNamedSnapshot, restoreSnapshot, snapshotsStats } from '../../utils/Snapshots.js';
import { getPersistenceState, requestPersistentStorage } from '../../utils/StoragePersistence.js';
import { THEMES, applyTheme, loadTheme, saveTheme } from '../../utils/Theme.js';
import { Button, Card, ConfirmDialog, EmptyState, IconButton, Input, Segmented, StatusBadge, Table, useToast } from '../../ui/index.js';
import { formatDay, formatTime } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import { useBackupRestore } from '../useBackupRestore.jsx';
import s from './Settings.module.css';

const STATUS_TONE = { draft: 'neutral', signed: 'accent', executing: 'success', completed: 'success' };
const leafCount = (list = []) => list.filter((x) => x && x.isGroup === false).length;

/** Restore points: daily automatic ones and named ones. Storage: utils/Snapshots. */
function SnapshotsCard() {
  const { t } = useI18n();
  const toast = useToast();
  const { tasks, projectMeta, identity } = useProject();
  const [snapshots, setSnapshots] = useState(loadSnapshots);
  const [stats, setStats] = useState(snapshotsStats);
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState(null); // { id, value }
  const [confirm, setConfirm] = useState(null); // { kind: 'restore'|'delete', label, snap }
  const refresh = () => {
    setSnapshots(loadSnapshots());
    setStats(snapshotsStats());
  };
  const autoRows = useMemo(() => Object.keys(snapshots.auto).sort().reverse(), [snapshots]);
  const named = useMemo(() => [...snapshots.named].filter(Boolean).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')), [snapshots]);

  const create = (e) => {
    e.preventDefault();
    const saved = createNamedSnapshot(name, tasks, projectMeta, identity?.name || '');
    if (!saved) {
      toast({ title: t('settings.storageFull'), tone: 'danger' });
      return;
    }
    setName('');
    refresh();
    toast({ title: t('settings.snapshotSaved') });
  };
  const commitRename = () => {
    if (renaming?.value.trim()) {
      renameNamedSnapshot(renaming.id, renaming.value);
      refresh();
    }
    setRenaming(null);
  };
  const onConfirm = () => {
    const { kind, snap } = confirm;
    if (kind === 'delete') {
      deleteNamedSnapshot(snap.id);
      refresh();
      return;
    }
    // Keep what is here now as a named snapshot first, so the restore can be undone.
    const before = createNamedSnapshot(t('settings.beforeRestoreName', { label: confirm.label }), tasks, projectMeta, identity?.name || '');
    if (!before) {
      toast({ title: t('settings.beforeRestoreFail'), tone: 'danger' });
      return;
    }
    try {
      restoreSnapshot({ tasks: snap.tasks || [], projectMeta: snap.projectMeta });
    } catch {
      toast({ title: t('settings.storageFull'), tone: 'danger' });
      refresh();
      return;
    }
    window.location.reload();
  };

  return (
    <Card title={t('snapshots.title')} titleAs="h2" padding="md" subtitle={t('snapshots.subtitle')} className={s.wide}>
      <dl className={s.figures}>
        <div className={s.figure}>
          <dt>{t('snapshots.statAutoCount')}</dt>
          <dd>{stats.autoCount}</dd>
        </div>
        <div className={s.figure}>
          <dt>{t('snapshots.statNamedCount')}</dt>
          <dd>{stats.namedCount}</dd>
        </div>
        <div className={s.figure}>
          <dt>{t('snapshots.statSize')}</dt>
          <dd>
            {(stats.totalBytes / 1024).toFixed(1)} {t('snapshots.sizeUnit')}
          </dd>
        </div>
      </dl>

      <form className={s.createRow} onSubmit={create}>
        <Input aria-label={t('snapshots.colName')} value={name} placeholder={t('snapshots.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="primary" icon={Plus} title={t('snapshots.createTitle')}>
          {t('settings.createSnapshot')}
        </Button>
      </form>

      <h3 className={s.subTitle}>
        {t('snapshots.namedTitle')} <span className={s.muted}>· {t('snapshots.namedHint')}</span>
      </h3>
      {named.length === 0 ? (
        <p className={s.muted}>{t('snapshots.namedEmpty')}</p>
      ) : (
        <Table minWidth={520} label={t('snapshots.namedTitle')}>
          <thead>
            <tr>
              <th>{t('snapshots.colName')}</th>
              <th>{t('snapshots.colDate')}</th>
              <th className="ui-num">{t('snapshots.colTasks')}</th>
              <th aria-label={t('common.actions')} />
            </tr>
          </thead>
          <tbody>
            {named.map((snap) => (
              <tr key={snap.id}>
                <td>
                  {renaming?.id === snap.id ? (
                    <Input
                      data-autofocus
                      autoFocus
                      aria-label={t('snapshots.rename')}
                      value={renaming.value}
                      onChange={(e) => setRenaming({ id: snap.id, value: e.target.value })}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitRename();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                    />
                  ) : (
                    <span title={snap.actor ? t('snapshots.createdBy', { name: snap.actor }) : undefined}>{snap.name}</span>
                  )}
                </td>
                <td className={s.date}>
                  {formatDay((snap.createdAt || '').slice(0, 10))} · {formatTime(snap.createdAt)}
                </td>
                <td className="ui-num" title={t('snapshots.leafTasksHint', { n: leafCount(snap.tasks) })}>
                  {(snap.tasks || []).length}
                </td>
                <td className={s.rowActions}>
                  <Button size="sm" icon={RotateCcw} onClick={() => setConfirm({ kind: 'restore', label: snap.name, snap })}>
                    {t('snapshots.restore')}
                  </Button>
                  <IconButton icon={Pencil} label={t('snapshots.rename')} size="sm" variant="ghost" onClick={() => setRenaming({ id: snap.id, value: snap.name || '' })} />
                  <IconButton icon={Trash2} label={t('common.delete')} size="sm" variant="ghost" onClick={() => setConfirm({ kind: 'delete', label: snap.name, snap })} />
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <h3 className={s.subTitle}>
        {t('snapshots.autoTitle')} <span className={s.muted}>· {t('snapshots.autoHint')}</span>
      </h3>
      {autoRows.length === 0 ? (
        <EmptyState icon={History} title={t('snapshots.autoEmpty')} />
      ) : (
        <Table minWidth={520} label={t('snapshots.autoTitle')}>
          <thead>
            <tr>
              <th>{t('snapshots.colDate')}</th>
              <th>{t('snapshots.colCreatedTime')}</th>
              <th className="ui-num">{t('snapshots.colTasksCount')}</th>
              <th className="ui-num">{t('snapshots.colVariations')}</th>
              <th aria-label={t('common.actions')} />
            </tr>
          </thead>
          <tbody>
            {autoRows.map((day) => {
              const snap = snapshots.auto[day];
              return (
                <tr key={day}>
                  <td className={s.date}>{formatDay(day)}</td>
                  <td className={s.date} title={snap.actor ? t('snapshots.createdBy', { name: snap.actor }) : undefined}>
                    {formatTime(snap.createdAt) || '—'}
                  </td>
                  <td className="ui-num">{(snap.tasks || []).length}</td>
                  <td className="ui-num">{(snap.projectMeta?.variations || []).length}</td>
                  <td className={s.rowActions}>
                    <Button size="sm" icon={RotateCcw} onClick={() => setConfirm({ kind: 'restore', label: formatDay(day), snap })}>
                      {t('snapshots.restore')}
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}

      <p className={s.note}>
        <strong>{t('snapshots.scopeNoteTitle')}</strong> {t('snapshots.scopeNote')}
      </p>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.kind === 'delete' ? t('settings.deleteSnapshotTitle') : t('settings.restoreTitle')}
        message={confirm ? (confirm.kind === 'delete' ? t('snapshots.deleteConfirm', { name: confirm.label }) : t('snapshots.restoreConfirm', { label: confirm.label })) : ''}
        confirmLabel={confirm?.kind === 'delete' ? t('common.delete') : t('snapshots.restore')}
        tone="danger"
        onConfirm={onConfirm}
      />
    </Card>
  );
}

const PERSIST_TONE = { persisted: 'success', 'best-effort': 'warning', unsupported: 'neutral' };

/** Whether the browser may clear this app's storage on its own (utils/StoragePersistence). */
function StorageProtection() {
  const { t } = useI18n();
  const toast = useToast();
  const [state, setState] = useState(null);

  useEffect(() => {
    let ignore = false;
    getPersistenceState().then((next) => !ignore && setState(next));
    return () => {
      ignore = true;
    };
  }, []);

  const ask = async () => {
    const next = await requestPersistentStorage();
    setState(next);
    if (next !== 'persisted') toast({ title: t('settings.storageRefused') });
  };

  if (!state) return null;
  return (
    <div className={s.row}>
      <span className={s.label}>{t('settings.storage')}</span>
      <StatusBadge tone={PERSIST_TONE[state]} icon="dot" size="md">
        {t(`settings.storage_${state}`)}
      </StatusBadge>
      {state === 'best-effort' && (
        <Button size="sm" icon={ShieldCheck} onClick={ask}>
          {t('settings.storageAsk')}
        </Button>
      )}
    </div>
  );
}

/**
 * /settings — who you are, appearance (theme, language), the project's
 * lifecycle, full backup / restore, and restore points.
 */
export default function SettingsPage() {
  const { t, lang, setLang, languages } = useI18n();
  const { identity, openIdentity, projectMeta } = useProject();
  const [theme, setTheme] = useState(loadTheme);
  const backupRestore = useBackupRestore();
  const status = projectMeta.status || 'draft';

  const changeTheme = (next) => {
    setTheme(next);
    saveTheme(next);
    applyTheme(next);
  };

  return (
    <Page area="settings">
      <div className={s.grid}>
        <Card title={t('settings.you')} titleAs="h2" padding="md">
          <div className={s.identity}>
            <span className={s.avatar} aria-hidden="true">
              <UserRound size={22} />
            </span>
            <div className={s.identityText}>
              <strong>{identity?.name || t('registries.identityUnset')}</strong>
              <span className={s.muted}>{identity?.role || t('registries.identityRoleHint')}</span>
            </div>
            <Button size="sm" onClick={openIdentity}>
              {identity?.name ? t('registries.change') : t('registries.identityPick')}
            </Button>
          </div>
        </Card>

        <Card title={t('settings.appearance')} titleAs="h2" padding="md">
          <div className={s.rows}>
            <div className={s.row}>
              <span className={s.label}>{t('settings.theme')}</span>
              <Segmented
                label={t('settings.theme')}
                value={theme}
                onChange={changeTheme}
                options={THEMES.map((v) => ({ value: v, label: t(`settings.theme_${v}`) }))}
              />
            </div>
            <div className={s.row}>
              <span className={s.label}>{t('ui.language')}</span>
              <Segmented label={t('ui.language')} value={lang} onChange={setLang} options={languages.map((l) => ({ value: l.code, label: l.label }))} />
            </div>
          </div>
        </Card>

        <Card title={t('settings.lifecycle')} titleAs="h2" padding="md">
          <div className={s.rows}>
            <div className={s.row}>
              <span className={s.label}>{t('settings.status')}</span>
              <StatusBadge tone={STATUS_TONE[status] || 'neutral'} icon="dot" size="md">
                {STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : status}
              </StatusBadge>
            </div>
            <p className={s.muted}>{t('settings.lifecycleHint')}</p>
            <div>
              <Button as={Link} to="/schedule" icon={CalendarRange}>
                {t('settings.openSchedule')}
              </Button>
            </div>
          </div>
        </Card>

        <Card title={t('settings.backup')} titleAs="h2" padding="md">
          <div className={s.rows}>
            <p className={s.muted}>{t('settings.backupHint')}</p>
            <StorageProtection />
            <div className={s.buttons}>
              <Button variant="primary" icon={Download} onClick={backupRestore.backup}>
                {t('schedule.backup')}
              </Button>
              <Button icon={Upload} onClick={backupRestore.restore}>
                {t('schedule.restore')}
              </Button>
            </div>
          </div>
          {backupRestore.element}
        </Card>

        <SnapshotsCard />
      </div>
    </Page>
  );
}
