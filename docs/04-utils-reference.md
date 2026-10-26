# 04 — Utils Reference (the engines)

`ProjectManagerApp/src/utils/` — pure logic + localStorage persistence.
**No React here.** All modules are plain ES modules; most are covered by
tests in `__tests__/` (run: `npm test` from `ProjectManagerApp/`).

Dependency order (leaf → top):

```
storeRegistry, permissions                                             (standalone: the store list and the role matrix)
Projects                                                               (imports storeRegistry; every project-scoped owner imports it)
CalculatorEngine, CriticalPath, Identity, ImageCompress, RateLibrary   (standalone)
FileDB, DataIO                                                         (import Projects)
ActivityLog, PlanningStore, Registries, Snapshots                      (import i18n / Projects)
SiteDiary, Delays                                                      (import Identity / Projects)
OrderEngine                                                            (imports i18n)
TemplateEngine                                                         (imports RateLibrary)
GanttEngine                                                            (imports OrderEngine + CriticalPath)
Certificates                                                           (imports i18n / Projects / ActivityLog / Identity / Registries)
```

---

## Projects.js — the project list and the open project

**Storage:** `pm-projects` (+ `pm-last-project`; open project in sessionStorage).
- `PROJECT_SCOPED_KEYS` — the stores kept once per project; `LEGACY_PROJECT_ID = 'project-1'`
- `keyFor(project, base)` → base for the legacy project, else `'pm-p:<id>:<base>'`; `parseProjectKey(key)`
- `projectKey(base)` — key for the open project (base when none is open); **every project-scoped owner calls it at access time**
- `currentProject()` (cached per page load) / `openProject(id)` / `closeProject()` / `lastProjectId()` / `projectStartDate(project?)`
- `loadProjects()` / `saveProjects(list)` / `getProject(id)` / `createProject(details)` / `updateProject(id, changes)` / `deleteProject(id)` (removes its keys)
- `ensureProjects()` — startup migration: plain project data → the first project

Storage functions take an optional storage argument (tests). Tests: `projects.test.js`.

---

## OrderEngine.js — order ledger (the foundation)

**Storage:** `pm-orders` (writes), `pm-registries` (read-only).

Constants:
- `ORDER_TYPES` — spec object for all 9 types (fields each type shows, tier, family)
- `ORDER_TYPE_LIST` — render-ready list (grouped by family)
- `WHO_KINDS = ['contractor','team','workers','none']`

Functions:
- `loadOrdersData()` / `saveOrdersData(data)` / `addOrder(order)` / `updateOrder(id, patch)` / `deleteOrder(id)`
- `approveOrder(id, approverName)` → sets `status:'approved'` + `approvedBy`
- `createOrderDraft(type, options)` — new draft with smart defaults (date, last who)
- `normalizeWhoForSave(who)` — cleans the who object before persisting
- **Aggregation (used by GanttEngine):**
  - `sumValueOrdersByTask(orders)` → `Map<taskId, {total, formalQty, quickQty, orderCount}>` — approved value orders only
  - `sumExpenses(orders, range?)` → `{total, byCategory}`
  - `ordersInRange(orders, from, to)` / `ordersForContractor(orders, contractorId, range?)`
- `loadRegistries()` / `resolveWhoLabel(who, registries)` — display names
- Date helpers: `formatDateStr`, `todayStr`, `daysAgoStr(days)`
- ID: `createOrderId()`

Tests: `orderEngine.test.js`.

---

## GanttEngine.js — the calculator

**No storage.** `GanttEngine.calculate(tasks, projectStartDate, projectMeta, orders)`
(static) → the single `engineResult` consumed by the store, Home and the reports.
Pipeline explained in [02-architecture.md §3](02-architecture.md). Returns:

```js
{
  tasks,                       // enriched (computed fields listed in 03-data-model)
  projectTotalCost, projectActualCost,
  projectTotalProgress, projectPlannedProgress, projectDeviation,
  evm: { bac, pv, ev, ac, spi, cpi, eac, vac },
  sCurve: [{ date, pv, ev, ac, isFuture }],          // one point per week
  perWbsEvm: [{ wbs, name, taskCount, bac, pv, ev, ac, spi, cpi }],
  expenses, scheduleStartDate, scheduleEndDate, projectDuration,
  warnings,   // [{ taskId, wbs, name, code, params, message }]
}
```

Each computed task also carries `warnings: [{ code, params, message }]`.
Codes: `duplicateWbs {wbs}`, `overExecuted`, `invalidDepType` (coerced to FS),
`dependencyCycle {cycle}`, `selfDependency`, `missingPredecessor {id}`.
`message` is an Arabic fallback; the UI shows `code` + `params` in its own
language (`src/app/schedule/warningText.js`, keys `schedule.warn*`).

Also exports date helpers `addDays(dateStr, days)` and `daysBetween(a, b)`.
`projectMeta.baseline.tasks` (map by task id) drives scope/exec variance.
Tests: `ganttEngine.test.js`.

---

## CriticalPath.js — CPM

`computeCriticalPath(computedTasks)` → `{ criticalIds: Set, floatById: Map }`.
Needs tasks with `id, isGroup, startDate, endDate, dependsOn, depType, lag`.
Pure, no storage. Tests: `criticalPath.test.js`.

---

## Snapshots.js — checkpoints

**Storage:** `pm-snapshots`; restore writes `project-manager-gantt-tasks` + `project-manager-project-meta`.
- `writeAutoSnapshot(tasks, projectMeta, actor, dateStr?)` — no-op if today's already saved; caps auto list at `MAX_AUTO_SNAPSHOTS = 14`
- `createNamedSnapshot(name, tasks, projectMeta, actor)` / `deleteNamedSnapshot(id)` / `renameNamedSnapshot(id, newName)`
- `createNamedSnapshot` returns the snapshot, or `null` when storage refused it
- `restoreSnapshot({tasks, projectMeta})` — throws if storage refuses (tasks key put back)
- `loadSnapshots()` / `saveSnapshots(data)` (→ true/false) / `hasAutoForDate(dateStr)` / `snapshotsStats()`

---

## ActivityLog.js — audit feed

**Storage:** `pm-activity` (array, cap 2000).
- `logAppEvent({actor, kind, summary, refType, refId, payload})` — call from anywhere
- `loadAppEvents()` / `saveAppEvents(list)`
- `buildUnifiedFeed({orders, variations, appEvents})` — merged, newest-first feed entries
- `formatDiff(before, after)` — value-change formatting
- `orderValueInIQD(order, tasks)` — money value of an order for heatmap weighting

---

## Registries.js — the roster

**Storage:** `pm-registries`.
- CRUD per entity: `addContractor/updateContractor/deleteContractor`, `addTeam/updateTeam/deleteTeam`, `addWorker/updateWorker/deleteWorker` (all take `(registries, …)` and return new data — immutable style)
- `loadRegistries()` / `saveRegistries(data)`
- `resolveWho(registries, who, lang)` — who → display label

---

## Certificates.js — payment certificates (ذرعات)

**Storage:** `pm-certificates` (project-scoped, shape in `docs/03` §13); every
write calls `notifyStoreChange`. The line math lives in
`state/certificateModel.js` (below).
- `loadCertificates()` → normalized `{ settings, rates, certificates }` / `saveCertificates(doc)`
- Series (one numbering per kind + contractor): `seriesKey`, `seriesOf(certificates, kind, contractorId)`,
  `nextNumber`, `openDraft`, `previousCertificates(certificates, cert)` (issued, lower number)
- `certificateProblem(certificates, { kind, contractorId, periodEnd }, selfId?)` →
  `null` | `'kind' | 'contractor' | 'date' | 'openDraft' | 'beforePrevious'`
- `defaultTerms(doc, kind, contractorId)` — the series' last terms, else the settings
  (a subcontractor starts with no advance / retention limit)
- Changes (load → change → save; `null` / `false` when refused):
  `createCertificate({ kind, contractorId, periodEnd }, actor?)`,
  `updateDraft(id, { periodEnd, terms, deductions, note })`, `deleteDraft(id)`,
  `issueCertificate(id, { periodStart, lines, totals, orderIds }, actor?)` — freezes,
  stamps `issuedBy` from `currentActor()`, logs an activity event (`kind: 'certificate'`),
  `saveSettings(patch)`, `setRate(contractorId, taskId, rate)` (`''` clears)
- **`certifiedOrderIds(doc?)`** → `Set` of order ids in issued certificates (for the
  order lock); `certificatesByOrder(doc?)` → `Map` orderId → `[{ id, number, kind, contractorId }]`

`state/certificateModel.js` (pure): `eligibleOrders(orders, cert)`,
`rateFor(kind, contractorId, taskId, task, rates)` (null = missing),
`certificateTotals(lines, cert, previous)`,
**`computeCertificate(cert, { certificates, rates, tasks, orders })`** →
`{ frozen, periodStart, lines, totals, orderIds, problems, issuable }` (an issued
certificate returns what it froze), `filterCertificates`, `rateRows` (the
contractor × item rates editor), `compareWbs`. Tests:
`utils/__tests__/certificates.test.js`, `state/__tests__/certificateModel.test.js`.

---

## DailyNotes.js — daily report site notes

`DAILY_NOTES_STORAGE_KEY = 'project-manager-daily-reports'`. `loadDailyNotes()`
(drops malformed rows), `saveDailyNotes(notes)`, `createDailyNote({ date,
engineer, task, details })` → a new note (no quantity: executed quantities come
from orders). Same key and shape as the legacy DailyReports screen.

## SiteDiary.js — site diary

**Storage:** `pm-site-diary` (project). Shape in [03-data-model §10a](03-data-model.md).
- `loadSiteDiary()` → `{ days }` (drops malformed days) / `saveSiteDiary(diary)` (notifies)
- `getDiaryDay(diary, day)`; `putDiaryDay(diary, day, entry, actor?, now?)` → new diary,
  stamps `recordedBy/At` on the first save and `updatedBy/At` on every save; an
  empty entry removes the day; `removeDiaryDay(diary, day)`
- `normalizeDiaryDay(raw)`, `emptyDiaryDay()`, `isDiaryDayEmpty(entry)`,
  `createDiaryRowId()`, `WEATHER_KINDS`

## Delays.js — delay register

**Storage:** `pm-delays` (project). Shape in [03-data-model §10a](03-data-model.md).
- `loadDelays()` → `{ events }` / `saveDelays(state)` (notifies)
- `upsertDelay(state, event, actor?, now?)` — adds (stamps `recordedBy`,
  `recordedById`, `createdAt` from `currentActor()`) or replaces (keeps those,
  stamps `updatedBy/At`); `removeDelay(state, id)`
- `normalizeDelay(raw)`, `createDelayId()`, `DELAY_CAUSES`, `DELAY_STATUSES`

The rules for both live in `state/diaryModel.js`: `manpowerFromPlan` (day plan
crews → manpower by trade; a worker counts once, a team's head count above its
members is general labour, a contractor crew is a row to fill in),
`diaryDraft`, `previousDiaryDay` / `copyDiaryDay` ("same as yesterday":
weather, hours, manpower, equipment — not visitors or issues), `diaryTotals`,
`diaryDaysInRange`, `tradeSuggestions` / `equipmentSuggestions`; delays:
`delaySpan` (an open event runs to today), `unionDays` (a day under two events
counts once), `noticeCheck` (`ok` / `late` = more than 28 days / `open` /
`overdue`, FIDIC 20.1), `delayTotals`, `delaysInMonth`, `sortDelays`,
`filterDelays`, `delayErrors`. Tests: `state/__tests__/diaryModel.test.js`,
`utils/__tests__/diaryStores.test.js`.

## PlanningStore.js — lookahead plans

**Storage:** `pm-plans`. Shape in [03-data-model §6](03-data-model.md).
- Load/save: `loadPlans()` / `savePlans(plans)`
- Readers: `getMonthPlans/getWeekPlans/getDayPlans(plans, key)`
- Mutations (immutable): `upsertTarget/deleteTarget`, `upsertAssignment/deleteAssignment` (scope = `'weeks'|'days'`), `cloneDayPlan/cloneWeekPlan(plans, src, tgt, mode)`
- Key math: `monthKey(dateStr)`, `isoWeekKey(dateStr)`, `isoWeekRange(weekKey)` → `{start,end}`, `addMonthsKey`, `addWeeksKey`, `addDaysDate`, `todayStr`
- Who: `normalizeWho(who)`, `whoLabel(who, registries, lang)`

Tests: `planningStore.test.js` (pure helpers only).

---

## TemplateEngine.js — project generator

**Storage:** `pm-templates`. Imports RateLibrary.
- `generateProject(template, values, options)` → `{tasks, stats {taskCount, groupCount, leafCount, totalCost, pricedCount, unpriced}}` — evaluates `qtyFormula` against template `variables`, applies repeats/dependencies (`FLOOR_CYCLE_LAG_DAYS = 7`), prices from rate library (copy-on-generate)
- `makeTemplateFromTasks(tasks, name)` — reverse: current project → template
- `listTemplates()` / `saveTemplate(t)` / `deleteTemplate(id)`
- `PARTS` — the reusable part catalog `{id, name, unit, category, productivity, rateName}`
- `evaluateFormula(expr, vars)` — safe formula evaluator; `toISODate(date)`

Tests: `templateEngine.test.js`.

---

## RateLibrary.js — IQD price catalog

**Storage:** `pm-rate-library` = `{items: [{id, name, unit, unitPrice, category}]}`.
`DEFAULT_RATES` (~40 civil items) + `RATE_CATEGORIES` (closed set) +
`seedDefaults/loadRateLibrary/saveRateLibrary/addRate/updateRate/deleteRate/findRateByName`.

---

## CalculatorEngine.js — BOQ grid formulas

No storage, no imports. Excel-style evaluation for calculator rows:
- `colIndexToLetter(i)` / `letterToColIndex('A')`
- `evaluateExcelFormula(formulaStr, rowValues, columns)` — e.g. `"=B*C+2"` with column letters
- `calculateRow(row, columns)` — computes all `formula` columns of a row

(The calculator's *templates* persist under `pm-calculator-templates`, owned by
`CalculatorTemplates.js`, not this module.)

## CalculatorTemplates.js / Finance.js / Theme.js — small storage owners

- `CalculatorTemplates.js`: `loadCalcTemplates()` (drops malformed grids),
  `saveCalcTemplates(list)` — key `pm-calculator-templates`.
- `Finance.js`: `LEDGERS`, `DEFAULT_FINANCE_CONFIG`, `loadFinanceData()` /
  `saveFinanceData()` (`project-manager-finance-data`), `loadFinanceConfig()`
  (stored lists over the defaults) / `saveFinanceConfig()`
  (`project-manager-finance-config`). Record shapes: `state/financeModel.js`.
- `Theme.js`: `THEMES = ['light','dark','system']`, `loadTheme()` (default
  `'light'`), `saveTheme()`, `applyTheme()` (sets `<html data-theme>`, or
  removes it for `'system'`) — key `pm-theme`.

---

## ImageCompress.js — shrink photos before storing

`fitWithin(w, h, maxSide)` (pure, tested) → `{ width, height }` with the
longest side ≤ maxSide, ratio kept, never scaled up.
`compressImage(file, { maxSide = 1600, quality = 0.8 })` →
`createImageBitmap(file, { imageOrientation: 'from-image' })` → canvas
(white background) → `toBlob('image/jpeg')` → a `File` named `<name>.jpg`.
Always resolves: returns the original file when anything fails or the copy
is not smaller. `jpegName(name)`; constants `PHOTO_MAX_SIDE`, `PHOTO_QUALITY`.
Used by `ui/PhotoPicker`.

---

## FileDB.js — IndexedDB for uploads

DB `ProjectManagerDB` v1, store `files`.
`initDB()` → `saveFile(folderId, fileObj, extra?)` (`extra.orderId` links an order's photo) / `getFiles(folderId)` / `deleteFile(fileId)`;
`getFilesByIds(ids)` / `deleteFiles(ids)` (an order's evidence);
`getAllFiles()` / `replaceAllFiles(records)` (one transaction) for the backup;
`deleteProjectFiles(projectId)`. Records carry `projectId`; `getFiles` returns the open project's only.

---

## StoragePersistence.js — keep the browser from clearing data

`requestPersistentStorage()` (called once in `main.jsx`) and
`getPersistenceState()` → `'persisted' | 'best-effort' | 'unsupported'`.
Shown in Settings → Backup & restore with a Protect button.

---

## Identity.js — current user

**Storage:** `pm-identity` = `{name, role}`.
`loadIdentity()` / `saveIdentity({name, role})` / `hasIdentity()`.
(The store opens the IdentityDialog automatically when `hasIdentity()` is false.)
`currentActor()` → `{ id, name, role }` — `role` is a permission role
(`permissions.js`); before accounts exist it is `{ id: null, name, role: 'admin' }`.

---

## storeRegistry.js — every store the app owns

`STORES`: `{ key, scope: 'project'|'global'|'device', owner, lists?: [{ path, idField }], sync }`.
Derived: `ALL_STORE_KEYS` (= `DataIO.APP_STORAGE_KEYS`), `PROJECT_STORE_KEYS`
(= `Projects.PROJECT_SCOPED_KEYS`), `DEVICE_STORE_KEYS` (a full restore keeps
them), `SYNCED_STORES`; `storeFor(key)`. `lists` name the record arrays inside
a stored value (`''` = the value is the array) for item-level sync and history.

---

## permissions.js — who may do what

`ROLES` (`admin, pm, office, site, accountant, viewer`; labels
`account.role.<code>`), `ACTIONS` (action → roles), `can(role, action)`,
`actionsFor(role)`, `canApproveRecord(actor, record)` (approve right and not
the recorder, once accounts exist). In components: `useCan()` /
`useActor()` from `src/app/useCan.js`.

---

## storeEvents.js — "this store changed" notifications

- `notifyStoreChange(key)` — dispatches a `pm-store-change` window event
  (no-op outside the browser, so node tests are unaffected)
- `onStoreChange(handler)` → unsubscribe; handler gets the storage key

Called by `saveOrdersData`, `saveRegistries`, `saveIdentity`,
`saveAppEvents`, `saveCertificates`, `saveSiteDiary` and `saveDelays` after writing; `ProjectProvider` listens and re-reads that
store immediately. A new persisted store that other screens read should do
the same.

---

## TaskRanking.js — task picker ordering

Used by `src/ui/TaskPicker`.
- `wbsCompare(a, b)` — numeric WBS order (`1.2` before `1.10`)
- `rankLeafTasks(tasks, orders)` → `{ recent, rest }`: leaves with orders,
  newest `recordedAt` first; the rest in WBS order; groups skipped
- `filterTasks(tasks, query)` — case-insensitive substring on `"wbs name"`

Pure. Tests: `taskRanking.test.js`.

---

## WhoSelection.js — "who" value helpers

Behind `src/ui/WhoPicker`. A who value is one of
`{kind:'contractor',contractorId}` · `{kind:'team',teamId}` ·
`{kind:'workers',workerIds}` · `{kind:'count',count}` · `{kind:'none'}`.
- `teamSizeOf(team)` — manual `defaultSize`, else member count
- `switchWhoKind(who, nextKind, teams)` — carries over what still makes sense
  (workers → count, team → workers roster, workers matching a roster → team)
- `toggleWhoWorker(who, workerId)` — always returns a workers value

Pure. Tests: `whoSelection.test.js`.

---

## DataIO.js — full backup / restore

`APP_STORAGE_KEYS` — the canonical list of all 18 keys (see
[03-data-model §1](03-data-model.md)). **Adding a key anywhere = adding it here.**
`isAppStorageKey(key)` also accepts every project's `pm-p:<id>:<key>` copy.
- `exportAppData({label?})` → `{filename, fileCount, filesSkipped}` — async; downloads the JSON backup incl. uploaded files (format in 03-data-model §12)
- `buildBackupPayload()` → `{payload, filesSkipped}`
- `readBackupFile(file)` → parsed JSON (rejects with `BackupError`)
- `validateBackup(parsed)` → `{ok, code?, stats?{keys, bytes, files}}`
- `restoreAppData(parsed)` — async; writes keys (a version-3 backup also removes app keys it doesn't hold; rolled back on failure) and replaces files when the backup has them; returns keys written; throws `BackupError`
- `BackupError` (`.code` → `app.backup.err.<code>`), `bytesToBase64` / `base64ToBytes` / `encodeFileRecord` / `decodeFileEntries`

Tests: `dataIO.test.js`.
