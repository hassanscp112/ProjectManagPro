# 03 — Data Model: Where Every Byte Lives

There is **no server and no database**. Everything is stored in the browser:

- **localStorage** — all structured data (20 keys, listed first)
- **IndexedDB** (`ProjectManagerDB`) — uploaded file blobs only

> If you add a new localStorage key, you MUST add it to
> `utils/storeRegistry.js` (key, scope `project` / `global` / `device`, owner,
> record lists). `DataIO.APP_STORAGE_KEYS` and `Projects.PROJECT_SCOPED_KEYS`
> are derived from it, so backups and per-project copies follow. A
> project-scoped key is read / written through `projectKey(KEY)`.
>
> Registered ahead for the roadmap (`plans/roadmap-plan.md`), not used yet:
> the device-only `pm-server`, `pm-session`. Files may carry `orderId` (an
> order's photo). In use: `pm-certificates` (project, owner `Certificates`,
> §13), `pm-site-diary` and `pm-delays` (project, §10a).

---

## 0. Projects — one set of keys per project

`pm-projects` lists the projects:

```js
{ projects: [ { id, name, contract, location, startDate: 'YYYY-MM-DD', createdAt, legacy? } ] }
```

- **Project-scoped keys** (`Projects.PROJECT_SCOPED_KEYS`, marked *P* below):
  each project has its own copy at `pm-p:<projectId>:<key>`.
- The **first project** (`id: 'project-1'`, `legacy: true`) is the data that
  existed before multi-project support: it keeps the plain keys, so nothing
  had to move. `ensureProjects()` (startup) creates its entry when plain
  project data exists and the list has no legacy entry.
- **Shared keys** (people, identity, templates, rates, language, theme, the
  list itself) are the same for every project.
- The project open in a tab is `sessionStorage['pm-active-project']`;
  `pm-last-project` remembers the last one opened (deep links in a new tab).
- Files (IndexedDB) carry `projectId`; records without one belong to the
  first project.
- `deleteProject(id)` removes the entry and every *P* key of that project;
  the Projects page downloads a full backup first and also deletes its files.

---

## 1. Master table of localStorage keys

*P* = one copy per project (§0); the rest are shared.

| # | Key | Scope | Owner module | What it holds |
|---|-----|-------|--------------|---------------|
| 1 | `project-manager-gantt-tasks` | P | ProjectProvider | Task tree (raw array) |
| 2 | `project-manager-project-meta` | P | ProjectProvider | status / baseline / variations |
| 3 | `project-manager-finance-data` | P | Finance | cost ledger entries |
| 4 | `project-manager-finance-config` | P | Finance | editable dropdown lists |
| 5 | `pm-calculator-templates` | P | CalculatorTemplates | BOQ calculator templates |
| 6 | `project-manager-daily-reports` | P | DailyNotes | daily site notes |
| 7 | `pm-orders` | P | OrderEngine | order ledger + lastWhoByType |
| 8 | `pm-registries` | shared | Registries | contractors / teams / workers |
| 9 | `pm-identity` | shared | Identity | current user {name, role} |
| 10 | `pm-plans` | P | PlanningStore | lookahead targets/assignments |
| 11 | `pm-rate-library` | shared | RateLibrary | IQD unit-price catalog |
| 12 | `pm-templates` | shared | TemplateEngine | project structure templates |
| 13 | `pm-activity` | P | ActivityLog | app event log (cap 2000) |
| 14 | `pm-snapshots` | P | Snapshots | auto (14 days) + named snapshots |
| 15 | `pm-language` | shared | i18n | `'ar'` \| `'en'` |
| 16 | `pm-theme` | shared | Theme | `'light'` \| `'dark'` \| `'system'` (default light) |
| 17 | `pm-projects` | shared | Projects | the project list (§0) |
| 18 | `pm-last-project` | shared | Projects | id of the last project opened on this device |
| 19 | `pm-site-diary` | P | SiteDiary | site diary, one entry per day (§10a) |
| 20 | `pm-delays` | P | Delays | delay register events (§10a) |
| 21 | `pm-certificates` | P | Certificates | payment certificates, agreed rates, default terms (§13) |

---

## 2. Task object

### Raw task (what's saved in `project-manager-gantt-tasks`)

```js
{
  id: 'uuid',                    // crypto.randomUUID or timestamp-random
  wbs: '1.1.1',                  // hierarchical number, children = '1.1.1.x'
  name: '…',                     // Arabic work description
  isGroup: false,                // true = section heading (no qty)
  manualStart: '2025-08-23',     // ISO date, honored by scheduler
  duration: 60,                  // working days
  quantity: 9413.4,              // contract qty (manual, or frozen at sign-off)
  actualQuantity: 9413,          // executed qty (manual ONLY if no orders exist)
  unitPrice: 1350,               // IQD per unit
  unit: 'م3',
  dependsOn: 'other-task-id' | null,
  depType: 'FS' | 'SS' | 'FF' | 'SF',
  lag: 7,                        // days, can be negative (overlap)

  // quantity take-off (group tasks, editable in the full task details page, Edit view):
  elementColumns: [{ id, name, unit, wasteFactor, linkedTaskId|null }],
  elements: [{ id, name, status, values: { [columnId]: number } }],
  // element.status: 'not_started' | 'in_progress' | 'completed' | 'on_hold'

  // set when the task was created BY an element-column BOQ link:
  boqLink: { parentId, colId, mode: 'created' | 'existing' },
}
```

### Computed task (same object **plus** fields added by `GanttEngine.calculate`)

`qty, actualQty, price, totalCost, actualCost, progress, startDate, endDate,
elementSumRaw, elementSum, boqLinked, orderSource {manual, formalQty, quickQty,
orderCount}, baselineQty, scopeVariance, execVariance, weight,
weightedProgress, plannedProgress, plannedCost, isCritical, warnings`

Rule of thumb: **raw = what the user set, computed = what the engine derived.**
Screens that let editing receive raw `tasks` from App; read-only views receive
`engineResult.tasks` (computed) — check the props table in
[02-architecture.md](02-architecture.md).

---

## 3. Project meta (`project-manager-project-meta`)

```js
{
  status: 'draft' | 'signed' | 'executing' | 'completed',
  baseline: {
    signedAt: 'ISO datetime',
    signedBy: 'name',
    tasks: { [taskId]: { quantity, unitPrice, unit, duration,
                         manualStart, name, wbs } }   // frozen copy per task
  } | null,
  variations: [ /* Variation Order records, below */ ]
}
```

### Variation Order record

```js
{
  id, date: 'ISO',
  taskId, taskWbs, taskName,
  type: 'qty' | 'price',
  field: 'quantity' | 'unitPrice',
  oldValue, newValue,
  reason, approver,
  urgency: 'low' | 'medium' | 'high',
  classification: 'qty' | 'price' | 'scope' | 'add' | 'remove' | '',
  estCostImpact: number,        // auto-derived from qty delta × unitPrice if blank
  estScheduleDays: number | null,
  clauseRef: 'FIDIC 13.x',
  status: 'issued',
}
```

---

## 4. Orders (`pm-orders`)

```js
{
  orders: [ /* order records, below */ ],
  lastWhoByType: { [orderType]: who }   // smart default: re-seed last crew per type
}
```

### Order record

```js
{
  id, type,                    // type see table in 01-overview §3
  family: 'value' | 'expense',
  tier: 'quick' | 'formal',
  date: 'YYYY-MM-DD',
  who: { kind: 'contractor'|'team'|'workers'|'none',
         contractorId?, teamId?, workerIds?, count? },
  taskId, elementId,           // value orders point at a leaf task (+ optional element)
  quantity, unit,              // value family
  amount, category,            // expense family (category = type label)
  location, sampleRef, result, depth, note,   // test/order extras
  status: 'recorded' | 'approved',   // quick orders are born approved
  approvedBy,
  recordedAt: 'ISO', recordedBy,
  details,
  evidence: [fileId, …],       // photo ids in IndexedDB (folder 'order_photos'), [] when none
}
```

**Photo evidence.** Photos picked on the Record form are compressed
(`utils/ImageCompress`: JPEG, longest side 1600 px, quality 0.8) and stored
*before* the order: `saveFile('order_photos', blob, { orderId })` per photo,
then the order is saved with `evidence: ids` (at most 6). If IndexedDB fails
the order is saved with `evidence: []` and a warning toast. Deleting an order
deletes its photos (`deleteFiles(order.evidence)`); deleting a photo in
Files → *Order photos* removes its id from the order. "Repeat last order"
never copies photos.

---

## 5. Registries (`pm-registries`), Identity (`pm-identity`)

```js
// pm-registries
{
  contractors: [{ id, name, phone, notes }],
  teams:       [{ id, name, foremanWorkerId, memberWorkerIds, defaultSize, notes }],
  workers:     [{ id, name, trade, dailyRate, phone, notes }],
}
// pm-identity
{ name: 'string', role: 'string' }
```

Team `defaultSize` convention: when it equals the member count it displays as
"auto"; a typed number makes it manual; clearing restores auto.

---

## 6. Plans / lookahead (`pm-plans`)

```js
{
  months: { 'YYYY-MM':    { targets:     [{ id, taskId, quantity, note }] } },
  weeks:  { 'YYYY-Www':   { assignments: [{ id, taskId, who, note }] } },
  days:   { 'YYYY-MM-DD': { assignments: [{ id, taskId, who, note }] } },
}
```

`who` here reuses the same shape as orders. Keys: ISO month, ISO week
(`2026-W39`), ISO date.

---

## 7. Snapshots (`pm-snapshots`)

```js
{
  auto:  { 'YYYY-MM-DD': { tasks, projectMeta, createdAt, actor } },  // capped at 14, oldest dropped
  named: [ { id, name, tasks, projectMeta, createdAt, actor } ],      // kept forever
}
```

⚠️ Snapshots cover **tasks + projectMeta only** — not orders/finance/reports.
`restoreSnapshot()` writes back into `project-manager-gantt-tasks` and
`project-manager-project-meta` (if the second write fails the first is put
back), then the app page-reloads. Settings first keeps the current data as a
named snapshot "Before restoring …" and refuses to restore if it can't.

---

## 8. Templates & rate library

```js
// pm-templates
{ templates: [{
    id, name, icon, version, createdAt, source,
    variables: [{ key, label, default }],          // e.g. floors, lengths
    elements: [{
      partId, name, qtyFormula,                    // formula references variables
      group, repeatsVar,                           // repeat element per variable value
      depOn, depType, lag,                         // dependency wiring
      isGroup, depth, unit, fixedUnitPrice, productivity, rateName
    }]
}]}

// pm-rate-library  (copy-on-generate: templates snapshot prices, later edits don't propagate)
{ items: [{ id, name, unit, unitPrice /*IQD*/, category }] }   // ~40 seeded defaults
```

---

## 9. Activity events (`pm-activity`)

```js
[ { id, at: 'ISO', actor, kind, summary, refType, refId, payload } ]
// capped at 2000 (MAX_APP_EVENTS)
```

The Activity screen feed merges three sources at read time:
orders + variations (from project-meta) + these app events —
`ActivityLog.buildUnifiedFeed()` produces normalized feed entries
`{id, at, date, actor, kind: 'order'|'variation'|'event', family, title,
subtitle, tone, refTaskId, payload}`.

---

## 10. Calculator & reports & finance keys

| Key | Shape |
|-----|-------|
| `pm-calculator-templates` | `[{ id, name, columns: [{ id, label, source: 'input'\|'design'\|'formula', formula }], rows: [{ …, values: { [colId]: number } }] }]` |
| `project-manager-daily-reports` | site notes `[{ id, date, engineer, taskId, taskName, taskWbs, details, timestamp, quantity? }]` — the manual part of the daily report (the "work done" part is derived live from orders). `quantity` exists only on notes written before Phase 5 and is shown read-only; new notes don't record quantities |
| `project-manager-finance-data` | ledger rows per tab (machinery / materials / petty cash / payroll). Payroll status `'مستقطع'` is a stored data value — see quirks doc |
| `project-manager-finance-config` | editable dropdown option lists for the finance forms |

---

## 10a. Site diary & delay register (`pm-site-diary`, `pm-delays`)

```js
// pm-site-diary — one entry per day; a day with nothing in it is removed
{ days: { 'YYYY-MM-DD': {
    weather: '' | 'sunny' | 'dusty' | 'rain' | 'heat',
    maxTemp: number | null,                    // °C
    hours: number | null,                      // working hours, 0–24
    manpower:  [{ id, trade, count }],         // trade '' = general labour
    equipment: [{ id, type, count }],
    visitors:  [{ id, name, org, purpose }],
    issues: string,
    recordedBy, recordedById, recordedAt,      // first save (Identity.currentActor)
    updatedBy, updatedById, updatedAt,         // last save
} } }

// pm-delays — list path 'events', id 'id'
{ events: [{
    id, title,
    cause: 'weather' | 'client' | 'design' | 'access' | 'supply' | 'other',
    start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' | '',   // '' = still going on (counts to today)
    taskIds: [],                                   // affected BOQ items
    excusable: boolean,                            // default true
    noticeDate: 'YYYY-MM-DD' | '',                 // FIDIC 20.1: within 28 days of start
    daysClaimed: number,
    status: 'draft' | 'submitted' | 'granted' | 'rejected',
    daysGranted: number,                           // counted only when granted
    notes,
    recordedBy, recordedById, createdAt,           // currentActor() on create, kept on edits
    updatedBy, updatedById, updatedAt,
}] }
```

Trades and equipment types are free text (suggestions come from the roster's
worker trades, earlier diary days and a built-in list). The manpower prefill
reads `pm-plans` day assignments and never writes them. The diary store is
synced as one document (no `lists`: days are keyed by date, not an array).

---

## 11. IndexedDB — `ProjectManagerDB` (files)

- DB `ProjectManagerDB` v1, object store **`files`** (keyPath `id`, index `folderId`).
- Record: `{ id, folderId, projectId, name, size, type, blob, createdAt, orderId? }`
  (`getFiles` returns only the open project's files; no `projectId` = the first project;
  `orderId` = the order a photo belongs to).
- Folder tree itself is virtual — root → *Items* (one folder per top-level
  section, `task_<id>`) and *Order photos* (`order_photos`, every order's photos).
- Managed only through `utils/FileDB.js` (`initDB/saveFile/getFiles/deleteFile`,
  plus `getAllFiles/replaceAllFiles` for the backup).
- Included in the backup file since version 2 (§12).

---

## 12. Backup file format (DataIO)

`exportAppData()` downloads `project-backup-YYYY-MM-DD_HH-MM.json`
(`…-before-restore-…` / `…-before-delete-…` for the automatic safety copies):

```js
{
  magic: 'projectmanager-backup',
  version: 3,                    // 1 = no files · 2 = files, one project · 3 = all projects
  exportedAt: 'ISO',
  app: 'ProjectManagerApp',
  storage: { '<localStorageKey>': '<raw JSON string, exactly as stored>' },
                                 // every app key incl. pm-projects and 'pm-p:<id>:…'
  files: [ { id, folderId, projectId?, name, size, type, createdAt, data: '<base64>' } ]
}                                // files left out if IndexedDB couldn't be read
```

`validateBackup()` checks magic/version (a newer version is refused) and
returns stats (keys, bytes, files — `null` for a version-1 backup). Errors are
codes (`BackupError.code`) shown via `app.backup.err.*`.

Restore (`useBackupRestore.jsx`): confirm → **download a safety backup of the
current data first** (restore is cancelled if that fails) → `restoreAppData()`
→ reload. `restoreAppData()` writes the app keys in the backup. A version-3
backup replaces everything: app keys it doesn't hold are removed (language,
theme and last-project stay). Older backups only write the keys they hold
(they restore into the first project). When the backup has a `files` section it replaces ALL
stored files in one IndexedDB transaction; a version-1 backup leaves the files
alone. If any write fails, the localStorage keys are put back as they were.

---

## 13. Payment certificates (`pm-certificates`, per project)

Owner: `utils/Certificates.js` (the only reader / writer, always through
`projectKey`); rules: `state/certificateModel.js`.

```js
{
  settings: {                  // defaults for the first certificate of a series
    retentionPct: 5,           // 0–100
    retentionLimit: 0,         // most that may be held back; 0 = no limit
    advanceAmount: 0,          // the MAIN CONTRACT's advance (a subcontractor starts at 0)
    advanceRecoveryPct: 0,     // share of each period's work recovered, 0–100
    currencyLabel: '',         // '' = the UI's IQD label
  },
  rates: { [contractorId]: { [taskId]: rate } },   // agreed subcontract rates (≥ 0; 0 is a rate)
  certificates: [ /* Certificate, below */ ],
}
```

### Certificate

```js
{
  id, kind: 'subcontractor' | 'employer',
  contractorId,                // null for 'employer' (the main contract)
  number,                      // 1, 2, 3 … per series = kind + contractor
  periodEnd: 'YYYY-MM-DD',     // approved orders dated up to here count
  status: 'draft' | 'issued',  // one draft per series at a time
  terms: { retentionPct, retentionLimit, advanceAmount, advanceRecoveryPct },
                               // copied from the series' previous certificate, else settings
  deductions: [{ id, label, amount }],   // other deductions on THIS certificate
  note, createdAt, createdBy,
  // set when issued — frozen, never changed afterwards:
  issuedAt, issuedBy: { id, name, role },   // Identity.currentActor()
  periodStart,                 // day after the previous certificate (or the first order)
  lines: [{ taskId, wbs, name, unit, rate, missingRate, missingTask,
            prevQty, thisQty, cumQty, prevAmount, thisAmount, cumAmount, orderCount }],
  totals: { gross, retention, advance, deductions, netDue,   // each { prev, this, cum }
            previousNet, netPayable, missingRates },         // (+ retention.limited, advance.remaining/capped)
  orderIds: [],                // the orders this certificate certified (new this period)
}
```

- A **draft is live**: lines and totals are recomputed from the order ledger
  every time. Issuing copies them in, with `orderIds`; an issued certificate
  never changes (`updateDraft` / `deleteDraft` refuse it).
- Counted orders: `family 'value'`, `status 'approved'`, a `taskId`, quantity
  > 0, `date` ≤ `periodEnd`, not already in an issued certificate of the same
  series; a subcontractor certificate only that contractor's
  (`who.kind 'contractor'`). Rate: the agreed rate, or for `'employer'` the
  task's `unitPrice`. No rate → the line is flagged (`missingRate`, amounts
  `null`), left out of the totals, and the draft can't be issued.
- "Previous" columns come from the series' last issued certificate (frozen).
  `certifiedOrderIds()` = every order id in an issued certificate (for locking).
