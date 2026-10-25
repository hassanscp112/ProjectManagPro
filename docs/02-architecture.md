# 02 — Architecture: How the Code Is Organized

Read [01-overview.md](01-overview.md) first for domain vocabulary.

---

## 1. The big picture (one diagram)

```
                        ┌─────────────────────────────────────────────┐
                        │                  App.jsx                    │
                        │  (src/App.jsx — the ONLY app shell)         │
                        │                                             │
                        │  • tab navigation (no router!)              │
                        │  • owns: tasks, projectMeta, ordersData,    │
                        │    registries, identity, appEvents          │
                        │  • lifecycle: sign-off / VO / status        │
                        │  • modals: delete, sign-off, restore, VO    │
                        └───────────┬─────────────────────┬───────────┘
              persists itself       │                     │ re-computes on any
        (localStorage effects)      ▼                     ▼ change via useMemo
        'project-manager-gantt-tasks'              ┌──────────────────┐
        'project-manager-project-meta'             │  GanttEngine     │
                         │                         │  .calculate()    │
                         │                         └────────┬─────────┘
                         │                                  │ engineResult
                         │              ┌───────────────────┼───────────────────┐
                         ▼              ▼                   ▼                   ▼
                  ┌────────────┐  ┌───────────┐   ┌────────────────┐  ┌──────────────┐
                  │ GanttChart │  │ Dashboard │   │ MonthlyReport  │  │ PlanningScr. │
                  └────────────┘  └───────────┘   └────────────────┘  └──────────────┘
                    (edit raw       (read-only      (read-only          (read engine
                     tasks)          views)          views)              + own store)

  ┌───────────────────────────────────────────────────────────────────────────────┐
  │  MODULE SCREENS — own their persistence; App re-reads their storage           │
  │  on every tab switch (refreshEcosystemStores) so siblings stay fresh:         │
  │                                                                               │
  │  OrdersScreen → OrderEngine      → localStorage 'pm-orders'                   │
  │  PlanningScreen → PlanningStore  → localStorage 'pm-plans'                    │
  │  RegistriesScreen → Registries   → localStorage 'pm-registries'               │
  │  TemplatesScreen → TemplateEngine/RateLibrary → 'pm-templates'/'pm-rate-library'
  │  SnapshotsScreen → Snapshots     → localStorage 'pm-snapshots'                │
  │  ActivityScreen  → ActivityLog   → localStorage 'pm-activity'                 │
  │  FileManager     → FileDB        → IndexedDB 'ProjectManagerDB'               │
  │  CalculatorView  → (own state)   → localStorage 'pm-calculator-templates'     │
  │  DailyReports                    → localStorage 'project-manager-daily-reports'
  │  FinanceManager                  → 'project-manager-finance-data'/'-config'   │
  └───────────────────────────────────────────────────────────────────────────────┘
```

**The one rule to remember:** Gantt/BOQ data is owned by `App.jsx`; every other
screen owns its own storage and re-persists directly. There is **no global state
library** — plain React `useState` + localStorage + a refresh-on-tab-switch.

---

## 2. App.jsx — the app shell (`src/App.jsx`, ~1030 lines)

Everything below lives in this one file:

| Concern | Where / how |
|---|---|
| Task tree state | `useState(loadInitialTasks)` → saved to `'project-manager-gantt-tasks'` on every change (`useEffect`) |
| Project meta | `status` (`draft/signed/executing/completed`), `baseline`, `variations[]` → `'project-manager-project-meta'` |
| Project start | `PROJECT_START = '2025-08-02'` — **hardcoded constant** near the top of the file |
| Seed data | `INITIAL_TASKS` — the real canal-contract WBS in Arabic (excavation, backfill, lining sections). Used only if storage is empty. |
| Ecosystem stores | `ordersData / registries / identity / appEvents` — App keeps copies, re-read from storage in `refreshEcosystemStores()` which runs on **every tab switch** (`goToTab`) |
| The engine | `engineResult = useMemo(() => GanttEngine.calculate(tasks, PROJECT_START, projectMeta, orders), [tasks, projectMeta, orders])` — the single source of all computed truth |
| Undo | In-memory history stack (`historyRef`, last 50), 1s typing debounce before pushing |
| Auto snapshot | `useEffect` calls `writeAutoSnapshot()` on any tasks/meta/identity change — no-ops if today's checkpoint already exists |
| Task CRUD | `handleAddMainTask` / `handleAddSubTask` (auto WBS numbering) / `handleDeleteTask` (modal with descendant + dependency preview) / `handleUpdateTask` |
| BOQ linking | `handleToggleBoqLink` (create-or-unlink a child leaf for an element column), `handleLinkExistingBoq` (link column to an existing leaf, mode `'existing'` keeps the leaf's contract qty authoritative) |
| Lifecycle | `handleSignOff` (freeze BOQ-linked quantities into raw tasks, write `projectMeta.baseline`, log event), `handleSetStatus` |
| Variation Orders | `handleRaiseVariation` — changes the locked field AND appends a VO record to `projectMeta.variations` |
| Templates | `handleGenerateFromTemplate` — appends generated tree, renumbers top-level WBS past current max, jumps to Gantt |
| Backup/restore | `handleExport/Import` via `utils/DataIO` (validate → confirm modal → write → page reload) |
| Navigation | `activeTab` string; 13 tabs in a right-hand sidebar (RTL layout) + hidden `taskDetails` tab reached via "jump to task details" |

### Props each screen receives (quick lookup)

| Screen | Props from App |
|---|---|
| Dashboard | `tasks={engineResult.tasks} summary={engineResult}` |
| GanttChart | `tasks={engineResult.tasks}` + `onUpdateTask, projectStart, isEditMode, isSigned, viewMode, onAdd*, onDelete, onJumpTo*` |
| OrdersScreen | `tasks` (raw), `identity` |
| PlanningScreen | `tasks` (raw), `computedTasks`, `orders`, `registries` |
| ActivityScreen | `orders, variations, appEvents, tasks, registries` |
| MonthlyReport | `summary, computedTasks, orders, variations, projectMeta, registries` |
| SnapshotsScreen | `tasks, projectMeta, identity, onRestored(→reload)` |
| TaskDetails | `task, allTasks, computedTasks, isSigned, orders, registries, identity` + 7 callbacks |
| FileManager | `tasks` (computed), `targetTask` |
| DailyReports | `tasks, orders, registries, identity` |
| TemplatesScreen | `onGenerate, tasks` |
| RegistriesScreen | `onChange(→setRegistries)` |
| CalculatorView / FinanceManager | none (fully self-owned) |

---

## 3. The computation pipeline (GanttEngine)

`utils/GanttEngine.js` is the brain. On every change it runs the whole chain
(pure function, ~500 lines, covered by tests):

```
raw tasks (flat array)
   │  1. schedule: forward pass over dependencies (FS/SS/FF/SF + lag),
   │     manualStart honored, groups span children
   │  2. quantities: leaf qty = manual OR element-column sum OR BOQ-linked child;
   │     executed qty (actualQty) = manual OR Σ approved value orders (OrderEngine)
   │  3. costs: totalCost = qty × unitPrice; actualCost from orders/expenses
   │  4. progress: per-task % → weighted roll-up by contract value (weight)
   │  5. baseline diff: scopeVariance / execVariance vs projectMeta.baseline
   │  6. critical path: CriticalPath.computeCriticalPath() → isCritical, totalFloat
   │  7. EVM: weekly PV/EV/AC → SPI, CPI, EAC, VAC + per-WBS roll-up + sCurve[]
   ▼
engineResult { tasks (enriched), projectTotalCost/Progress/Deviation,
               evm, sCurve, perWbsEvm, expenses, warnings, schedule dates }
```

Every computed task keeps the raw fields **plus** computed ones
(`qty, actualQty, price, startDate, endDate, progress, isCritical, weight,
orderSource, baselineQty, scopeVariance, …`). Full field list:
[03-data-model.md](03-data-model.md).

`OrderEngine.sumValueOrdersByTask(orders)` is the bridge between the order
ledger and the schedule: it aggregates approved value orders per `taskId` into
`{total, formalQty, quickQty, orderCount}` — that's how "executed" becomes
order-derived and read-only.

---

## 4. State & persistence ownership (who writes what)

| Data | Written by | Read by | Storage key |
|---|---|---|---|
| Task tree + BOQ | App.jsx (edit via Gantt grid / TaskDetails) | everything | `project-manager-gantt-tasks` |
| Project meta (status/baseline/VOs) | App.jsx modals | Monthly, Activity, engine | `project-manager-project-meta` |
| Order ledger | OrdersScreen (OrderEngine) | engine, Planning, Reports, Activity | `pm-orders` |
| Registries | RegistriesScreen | Orders, Planning, Reports, TaskDetails | `pm-registries` |
| Identity | IdentityPicker | stamps everywhere | `pm-identity` |
| App events | `logAppEvent` from App/screens | Activity feed | `pm-activity` |
| Plans | PlanningScreen | itself | `pm-plans` |
| Snapshots | SnapshotsScreen + auto-writer | restore | `pm-snapshots` |
| Templates / rates | TemplatesScreen | generator | `pm-templates` / `pm-rate-library` |
| Calculator | CalculatorView | itself | `pm-calculator-templates` |
| Daily reports | DailyReports | itself | `project-manager-daily-reports` |
| Finance ledgers | FinanceManager | itself | `project-manager-finance-data` / `-config` |
| Uploaded files | FileManager | itself | IndexedDB `ProjectManagerDB` |
| Language | LanguageSwitcher | i18n provider | `pm-language` |

Cross-tab live updates: OrdersScreen listens to the browser `storage` event so
two open tabs stay in sync. App itself refreshes the sibling stores on tab
switch — that's the whole synchronization story.

---

## 5. Styling & layout conventions

- Each screen folder has its own `*.css` next to the `.jsx`
  (e.g. `components/orders/OrdersScreen.css`). Global shell styles:
  `src/App.css`, `src/index.css`.
- Design language: Apple-ish light theme, CSS variables
  (`--bg-surface`, `--apple-blue-action`, `--apple-red`, `--apple-green`, …).
- Layout: fixed right sidebar (RTL) + workspace with topbar breadcrumb; the
  app root gets `dir={dir}` from i18n; numeric/chart containers force `dir="ltr"`.
- **No CSS framework, no component library** — plain CSS files.

---

## 6. Where to add a new thing (decision table)

| I want to add… | Do this |
|---|---|
| A new screen/tab | Create `components/<name>/` with `.jsx`+`.css`; add a nav `<a>` + render branch in `App.jsx`; add `app.nav.<name>` to both dictionaries |
| A new order type | Extend `ORDER_TYPES`/`ORDER_TYPE_LIST` in `OrderEngine.js` + dictionary labels in `orders.*` (see [04-utils-reference.md](04-utils-reference.md)) |
| A new computed metric | Add to `GanttEngine.calculate()` return; consume in Dashboard/MonthlyReport |
| A new stored entity | New util module with its own `STORAGE_KEY` + load/save; register the key in `DataIO.APP_STORAGE_KEYS` (so backup covers it!) |
| A new UI string | Both `dictionaries/ar/` and `dictionaries/en/` — never hardcode text ([06-i18n-guide.md](06-i18n-guide.md)) |
