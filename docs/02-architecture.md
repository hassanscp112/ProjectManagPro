# 02 — Architecture: How the Code Is Organized

Read [01-overview.md](01-overview.md) first for domain vocabulary.

---

## 1. The big picture (one diagram)

```
 main.jsx ─ fonts + src/ui tokens/base css ─ data-theme="light"
   └─ I18nProvider → UiProvider (Radix direction, tooltips, toasts) → App
        └─ App.jsx = ProjectProvider + RouterProvider (hash URLs)

 ┌──────────────── src/state/ProjectProvider.jsx ─────────────────┐
 │ owns: tasks, projectMeta (persisted here on every change)       │
 │ mirrors: orders, registries, identity, appEvents (read from     │
 │          their utils owners; refreshed on every navigation AND  │
 │          live via storeEvents when an owner writes)             │
 │ engineResult = GanttEngine.calculate(tasks, PROJECT_START,      │
 │                                      projectMeta, orders)       │
 │ actions: task edits, BOQ links, sign-off, status, VO, templates,│
 │          delete (with confirm), undo (50 steps), auto-snapshot  │
 │ pure logic lives in src/state/projectModel.js (tested)          │
 └──────────────────────────┬──────────────────────────────────────┘
                            │ useProject()
 ┌──────────────── src/app/ (router + shell) ──────────────────────┐
 │ router.jsx   route table          AppLayout.jsx  sidebar/bottom │
 │ navigation.js 7 areas + tabs      bar, Ctrl K search, app-wide  │
 │ Page.jsx     title + global       dialogs (delete, identity)    │
 │              actions + area tabs                                │
 │ pages/       one route component per screen (Phase 1: mounts the│
 │              existing components/ screens unchanged)            │
 └─────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────────────────────┐
  │  MODULE SCREENS (components/) — own their persistence via src/utils owners:   │
  │                                                                               │
  │  Record pages → OrderEngine      → localStorage 'pm-orders'        (notifies) │
  │  PlanningScreen → PlanningStore  → localStorage 'pm-plans'                    │
  │  RegistriesScreen → Registries   → localStorage 'pm-registries'    (notifies) │
  │  IdentityPicker → Identity       → localStorage 'pm-identity'      (notifies) │
  │  logAppEvent → ActivityLog       → localStorage 'pm-activity'      (notifies) │
  │  TemplatesScreen → TemplateEngine/RateLibrary → 'pm-templates'/'pm-rate-library'
  │  SnapshotsScreen → Snapshots     → localStorage 'pm-snapshots'                │
  │  FileManager     → FileDB        → IndexedDB 'ProjectManagerDB'               │
  │  CalculatorView  → (own state)   → localStorage 'pm-calculator-templates'     │
  │  DailyReports                    → localStorage 'project-manager-daily-reports'
  │  FinanceManager                  → 'project-manager-finance-data'/'-config'   │
  └───────────────────────────────────────────────────────────────────────────────┘
```

**The one rule to remember:** task tree and project meta are owned by
`ProjectProvider`; every other store is owned by its `src/utils` module and
written there. Screens read everything through `useProject()`. There is **no
global state library** — React state + localStorage + change notifications.

---

## 2. The app shell and the project store

### Routes (`src/app/router.jsx`, hash URLs — refresh and links keep the screen)

| Area | Route | Screen (Phase 1: existing component) |
|---|---|---|
| Home | `/` | `dashboard/Dashboard` |
| Record | `/record` · `/record/log` · `/record/pending` | **Rebuilt (Phase 2)** — `app/record/`: new order (desktop form + side panel; phone type → form → done), order log, pending approvals |
| Schedule | `/schedule` | Gantt page (`app/pages/SchedulePage.jsx`: KPI strip, lifecycle/backup toolbar, `GanttChart`, sign-off / VO / restore dialogs) |
| | `/schedule/lookahead` | `planning/PlanningScreen` |
| | `/schedule/task/:taskId` | `taskDetails/TaskDetails` (was the hidden tab) |
| Reports | `/reports/daily` · `/reports/monthly` · `/reports/activity` | `DailyReports` · `MonthlyReport` · `ActivityScreen` |
| Finance | `/finance` | `finance/FinanceManager` |
| Library | `/library/boq` · `/library/templates` · `/library/files(/:taskId)` | `CalculatorView` · `TemplatesScreen` · `FileManager` |
| People | `/people` | `registries/RegistriesScreen` |
| Settings | `/settings` | `snapshots/SnapshotsScreen` |
| (phone) | `/more` | `app/pages/MorePage.jsx` — every area + identity |
| (dev) | `/dev/ui` | `dev/UiReview.jsx`, dev builds only |

`/reports` and `/library` redirect to their first sub-page; unknown routes go
Home. Sub-pages show as tabs under the page title (`AREA_TABS` in
`app/navigation.js`). Not yet split out (later phases): `/schedule/baseline`, `/library/rates`, `/finance/:ledger`,
`/people/:kind`.

### ProjectProvider (`src/state/ProjectProvider.jsx`)

| Concern | Where / how |
|---|---|
| Task tree | `useState(loadTasks)` → saved to `project-manager-gantt-tasks` on every change |
| Project meta | `status` (`draft/signed/executing/completed`), `baseline`, `variations[]` → `project-manager-project-meta` |
| Project start | `PROJECT_START = '2025-08-02'` in `src/state/projectModel.js` (still hardcoded) |
| Seed data | `INITIAL_TASKS` in `projectModel.js` — used only if storage is empty |
| Ecosystem stores | `orders / registries / identity / appEvents`, re-read on every route change (`AppLayout`) and live on `pm-store-change` events (`utils/storeEvents.js`) |
| Engine | `engineResult = useMemo(() => GanttEngine.calculate(...), [tasks, projectMeta, orders])` |
| Undo | 50-step history; a 1 s typing burst counts as one step; `ganttView` (edit mode, week/month) survives navigation |
| Auto snapshot | `writeAutoSnapshot()` on any tasks/meta/identity change (no-op if today's exists) |
| Task actions | `updateTask`, `addMainTask`, `addSubTask`, `requestDeleteTask` → `confirmDeleteTask` (dialog in `AppLayout`), `setBoqLink`, `linkBoqToExisting` |
| Lifecycle | `signOff(signedBy)`, `setStatus(status)`, `raiseVariation(draft)` → true when recorded |
| Templates | `generateFromTemplate(tree, meta)` → appends with renumbered WBS; the page then navigates to `/schedule` |
| Backup/restore | Gantt page toolbar via `utils/DataIO` (validate → confirm → write → reload) |

The Record rules (validation, building an order, repeat-last, log filters,
KPIs) are pure functions in `src/state/orderForm.js`, tested in
`src/state/__tests__/orderForm.test.js`.

All tree/lifecycle transforms are pure functions in `projectModel.js`
(`addSubTask`, `deleteTaskCascade`, `toggleBoqLink`, `signOffProject`,
`applyVariation`, `appendGeneratedTasks`, …) with tests in
`src/state/__tests__/projectModel.test.js`.

### Props each screen receives (quick lookup)

| Screen | Props (from `useProject()` in its route page) |
|---|---|
| Dashboard | `tasks={engineResult.tasks} summary={engineResult}` |
| GanttChart | `tasks={engineResult.tasks}` + `onUpdateTask, projectStart, isEditMode, isSigned, viewMode, onAdd*, onDelete, onJumpTo*` (jumps navigate to `/library/files/:id` and `/schedule/task/:id`) |
| Record pages | none — read `useProject()` (tasks, orders, lastWhoByType, registries, identity, engineResult); rules in `src/state/orderForm.js` |
| PlanningScreen | `tasks` (raw), `computedTasks`, `orders`, `registries` |
| ActivityScreen | `orders, variations, appEvents, tasks, registries` |
| MonthlyReport | `summary, computedTasks, orders, variations, projectMeta, registries` |
| SnapshotsScreen | `tasks, projectMeta, identity, onRestored(→reload)` |
| TaskDetails | `task, allTasks, computedTasks, isSigned, orders, registries, identity` + 7 callbacks |
| FileManager | `tasks` (computed), `targetTask` (from `:taskId`) |
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
| Task tree + BOQ | ProjectProvider (edit via Gantt grid / TaskDetails) | everything | `project-manager-gantt-tasks` |
| Project meta (status/baseline/VOs) | ProjectProvider (Gantt page dialogs) | Monthly, Activity, engine | `project-manager-project-meta` |
| Order ledger | Record pages (OrderEngine `addOrder` / `approveOrder` / `deleteOrder`) | engine, Planning, Reports, Activity | `pm-orders` |
| Registries | RegistriesScreen | Orders, Planning, Reports, TaskDetails | `pm-registries` |
| Identity | IdentityPicker | stamps everywhere | `pm-identity` |
| App events | `logAppEvent` from ProjectProvider/screens | Activity feed | `pm-activity` |
| Plans | PlanningScreen | itself | `pm-plans` |
| Snapshots | SnapshotsScreen + auto-writer | restore | `pm-snapshots` |
| Templates / rates | TemplatesScreen | generator | `pm-templates` / `pm-rate-library` |
| Calculator | CalculatorView | itself | `pm-calculator-templates` |
| Daily reports | DailyReports | itself | `project-manager-daily-reports` |
| Finance ledgers | FinanceManager | itself | `project-manager-finance-data` / `-config` |
| Uploaded files | FileManager | itself | IndexedDB `ProjectManagerDB` |
| Language | LanguageSwitcher | i18n provider | `pm-language` |

Synchronization: `saveOrdersData`, `saveRegistries`, `saveIdentity` and
`saveAppEvents` call `notifyStoreChange(key)` (`utils/storeEvents.js`), and
ProjectProvider re-reads that store at once; it also re-reads orders /
registries / events on every route change. Across browser tabs,
ProjectProvider also listens to the `storage` event for the same four keys.

---

## 5. Styling & layout conventions

- New UI (`src/ui/`, `src/app/`): CSS Modules + `--ui-*` tokens
  (`src/ui/tokens.css`), logical properties for RTL/LTR — see
  [07 §2](07-conventions-quirks-roadmap.md).
- Legacy screens (`components/`): own `*.css` next to the `.jsx`; legacy
  globals in `src/App.css` (imported by `AppLayout`) and `src/index.css`.
- Design language: Apple-ish light theme, CSS variables
  (`--bg-surface`, `--apple-blue-action`, `--apple-red`, `--apple-green`, …).
- Layout: `AppShell` = dark sidebar (≥768px) or phone bottom bar + a main
  column that scrolls (legacy CSS locks `html/body` scrolling); full-height
  pages (Gantt) use `<Page fill>`. The shell root gets `dir` from i18n;
  numeric/chart containers force `dir="ltr"`.
- No CSS framework; accessible primitives from Radix UI inside `src/ui/`.

---

## 6. Where to add a new thing (decision table)

| I want to add… | Do this |
|---|---|
| A new screen | Build it from `src/ui/` components; add a route in `src/app/router.jsx` (and an area or `AREA_TABS` entry in `app/navigation.js`); wrap it in `<Page area=…>`; labels in both dictionaries |
| A new order type | Extend `ORDER_TYPES`/`ORDER_TYPE_LIST` in `OrderEngine.js` + dictionary labels in `orders.*` (see [04-utils-reference.md](04-utils-reference.md)) |
| A new computed metric | Add to `GanttEngine.calculate()` return; consume in Dashboard/MonthlyReport |
| A new stored entity | New util module with its own `STORAGE_KEY` + load/save; register the key in `DataIO.APP_STORAGE_KEYS` (so backup covers it!) |
| A new UI string | Both `dictionaries/ar/` and `dictionaries/en/` — never hardcode text ([06-i18n-guide.md](06-i18n-guide.md)) |
