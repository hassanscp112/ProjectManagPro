# 07 — Conventions, Known Quirks, Environment & Roadmap

The rules that prevent mistakes. Read this before changing anything.

---

## 1. Non-negotiable project rules

1. **Archive, never delete.** Cleanup moves clutter into `_archive/` (with a
   restore note in `_archive/README.md`), never `rm`. Applies to repo files.
2. **Every new localStorage key must be registered** in
   `DataIO.APP_STORAGE_KEYS` — otherwise backups silently lose that data.
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
- Styles: one CSS file per component folder; Apple-ish light theme via CSS
  variables in `App.css`/`index.css`.
- IDs: `crypto.randomUUID()` with timestamp-random fallback (`createTaskId`).
- Tests: Node built-in runner (`node:test`) for pure logic only
  (`node --test "src/utils/__tests__/*.test.js"` from `ProjectManagerApp/`).
  Note: package.json has **no `test` script** — run the command directly.
- Undo (Gantt) keeps a 50-step in-memory history with a 1s typing debounce.

## 3. Known quirks & traps (verified in code)

| # | Quirk | Where | Implication |
|---|-------|-------|-------------|
| 1 | `exceljs` and `mathjs` are in package.json but **imported nowhere** | package.json | Don't assume Excel export or mathjs exists; removing them is safe if desired |
| 2 | `PROJECT_START = '2025-08-02'` is a hardcoded constant | App.jsx top | New projects must edit this |
| 3 | Topbar breadcrumb is a hardcoded Arabic string | App.jsx | Not translatable currently |
| 4 | Payroll compares raw `'مستقطع'` data value | FinanceManager | Stored data value — don't translate the comparison |
| 5 | LanguageSwitcher caption is a ternary `ar ? 'عربي' : 'EN'` | LanguageSwitcher.jsx | Breaks for a 3rd language — use `l.label` |
| 6 | No router — tab string state only | App.jsx | Deep links/refresh always land on Dashboard |
| 7 | Snapshots cover tasks + projectMeta ONLY | Snapshots.js | Orders/finance NOT in snapshots (full safety = JSON backup) |
| 8 | Gantt bars are not draggable by design | GanttChart.jsx | Dates/durations edited via grid inputs |
| 9 | localStorage **quota** (~5 MB) is the only real limit | all | File blobs already live in IndexedDB; big data goes to backup files |
| 10 | Element columns/BOQ links only on group tasks | TaskDetails | Leaves are "record only" |
| 11 | Quick orders are born approved (`approvedBy` = identity) | OrderEngine | Only formal+recorded need the Approve action |

## 4. Environment quirks (this machine / workflow)

- **Shell is Git Bash on Windows.** Paths with spaces — always quote:
  `cd "/e/Vs Code/Project Management Package"`.
- **Arabic text in heredocs breaks** in this environment — write script files
  to disk instead of piping Arabic through heredocs.
- **Browser automation:** Playwright element clicks can time out — use DOM
  `evaluate` clicks instead; verify app state via DOM queries, not screenshots.
- Dev server: `npm run dev` → http://localhost:5173 (run.cmd opens it).
- `Study/` contains a nested ~500 MB third-party repo clone
  (OpenConstructionERP, AGPL) — excluded from agent context via `.zcodeignore`;
  do not commit or copy it.

## 5. Design blueprints (why things are the way they are)

| Plan file | Status |
|---|---|
| `plans/ecosystem-plan.md` | Master vision "orders as foundation, enter once read everywhere" — **implemented** |
| `plans/advanced-lifecycle-plan.md` | Baseline / VO / lifecycle design — **implemented** |
| `plans/study-folder-analysis.md` | Notes on the Study research folder |

## 6. Current state (as of 2026-10-25)

- **Code:** 3+ build rounds shipped — orders foundation, snapshots,
  read-first TaskDetails, i18n ar/en + RTL, planning/activity/templates/
  registries screens, EVM + S-curve, monthly report, full backup/restore.
- **Git:** all work committed (2026-10-25) as per-feature conventional commits.
- **Tests:** 5 engine test files (76 tests), all pure-logic; no component tests.

## 7. Roadmap (agreed next steps, in order)

1. **Markups/pricing layer** — markup on top of rate library prices.
2. **Baseline-diff view** — visual comparison current vs baseline beyond the
   existing scope/exec variance numbers.
3. **Validation rules** — stronger order/entry validation (ranges, duplicates).
4. Deferred-quirks list: see §3 above; pick from there when doing cleanup.
5. Optional: 3rd language = one dictionary folder + LANGUAGES entry
   (plus the LanguageSwitcher fix, §3 #5).

---

**When you change the app, update this documentation in the same session** —
each doc carries a "last verified" date; bump it when you touch what it describes.
