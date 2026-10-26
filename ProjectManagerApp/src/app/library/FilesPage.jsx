import { ChevronLeft, ChevronRight, Download, Eye, FileText, Folder, Images, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { FOLDER_ORDER_PHOTOS, FOLDER_ROOT, FOLDER_TASKS, childFolders, folderPathFor, formatBytes } from '../../state/libraryModel.js';
import { useProject } from '../../state/projectContext.js';
import { deleteFile, getFiles, saveFile } from '../../utils/FileDB.js';
import { updateOrder } from '../../utils/OrderEngine.js';
import { Button, ConfirmDialog, EmptyState, IconButton, ListRow, PhotoViewer, cx, useToast } from '../../ui/index.js';
import { formatDay, orderSubject, typeLabel } from '../record/orderMeta.js';
import { Page } from '../Page.jsx';
import { useOrderPhotos } from '../useOrderPhotos.js';
import fp from './FilesPage.module.css';
import s from './Library.module.css';

const newestFirst = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');

/**
 * /library/files — documents per top-level section, stored in IndexedDB
 * (utils/FileDB). The open folder is in the URL (?folder=…);
 * /library/files/:taskId opens the folder of that item's section.
 * "Order photos" holds the photos saved with orders on the Record screen:
 * view, download and delete only (deleting also drops it from its order).
 */
export default function FilesPage() {
  const { t, dir } = useI18n();
  const toast = useToast();
  const navigate = useNavigate();
  const { taskId } = useParams();
  const [params] = useSearchParams();
  const { tasks, orders } = useProject();
  const [files, setFiles] = useState([]);
  const [viewing, setViewing] = useState(null);
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
        if (id === FOLDER_ORDER_PHOTOS) return [{ id: FOLDER_ROOT }, { id: FOLDER_ORDER_PHOTOS }];
        const section = tasks.find((x) => `task_${x.id}` === id);
        return section ? folderPathFor(section, tasks) : [{ id: FOLDER_ROOT }];
      })();
  const folder = path[path.length - 1];
  const folders = childFolders(folder.id, tasks);
  const Chevron = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const photoFolder = folder.id === FOLDER_ORDER_PHOTOS;

  // Order photos: thumbnails + viewer, and which order each one belongs to.
  const photoIds = useMemo(() => (photoFolder ? files.map((file) => file.id) : []), [photoFolder, files]);
  const { photos } = useOrderPhotos(photoIds);
  const photoUrl = useMemo(() => new Map(photos.map((p) => [p.id, p.url])), [photos]);
  const ordersById = useMemo(() => new Map(orders.map((o) => [o.id, o])), [orders]);
  const orderLabel = (file) => {
    const order = file.orderId ? ordersById.get(file.orderId) : null;
    if (!order) return t('files.orderGone');
    return [typeLabel(order.type), orderSubject(order), formatDay(order.date)].filter(Boolean).join(' · ');
  };
  const viewPhoto = (file) => {
    const i = photos.findIndex((p) => p.id === file.id);
    if (i >= 0) setViewing(i);
  };

  const folderName = (f) =>
    f.id === FOLDER_ROOT
      ? t('files.root')
      : f.id === FOLDER_TASKS
        ? t('files.tasksRoot')
        : f.id === FOLDER_ORDER_PHOTOS
          ? t('files.orderPhotos')
          : f.task
            ? `${f.task.wbs} ${f.task.name}`
            : f.id;
  const go = (id) => navigate(id === FOLDER_ROOT ? '/library/files' : `/library/files?folder=${encodeURIComponent(id)}`);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setFiles((await getFiles(folder.id)).sort(newestFirst));
    } finally {
      setLoading(false);
    }
  }, [folder.id]);

  useEffect(() => {
    let ignore = false;
    getFiles(folder.id)
      .then((list) => !ignore && setFiles(list.sort(newestFirst)))
      .catch(() => !ignore && setFiles([]));
    return () => {
      ignore = true;
    };
  }, [folder.id]);

  const upload = async (list) => {
    if (photoFolder || !list || !list.length) return;
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
        {!photoFolder && (
          <>
            <input ref={inputRef} type="file" multiple hidden onChange={(e) => upload([...e.target.files])} />
            <Button variant="primary" icon={Upload} onClick={() => inputRef.current?.click()}>
              {t('files.upload')}
            </Button>
          </>
        )}
      </div>

      <div
        className={cx(s.dropzone, dragging && s.dragging)}
        onDragOver={(e) => {
          if (photoFolder) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          if (photoFolder) return;
          e.preventDefault();
          setDragging(false);
          upload([...e.dataTransfer.files]);
        }}
        aria-busy={loading}
      >
        {folders.length === 0 && files.length === 0 ? (
          photoFolder ? (
            <EmptyState icon={Images} title={t('files.orderPhotosEmpty')} body={t('files.orderPhotosHint')} />
          ) : (
            <EmptyState icon={Folder} title={t('files.emptyFolder')} body={t('files.emptyHint')} />
          )
        ) : (
          <ul className={s.fileList}>
            {folders.map((f) => (
              <li key={f.id}>
                <ListRow
                  flush
                  onClick={() => go(f.id)}
                  leading={
                    f.id === FOLDER_ORDER_PHOTOS ? (
                      <Images size={20} aria-hidden="true" className={s.folderIcon} />
                    ) : (
                      <Folder size={20} aria-hidden="true" className={s.folderIcon} />
                    )
                  }
                  title={folderName(f)}
                  trailing={<Chevron size={18} aria-hidden="true" />}
                />
              </li>
            ))}
            {photoFolder &&
              files.map((file) => (
                <li key={file.id}>
                  <ListRow
                    flush
                    leading={
                      <button type="button" className={fp.thumb} onClick={() => viewPhoto(file)} aria-label={t('files.viewPhoto')} tabIndex={-1}>
                        {photoUrl.get(file.id) && <img src={photoUrl.get(file.id)} alt="" loading="lazy" decoding="async" />}
                      </button>
                    }
                    title={orderLabel(file)}
                    subtitle={[formatBytes(file.size), file.createdAt ? formatDay(file.createdAt.slice(0, 10)) : null].filter(Boolean).join(' · ')}
                    trailing={
                      <>
                        <IconButton icon={Eye} label={t('files.viewPhoto')} size="sm" variant="ghost" onClick={() => viewPhoto(file)} />
                        <IconButton icon={Download} label={t('library.download')} size="sm" variant="ghost" onClick={() => download(file)} />
                        <IconButton icon={Trash2} label={t('files.deleteFileTitle')} size="sm" variant="ghost" onClick={() => setToDelete(file)} />
                      </>
                    }
                  />
                </li>
              ))}
            {!photoFolder && files.map((file) => (
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
        <p className={s.dropHint}>{photoFolder ? t('files.orderPhotosHint') : t('library.dropHint')}</p>
      </div>

      {photoFolder && (
        <PhotoViewer
          photos={photos}
          index={viewing ?? 0}
          onIndexChange={setViewing}
          open={viewing !== null}
          onOpenChange={(o) => !o && setViewing(null)}
          title={t('files.orderPhotos')}
        />
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('library.deleteFileTitle')}
        message={toDelete?.orderId ? t('files.deletePhotoText', { name: toDelete.name }) : toDelete?.name}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={async () => {
          const file = toDelete;
          await deleteFile(file.id);
          // Keep the order's photo count true: drop the id from its evidence.
          const order = file.orderId ? ordersById.get(file.orderId) : null;
          if (order && Array.isArray(order.evidence) && order.evidence.includes(file.id)) {
            updateOrder(order.id, { evidence: order.evidence.filter((id) => id !== file.id) });
          }
          reload();
        }}
      />
    </Page>
  );
}
