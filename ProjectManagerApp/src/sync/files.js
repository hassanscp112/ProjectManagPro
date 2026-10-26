// ─────────────────────────────────────────────────────────────
// files — uploaded files and photos (FileDB, IndexedDB) ⇄ the server.
//
// Each file is a record of the 'files' collection (its details: folder,
// name, size, type, order …) plus the bytes in Storage at
// files/<server project id>/<file id>. A file keeps its FileDB id on every
// device. Deleting a file marks its record deleted; the bytes stay on the
// server (nothing is lost), other devices remove their copy.
// FileDB access is passed in (the browser wiring is in runtime.js).
// ─────────────────────────────────────────────────────────────

import { LEGACY_PROJECT_ID } from '../utils/Projects.js';
import { FILES_COLLECTION, canWriteVersion } from './rules.js';

const MAX_DOWNLOADS = 20;

/** The details that travel as the file's record (the bytes go to Storage). */
export const fileMeta = (record) => ({
  id: record.id,
  folderId: record.folderId ?? '',
  name: record.name || '',
  size: Number(record.size) || 0,
  type: record.type || '',
  createdAt: record.createdAt || '',
  ...(record.orderId ? { orderId: record.orderId } : {}),
});

export const storagePath = (serverProjectId, fileId) => `${serverProjectId}/${fileId}`;

const belongsTo = (record, localProjectId) => (record.projectId || LEGACY_PROJECT_ID) === localProjectId;

/**
 * Upload the scope's new local files and queue their records; queue the
 * removal of files deleted on this device. `files`: every FileDB record.
 * Returns { uploaded, removed }.
 */
export const pushFiles = async ({ engine, transport, db, scope, files }) => {
  const shadow = (await engine.loadShadow(scope, FILES_COLLECTION)) || { items: {} };
  const knownKey = `files:local:${scope.key}`;
  const known = new Set((await db.kvGet(knownKey)) || []);
  const local = files.filter((f) => f && f.blob && belongsTo(f, scope.local.id));
  const localIds = new Set(local.map((f) => f.id));
  const changes = [];
  let uploaded = 0;
  for (const file of local) {
    known.add(file.id);
    if (shadow.items[file.id]) continue; // on the server already (or deleted there)
    const meta = fileMeta(file);
    if (!canWriteVersion(scope.actor?.role, FILES_COLLECTION, file.id, meta)) continue; // stays on this device
    await transport.upload(storagePath(scope.projectId, file.id), file.blob, file.type);
    changes.push({ key: file.id, op: 'insert', before: null, after: meta, pos: null });
    uploaded += 1;
  }
  let removed = 0;
  Object.entries(shadow.items).forEach(([id, b]) => {
    if (b.deleted || b.lo || b.pending || localIds.has(id) || !known.has(id)) return;
    known.delete(id);
    if (!canWriteVersion(scope.actor?.role, FILES_COLLECTION, id, b.data)) return;
    changes.push({ key: id, op: 'delete', before: b.data, after: null, pos: b.pos });
    removed += 1;
  });
  await engine.queueChanges(scope, FILES_COLLECTION, changes);
  await db.kvSet(knownKey, [...known]);
  return { uploaded, removed };
};

/**
 * Download files the server has and this device does not; remove local
 * copies of files deleted on the server. `putFile(record)` / `removeFile(id)`
 * write FileDB. Returns { downloaded, removed, failed }.
 */
export const pullFiles = async ({ engine, transport, db, scope, files, putFile, removeFile }) => {
  const shadow = (await engine.loadShadow(scope, FILES_COLLECTION)) || { items: {} };
  const knownKey = `files:local:${scope.key}`;
  const known = new Set((await db.kvGet(knownKey)) || []);
  const localIds = new Set(files.filter((f) => f && belongsTo(f, scope.local.id)).map((f) => f.id));
  let downloaded = 0;
  let removed = 0;
  let failed = 0;
  for (const [id, b] of Object.entries(shadow.items)) {
    if (b.lo || b.pending) continue;
    if (b.deleted) {
      if (localIds.has(id)) {
        await removeFile(id);
        known.delete(id);
        removed += 1;
      }
      continue;
    }
    if (localIds.has(id) || downloaded >= MAX_DOWNLOADS) continue;
    try {
      const blob = await transport.download(storagePath(scope.projectId, id));
      const meta = b.data || {};
      await putFile({
        id,
        folderId: meta.folderId ?? '',
        projectId: scope.local.id,
        name: meta.name || '',
        size: blob?.size ?? meta.size ?? 0,
        type: meta.type || blob?.type || '',
        blob,
        createdAt: meta.createdAt || new Date().toISOString(),
        ...(meta.orderId ? { orderId: meta.orderId } : {}),
      });
      known.add(id);
      downloaded += 1;
    } catch (error) {
      if (error?.offline) throw error;
      failed += 1; // missing on the server or refused: tried again next time
    }
  }
  await db.kvSet(knownKey, [...known]);
  return { downloaded, removed, failed };
};
