// ─────────────────────────────────────────────────────────────
// storeRegistry — the one list of every localStorage store the app owns.
//
// Each entry describes a key, never its contents:
//   key    the base localStorage key
//   scope  'project' — one copy per project ('pm-p:<id>:<key>', see Projects)
//          'global'  — shared by every project
//          'device'  — this device only (preferences, session); a full
//                      restore leaves it as it is
//   owner  the src/utils module that reads / writes it (the only one allowed)
//   lists  record lists inside the stored value, for item-level sync and
//          history: [{ path, idField }] — path '' = the stored value is the
//          array itself; a dotted path points inside an object. A store with
//          no lists is synced as one document.
//   sync   false = never leaves this device (restore points, preferences)
//
// DataIO.APP_STORAGE_KEYS (backups) and Projects.PROJECT_SCOPED_KEYS are
// derived from this list. A new store = one entry here, nothing else.
// ─────────────────────────────────────────────────────────────

export const STORES = [
  { key: 'pm-projects', scope: 'global', owner: 'Projects', lists: [{ path: 'projects', idField: 'id' }], sync: true },
  { key: 'pm-last-project', scope: 'device', owner: 'Projects', sync: false },
  { key: 'project-manager-gantt-tasks', scope: 'project', owner: 'ProjectProvider', lists: [{ path: '', idField: 'id' }], sync: true },
  { key: 'project-manager-project-meta', scope: 'project', owner: 'ProjectProvider', lists: [{ path: 'variations', idField: 'id' }], sync: true },
  {
    key: 'project-manager-finance-data',
    scope: 'project',
    owner: 'Finance',
    lists: ['machinery', 'materials', 'pettyCash', 'payroll'].map((path) => ({ path, idField: 'id' })),
    sync: true,
  },
  { key: 'project-manager-finance-config', scope: 'project', owner: 'Finance', sync: true },
  { key: 'pm-calculator-templates', scope: 'project', owner: 'CalculatorTemplates', lists: [{ path: '', idField: 'id' }], sync: true },
  { key: 'project-manager-daily-reports', scope: 'project', owner: 'DailyNotes', lists: [{ path: '', idField: 'id' }], sync: true },
  { key: 'pm-orders', scope: 'project', owner: 'OrderEngine', lists: [{ path: 'orders', idField: 'id' }], sync: true },
  {
    key: 'pm-registries',
    scope: 'global',
    owner: 'Registries',
    lists: ['contractors', 'teams', 'workers'].map((path) => ({ path, idField: 'id' })),
    sync: true,
  },
  { key: 'pm-identity', scope: 'global', owner: 'Identity', sync: false },
  { key: 'pm-plans', scope: 'project', owner: 'PlanningStore', sync: true },
  { key: 'pm-rate-library', scope: 'global', owner: 'RateLibrary', lists: [{ path: 'items', idField: 'id' }], sync: true },
  { key: 'pm-templates', scope: 'global', owner: 'TemplateEngine', lists: [{ path: 'templates', idField: 'id' }], sync: true },
  { key: 'pm-activity', scope: 'project', owner: 'ActivityLog', lists: [{ path: '', idField: 'id' }], sync: true },
  { key: 'pm-snapshots', scope: 'project', owner: 'Snapshots', sync: false },
  { key: 'pm-language', scope: 'device', owner: 'i18n', sync: false },
  { key: 'pm-theme', scope: 'device', owner: 'Theme', sync: false },

  // Roadmap stores (plans/roadmap-plan.md) — registered ahead so every
  // workstream builds on the same list.
  // { settings, rates: { [contractorId]: { [taskId]: rate } }, certificates: [] }
  { key: 'pm-certificates', scope: 'project', owner: 'Certificates', lists: [{ path: 'certificates', idField: 'id' }], sync: true },
  // { days: { 'YYYY-MM-DD': { weather, manpower, equipment, visitors, issues, … } } }
  { key: 'pm-site-diary', scope: 'project', owner: 'SiteDiary', sync: true },
  // { events: [{ id, title, cause, start, end, taskIds, noticeDate, … }] }
  { key: 'pm-delays', scope: 'project', owner: 'Delays', lists: [{ path: 'events', idField: 'id' }], sync: true },
  // { url, anonKey } — which server this device talks to
  { key: 'pm-server', scope: 'device', owner: 'sync', sync: false },
  // signed-in user and device id on this device
  { key: 'pm-session', scope: 'device', owner: 'sync', sync: false },
];

export const storeFor = (key) => STORES.find((s) => s.key === key) || null;

/** Every key the app writes (backups include all of them). */
export const ALL_STORE_KEYS = STORES.map((s) => s.key);

/** Keys with one copy per project. */
export const PROJECT_STORE_KEYS = STORES.filter((s) => s.scope === 'project').map((s) => s.key);

/** Keys that describe this device only (a full restore keeps them). */
export const DEVICE_STORE_KEYS = STORES.filter((s) => s.scope === 'device').map((s) => s.key);

/** Stores the server sync carries. */
export const SYNCED_STORES = STORES.filter((s) => s.sync);
