# 04 — Utils Reference (the engines)

`ProjectManagerApp/src/utils/` — pure logic + localStorage persistence.
(Planning and history sections last verified 2026-10-26.) **No React here.** All modules are plain ES modules; most are covered by
tests in `__tests__/` (run: `npm test` from `ProjectManagerApp/`).

Dependency order (leaf → top):

```
storeRegistry, permissions                                             (standalone: the store list and the role matrix)
Projects                                                               (imports storeRegistry; every project-scoped owner imports it)
planning/WorkCalendar, planning/links                                  (standalone: working days, task links)
planning/network                                                       (imports WorkCalendar: the forward pass)
CalculatorEngine, ImageCompress, RateLibrary                           (standalone)
CriticalPath                                                           (imports planning/*)
Identity                                                               (imports Projects + src/sync/session)
FileDB, DataIO                                                         (import Projects)
ActivityLog, PlanningStore, Registries, Snapshots                      (import i18n / Projects)
SiteDiary, Delays                                                      (import Identity / Projects)
OrderEngine                                                            (imports i18n)
TemplateEngine                                                         (imports RateLibrary)
GanttEngine                                                            (imports OrderEngine + CriticalPath + planning/*)
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
- Shared projects (src/sync): a record may carry `serverId` (its id on the server; a project pulled from the server uses it as its local id too) and `revoked` (this account lost access: kept here, no longer synced). `projectByServerId(id)`, `linkProject(id, serverId)`, `fromServerProject(row)` (server row → local fields), `mergeServerProjects(serverProjects, { hidden, changedOnServer })` → `{ added, updated, revoked }` — adds the server's projects, updates linked details, marks lost access, never re-adds `hidden` ones

Storage functions take an optional storage argument (tests). Tests: `projects.test.js`, `src/sync/__tests__/account.test.js`.

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
- `createOrderDraft(type, options)` — new draft with smart defaults (date, last who); expense types also get their detail keys as `''`
- `addOrders(list)` — append several orders in one write (the finance migration); leaves `lastWhoByType` alone
- `normalizeWhoForSave(who)` — cleans the who object before persisting
- **Expense details** (last verified 2026-10-26): field kinds `choice` (a
  value from the finance list `list`), `measure` (a number; `money` or
  `unitKey`) and `computed` (the amount, read-only); `detail: true` fields go
  into `order.details`. `EXPENSE_FIELD_KINDS`, `DEDUCTED_STATUS` (`'مستقطع'`,
  data), `hasComputedAmount(type)`, `expenseBreakdown(type, values)` →
  `{ amount, parts: [{ labelKey, qty, rate, unitKey, unit, total }] }` (payroll:
  `{ amount, salary, advance, deducted }`) or null for typed amounts —
  machinery = hours × rate + driver hours × rate + liters × price, material =
  qty × unit price, payroll = salary − advance only when deducted;
  `expenseDetails(draft, spec)` (numbers as numbers, empties dropped) and
  `expenseFieldMissing(field, draft)` — the two hooks `state/orderForm.js`
  calls. Tests: `state/__tests__/expenseOrders.test.js`.
- **Aggregation (used by GanttEngine):**
  - `sumValueOrdersByTask(orders)` → `Map<taskId, {total, formalQty, quickQty, orderCount}>` — approved value orders only
  - `sumExpenses(orders, range?)` → `{total, byCategory}`
  - `ordersInRange(orders, from, to)` / `ordersForContractor(orders, contractorId, range?)`
- `loadRegistries()` / `resolveWhoLabel(who, registries)` — display names
- Date helpers: `formatDateStr`, `todayStr`, `daysAgoStr(days)`
- ID: `createOrderId()`

Tests: `orderEngine.test.js`.

`state/orderForm.js` (pure, the Record screens' rules): `missingRequiredFields`,
`buildOrderFromDraft(draft, spec, { tasks, userName, recordedById, id, now, evidence })`
(stamps `recordedById`, null without accounts), filters / KPIs, and:
- **`draftWarnings(draft, { orders, tasks, projectStart, today })`** → `[{ code, … }]`,
  never a block (the screens ask "Save anyway?"): `'duplicate'` `{ orderId }` (same type,
  item, work date, quantity or amount, who, location / sample / depth), `'overLeft'`
  `{ qty, left, pending, unit }` (contract − executed − value orders awaiting approval;
  `tasks` = the engine's computed tasks), `'amountOutlier'` `{ amount, median }` (over
  `OUTLIER_FACTOR` = 10 × the median of the type's earlier amounts, from
  `OUTLIER_MIN_SAMPLES` = 3 of them), `'futureDate'` `{ today }`, `'beforeStart'` `{ start }`.
- **`approvalBlock(order, actor, { certified })`** → `null` | `'certified'` | `'role'`
  (no `orders.approve`) | `'own'` (`canApproveRecord`: the recorder).
- **`orderLock(order, certificatesByOrder())`** → the issued certificates holding it, or null.

Tests: `state/__tests__/orderForm.test.js`.

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
  marked `checked: false`; `family` = interchangeable types for BOQ
  placement; seed version 2 gives stored seeded types the new fields and
  keywords without touching user values). Tests: `workTypes.test.js`.
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
  `options.boq = { lines, assignments }` pours a contract BOQ in (below);
  items removed (dropped, or left out by the BOQ) make no task and the items
  waiting for them inherit their predecessors (no gaps, no false starts).
- **`BoqImport.js`** — `parseTable(text)` (Excel clipboard: tabs, quoted
  multi-line cells), `parseNumber` (Arabic-Indic digits, separators, leading
  number only), `normalizeUnit` (م3 / m3 / م³ / متر مكعب → 'م3' …),
  `unitFamily`, `detectHeader`, `guessColumns` (names, then contents),
  `boqLines` (items + section headings, WBS from hierarchical numbers or
  section + running number), `readBoq(text, columns?)`, `tableToText(rows)`
  (an .xlsx sheet's cell values → the same tab-separated text a paste gives),
  `pickBoqSheet(sheets)` (the sheet with the most item lines). Tests:
  `boqImport.test.js`.
- **`Matcher.js`** — local matching of BOQ lines to work types:
  `normalizeText` (diacritics, tatweel, alef / ya / ta marbuta, digits),
  `stem`, `contentWords` (BOQ boilerplate dropped), `scoreLine` (shared
  words weighted by rarity across the library, stemmed keyword phrases,
  unit kind ±), `matchLine` → `{ best, candidates }`, `matchBoq`,
  `confidenceOf` (high ≥ 0.55, medium ≥ 0.3), `withAlias` (a confirmed
  manual match → exact next time).
- **`boqPlan.js`** — `applyBoq(items, lines, assignments, workTypes)`:
  each line spread over its work type's template items in proportion to
  their template quantities, at the BOQ price (`contractRate`, no markups);
  several lines of one type → variants; a type of the same `family` takes
  the slot (tiles ↔ porcelain); template items without a line → `leftOut`;
  the rest → section `other` (`OTHER_SECTION`). Info: `{ lines, placed,
  unplaced, unassigned, leftOut, unitMismatch }`.
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
  (event kinds in words: `state/reportsModel.eventKindKey`)
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
  (the Record screens read it through `app/record/useOrderCertificates.js`, one map
  for all rows, rebuilt when `pm-certificates` changes)

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
- `Finance.js` (last verified 2026-10-26): `LEDGERS`, `DEFAULT_FINANCE_CONFIG`,
  `loadFinanceData()` — the **old ledger, read-only** (`project-manager-finance-data`;
  nothing writes its records any more), `loadFinanceMigration()` /
  `saveFinanceMigration(flag)` — the migrated flag beside it (writes only
  `migration`, never touches the records, leaves an unreadable value alone,
  announces the store), `loadFinanceConfig()` (stored lists over the defaults)
  / `saveFinanceConfig()` (`project-manager-finance-config` — the lists expense
  order details pick from). The ledgers' rules and the migration plan:
  `state/financeModel.js` (`ledgerOrders`, `filterLedger`, `financeTotals`,
  `draftAfterSave`, `planFinanceMigration`, `legacyRecordToOrder`,
  `migrationFlag`, `migrationCheck`). Tests: `state/__tests__/financeModel.test.js`,
  `utils/__tests__/financeStore.test.js`.
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

**Storage use** (the meter under it):
- `getStorageUsage()` → `summarizeStorage(...)` of the three readings below
  (FileDB failures count as no photos).
- `getStorageEstimate()` → `{ usage, quota }` bytes for the whole origin
  (`navigator.storage.estimate`: IndexedDB files, the offline cache, …), or
  null when the browser cannot tell.
- `localStorageSize(storage?)` → characters of every key + value, all
  projects (the unit browsers cap at `LOCAL_STORAGE_LIMIT`, 5 M).
- `photoStats(records)` → `{ count, bytes }` of FileDB records in
  `ORDER_PHOTOS_FOLDER` (`'order_photos'`).
- `summarizeStorage({ estimate, localSize, photos })` (pure, tested) →
  `{ device: { used, total, ratio } | null, data: { used, total, ratio },
  photos, warn }`; `warn` when either ratio reaches `STORAGE_WARN_RATIO`
  (0.8).

---

## Identity.js — current user

**Storage:** `pm-identity` = `{name, role}` (the local name + job title).
- `loadIdentity()` — the name and job title to show and stamp: the signed-in
  account's name (with the local job title), else the local identity;
  `loadLocalIdentity()` ignores the account
- `saveIdentity({name, role})` (local; returns `loadIdentity()`), `hasIdentity()`
  (signed in, or a local name). The store opens the account dialog
  (`app/IdentityDialog.jsx`) when it is false.
- `currentActor()` → `{ id, name, role }` — `role` is a permission role
  (`permissions.js`): not signed in → `{ id: null, name, role: 'admin' }`;
  signed in → the account, with its role in the open shared project
  (`viewer` if access was withdrawn), `admin` in a project that exists only
  on this device, the organization role at the projects level. `useActor()`
  re-reads it on `pm-session` / `pm-identity` changes.


---

## src/sync — server sync, accounts and history

Offline-first sync with Supabase (server: `supabase/`, guide:
[08-server-setup.md](08-server-setup.md); flow: [02-architecture §8](02-architecture.md)).
Import from `src/sync/index.js`. Pure modules are tested in
`src/sync/__tests__/` (`npm test`); the same code runs against the real
migrations in PGlite with `npm run test:db`.

| Module | What it does |
|---|---|
| `itemDiff.js` (pure) | `explodeStore(entry, value)` → items (`'<path>/<id>'`, `'<id>'` for a root list, `'<path>/<key>'` for a `keyed` list, `'$doc'` for the rest); `diffItems(base, items, { staleCheck })` → `{ changes, stale, localOnly }`; `materialize(entry, items)`; `applyItems(entry, value, updates, posOf)`; `assignPositions`; `hashOf` / `stableStringify`; `DOC_ITEM`, `ABSENT` |
| `conflict.js` (pure) | `pickWinner(current, incoming)` → `{ winner, reason }`: approved beats recorded, else higher rev, tie keeps the server's |
| `rules.js` (pure) | `COLLECTION_RULES` (mirror of the SQL `app_private.collection_rules`), `writeAction`, `canWriteVersion(role, …)`, `checkChange(actor, { collection, key, before, after, recordedBy, importing })` → `{ ok, reason }` (`role`, `notApprover`, `ownRecord`, `approveUnrecorded`); `scopeOf`, `entryFor`, `FILES_COLLECTION` |
| `engine.js` | `createEngine({ db, transport, storage, notify, emit, now, deviceId })` → `diffStore` / `diffScope` (queue changes, undo refused ones), `push(actorId, scopes)`, `pullScope`, `applyServerRows`, `queueChanges`, `applyLocalVersion` (restore), `clearStaleMarks`, `dropScope`; helpers `selectBatch`, `sortResults`, `toPushPayload`; `LIVE_STORES`, `PLAN_STORES` |
| `localDb.js` | the sync database (IndexedDB `pm-sync`: `kv`, `shadow`, `outbox`); `createMemoryDb()` for tests |
| `files.js` | `pushFiles` / `pullFiles` — FileDB ⇄ Storage `files/<server project>/<file id>`; `fileMeta`, `storagePath` |
| `transport.js` | `createSupabaseTransport(client)` — every server call; `SyncError` (`offline`, `auth`, `code`), `toSyncError` |
| `client.js` | `getConnection(db)` (supabase-js loaded on first use; token kept in `pm-sync`), `probeServer({ url, anonKey })` |
| `serverConfig.js` | `pm-server`: `loadServerConfig()` (device value, else `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`), `saveServerConfig`, `resetServerConfig`, `validateServerConfig` (codes `url` / `key` / `https`), `normalizeServerUrl`, `isServerConfigured` |
| `session.js` | `pm-session`: `loadSession`, `saveSession`, `clearAccount`, `chooseLocalMode`, `isSignedIn`, `needsLogin`, `projectRole` |
| `runtime.js` | the browser loop: `startSync` / `stopSync`, `requestSync`, `syncNow`, `onSyncStatus` / `getSyncStatus`, `onSyncEvent` (`denied`, `overruled`, `ignored`, `applied`, `signedOut`), `refreshAccess`, `applyAccess`, `buildScopes`, `scopeFor`, `withSyncLock`, `pendingChanges`, `retryFailed`, `discardFailed`, `resetPullCursors` |
| `account.js` | `signIn`, `signUp`, `signOut`, `createOrganization`, `refreshAccount`, `renameMe`, `listMembers`, `listOrgMembers`, `listInvites`, `inviteMember`, `setMemberRole`, `removeMember`, `setOrgRole`, `removeOrgMember`, `cancelInvite` — all return `{ ok }` or `{ ok: false, code }` (`account.err.<code>`) |
| `upload.js` | `uploadDeviceData({ onStep })` (safety backup → server projects → import → full sync), `canUpload`, `localOnlyProjects` |
| `history.js` | `getHistory(collection, itemId, { project })`, `getProjectTimeline({ project, actor, collection, from, to, beforeId, limit, shared })` → `{ ok, rows, next }`, `restoreVersion(changeId)` (a new change, never a rewrite), `itemKeysFor`. Rows: `{ id, collection, itemId, op, before, after, rev, outcome, note, actor: { id, name }, deviceId, clientAt, serverAt, restoredFrom, pending }`; this device's queued changes come first with `pending: true` |

React hooks for screens: `app/account/useAccount.js` (`useSession`,
`useServerConfig`, `useSyncStatus`, `usePlanEpoch`).

**History screens** read `history.js` only; their rules are pure in
`state/historyModel.js` (tested in `state/__tests__/historyModel.test.js`):
`diffFields(before, after, { hidden })` → `[{ path, segments, change:
'added'|'removed'|'changed', before, after, list? }]` (nested values per leaf,
record lists matched by `id` / `taskId` / `key`, plain lists with `list: {
added, removed }`, the id and bookkeeping in `HIDDEN_FIELDS` left out);
`valueText(value, words)` (yes / no, numbers, dates, records by name);
`recordStamps(record, { last })` → `[{ kind: 'recorded'|'approved'|'issued'|'edited',
name, at }]` (a newest row that is the first version is not an edit); `lastChange(rows)`; `restorePayload(row)` / `restoreGate({ row,
rows, current, actor })` (the same `checkChange` the sync engine uses);
`timelineQuery(filters)` → `getProjectTimeline` arguments (local days → ISO
bounds), `filterTimeline` (order family, variation orders, pending rows'
person and dates), `timelineActors`, `personSummary`, `periodDays`,
`localDay`, `historyHref`, `splitItemId`, `recordName`, `COLLECTION_KEYS`.
Hooks: `app/history/timelineHooks.jsx` (`useServerHistory`, `useMembers`,
`useTimeline`, `usePeriod`), `app/history/useLastChange.js`,
`app/history/useCurrentRecord.js`.

---

## storeRegistry.js — every store the app owns

`STORES`: `{ key, scope: 'project'|'global'|'device', owner, lists?: [{ path, idField }], sync }`.
Derived: `ALL_STORE_KEYS` (= `DataIO.APP_STORAGE_KEYS`), `PROJECT_STORE_KEYS`
(= `Projects.PROJECT_SCOPED_KEYS`), `DEVICE_STORE_KEYS` (a full restore keeps
them), `SYNCED_STORES`; `storeFor(key)`. `lists` name the record arrays inside
a stored value (`''` = the value is the array) for item-level sync and history;
`{ path, keyed: true }` = an object of records by key (`pm-site-diary` days,
`pm-plans` months / weeks / days, `meta.planning`), each key one sync item.

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
