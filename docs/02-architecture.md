# 02 — Architecture: How the Code Is Organized

Read [01-overview.md](01-overview.md) first for domain vocabulary.

---

## 1. The big picture (one diagram)

```
 main.jsx ─ fonts + src/ui tokens/base css ─ applyTheme(loadTheme()) ─ ensureProjects()
   └─ I18nProvider → UiProvider (Radix direction, tooltips, toasts) → App
        └─ App.jsx = AppErrorBoundary + SyncRuntime (server sync, sign-in gate — §8)
             │         + RouterProvider (hash URLs)
             │         + UpdatePrompt (service worker, "new version" banner; §7)
             ├─ /login (stand-alone: sign in, server address, "use without an account")
             ├─ projects level: PortfolioLayout → /projects, /projects/new,
             │                  /templates, /templates/new, /rates  (no project open)
             └─ inside a project: ProjectGate → ProjectProvider key=project.id(:plan epoch)
                                  → AppLayout → every other route

 ┌──────────────── src/state/ProjectProvider.jsx ─────────────────┐
 │ owns: tasks, projectMeta (persisted here on every change)       │
 │ mirrors: orders, registries, identity, appEvents (read from     │
 │          their utils owners; refreshed on every navigation AND  │
 │          live via storeEvents when an owner writes)             │
 │ engineResult = GanttEngine.calculate(tasks, projectStart,       │
 │                                      projectMeta, orders)       │
 │ actions: task edits, BOQ links, sign-off, status, VO,           │
 │          delete (with confirm), undo (50 steps), auto-snapshot  │
 │ pure logic lives in src/state/projectModel.js (tested)          │
 └──────────────────────────┬──────────────────────────────────────┘
                            │ useProject()
 ┌──────────────── src/app/ (router + shell) ──────────────────────┐
 │ router.jsx   route table          AppLayout.jsx  sidebar/bottom │
 │ navigation.js 7 areas + tabs      bar, Ctrl K search, app-wide  │
 │ Page.jsx     title + global       dialogs (delete, identity)    │
 │              actions + area tabs                                │
 │ <area>/      one folder per area (record, home, schedule,       │
 │              reports, finance, library, people, settings);       │
 │              Home + Record load with the app, the rest lazily   │
 └─────────────────────────────────────────────────────────────────┘

  ┌───────────────────────────────────────────────────────────────────────────────┐
  │  PAGES (src/app/<area>/) — persist through src/utils owners:                  │
  │                                                                               │
  │  Record pages → OrderEngine      → localStorage 'pm-orders'        (notifies) │
  │  LookaheadPage → PlanningStore   → localStorage 'pm-plans'                    │
  │  PeoplePage    → Registries      → localStorage 'pm-registries'    (notifies) │
  │  IdentityDialog → Identity       → localStorage 'pm-identity'      (notifies) │
  │  logAppEvent → ActivityLog       → localStorage 'pm-activity'      (notifies) │
  │  ProjectsPage / NewProjectPage → Projects → localStorage 'pm-projects'       │
 │  Templates/Rates pages → TemplateEngine/RateLibrary → 'pm-templates'/'pm-rate-library'
  │  SettingsPage  → Snapshots       → localStorage 'pm-snapshots'                │
  │  SettingsPage  → Theme           → localStorage 'pm-theme'                    │
  │  FilesPage     → FileDB          → IndexedDB 'ProjectManagerDB'               │
  │  BoqPage       → CalculatorTemplates → localStorage 'pm-calculator-templates' │
  │  DailyReportPage → DailyNotes    → localStorage 'project-manager-daily-reports'
  │  FinancePage   → Finance         → 'project-manager-finance-data'/'-config'   │
  └───────────────────────────────────────────────────────────────────────────────┘
```

**Projects:** project-scoped stores (tasks, meta, orders, plans, finance,
daily notes, BOQ grids, activity, snapshots) exist once per project; their
owners call `projectKey(base)` (`utils/Projects.js`) at every read/write, so
the open project decides the key. Shared stores (people, identity, templates,
rates, language, theme, the project list) use fixed keys. Files carry a
`projectId`. See [03-data-model §0](03-data-model.md).

**The one rule to remember:** task tree and project meta are owned by
`ProjectProvider`; every other store is owned by its `src/utils` module and
written there. Screens read everything through `useProject()`. There is **no
global state library** — React state + localStorage + change notifications.

---

## 2. The app shell and the project store

### Routes (`src/app/router.jsx`, hash URLs — refresh and links keep the screen)

| Area | Route | Screen (Phase 1: existing component) |
|---|---|---|
| **Projects level** | `/projects` | `app/portfolio/ProjectsPage.jsx` — all projects (status, value, progress, dates); open, edit details, delete (backup downloaded first). The landing page when no project is open |
| | `/projects/new` | `app/portfolio/NewProjectPage.jsx` — details + start from a template / blank / copy of a project → opens the Schedule in edit mode |
| | `/templates` (`?t=`) · `/templates/new` · `/rates` | `app/templates/` — shared templates (→ *New project from this template*), template builder, rate library |
| Home | `/` | **Rebuilt (Phase 3)** — `app/home/HomePage.jsx`: headline numbers, needs-attention list, S-curve + EVM figures, progress by section, recent orders |
| Record | `/record` · `/record/log` · `/record/pending` | **Rebuilt (Phase 2)** — `app/record/`: new order (desktop form + side panel; phone type → form → done), order log, pending approvals |
| Schedule | `/schedule` · `/schedule/task/:taskId` | **Rebuilt (Phase 4)** — `app/schedule/SchedulePage.jsx` + `Gantt.jsx`: KPI strip, lifecycle/view toolbars, grid + timeline in one scroller; the `:taskId` child route opens `TaskPanel.jsx` (drawer / bottom sheet) over it; sign-off / VO dialogs (`LifecycleDialogs.jsx`), backup/restore (`useBackupRestore.jsx`) |
| | `/schedule/lookahead` | **Rebuilt (Phase 4)** — `app/schedule/LookaheadPage.jsx` (month / week / day plans) |
| | `/schedule/baseline` | **Rebuilt (Phase 4)** — `app/schedule/BaselinePage.jsx` (signed vs current contract) |
| | `/schedule/task/:taskId/details` | **Rebuilt (Phase 7)** — `app/schedule/TaskDetailsPage.jsx` (read report + Edit: sub-items, quantity types with BOQ links, elements) |
| Reports | `/reports/daily` · `/reports/monthly` · `/reports/activity` | **Rebuilt (Phase 5)** — `app/reports/`: `DailyReportPage`, `MonthlyReportPage`, `ActivityPage` (view in `?view=`); printable sheets share `ReportSheet.jsx` |
| Finance | `/finance/:ledger` (`machinery` · `materials` · `pettyCash` · `payroll` · `lists`) | **Rebuilt (Phase 6)** — `app/finance/FinancePage.jsx` |
| Library | `/library/boq` (`?grid=`) · `/library/files(/:taskId)` (`?folder=`) | **Rebuilt (Phase 6)** — `app/library/`; the old `/library/templates` and `/library/rates` links redirect to the projects level |
| People | `/people/:kind` (`contractors` · `teams` · `workers`) | **Rebuilt (Phase 6)** — `app/people/PeoplePage.jsx` |
| Settings | `/settings` | **Rebuilt (Phase 6)** — `app/settings/SettingsPage.jsx` |
| | `/settings/users` | `app/settings/UsersPage.jsx` — members of the open project and their roles, invite by e-mail, company roles, what each role may do (needs a signed-in account and a shared project) |
| | `/settings/server` | `app/settings/ServerPage.jsx` — server address (device setting), the account, sync status, *Upload this device's data* |
| (account) | `/login` | `app/account/LoginPage.jsx` — outside the shell: sign in / create account, company setup on a new server, the server address, *Use without an account* |
| (phone) | `/more` | `app/pages/MorePage.jsx` — every area + identity |
| (dev) | `/dev/ui` | `dev/UiReview.jsx`, dev builds only |

`/reports` and `/library` redirect to their first sub-page; unknown routes go
Home. `ProjectGate` decides which project a project route runs in: the one
open in this tab (sessionStorage), else — for a deep link in a new tab — the
last one opened on this device; `#/` with no open project goes to
`/projects`. Opening a project from the list calls `openProject(id)` and
navigates to `/`; the store remounts per project (`key`), so nothing carries
over. Sub-pages show as tabs under the page title (`AREA_TABS` in
`app/navigation.js`; `alsoActive` keeps a tab lit on child routes, e.g. Timeline on
`/schedule/task/…`). Not yet split out (later phases): `/library/rates`, `/finance/:ledger`,
`/people/:kind`.

### ProjectProvider (`src/state/ProjectProvider.jsx`)

| Concern | Where / how |
|---|---|
| Task tree | `useState(loadTasks)` → saved to `project-manager-gantt-tasks` on every change |
| Project meta | `status` (`draft/signed/executing/completed`), `baseline`, `variations[]` → `project-manager-project-meta` |
| Project | `project` (the open project's record) and `projectStart` (its start date, `Projects.projectStartDate`) are in the context |
| Seed data | `INITIAL_TASKS` in `projectModel.js` — only for the first (legacy) project when its storage is empty; other projects start empty |
| Ecosystem stores | `orders / registries / identity / appEvents`, re-read on every route change (`AppLayout`) and live on `pm-store-change` events (`utils/storeEvents.js`) |
| Engine | `engineResult = useMemo(() => GanttEngine.calculate(...), [tasks, projectMeta, orders])` |
| Undo | 50-step history; a 1 s typing burst counts as one step; `ganttView` (edit mode, zoom, columns, critical-only, search, collapsed groups) survives navigation |
| Auto snapshot | `writeAutoSnapshot()` on any tasks/meta/identity change (no-op if today's exists) |
| Task actions | `updateTask`, `addMainTask`, `addSubTask`, `requestDeleteTask` → `confirmDeleteTask` (dialog in `AppLayout`), `setBoqLink`, `linkBoqToExisting`, `applyTaskPatches([{ id, patch }])` (several tasks, one undo step — `projectModel.applyTaskPatchList`), `setPlanning(patch \| updater)` (merges into `meta.planning`, not undoable — `projectModel.mergePlanning`) |
| Lifecycle | `signOff(signedBy)`, `setStatus(status)`, `raiseVariation(draft)` → true when recorded |
| Backup/restore | Schedule toolbar's More menu and Settings via `utils/DataIO` (validate → confirm → safety download → write keys + files → reload) |
| Crashes | `app/ErrorPage.jsx`: a screen crash shows the error page inside the shell (router `errorElement` on a pathless route); a shell crash shows it full-window; `AppErrorBoundary` in `App.jsx` catches the project store. All offer a backup download |

The Record rules (validation, building an order, repeat-last, log filters,
KPIs) are pure functions in `src/state/orderForm.js`; the Home rules (task
status, attention list, section progress, SPI/CPI tone, chart helpers) in
`src/state/homeModel.js`; the Schedule rules (timeline range and header tiers,
visible rows, field locks, task scope, baseline comparison) in
`src/state/scheduleModel.js`; the Lookahead rules (sections, month actuals,
day completion / PPC) in `src/state/lookaheadModel.js`; the Reports rules (day report, monthly
report, feed filters, item story, heatmap) in `src/state/reportsModel.js`; the projects level
(new-project checks, blank / copied task trees, card summaries, template
preview) in `src/state/portfolioModel.js`.
All are tested in `src/state/__tests__/`.

All tree/lifecycle transforms are pure functions in `projectModel.js`
(`addSubTask`, `deleteTaskCascade`, `toggleBoqLink`, `signOffProject`,
`applyVariation`, `appendGeneratedTasks`, …) with tests in
`src/state/__tests__/projectModel.test.js`.

### Props each screen receives (quick lookup)

| Screen | Props (from `useProject()` in its route page) |
|---|---|
| Schedule / Lookahead / Baseline pages | none — read `useProject()`; the Gantt gets rows from `visibleRows()` and calls `onUpdate(id, patch)` with only the changed fields |
| Record pages | none — read `useProject()` (tasks, orders, lastWhoByType, registries, identity, engineResult); rules in `src/state/orderForm.js` |
| Report pages | none — read `useProject()`; rules in `src/state/reportsModel.js` |
| Finance / Library / People / Settings pages | none — read `useProject()` (People saves through `saveRegistries` + `setRegistries`); rules in `src/state/financeModel.js`, `libraryModel.js`, `peopleModel.js` |

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
| Task tree + BOQ | ProjectProvider (edit via the Schedule grid / task panel / full task details) | everything | `project-manager-gantt-tasks` |
| Project meta (status/baseline/VOs) | ProjectProvider (Schedule dialogs) | Monthly, Activity, Baseline, engine | `project-manager-project-meta` |
| Order ledger | Record pages (OrderEngine `addOrder` / `approveOrder` / `deleteOrder`) | engine, Planning, Reports, Activity | `pm-orders` |
| Registries | PeoplePage | Orders, Planning, Reports, task details | `pm-registries` |
| Identity | IdentityDialog — the account dialog when signed in, else the local name (first launch, sidebar user, Settings) | stamps everywhere | `pm-identity` (+ the account in `pm-session`) |
| Server address, sign-in | ServerForm (login page, `/settings/server`), `src/sync` | `currentActor`, sync | `pm-server`, `pm-session` (device) |
| App events | `logAppEvent` from ProjectProvider/screens | Activity feed | `pm-activity` |
| Plans | LookaheadPage (via PlanningStore) | itself | `pm-plans` |
| Snapshots | SettingsPage + auto-writer | restore | `pm-snapshots` |
| Templates / rates | Templates / builder / Rates pages | generator | `pm-templates` / `pm-rate-library` |
| Calculator grids | BoqPage (via `utils/CalculatorTemplates.js`) | itself | `pm-calculator-templates` |
| Theme | SettingsPage (via `utils/Theme.js`) | `main.jsx` | `pm-theme` |
| Daily site notes | DailyReportPage (via `utils/DailyNotes.js`) | itself | `project-manager-daily-reports` |
| Finance ledgers | FinancePage (via `utils/Finance.js`) | itself | `project-manager-finance-data` / `-config` |
| Uploaded files | FilesPage (via `utils/FileDB.js`) | itself | IndexedDB `ProjectManagerDB` |
| Language | Page header language menu / Settings | i18n provider | `pm-language` |

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
- Global CSS is only `src/ui/tokens.css` + `src/ui/base.css` (reset, page
  lock, scrollbars, focus ring, skip link, print); the old `App.css` /
  `index.css` are archived (Phase 7).
- Design language: "Aubergine" — light / dark / device themes from the tokens.
- Layout: `AppShell` = dark sidebar (≥768px) or phone bottom bar + a main
  column that scrolls (`base.css` locks `html/body` scrolling); a "Skip to
  content" link is the first Tab stop; each page sets the window title; full-height
  pages (Schedule timeline) use `<Page fill>`; on phones `fill` is off and the
  page scrolls as a whole. The shell root gets `dir` from i18n;
  numeric/chart containers force `dir="ltr"`.
- No CSS framework; accessible primitives from Radix UI inside `src/ui/`.

---

## 6. Where to add a new thing (decision table)

| I want to add… | Do this |
|---|---|
| A new screen | Build it from `src/ui/` components; add a route in `src/app/router.jsx` (and an area or `AREA_TABS` entry in `app/navigation.js`); wrap it in `<Page area=…>`; labels in both dictionaries |
| A new order type | Extend `ORDER_TYPES`/`ORDER_TYPE_LIST` in `OrderEngine.js` + dictionary labels in `orders.*` (see [04-utils-reference.md](04-utils-reference.md)) |
| A new computed metric | Add to `GanttEngine.calculate()` return; consume in Home / the monthly report |
| A new stored entity | New util module with its own `STORAGE_KEY` + load/save; add one entry to `utils/storeRegistry.js` (backup, per-project keys and sync follow) |
| A new UI string | Both `dictionaries/ar/` and `dictionaries/en/` — never hardcode text ([06-i18n-guide.md](06-i18n-guide.md)) |

---

## 7. Build, installable app (PWA), deployment and E2E tests

**Base path.** `vite.config.js` sets `base: process.env.VITE_BASE || '/'`.
Locally the app lives at the root (dev server `localhost:5173`, fixed port);
the GitHub Pages build uses `VITE_BASE=/ProjectManagPro/`. The hash router
needs no server rewrites, so any static host works.

**Installable / offline (vite-plugin-pwa 2, Workbox `generateSW`).**
- `npm run build` also writes `dist/manifest.webmanifest`, `dist/sw.js` and a
  Workbox runtime file. The manifest: «مدير المشروع», `lang: 'ar'`,
  `dir: 'rtl'`, standalone, theme `#553285`, white background,
  `start_url` / `scope` `'.'` (relative to the base), the icons below.
- The service worker precaches every `js, css, html, svg, png, ico, woff2`
  file of the build (≤ 4 MB each; the largest chunk is BoqPage with
  jspreadsheet) and answers every navigation with `index.html`. Cache name
  `workbox-precache-v2-<scope>`. After the first visit the whole app, every
  lazy screen and the fonts open offline.
- No service worker in dev (`devOptions.enabled: false`): there
  `virtual:pwa-register/react` is a stub, so dev servers never cache.
- `registerType: 'prompt'`, `injectRegister: false`: `src/app/UpdatePrompt.jsx`
  (mounted beside `RouterProvider`) registers the worker with `useRegisterSW`.
  A new deployment installs in the background and **waits**; the banner
  "A new version is ready · Reload" appears and only the user's Reload
  switches over (skip-waiting + one reload). It never reloads by itself — a
  half-filled order would be lost. While open, the app checks for a new
  version every hour (when online). The first install shows the toast "Ready
  to work offline" once.

**Icons.** One source, `public/app-icon.svg` (aubergine tile, white roof over
three plan bars). `npm run icons` (`pwa-assets.config.js`,
`@vite-pwa/assets-generator`, preset `minimal-2023` with an aubergine instead
of white background for the maskable and Apple icons) writes next to it:
`pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`,
`maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`.
They are committed; rerun the script after changing the SVG. `index.html`
links the favicon, the SVG icon and the Apple icon, and sets `theme-color`
and the "standalone on the home screen" metas.

**Deployment.** `.github/workflows/deploy-pages.yml` runs on every push to
`main` (and by hand): in `ProjectManagerApp/`, Node 22, `npm ci`, `npm test`,
`npm run build` with `VITE_BASE=/ProjectManagPro/`, then
`upload-pages-artifact` (`dist`) and `deploy-pages` →
https://hassanscp112.github.io/ProjectManagPro/. The repository's Pages
source must be set once to **GitHub Actions** (Settings → Pages).
The Pages site is a **different origin** from `localhost:5173`: it starts
with empty storage. Move data with Backup on one and Restore on the other.

**Checking a Pages build locally.** Build with the base, then preview:
`VITE_BASE=/ProjectManagPro/ npm run build` and
`VITE_BASE=/ProjectManagPro/ npm run preview -- --port 4173`, open
http://localhost:4173/ProjectManagPro/. In Git Bash prefix both with
`MSYS_NO_PATHCONV=1` (it otherwise rewrites `/ProjectManagPro/` into a
Windows path); in PowerShell set `$env:VITE_BASE='/ProjectManagPro/'`.
DevTools → Application shows the manifest, the worker and the precache.

**E2E smoke tests.** `npm run test:e2e` (Playwright, `playwright.config.js`,
specs in `e2e/`). It starts its own dev server on port **5190** with empty
browser profiles, so real data is never touched; first run
`npx playwright install chromium`. `smoke.spec.js` creates a project from the
first template and opens every route (with real ids) as a fresh deep link
in Arabic and English, desktop and 375 px phone: no console errors, no error
page. `record-order.spec.js` records a quick work order and finds it in the
order log. Tests run one at a time (parallel full page loads exhaust the
browser against the unbundled dev server); the suite takes about 3 minutes.
Helpers (`e2e/helpers.js`) seed the language and a user name (so the
first-run identity dialog stays closed) and click through the DOM
(`element.click()`), because pointer clicks can time out in some
environments. Output goes to `test-results/` (git-ignored).

---

## 8. Accounts and server sync (`src/sync`)

Optional: without a server (or with *Use without an account*) the app is a
single-device app exactly as above. With one (Supabase, address in
`pm-server`, guide [08-server-setup.md](08-server-setup.md)):

```
 screens ──write──▶ localStorage stores (unchanged: still the read model)
                          │ notifyStoreChange · every 20 s · page visible · back online
                          ▼
             src/sync engine (one cycle at a time, all tabs — Web Locks)
   diff ── each SYNCED_STORES store split into items (registry `lists`) and
   │        compared with its base (IndexedDB pm-sync) → checkChange(role) →
   │        outbox entry { actor, device, client time } — or undo on the spot
   push ── push_changes RPC: row-level security + conflict rules; lost /
   │        refused versions come back into the store (kept in `changes`)
   pull ── pull_items since the scope's cursor (+ Realtime poke) → write
            the store → notifyStoreChange → screens refresh
   files ── FileDB blobs ⇄ Storage files/<project>/<file>
```

- **Gate:** `SyncRuntime` (in `App.jsx`) starts the engine and sends every
  route to `#/login` while a server is set, nobody is signed in and local
  mode was not chosen; `ProjectGate` does the same for project routes.
- **Who acts:** `Identity.currentActor()` = the signed-in account with its
  role in the open project (`pm-session.projectRoles`); `useCan()` follows
  it. The server enforces the same matrix (row-level security).
- **Scopes:** the organization (people, templates, rates) and each shared
  project. A project created on a device after signing in is shared
  automatically (admin / PM); older local projects go up with *Upload this
  device's data* (a safety backup is downloaded first).
- **Screens unchanged, two safeguards:** ProjectProvider keeps the plan in
  memory, so `ProjectGate` remounts it (key `project.id:epoch`) when the
  engine rewrites tasks / meta; and a screen that saves an older copy of a
  record a remote change replaced is not taken as an edit (until the next
  navigation) — the store is put back instead. A store emptied or removed
  at once is restored from the base, never deleted on the server.
- **History:** every applied write and every lost / refused version is in
  the server's append-only `changes`; `src/sync/history.js` reads it
  (`getHistory`, `getProjectTimeline`) and `restoreVersion` writes an old
  version as a new change.
- **History screens** (the only readers of that API):
  `#/history/:collection/:id` (`app/history/HistoryPage.jsx`) shows one
  record's versions with field diffs and *Restore this version*; the Activity
  feed and *By person* (`app/history/Timeline.jsx`) read
  `getProjectTimeline` when signed in and the project is shared, and fall
  back to the local feed (orders, variation orders, `pm-activity`) with no
  server, offline or when the server can't be read. Entry points:
  `ui/HistoryButton.jsx` (icon link) and `ui/HistoryStamps.jsx`
  ("recorded / approved / issued / last edited by", the last editor from
  `app/history/useLastChange.js`). Rules (diff, stamps, restore gate,
  timeline filters) are pure in `state/historyModel.js`; the restore gate is
  `src/sync/rules.checkChange`, so the button and the server agree.
