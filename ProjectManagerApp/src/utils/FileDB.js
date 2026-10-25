// Uploaded files, per project: each record carries projectId (records saved
// before multi-project support have none and belong to the first project).
import { LEGACY_PROJECT_ID, currentProject } from './Projects.js';

const openProjectId = () => currentProject()?.id || LEGACY_PROJECT_ID;
const belongsTo = (record, projectId) => (record.projectId || LEGACY_PROJECT_ID) === projectId;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ProjectManagerDB', 1);

    request.onerror = (event) => {
      console.error('IndexedDB error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('files')) {
        const store = db.createObjectStore('files', { keyPath: 'id' });
        store.createIndex('folderId', 'folderId', { unique: false });
      }
    };
  });
};

export const saveFile = async (folderId, fileObj) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    
    const fileData = {
      id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString() + Math.random().toString(),
      folderId,
      projectId: openProjectId(),
      name: fileObj.name,
      size: fileObj.size,
      type: fileObj.type,
      blob: fileObj, // Store the native File/Blob object directly
      createdAt: new Date().toISOString()
    };

    const request = store.add(fileData);

    request.onsuccess = () => resolve(fileData);
    request.onerror = (e) => reject(e.target.error);
  });
};

export const getFiles = async (folderId) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['files'], 'readonly');
    const store = transaction.objectStore('files');
    const index = store.index('folderId');
    const request = index.getAll(IDBKeyRange.only(folderId));

    const projectId = openProjectId();
    request.onsuccess = () => resolve(request.result.filter((r) => belongsTo(r, projectId)));
    request.onerror = (e) => reject(e.target.error);
  });
};

export const deleteFile = async (fileId) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    const request = store.delete(fileId);

    request.onsuccess = () => resolve();
    request.onerror = (e) => reject(e.target.error);
  });
};

// Every stored file (all folders) — used by the full backup (DataIO).
export const getAllFiles = async () => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['files'], 'readonly');
    const request = transaction.objectStore('files').getAll();

    request.onsuccess = () => resolve(request.result);
    request.onerror = (e) => reject(e.target.error);
  });
};

// Delete every file of one project (when the project is deleted).
export const deleteProjectFiles = async (projectId) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    const request = store.getAll();
    request.onsuccess = () => request.result.filter((r) => belongsTo(r, projectId)).forEach((r) => store.delete(r.id));

    transaction.oncomplete = () => resolve();
    transaction.onerror = (e) => reject(e.target.error);
  });
};

// Replace ALL stored files with `records` ({ id, folderId, projectId, name,
// size, type, blob, createdAt }) in one transaction: if any write fails, nothing changes.
export const replaceAllFiles = async (records) => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['files'], 'readwrite');
    const store = transaction.objectStore('files');
    store.clear();
    records.forEach((record) => store.put(record));

    transaction.oncomplete = () => resolve(records.length);
    transaction.onerror = (e) => reject(e.target.error);
    transaction.onabort = (e) => reject(e.target.error || new Error('aborted'));
  });
};
