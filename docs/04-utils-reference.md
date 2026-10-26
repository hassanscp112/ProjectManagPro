# 04 — Utils Reference (the engines)

`ProjectManagerApp/src/utils/` — pure logic + localStorage persistence.
(Planning sections last verified 2026-10-26.) **No React here.** All modules are plain ES modules; most are covered by
tests in `__tests__/` (run: `npm test` from `ProjectManagerApp/`).

Dependency order (leaf → top):

```
storeRegistry, permissions                                             (standalone: the store list and the role matrix)
Projects                                                               (imports storeRegistry; every project-scoped owner imports it)
planning/WorkCalendar, planning/links                                  (standalone: working days, task links)
planning/network                                                       (imports WorkCalendar: the forward pass)
CalculatorEngine, Identity, RateLibrary                                (standalone)
CriticalPath                                                           (imports planning/*)
FileDB, DataIO                                                         (import Projects)
ActivityLog, PlanningStore, Registries, Snapshots                      (import i18n / Projects)
OrderEngine                                                            (imports i18n)
TemplateEngine                                                         (imports RateLibrary)
GanttEngine                                                            (imports OrderEngine + CriticalPath + planning/*)
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
  projectWorkingDays,          // working days on the project calendar
  calendarIssues,              // [{ code }] from a bad calendar spec
  warnings,   // [{ taskId, wbs, name, code, params, message }]
}
```

**Scheduling:** every predecessor counts (`task.predecessors`, read through
`planning/links.js`); a task starts at the LATEST of its link constraints
(FS/SS/FF/SF + lag), else at `manualStart`/project start; leveling links only
delay it. It runs on the project's working calendar
(`projectMeta.planning.calendar`, see `planning/WorkCalendar.js`): durations
and lags are working days, `endDate` is the exclusive end (start + duration
when every day works). With no calendar the results are exactly the old
7-day engine's — guarded by differential tests against a frozen copy
(`__tests__/engineParity.test.js`, `__tests__/fixtures/legacy*.js`).

Each computed task also carries `warnings: [{ code, params, message }]`.
Codes: `duplicateWbs {wbs}`, `overExecuted`, `invalidDepType` (coerced to FS;
`{id}` for an extra link),
`dependencyCycle {cycle}`, `selfDependency`, `missingPredecessor {id}`.
`message` is an Arabic fallback; the UI shows `code` + `params` in its own
language (`src/app/schedule/warningText.js`, keys `schedule.warn*`).

Also exports date helpers `addDays(dateStr, days)` and `daysBetween(a, b)`.
`projectMeta.baseline.tasks` (map by task id) drives scope/exec variance.
Tests: `ganttEngine.test.js`, `ganttEngineLinks.test.js`, `engineParity.test.js`.

---

## CriticalPath.js — CPM

`computeCriticalPath(computedTasks, timing?)` → `{ criticalIds: Set, floatById: Map }`.
Needs tasks with `id, isGroup, startDate, endDate` and their links (`links`
from the engine, or `dependsOn/depType/lag/predecessors`); leveling links
count too. `timing = { cal, ES, EF }` (working units from the forward pass)
makes float working days; without it every day counts. Acyclic networks:
one reverse topological pass; with a cycle: the old relaxation. Pure, no
storage. Tests: `criticalPath.test.js`, `engineParity.test.js`.

---

## planning/ — auto-planning building blocks (no storage)

- **`links.js`** — a task's predecessors. `readLinks(task)` (slot 0 from
  `dependsOn/depType/lag`, extras from `predecessors[1..]`),
  `writeLinks(task, links)` (mirrors slot 0), `linksPatch(links)` (an
  editor's changed fields), `readLevelLinks`, `hasLinkTo(task, idSet)`,
  `removeLinksTo(task, idSet)` (a legacy task gives exactly the old cleared
  object), `formatLinks(links, wbsOf)` / `parseLinks(text, idOf)` for the
  grid text `2.1FS+3; 2.4SS; 3.2FF-2d` (`d` = calendar days). Tests:
  `links.test.js`.
- **`WorkCalendar.js`** — working time: `getCalendar(spec)` (memoized; no
  spec or nothing off = the identity calendar), units of 100 per normal
  working day, `cum(k)`, `startDayOf(T)` (skips days off), `endDayOf(T)`
  (exclusive end), date helpers `addWorkingDays`, `workingDaysBetween`,
  `nextWorkingDay`, `isWorkingDay`, `normalizeCalendarSpec`,
  `presetCalendar(preset, startDate)` (`fridayHolidays` · `friday` ·
  `fridaySaturday` · `allDays`; `IRAQ_FIXED_HOLIDAYS`). Tests:
  `workCalendar.test.js`.
- **`network.js`** — the forward pass (`forwardPass`, iterative, reproduces
  the old recursion's warnings and cycle texts), `linkBound`,
  `shiftByLag` / `unshiftByLag` (shared with CriticalPath). Stale leveling
  links that contradict the logic are dropped.
- **`Formula.js`** — template formulas without `eval`: `evaluate(src, vars)`
  → `{ value, error: null|'syntax'|'unknown', names? }`, `quantityOf`
  (≥ 0, 2 decimals), `conditionHolds` (empty = true), `compileFormula`
  (cached). Operators `+ - * / % < <= > >= == != && || ! ?:`, functions
  `min max ceil floor round abs sqrt pow if`, `Math.` prefix, `PI`.
  Tests: `formula.test.js`.
- **`trades.js`** — `TRADES` (18 crew trades; labels `planning.trade.*`).
- **`WorkTypes.js`** — the work-type library (`pm-work-types`, global):
  `loadWorkTypes` (seeds / tops up new seeds once, never a removed one),
  `saveWorkTypes`, `upsertWorkType`, `deleteWorkType`, `cleanWorkType`,
  `workTypeMap`, `workTypeName(wt, lang)`, `durationFor(qty, { productivity,
  crews, fixedDays })` = ceil(qty ÷ (productivity × crews)), 1–365, normal
  working days. Seeds + building rates in **`workTypeSeeds.js`** (~80 types,
  marked `checked: false`). Tests: `workTypes.test.js`.
- **`buildingTemplates.js`** — `buildingTemplateSeeds()` (house, villa,
  apartments, school, mall, health center, mosque, office / mixed-use,
  warehouse), `LEVEL_USES`. Per-floor-by-trade elements with explicit links
  (columns after the slab below + 7 calendar days curing, masonry after the
  slab above, finishes chain, roof after the top slab…).
- **`generator.js`** — `templateValues`, `buildLevels(template, vars,
  overrides)` (basement + ground + upper floors, per-level area / height /
  use), `buildingVars`, `expandTemplate(template, values, { levelOverrides })`
  → `{ vars, levels, items, issues }`, `resolveLinks(items, template,
  levelCount)` (floor selectors, `if` filters, lists of keys; a level item
  whose rules all miss waits for the level anchor, default `slab`).
  Tests: `generator.test.js`.
- **`autoPlan.js`** — `priceItems` (rate by `rateId`, cost overrides,
  `priceWithMarkups(cost, markups)` = cost × (1 + Σ%/100)), `scheduleItems`
  (productivity overrides, crews per trade, else `autoCrews` toward
  `CREW_TARGET_DAYS` {level 20, once 40}, max 6), `itemsToTasks` (sections,
  one group per level, names via `levelName(level, lang)` + `planning.gen.atLevel`),
  `planProject(template, values, options)` → `{ levels, items, tasks, stats
  {…, directCost, totalCost, unpriced, noProductivity}, issues, planning }`.
  `DEFAULT_MARKUPS = { overhead: 10, contingency: 5, profit: 10 }`.
  Tests: `autoPlan.test.js` (every seeded template, several sizes: no issues,
  no engine warnings, everything priced and linked).

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

## DailyNotes.js — daily report site notes

`DAILY_NOTES_STORAGE_KEY = 'project-manager-daily-reports'`. `loadDailyNotes()`
(drops malformed rows), `saveDailyNotes(notes)`, `createDailyNote({ date,
engineer, task, details })` → a new note (no quantity: executed quantities come
from orders). Same key and shape as the legacy DailyReports screen.

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

**Storage:** `pm-templates` (`{templates, seedVersion}`). Imports RateLibrary.
- `listTemplates()` seeds the nine schema-2 building templates
  (`planning/buildingTemplates.js`); a seed-version-1 store keeps its
  templates, its five schema-1 seeds get `archived: true`.
  `activeTemplates(list)` hides archived ones; `isPlanTemplate(t)`
  (schema 2); `LEGACY_SEED_TEMPLATES` (the old seed factories).
- `generateProject(template, values, options)` (schema 1 only) → `{tasks, stats {taskCount, groupCount, leafCount, totalCost, pricedCount, unpriced}}` — evaluates `qtyFormula` against template `variables`, applies repeats/dependencies (`FLOOR_CYCLE_LAG_DAYS = 7`), prices from rate library (copy-on-generate)
- `makeTemplateFromTasks(tasks, name)` — reverse: current project → template
- `listTemplates()` / `saveTemplate(t)` / `deleteTemplate(id)`
- `PARTS` — the reusable part catalog `{id, name, unit, category, productivity, rateName}`
- `evaluateFormula(expr, vars)` — safe formula evaluator; `toISODate(date)`

Tests: `templateEngine.test.js`.

---

## RateLibrary.js — IQD price catalog

**Storage:** `pm-rate-library` = `{items: [{id, name, unit, unitPrice, category}]}`.
`DEFAULT_RATES` (~40 civil items + `BUILDING_RATES` from
`planning/workTypeSeeds.js`; `RATE_SEED_VERSION = 2` adds the building
rates once to older libraries) + `RATE_CATEGORIES` (closed set) +
`seedDefaults/loadRateLibrary/saveRateLibrary/addRate/updateRate/deleteRate/findRateByName/findRateById`.
Prices are direct cost; markups are added per project.

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

Called by `saveOrdersData`, `saveRegistries`, `saveIdentity` and
`saveAppEvents` after writing; `ProjectProvider` listens and re-reads that
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
