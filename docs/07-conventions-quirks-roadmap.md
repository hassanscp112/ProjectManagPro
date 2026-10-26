# 07 — Conventions, Known Quirks, Environment & Roadmap

The rules that prevent mistakes. Read this before changing anything.

---

## 1. Non-negotiable project rules

1. **Archive, never delete.** Cleanup moves clutter into `_archive/` (with a
   restore note in `_archive/README.md`), never `rm`. Applies to repo files.
2. **Every new localStorage key must be registered** in
   `utils/storeRegistry.js` — backups (`DataIO.APP_STORAGE_KEYS`), the
   per-project key list and the server sync are derived from it; an
   unregistered key is silently lost.
3. **No hardcoded UI text** — both `ar/` and `en/` dictionaries
   ([06-i18n-guide.md](06-i18n-guide.md)).
4. **Components never touch `localStorage` directly** — always through
   `src/utils` helpers (one owner per key).
5. **Executed quantities are order-derived** — don't add UI that lets users
   type actual quantities when orders exist (`orderSource.manual === false`
   means locked).
6. Commits follow conventional-commit style, see git history:
   `feat(orders): …`, `fix(ui): …`, `feat(evm): …`, `docs: …`.

## 2. Code conventions

- Plain JavaScript + JSX (no TypeScript). React function components + hooks.
- Engines in `src/utils/` are pure/immutable where possible
  (`Registries.add*(registries, …)` return NEW objects).
- Styles (new UI, `src/ui/`): CSS Modules per component + design tokens in
  `src/ui/tokens.css`. Every token is named `--ui-*` (never reuse legacy names
  like `--text-primary`). Use logical properties (`inset-inline-start`,
  `margin-inline-end`) so RTL and LTR both work. Light/dark come from the
  tokens; `<html data-theme>` forces a theme, none = follow the OS.
- New UI components come from `src/ui/index.js`; every color must meet the
  contrast rules on the "Color system · Aubergine" board (text ≥ 4.5:1,
  control borders ≥ 3:1, status = icon/word + color).
- IDs: `crypto.randomUUID()` with timestamp-random fallback (`createTaskId`).
- Tests: Node built-in runner (`node:test`) for pure logic — `npm test` from
  `ProjectManagerApp/` (runs every `src/**/__tests__/*.test.js`).
- CSS comments: never write `*/` inside a comment (e.g. `--text-*/`); the dev
  server tolerates it but the production minifier fails.
- Undo (Schedule edit mode) keeps a 50-step in-memory history with a 1s typing debounce.

## 3. Known quirks & traps (verified in code)

| # | Quirk | Where | Implication |
|---|-------|-------|-------------|
| 1 | ~~`exceljs` and `mathjs` in package.json but imported nowhere~~ **removed** | — | No Excel export exists; the archived `analyze_excel.cjs` needs `npm i exceljs` to run again |
| 2 | ~~`PROJECT_START` is a hardcoded constant~~ **fixed** — each project has its own `startDate` | `utils/Projects.projectStartDate` | `PROJECT_START` remains only as the first project's default |
| 3 | ~~Topbar breadcrumb is a hardcoded Arabic string~~ **fixed in Phase 1** | — | Project name/contract now `ui.projectName` / `ui.projectContract` |
| 4 | Payroll compares raw `'مستقطع'` data value | `utils/OrderEngine.js` (`DEDUCTED_STATUS`, re-exported by `state/financeModel.js`) | Stored data value — don't translate the comparison. Payroll is now an expense order; net = salary − advance only for this status |
| 5 | ~~LanguageSwitcher caption is a ternary~~ **fixed in Phase 7** — the old switcher is archived; language menus use `l.label` | — | A 3rd language needs no UI change |
| 6 | ~~No router~~ **fixed in Phase 1** — hash routes | `src/app/router.jsx` | Refresh and links keep the screen; use `#/…` hrefs or `useNavigate()` |
| 7 | Snapshots cover tasks + projectMeta ONLY | Snapshots.js | Orders/finance NOT in snapshots (full safety = JSON backup). With a server, every record's versions are kept in the append-only `changes` table (History page, *Restore this version*) |
| 8 | Gantt bars are not draggable by design | `src/app/schedule/Gantt.jsx` | Dates/durations edited via grid inputs (edit mode) |
| 9 | localStorage **quota** (~5 MB) is the only real limit | all | File blobs already live in IndexedDB; big data goes to backup files |
| 14 | The first project keeps the plain (unprefixed) keys | `utils/Projects.js` (`legacy: true`) | Never read a project store with a fixed key — always `projectKey(KEY)` (or `keyFor(project, KEY)`), or you get the first project's data |
| 13 | Data belongs to the origin (`http://localhost:5173`) | `vite.config.js` | The dev port is pinned (`strictPort`): if 5173 is busy, `npm run dev` fails instead of opening an empty app on another port. The GitHub Pages site is another origin with its own, empty storage (move data with Backup → Restore). With a server set, each device's local stores are an offline copy of the server's data |
| 10 | Element columns/BOQ links only on group tasks | `app/schedule/TaskDetailsEdit.jsx` | Leaves are "record only" |
| 11 | Quick orders are born approved (`approvedBy` = identity) | OrderEngine | Only formal+recorded need the Approve action |
| 12 | ~~Engine task warnings are hardcoded Arabic~~ **fixed** — warnings carry `code` + `params` | `GanttEngine.js`, `app/schedule/warningText.js` | Shown in the UI language (grid tooltip and the task panel's warning list) |

## 4. Environment quirks (this machine / workflow)

- **Shell is Git Bash on Windows.** Paths with spaces — always quote:
  `cd "/e/Vs Code/Project Management Package"`.
- **Arabic text in heredocs breaks** in this environment — write script files
  to disk instead of piping Arabic through heredocs.
- **Browser automation:** Playwright element clicks can time out — use DOM
  `evaluate` clicks instead; verify app state via DOM queries, not screenshots.
- **GitHub Pages / PWA builds:** in Git Bash, prefix
  `MSYS_NO_PATHCONV=1` to `VITE_BASE=/ProjectManagPro/ npm run build`,
  otherwise the base becomes `/Git/ProjectManagPro/`. The built-in browser
  pane cannot register service workers — check them in Playwright's
  Chromium. The hosted site has its own (empty) storage; move data with
  Backup → Restore.
- E2E: `npm run test:e2e` (Playwright, its own dev server on 5190, one
  worker — parallel workers ran out of browser resources).
- Dev server: `npm run dev` → http://localhost:5173 (run.cmd opens it). The
  port is fixed — stop the other server if it says the port is in use. For
  automated checks use another port (`npm run dev -- --port 5180`) so the real
  data on 5173 is never touched.
- `Study/` contains a nested ~500 MB third-party repo clone
  (OpenConstructionERP, AGPL) — excluded from agent context via `.zcodeignore`;
  do not commit or copy it.

## 5. Design blueprints (why things are the way they are)

| Plan file | Status |
|---|---|
| `plans/ecosystem-plan.md` | Master vision "orders as foundation, enter once read everywhere" — **implemented** |
| `plans/advanced-lifecycle-plan.md` | Baseline / VO / lifecycle design — **implemented** |
| `plans/study-folder-analysis.md` | Notes on the Study research folder |
| `plans/roadmap-plan.md` | Full multi-user app, built by parallel sessions (accounts, sync, history, auto-planning, photos, PWA, certificates, diary) — **in progress** |
| `plans/auto-planning-plan.md` | Building wizard, BOQ → plan, working calendar, resources and leveling, learned productivity — **M1–M5 implemented**, M6–M7 in progress |

## 6. Current state (as of 2026-10-26)

Everything below is on branch `roadmap/integration` (built by parallel
sessions, `plans/roadmap-plan.md`); `main` still has the 2026-10-25 state
until the release merge.

- **Base app** (unchanged foundations): orders ledger, schedule + EVM +
  S-curve, lifecycle / baseline / VOs, reports, multi-project, i18n ar/en +
  RTL, Aubergine UI (`plans/ui-rebuild-plan.md`), backups (format v3,
  `pm-session` / `pm-server` never included).
- **Store registry:** every localStorage key is one entry in
  `utils/storeRegistry.js`; backups, per-project keys and sync derive from it.
- **Accounts, server, sync** (`supabase/`, `src/sync/`, `docs/08-server-setup.md`):
  Supabase schema + row-level security, offline-first item-level sync with an
  outbox, files to Storage, sign-in, server address per device, users and
  roles per project, "Upload this device's data", append-only `changes`
  history with restore. **No server set = the app works on this device
  only**, as before. Tested against the real migrations in PGlite
  (`npm run test:db`); **not yet run against a real server**.
- **Roles:** Admin, Project manager, Technical office engineer, Site
  engineer, Accountant, Viewer (`utils/permissions.js`, mirrored in
  `src/sync/rules.js` + SQL). The matrix still needs the user's confirmation
  on a real server.
- **Auto-planning** (`plans/auto-planning-plan.md`, M1–M5 merged): several
  predecessors per item, working calendar, leveling links; New project
  wizard (building templates per floor and trade, or from a contract BOQ by
  paste / `.xlsx`, matched to the work-type library), markups, resources and
  leveling (`#/schedule/resources`). M6–M7 (learned productivity, template
  editor v2) in progress.
- **Site and money:** photo evidence on orders; site diary + delay register
  (FIDIC 20.1 notice warning); payment certificates (subcontractor / main
  contract, retention, advance recovery, issue freezes and locks their
  orders); expenses recorded as orders, Finance = views over them, with a
  one-time move of the old ledger; order warnings ("Save anyway?") and no
  self-approval.
- **History:** History page per record, project timeline and *By person*
  (server), record stamps (recorded / approved / last edited by).
- **Platform:** installable PWA (offline, update prompt); GitHub Pages
  workflow (`.github/workflows/deploy-pages.yml`, Pages not yet switched on);
  storage meter in Settings.
- **Tests:** 513 unit tests (`npm test`), 96 SQL assertions + 12 sync tests
  (`npm run test:db`), 8 browser E2E tests (`npm run test:e2e`).
- **Printing:** only `.ui-print-sheet` content prints; certificates, daily
  report (with diary and day photos), delay register and monthly report were
  checked with print styles, not yet in a real print preview.

## 7. Roadmap (agreed next steps, in order)

1. **Release:** merge `roadmap/integration` into `main` (that push deploys the
   Pages site) and switch GitHub Pages on — only with the user's go-ahead.
2. **Real server:** set up the test laptop (`docs/08-server-setup.md`), then
   the two-device walkthrough from `plans/roadmap-plan.md` (offline order with
   photos, live sync, self-approval refused, role limits, history restore) and
   confirm the role matrix.
3. **Planning M6–M7** (learned productivity and Lookahead pace; template
   editor v2) and the History button in the task panel.
4. **Follow-ups:** device-side gate for deleting an approved formal order (the
   server already refuses it); history offline short-circuit in
   `src/sync/history.js`; `FileDB.putFile`; decide whether `ProjectGate`'s
   remount on sync can go; Pages repository variables for the server address;
   a real print preview pass; baseline-diff view.
5. Optional: 3rd language = one dictionary folder + LANGUAGES entry.

---

**When you change the app, update this documentation in the same session** —
each doc carries a "last verified" date; bump it when you touch what it describes.
