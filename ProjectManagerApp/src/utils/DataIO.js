// ─────────────────────────────────────────────────────────────
// DataIO — full backup / restore of all app data.
//
// The app persists everything in localStorage (tasks, baseline/variations,
// finance ledgers, calculator templates, daily reports). A single browser
// cache clear would wipe it all. These helpers bundle every known key into
// one downloadable JSON file and restore it on demand.
// ─────────────────────────────────────────────────────────────

// Every localStorage key the application writes to.
export const APP_STORAGE_KEYS = [
  'project-manager-gantt-tasks',   // tasks / BOQ
  'project-manager-project-meta',  // baseline + variations + lifecycle status
  'project-manager-finance-data',  // finance ledgers (machinery, materials, …)
  'project-manager-finance-config',// finance dropdown lists
  'pm-calculator-templates',       // calculator templates
  'project-manager-daily-reports', // daily site reports
];

const BACKUP_MAGIC = 'projectmanager-backup';
const BACKUP_VERSION = 1;

/**
 * Gather every known app key currently in localStorage into a plain object.
 * Missing keys are skipped (not stored), so restore only writes what existed.
 */
const snapshotStorage = () => {
  const data = {};
  APP_STORAGE_KEYS.forEach((key) => {
    const raw = localStorage.getItem(key);
    if (raw !== null) data[key] = raw; // keep raw string — preserve exact JSON
  });
  return data;
};

/**
 * Build a backup payload and trigger a browser download of the JSON file.
 * Returns the generated filename (without path).
 */
export const exportAppData = () => {
  const payload = {
    magic: BACKUP_MAGIC,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'ProjectManagerApp',
    storage: snapshotStorage(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);

  // Compact, filesystem-safe timestamp: 2026-08-01_14-30
  const stamp = payload.exportedAt
    .slice(0, 16)
    .replace(/[:T]/g, '-')
    .replace(/-/g, (m, i) => (i === 4 || i === 7 ? '-' : ''));
  const filename = `project-backup-${stamp.slice(0, 10)}_${stamp.slice(11)}.json`;

  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  return filename;
};

/**
 * Validate a parsed backup object. Returns an object describing the result:
 *   { ok: boolean, reason?: string, stats?: { keys, bytes } }
 */
export const validateBackup = (parsed) => {
  if (!parsed || typeof parsed !== 'object') {
    return { ok: false, reason: 'الملف ليس كائن JSON صالح.' };
  }
  if (parsed.magic !== BACKUP_MAGIC) {
    return { ok: false, reason: 'الملف ليس نسخة احتياطية معتمدة من هذا التطبيق.' };
  }
  if (!parsed.storage || typeof parsed.storage !== 'object') {
    return { ok: false, reason: 'بنية النسخة الاحتياطية غير سليمة (لا يوجد قسم storage).' };
  }

  const keys = Object.keys(parsed.storage).filter((k) => APP_STORAGE_KEYS.includes(k));
  if (keys.length === 0) {
    return { ok: false, reason: 'لا توجد مفاتيح بيانات معروفة داخل النسخة الاحتياطية.' };
  }

  let bytes = 0;
  keys.forEach((k) => {
    bytes += (parsed.storage[k] || '').length;
  });

  return { ok: true, stats: { keys: keys.length, bytes } };
};

/**
 * Read a File object (from <input type=file>) as JSON.
 * Returns a promise resolving to the parsed object.
 */
export const readBackupFile = (file) =>
  new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('لم يتم اختيار ملف.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّر قراءة الملف.'));
    reader.onload = () => {
      try {
        resolve(JSON.parse(String(reader.result)));
      } catch {
        reject(new Error('الملف لا يحتوي على JSON صالح.'));
      }
    };
    reader.readAsText(file);
  });

/**
 * Restore a previously-validated backup payload into localStorage.
 * Writes back ONLY the known keys present in the backup; leaves others intact.
 * Returns the list of keys that were written.
 *
 * NOTE: callers should reload the app (window.location.reload()) afterwards so
 * every component re-initializes its state from the freshly-written storage.
 */
export const restoreAppData = (parsed) => {
  const result = validateBackup(parsed);
  if (!result.ok) {
    throw new Error(result.reason);
  }
  const written = [];
  Object.entries(parsed.storage).forEach(([key, rawValue]) => {
    if (APP_STORAGE_KEYS.includes(key) && typeof rawValue === 'string') {
      localStorage.setItem(key, rawValue);
      written.push(key);
    }
  });
  return written;
};
