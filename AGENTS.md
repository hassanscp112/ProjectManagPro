# AGENTS.md — AI Agent Entry Point (read this FIRST, not the code)

**Complete documentation lives in [`docs/`](docs/README.md). Read only the doc
you need, on demand — do not crawl the source tree to answer questions this
file already answers.** Docs last verified 2026-10-26.

## What this repo is (30 seconds)

A **React 19 + Vite** single-page app (`ProjectManagerApp/`) for managing
construction projects (the first one is a real Iraqi canal contract). A
projects level (`#/projects`) lists them and creates new ones from a
template, blank, or a copy; templates, rates and people are shared. No backend, no database (hash-URL router) —
**all data in browser localStorage** (+ IndexedDB for file blobs), Arabic-first
(RTL) with English. Core design: site reality is entered once as **"orders"**
in one screen; every other screen (schedule, dashboard, reports, activity) is a
live view over that ledger. Blueprint: `plans/ecosystem-plan.md`.

## Route your question to the right doc (do not read the code)

| Question | Doc |
|---|---|
| Domain words (BOQ, WBS, orders, VO, EVM), what each screen does, folder map | `docs/01-overview.md` |
| How the store, router and shell wire everything, data flow, who persists what, "where do I add X" | `docs/02-architecture.md` |
| Any localStorage key / data shape / object fields | `docs/03-data-model.md` |
| Anything in `src/utils/` (engines & their exports) | `docs/04-utils-reference.md` |
| Screen behavior, flows, UX rules | `docs/05-screens-guide.md` |
| Text/translation, adding a string or language | `docs/06-i18n-guide.md` |
| Rules, known quirks/traps, environment, roadmap | `docs/07-conventions-quirks-roadmap.md` |

## Commands (run from `ProjectManagerApp/`)

```bash
npm run dev     # dev server → http://localhost:5173, port fixed (data is per origin)  (root run.cmd also works)
npm run lint    # ESLint
npm run build   # production build
npm test        # unit tests: engines + ar/en dictionary parity (node:test)
```

Dev-only component review page: `npm run dev`, then http://localhost:5173/#/dev/ui

## Golden rules (violating these breaks the app or the user's trust)

1. **New localStorage key ⇒ one entry in `src/utils/storeRegistry.js`** (scope, owner, record lists). Backups (`DataIO.APP_STORAGE_KEYS`), per-project keys (`Projects.PROJECT_SCOPED_KEYS`) and the coming server sync all derive from it. A project-scoped key is always accessed as `projectKey(KEY)`.
8. **Permissions:** gate any action a role may be refused with `useCan()` (`src/app/useCan.js`) / `can(role, action)` (`src/utils/permissions.js`) — never compare role names in screens.
2. **UI text goes in BOTH `src/i18n/dictionaries/ar/` and `…/en/`** — never hardcode.
3. **Components never call localStorage directly** — persistence only via `src/utils` owners.
4. **Cleanup = move to `_archive/`** with a note; never delete files.
5. Don't add manual "actual quantity" inputs — executed qty is order-derived.
6. There is no Excel export (the unused `exceljs`/`mathjs` deps were removed).
7. Data loss risk: everything lives in the browser — never instruct clearing storage without exporting a backup first (in-app Backup button).

## Fast facts (so you never grep for them)

- Project store: `src/state/ProjectProvider.jsx` (+ pure `projectModel.js`) — tasks, meta, lifecycle (draft→signed→executing→completed), sign-off baseline, Variation Orders, undo; read it with `useProject()`.
- Shell + routes: `src/app/` (`router.jsx` hash URLs, `AppLayout.jsx`, `Page.jsx`, `pages/`). Every screen has a URL, e.g. `#/schedule/task/2.1.2`; route table in `docs/02-architecture.md` §2.
- Engine: `GanttEngine.calculate(tasks, projectStart, projectMeta, orders)` → schedule + costs + progress + critical path + EVM + S-curve. `projectStart` = the open project's `startDate` (in `useProject()`).
- Projects: `src/utils/Projects.js` — list in `pm-projects`, open project per tab (sessionStorage), per-project keys `pm-p:<id>:<key>`; the first (legacy) project keeps the plain keys. Routes inside a project go through `app/ProjectGate.jsx`; the projects level is `app/portfolio/` + `app/templates/`.
- Order ledger keys: `pm-orders`; 9 types; families value/expense; tiers quick (auto-approved)/formal (needs Approve).
- Screens persist their own stores via `src/utils`; orders/registries/identity/activity owners announce writes (`utils/storeEvents.js`) and the provider re-reads them instantly (also on every navigation).
- 16 localStorage keys + IndexedDB `ProjectManagerDB` — full table in `docs/03-data-model.md`. Backups (format v2) hold both; restore downloads a safety copy first.
- For automated browser checks run on another port (`npm run dev -- --port 5180`) — never test restore/clear on 5173, where the real data lives.
- i18n: flat `'domain.key'` dictionaries, fallback ar→key, direction from `LANGUAGES`, persisted in `pm-language`.

## Current state & next steps

**Roadmap in progress** (2026-10-26): `plans/roadmap-plan.md` — a full
multi-user app (Supabase accounts + offline-first sync + audit history),
auto-planning, photos, PWA, certificates, diary, built by parallel sessions on
branch `roadmap/integration`. Read it before starting any roadmap work.

**Multi-project** (2026-10-25): projects level, new project from template /
blank / copy, per-project storage, backup format v3 (all projects). See
`docs/03-data-model.md` §0.

**UI rebuild complete** ("Aubergine", `plans/ui-rebuild-plan.md`, Phases
0–7, merged phase by phase from `redesign/aubergine`). Every screen lives in
`src/app/<area>/` (record, home, schedule, reports, finance, library, people,
settings) and is built only from `src/ui/` components (design tokens
`src/ui/tokens.css`, all names `--ui-*`; CSS Modules per component). Screen
rules are pure, tested modules in `src/state/` (`orderForm`, `homeModel`,
`scheduleModel`, `lookaheadModel`, `reportsModel`, `financeModel`,
`libraryModel`, `peopleModel`, `taskDetailsModel`). Old screens and global CSS
are archived in `_archive/ui-rebuild/`. Roadmap: `docs/07-conventions-quirks-roadmap.md` §6–7.

## Folders other than the app

`plans/` design docs (implemented) · `Excel Sheets/` real contract reference
files · `Study/` large research library (no code; partially ignored via
`.zcodeignore`) · `_archive/` retired files (never delete) · `docs/` this documentation.

> **When you change the app, update `docs/` in the same session** and bump the
> "last verified" date in the affected file.
