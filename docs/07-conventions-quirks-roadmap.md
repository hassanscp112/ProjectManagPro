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
| 4 | Payroll compares raw `'مستقطع'` data value | `state/financeModel.js` (`DEDUCTED_STATUS`) | Stored data value — don't translate the comparison |
| 5 | ~~LanguageSwitcher caption is a ternary~~ **fixed in Phase 7** — the old switcher is archived; language menus use `l.label` | — | A 3rd language needs no UI change |
| 6 | ~~No router~~ **fixed in Phase 1** — hash routes | `src/app/router.jsx` | Refresh and links keep the screen; use `#/…` hrefs or `useNavigate()` |
| 7 | Snapshots cover tasks + projectMeta ONLY | Snapshots.js | Orders/finance NOT in snapshots (full safety = JSON backup) |
| 8 | Gantt bars are not draggable by design | `src/app/schedule/Gantt.jsx` | Dates/durations edited via grid inputs (edit mode) |
| 9 | localStorage **quota** (~5 MB) is the only real limit | all | File blobs already live in IndexedDB; big data goes to backup files |
| 14 | The first project keeps the plain (unprefixed) keys | `utils/Projects.js` (`legacy: true`) | Never read a project store with a fixed key — always `projectKey(KEY)` (or `keyFor(project, KEY)`), or you get the first project's data |
| 13 | Data belongs to the origin (`http://localhost:5173`) | `vite.config.js` | The dev port is pinned (`strictPort`): if 5173 is busy, `npm run dev` fails instead of opening an empty app on another port |
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

## 6. Current state (as of 2026-10-25)

- **Code:** 3+ build rounds shipped — orders foundation, snapshots,
  read-first task details, i18n ar/en + RTL, planning/activity/templates/
  registries screens, EVM + S-curve, monthly report, full backup/restore.
- **Git:** `main` fully committed (2026-10-25). UI rebuild on branch
  `redesign/aubergine`, merged to `main` phase by phase.
- **UI rebuild:** done (Phases 0–7, `plans/ui-rebuild-plan.md`). Every screen
  lives in `src/app/<area>/` on the shared components in `src/ui/`; the old
  `src/components/` screens and global CSS are in `_archive/ui-rebuild/`.
  Home and Record load with the app; the other areas are lazy routes
  (initial JS ≈ 650 kB, was 1.5 MB in one file; the jspreadsheet BOQ editor
  loads only with the BOQ page).
- **Theme:** Settings → Appearance (Light / Dark / Device), stored in
  `pm-theme`, applied in `main.jsx`. Paper always prints light.
- **Accessibility:** a "Skip to content" link, a window title per page, a
  focus ring on every focusable element (`base.css` fallback), labelled
  fields and icon buttons (checked on every route), status always with words.
- **Projects:** several projects with a level above them (`#/projects`):
  create from a template / blank / copy, open, edit, delete. Per-project
  stores via `Projects.projectKey`; templates, rates and people shared.
- **Data safety:** backups include uploaded files (format v2); restore
  downloads a safety copy first; persistent storage requested at startup;
  crash screens offer a backup download.
- **Tests:** 21 test files (171 tests), all pure-logic (engines, project model, order form, home model,
  schedule model, lookahead model, reports model, finance / library / people models, task details model,
  task ranking, who selection, backup encoding, projects and the projects-level model, ar/en dictionary parity); no component tests.
- **Printing:** only `.ui-print-sheet` content prints (report pages, finance
  tables); shell and `.ui-no-print` controls are hidden.

## 7. Roadmap (agreed next steps, in order)

0. **UI rebuild, Phases 1–7** — see `plans/ui-rebuild-plan.md`.
1. **Markups/pricing layer** — markup on top of rate library prices.
2. **Baseline-diff view** — visual comparison current vs baseline beyond the
   existing scope/exec variance numbers.
3. **Validation rules** — stronger order/entry validation (ranges, duplicates).
4. Deferred-quirks list: see §3 above; pick from there when doing cleanup.
5. Optional: 3rd language = one dictionary folder + LANGUAGES entry
   (no UI change needed).

---

**When you change the app, update this documentation in the same session** —
each doc carries a "last verified" date; bump it when you touch what it describes.
