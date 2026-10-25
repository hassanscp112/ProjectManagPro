# 04 — Utils Reference (the engines)

`ProjectManagerApp/src/utils/` — pure logic + localStorage persistence.
**No React here.** All modules are plain ES modules; most are covered by
tests in `__tests__/` (run: `node --test "src/utils/__tests__/*.test.js"` from `ProjectManagerApp/`).

Dependency order (leaf → top):

```
CalculatorEngine, CriticalPath, FileDB, Identity, DataIO, RateLibrary   (standalone)
ActivityLog, PlanningStore, Registries, Snapshots                      (import i18n only)
OrderEngine                                                            (imports i18n)
TemplateEngine                                                         (imports RateLibrary)
GanttEngine                                                            (imports OrderEngine + CriticalPath)
```

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
(static) → the single `engineResult` consumed by App/Dashboard/MonthlyReport.
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
  warnings,
}
```

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
- `restoreSnapshot({tasks, projectMeta})`
- `loadSnapshots()` / `saveSnapshots(data)` / `hasAutoForDate(dateStr)` / `snapshotsStats()`

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
`CalculatorView`, not this module.)

---

## FileDB.js — IndexedDB for uploads

DB `ProjectManagerDB` v1, store `files`.
`initDB()` → `saveFile(folderId, fileObj)` / `getFiles(folderId)` / `deleteFile(fileId)`.

---

## Identity.js — current user

**Storage:** `pm-identity` = `{name, role}`.
`loadIdentity()` / `saveIdentity({name, role})` / `hasIdentity()`.
(App opens the IdentityPicker automatically when `hasIdentity()` is false.)

---

## DataIO.js — full backup / restore

`APP_STORAGE_KEYS` — the canonical list of all 15 keys (see
[03-data-model §1](03-data-model.md)). **Adding a key anywhere = adding it here.**
- `exportAppData()` — downloads JSON backup (format in 03-data-model §12)
- `readBackupFile(file)` → parsed JSON (throws on bad file)
- `validateBackup(parsed)` → `{ok, reason?, stats?{keys, bytes}}`
- `restoreAppData(parsed)` — writes all keys, returns list written
