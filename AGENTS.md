# AGENTS.md — AI Agent Entry Point (read this FIRST, not the code)

**Complete documentation lives in [`docs/`](docs/README.md). Read only the doc
you need, on demand — do not crawl the source tree to answer questions this
file already answers.** Docs last verified 2026-10-25.

## What this repo is (30 seconds)

A **React 19 + Vite** single-page app (`ProjectManagerApp/`) for managing a
real Iraqi canal-construction contract. No backend, no router, no database —
**all data in browser localStorage** (+ IndexedDB for file blobs), Arabic-first
(RTL) with English. Core design: site reality is entered once as **"orders"**
in one screen; every other screen (Gantt, dashboard, reports, activity) is a
live view over that ledger. Blueprint: `plans/ecosystem-plan.md`.

## Route your question to the right doc (do not read the code)

| Question | Doc |
|---|---|
| Domain words (BOQ, WBS, orders, VO, EVM), what each screen does, folder map | `docs/01-overview.md` |
| How App.jsx wires everything, data flow, who persists what, "where do I add X" | `docs/02-architecture.md` |
| Any localStorage key / data shape / object fields | `docs/03-data-model.md` |
| Anything in `src/utils/` (engines & their exports) | `docs/04-utils-reference.md` |
| Screen behavior, flows, UX rules | `docs/05-screens-guide.md` |
| Text/translation, adding a string or language | `docs/06-i18n-guide.md` |
| Rules, known quirks/traps, environment, roadmap | `docs/07-conventions-quirks-roadmap.md` |

## Commands (run from `ProjectManagerApp/`)

```bash
npm run dev     # dev server → http://localhost:5173  (root run.cmd also works)
npm run lint    # ESLint
npm run build   # production build
node --test "src/utils/__tests__/*.test.js"   # engine unit tests (no 'test' script defined)
```

## Golden rules (violating these breaks the app or the user's trust)

1. **New localStorage key ⇒ register it in `DataIO.APP_STORAGE_KEYS`** or backups lose it.
2. **UI text goes in BOTH `src/i18n/dictionaries/ar/` and `…/en/`** — never hardcode.
3. **Components never call localStorage directly** — persistence only via `src/utils` owners.
4. **Cleanup = move to `_archive/`** with a note; never delete files.
5. Don't add manual "actual quantity" inputs — executed qty is order-derived.
6. `exceljs`/`mathjs` deps are currently unused; no Excel export exists.
7. Data loss risk: everything lives in the browser — never instruct clearing storage without exporting a backup first (in-app Backup button).

## Fast facts (so you never grep for them)

- App shell: single file `src/App.jsx` (~1030 lines): tabs, lifecycle (draft→signed→executing→completed), sign-off baseline, Variation Orders, backup/restore, undo.
- Engine: `GanttEngine.calculate(tasks, PROJECT_START, projectMeta, orders)` → schedule + costs + progress + critical path + EVM + S-curve. `PROJECT_START = '2025-08-02'` (hardcoded).
- Order ledger keys: `pm-orders`; 9 types; families value/expense; tiers quick (auto-approved)/formal (needs Approve).
- Screens persist their own stores; App re-reads all stores on every tab switch.
- 15 localStorage keys + IndexedDB `ProjectManagerDB` — full table in `docs/03-data-model.md`.
- i18n: flat `'domain.key'` dictionaries, fallback ar→key, direction from `LANGUAGES`, persisted in `pm-language`.

## Current state & next steps

All work is committed (2026-10-25). Next: markups, baseline-diff view,
validation rules — full list in `docs/07-conventions-quirks-roadmap.md` §6–7.

## Folders other than the app

`plans/` design docs (implemented) · `Excel Sheets/` real contract reference
files · `Study/` large research library (no code; partially ignored via
`.zcodeignore`) · `_archive/` retired files (never delete) · `docs/` this documentation.

> **When you change the app, update `docs/` in the same session** and bump the
> "last verified" date in the affected file.
