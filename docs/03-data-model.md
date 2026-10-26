# 03 — Data Model: Where Every Byte Lives

<!-- Planning sections (task links, meta.planning) last verified 2026-10-26. -->
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
> Files may carry `orderId` (an order's photo). In use: `pm-certificates`
> (project, owner `Certificates`, §13), `pm-site-diary` and `pm-delays`
> (project, §10a). Also registered ahead for auto-planning
> (`plans/auto-planning-plan.md`): the global `pm-work-types`
> (`{ items: [...] }`, owner `utils/planning/WorkTypes.js`). The device-only
> `pm-server` / `pm-session` and the server copy of the shared data are
> described in §14.

---

## 0. Projects — one set of keys per project

`pm-projects` lists the projects:

```js
{ projects: [ { id, name, contract, location, startDate: 'YYYY-MM-DD', createdAt, legacy?,
                serverId?, revoked? } ] }
// serverId: shared on the server under this id (a project pulled from the server uses it as id too)
// revoked:  this account lost access on the server — kept here, no longer synced (§14)
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
| 3 | `project-manager-finance-data` | P | Finance | old cost ledger (read-only since expenses are orders) + migrated flag |
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
| 22 | `pm-server` | device | sync/serverConfig | `{ url, anonKey }` — the server this device uses (§14) |
| 23 | `pm-session` | device | sync/session | who is signed in, organization, role per project (§14) |

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
  dependsOn: 'other-task-id' | null,  // the FIRST predecessor (slot 0)
  depType: 'FS' | 'SS' | 'FF' | 'SF',
  lag: 7,                        // working days, can be negative (overlap)

  // optional (auto-planning) — absent on older tasks, all mean "as before":
  predecessors: [{ id, type, lag, lagUnit?: 'cd' }], // EVERY predecessor; [0] mirrors
                                 // dependsOn/depType/lag, which always win for slot 0.
                                 // Only stored when there are 2+ links or a 'cd' lag.
                                 // lagUnit 'cd' = calendar days (curing), else working days.
                                 // Read/write ONLY through utils/planning/links.js.
  levelLinks: [{ id, type: 'FS', lag: 0 }], // written by resource leveling (crew hand-overs);
                                 // they only delay the start and never override the logic
  pinned: true,                  // resource leveling never moves this item

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
weightedProgress, plannedProgress, plannedCost, isCritical, totalFloat,
warnings`, and (auto-planning) `links` (every logic link, lag parsed),
`levelLinks` (normalized), `drivingLinkId` (the predecessor that sets the
start), `spanDays` (calendar days the bar covers — `duration` is working days)

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
  variations: [ /* Variation Order records, below */ ],
  // optional (auto-planning); absent = every day is a working day, as before:
  planning: {
    version: 1,
    calendar: {
      weekRest: [5],                                   // UTC weekdays off (5 = Friday)
      holidays: [{ from: 'YYYY-MM-DD', to, name }],    // days off
      periods: [{ from, to, factor: 0.75, name }],     // reduced pace (Ramadan)
      workdays: ['YYYY-MM-DD'],                        // worked although off
    },
  }
}
```
`planning` is not in `DEFAULT_META`. Durations and lags are working days on
this calendar (`utils/planning/WorkCalendar.js`).

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
  recordedById,                // the recorder's account id (currentActor().id); null without accounts
  details,
  evidence: [fileId, …],       // photo ids in IndexedDB (folder 'order_photos'), [] when none
}
```

**Expense details** (last verified 2026-10-26). Expense orders are the one
place expenses are entered; the Finance ledgers are views over them. Their
structured fields sit in `details` (same keys as the form draft; numbers
stored as numbers, empty fields left out); `amount` / `category` stay as
before, so EVM, reports and certificates read them unchanged.

| Type | `details` keys | `amount` |
|---|---|---|
| `machinery` | `machineType`, `machineSize`, `driver` (finance lists), `machineHours`, `machineRate`, `driverHours`, `driverRate`, `fuelLiters`, `fuelPrice` | computed: hours × rate + driver hours × rate + liters × price |
| `material` | `material` (list), `materialQty`, `materialUnit`, `unitPrice`, `receipt` | computed: qty × unit price |
| `payroll` | `employee` (list), `salary`, `advance`, `payStatus` (list) | computed: salary − advance **only when `payStatus === 'مستقطع'`** (a stored data value, quirk #4), else salary |
| `other_expense` | `expenseType` (list) | typed |
| `fuel` | — | typed |

Orders moved from the old finance ledger also carry `source:
'finance-migration'`, `sourceLedger` (machinery / materials / pettyCash /
payroll), `sourceId` (the old record's id) and `migratedAt`; their id is
`fin-<ledger>-<old id>` (the same on every device). They keep the old
date, are `approved`, `recordedBy` = the old record's author or the
migrating user, and `recordedAt` = the old id's timestamp. Old-only fields
stay in `details`: machinery `machineName`, `badge`; materials
`quantityText` (the old free-text quantity, e.g. "150 م3") and `note`
(the old "details" text).

**Photo evidence.** Photos picked on the Record form are compressed
(`utils/ImageCompress`: JPEG, longest side 1600 px, quality 0.8) and stored
*before* the order: `saveFile('order_photos', blob, { orderId })` per photo,
then the order is saved with `evidence: ids` (at most 6). If IndexedDB fails
the order is saved with `evidence: []` and a warning toast. Deleting an order
deletes its photos (`deleteFiles(order.evidence)`); deleting a photo in
Files → *Order photos* removes its id from the order. "Repeat last order"
never copies photos.

**Order rules** (nothing extra is stored; `state/orderForm.js`):
- *Warnings* before saving (over the contract, likely duplicate, future date,
  before the project start, an expense far above its type's median) only ask
  "Save anyway?"; the order is stored as usual.
- *Approving*: nobody approves their own formal order once accounts exist —
  compared by `recordedById`, else by `recordedBy` name (orders from before
  accounts). Without accounts (`currentActor().id` null) the one local user
  approves everything, as before. The server enforces the same rule with its
  own `items.recorded_by`.
- *Certificate lock*: an order whose id is in an **issued** certificate's
  `orderIds` (§13, `certificatesByOrder()`) is not deleted or approved again;
  the Record screens refuse with the certificate's number and a link.

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
// pm-templates  (seedVersion 2: the nine building templates; older seeds archived)
{ seedVersion: 2, templates: [
  // schema 1 (older / custom templates; generateProject)
  { id, name, icon, version, createdAt, source, archived?,
    variables: [{ key, label, default }],          // e.g. floors, lengths
    elements: [{
      partId, name, qtyFormula,                    // formula references variables
      group, repeatsVar,                           // repeat element per variable value
      depOn, depType, lag,                         // dependency wiring ('5@2', '5@last')
      isGroup, depth, unit, fixedUnitPrice, productivity, rateName
    }] },
  // schema 2 (building templates; utils/planning/autoPlan.planProject)
  { id, schema: 2, kind: 'building', type: 'apartments', name, nameEn, icon, version, createdAt, source,
    variables: [{ key, label, labelEn, type: 'number'|'int'|'bool'|'choice', default, min?, max?, unit?,
                  options?: [{ value, label, labelEn }] }],
    levels: { count: 'floors', basement: 'basement', area: 'areaPerFloor', height: 'floorHeight',
              use: 'residential', groundUse?, basementUse?, anchor? },
    sections: [{ key: 'prelim'|'sub'|'level'|'roof'|'external'|'systems', name, nameEn }],
    elements: [{ key, workType, section, scope: 'once'|'level', qty /*formula*/, when? /*formula*/,
                 name?, nameEn?, crews?,
                 links: [{ to: key|[keys], floor?: 'same'|'prev'|'next'|'first'|'last'|'all'|{offset},
                           if?: 'first'|'notFirst'|'last'|'notLast', type, lag, lagUnit? }] }] },
]}

// pm-rate-library  (copy-on-generate: templates snapshot prices, later edits don't propagate)
// Prices are DIRECT COST; a project adds its markups (meta.planning.markups).
{ seedVersion: 2, items: [{ id, name, unit, unitPrice /*IQD*/, category, checked? }] }
// ~40 base items + the building rates (ids 'rb-…'), added once to older libraries

// pm-work-types  (global; utils/planning/WorkTypes.js) — the work-type library
{ seedVersion: 1, removedSeeds: [id], items: [{
    id, name, nameEn, unit, trade,                 // trade: utils/planning/trades.js
    productivity,                                  // qty per crew per working day
    crew: { labour, equipment: { crane: 1, … } },  // one crew
    rateId,                                        // pm-rate-library item that prices it
    keywords: [], aliases: [],                     // BOQ matching
    fixedDays,                                     // fixed duration (mobilization, testing…)
    legacy, checked, source: 'seed'|'user', learned, history: []
}]}
```
**`pm-work-types` must be registered in `storeRegistry.js`** (requested from
the integrator; until then it is not in backups).

Generated tasks also carry (optional): `workTypeId`, `trade`, `crews`,
`productivity`, `durationSource` (`productivity`|`fixed`|`manual`),
`unitCost` (direct cost; `unitPrice` = contract price with markups),
`templateKey` (element key), `floor` (level index). `meta.planning` of a
generated project: `{ version, calendar, markups: { overhead, contingency,
profit }, crews }`.

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
| `project-manager-finance-data` | **the old ledger, read-only** (expenses are expense orders now): rows per tab `{ machinery, materials, pettyCash, payroll }` (old record shapes: machinery `{ id, date, machineName, machineType, machineSize, badge, machineHours, machineRate, machineTotal, operator, driverHours, driverRate, driverTotal, fuelLiters, fuelPrice, fuelTotal, totalPrice }`, materials `{ id, date, receipt, details, materialType, quantity (text), totalPrice }`, pettyCash `{ id, date, expenseType, notes, totalPrice }`, payroll `{ id, date, employee, salary, advancePayment, status, totalPrice }`) + `migration: { migratedAt, migratedBy, lastRunAt, count, sourceKeys: ['<ledger>:<id>'] }` once moved into expense orders. Nothing writes the rows any more and the key is never deleted. Payroll status `'مستقطع'` is a stored data value — see quirks doc |
| `project-manager-finance-config` | the finance lists `{ machines, machineSizes, employees, materials, expenseTypes, statuses }` that expense order details pick from (edited on Finance → Lists) |

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
reads `pm-plans` day assignments and never writes them. The diary syncs day
by day (registry list `days`, `keyed: true`): two people editing different
days never collide (§14).

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

`pm-session` and `pm-server` (who is signed in, which server) are never
written into a backup and never restored from one (`DataIO.LOCAL_ONLY_KEYS`).

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
  `certifiedOrderIds()` = every order id in an issued certificate (for locking:
  those orders cannot be deleted or approved again — §4 *Order rules*).

---

## 14. Server sync (`src/sync`, `supabase/`)

The local stores above stay the read model on every device; the server
keeps the shared copy, item by item, plus the full history.
Setup: [08-server-setup.md](08-server-setup.md).

### On the device

```js
// pm-server (device) — which server; without it the build's VITE_SUPABASE_URL / _ANON_KEY
{ url: 'https://pm-laptop.tailxxxx.ts.net', anonKey: '<public anon key>' }

// pm-session (device) — readable synchronously by currentActor(); no secrets
{ mode: 'account' | 'local' | null,      // local = "use without an account"
  server,                                 // the url the account is on
  user: { id, email, name } | null,
  needsSignIn,                            // sign-in expired: works offline, syncs after signing in
  signedInAt, hasOrg,
  org: { id, name, role } | null,         // the organization role
  projectRoles: { [serverProjectId]: role },
  deviceId }
```

IndexedDB **`pm-sync`** (never in a backup): `kv` (device id, the sign-in
token `auth:*`, pull cursors `cursor:<scope>`, flags), `shadow` (per scope
and store: the base of each item — what the server had — `{ h, rev, pos,
data, deleted, by, pending?, sup?, lo? }`), `outbox` (queued changes:
`{ seq, scopeKey, orgId, projectId, collection, key, op, data, before,
deleted, pos, baseRev, rev, actorId, deviceId, clientAt, restoredFrom?,
attempts, failed? }`).

### How a store becomes items

Each store in `SYNCED_STORES` (storeRegistry) except `pm-projects` is split
by its `lists`: a record of list `path` is item `'<path>/<id>'` (`'<id>'`
when the stored value is the list), everything else is item `'$doc'` (lists
left as `[]`). A list marked `keyed: true` in the registry is an object of
records by key (diary days by date …): item `'<path>/<key>'`, `{}` left in
`'$doc'`. A store without lists is one `'$doc'`. Uploaded files are
items of collection `files` (`{ id, folderId, name, size, type, createdAt,
orderId? }`) with the bytes in Storage `files/<server project id>/<file id>`.
Scopes: the organization (global stores: `pm-registries`, `pm-rate-library`,
`pm-templates`) and each shared project (project stores). The project list
itself syncs through the server's `projects` table.

### On the server (Postgres, schema in `supabase/migrations/`)

| Table | Holds |
|---|---|
| `orgs`, `org_members(org_id, user_id, role)` | the company and the organization role |
| `profiles(id, email, name)` | one per account (made on sign-up) |
| `projects(id, org_id, name, contract, location, start_date, local_id, archived)` | shared projects |
| `project_members(project_id, user_id, role)` | role per project (an org admin is admin everywhere) |
| `invites(org_id, project_id?, email, role)` | e-mails waiting to sign up |
| `items(org_id, project_id?, collection, item_id, data, pos, rev, deleted, recorded_by, updated_by, updated_at, txid, seq)` | one row per record; `project_id` null = organization store; deleting keeps the data |
| `changes(id, org_id, project_id?, collection, item_id, op, before, after, rev, outcome, note, actor, actor_name, device_id, client_at, server_at, restored_from)` | append-only history: every applied write (`outcome 'applied'`, by trigger) and every version that lost a conflict or was refused (`'rejected'`); `op` = insert / update / delete / restore / import |

Row-level security: members read; writes need the action of
`app_private.collection_rules` (mirror of `src/sync/rules.js`, from the
`permissions.js` matrix) for the version before and after; approving a
formal order needs an approver who is not `recorded_by`; `changes` only
grows. Conflicts (`push_changes`): approved beats recorded, else the
higher `rev`, a tie keeps the server's version.
