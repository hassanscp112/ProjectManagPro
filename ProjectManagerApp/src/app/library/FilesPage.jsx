import { ChevronLeft, ChevronRight, Download, FileText, Folder, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { FOLDER_ROOT, FOLDER_TASKS, childFolders, folderPathFor, formatBytes } from '../../state/libraryModel.js';
import { useProject } from '../../state/projectContext.js';
import { deleteFile, getFiles, saveFile } from '../../utils/FileDB.js';
import { Button, ConfirmDialog, EmptyState, IconButton, ListRow, cx, useToast } from '../../ui/index.js';
import { formatDay } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import s from './Library.module.css';

/**
 * /library/files — documents per top-level section, stored in IndexedDB
 * (utils/FileDB). The open folder is in the URL (?folder=…);
 * /library/files/:taskId opens the folder of that item's section.
 */
export default function FilesPage() {
  const { t, dir } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [params] = useSearchParams();
  const { tasks } = useProject();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const inputRef = useRef(null);

  // Where we are: an item's section folder, else ?folder=, else the root.
  const target = taskId ? tasks.find((x) => x.id === decodeURIComponent(taskId)) : null;
  const path = target
    ? folderPathFor(target, tasks)
    : (() => {
        const id = params.get('folder') || FOLDER_ROOT;
        if (id === FOLDER_ROOT) return [{ id: FOLDER_ROOT }];
        if (id === FOLDER_TASKS) return [{ id: FOLDER_ROOT }, { id: FOLDER_TASKS }];
        const section = tasks.find((x) => `task_${x.id}` === id);
        return section ? folderPathFor(section, tasks) : [{ id: FOLDER_ROOT }];
      })();
  const folder = path[path.length - 1];
  const folders = childFolders(folder.id, tasks);
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight;

  const folderName = (f) =>
    f.id === FOLDER_ROOT ? t('files.root') : f.id === FOLDER_TASKS ? t('files.tasksRoot') : f.task ? `${f.task.wbs} ${f.task.name}` : f.id;
  const go = (id) => navigate(id === FOLDER_ROOT ? '/library/files' : `/library/files?folder=${encodeURIComponent(id)}`);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setFiles(await getFiles(folder.id));
    } finally {
      setLoading(false);
    }
  }, [folder.id]);

  useEffect(() => {
    let ignore = false;
    getFiles(folder.id)
      .then((list) => !ignore && setFiles(list))
      .catch(() => !ignore && setFiles([]));
    return () => {
      ignore = true;
    };
  }, [folder.id]);

  const upload = async (list) => {
    if (!list || !list.length) return;
    setLoading(true);
    try {
      for (const file of list) await saveFile(folder.id, file);
      toast({ title: t('library.uploaded', { n: list.length }) });
    } catch {
      toast({ title: t('files.uploadFailed') });
    } finally {
      if (inputRef.current) inputRef.current.value = '';
      await reload();
    }
  };

  const download = (file) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Page area="library">
      <div className={s.toolbar}>
        <nav aria-label={t('library.folderPath')} className={s.crumbs}>
          {path.map((f, i) => (
            <span key={f.id} className={s.crumb}>
              {i > 0 && <Chevron size={16} aria-hidden="true" className={s.crumbSep} />}
              {i === path.length - 1 ? (
                <strong aria-current="page">{folderName(f)}</strong>
              ) : (
                <button type="button" className={s.crumbLink} onClick={() => go(f.id)}>
                  {folderName(f)}
                </button>
              )}
            </span>
          ))}
        </nav>
        <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload([...e.target.files])} />
        <Button variant="primary" icon={Upload} onClick={() => inputRef.current?.click()}>
          {t('files.upload')}
        </Button>
      </div>

      <div
        className={cx(s.dropzone, dragging && s.dragging)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload([...e.dataTransfer.files]);
        }}
        aria-busy={loading}
      >
        {folders.length === 0 && files.length === 0 ? (
          <EmptyState icon={Folder} title={t('files.emptyFolder')} body={t('files.emptyHint')} />
        ) : (
          <ul className={s.fileList}>
            {folders.map((f) => (
              <li key={f.id}>
                <ListRow
                  flush
                  onClick={() => go(f.id)}
                  leading={<Folder size={20} aria-hidden="true" className={s.folderIcon} />}
                  title={folderName(f)}
                  trailing={<Chevron size={18} aria-hidden="true" />}
                />
              </li>
            ))}
            {files.map((file) => (
              <li key={file.id}>
                <ListRow
                  flush
                  leading={<FileText size={20} aria-hidden="true" />}
                  title={file.name}
                  subtitle={[formatBytes(file.size), file.createdAt ? formatDay(file.createdAt.slice(0, 10)) : null].filter(Boolean).join(' · ')}
                  trailing={
                    <>
                      <IconButton icon={Download} label={t('library.download')} size="sm" variant="ghost" onClick={() => download(file)} />
                      <IconButton icon={Trash2} label={t('files.deleteFileTitle')} size="sm" variant="ghost" onClick={() => setToDelete(file)} />
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        )}
        <p className={s.dropHint}>{t('library.dropHint')}</p>
      </div>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('library.deleteFileTitle')}
        message={toDelete?.name}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={async () => {
          await deleteFile(toDelete.id);
          reload();
        }}
      />
    </Page>
  );
}
