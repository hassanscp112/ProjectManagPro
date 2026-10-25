# UI/UX Rebuild Plan — "Aubergine"

**Status:** approved 2026-10-25 · in progress on branch `redesign/aubergine`
· Phases 0–2 done (sub-routes `/schedule/baseline`, `/library/rates`,
`/finance/:ledger`, `/people/:kind` arrive with their screens in Phases 4 and 6)
**Design source:** canvas "ProjectManager Redesign" (Desktop Home / Record / Schedule,
Phone Home / Record, Color system · Aubergine).

**Principle:** the screens, layout and styling are rebuilt from zero. The engines,
the stored data and the translations stay — same storage keys, same object
shapes. The app works fully at the end of every phase; each phase is merged to
`main` on its own.

---

## 1. Architecture decisions

| Area | Decision | Why |
|---|---|---|
| Router | React Router v7, **hash URLs** (`/#/schedule/task/2.1.2`) | Refresh and deep links work; no server setup, works offline and on any static host |
| State | Small project store (React built-ins, no library) | Replaces the 1,030-line `App.jsx` and the re-read-on-tab-switch workaround; task / sign-off / VO / BOQ-link / undo / snapshot actions become plain testable functions |
| Styling | Design variables (light + dark, from the color-system board) + one CSS Module per component | Plain CSS like today, scoped styles, logical properties so RTL and LTR both work |
| Primitives | Radix UI (dialog, popover, dropdown, tabs, tooltip, toast, direction), `cmdk` (Ctrl K search, task picker), `lucide-react` icons | Keyboard and screen-reader support built in; Radix handles RTL |
| Font | IBM Plex Sans Arabic bundled via `@fontsource` | Works offline on site |
| Kept as-is | `GanttEngine`, `OrderEngine`, `CriticalPath`, `PlanningStore`, `TemplateEngine`, `Snapshots`, `DataIO`, jspreadsheet (template editor only), S-curve chart (restyled only) | Tested and working |

**Shared components (`src/ui/`):** app shell (desktop sidebar, phone bottom bar,
top bar), Button, IconButton, Card, StatCard, StatusBadge (icon + text, never
color alone), ProgressBar, Field, NumberInput (with unit), Select, DateChips,
Tabs, Segmented, Table, ListRow, Drawer (side panel on desktop, bottom sheet on
phone), Dialog + ConfirmDialog (replaces `window.confirm`), Toast, EmptyState,
CommandPalette, TaskPicker, WhoPicker.

## 2. Navigation (13 tabs → 7 areas)

| Area | Contains | Routes |
|---|---|---|
| Home | Overview, needs attention | `/` |
| Record | Orders: new · log · pending | `/record`, `/record/log`, `/record/pending` |
| Schedule | Gantt · Lookahead · Baseline; task side panel | `/schedule`, `/schedule/lookahead`, `/schedule/baseline`, `/schedule/task/:id` |
| Reports | Daily · Monthly · Activity | `/reports/daily`, `/reports/monthly`, `/reports/activity` |
| Finance | Cost ledgers | `/finance/:ledger` |
| Library | BOQ calculator · Templates & rates · Files | `/library/boq`, `/library/templates`, `/library/rates`, `/library/files` |
| People | Contractors · teams · workers | `/people/:kind` |
| Settings | Snapshots, backup/restore, lifecycle, language, theme, identity | `/settings` |

Phone bottom bar: Home · Schedule · [+ Record] · Reports · More.

## 3. Phases

| # | Phase | Delivers | Size |
|---|---|---|---|
| 0 | Foundation | Libraries, design variables (light / dark / system), bundled font, all shared components, dev-only `/#/dev/ui` review page, `npm test` script, ar/en parity test | M |
| 1 | Store + router + shell | Logic out of `App.jsx` with identical behavior; hash routes; new sidebar and bottom bar; **current screens mounted inside the new shell** so everything keeps working | L |
| 2 | Record | Desktop type cards + dynamic form + pending approvals + log; phone type → form → done flow with date and contractor chips, repeat last order | L |
| 3 | Home | Headline numbers, restyled S-curve, attention list from engine critical/overdue tasks, progress by section, recent orders with Approve | M |
| 4 | Schedule | Rebuilt Gantt (week/month/quarter, today, critical filter, search, undo); task side panel replaces hidden TaskDetails tab; Lookahead sub-tab; sign-off and VO dialogs | XL |
| 5 | Reports | Daily, Monthly, Activity (heatmap in plum ramp); print = black/white with small plum touches | L |
| 6 | Finance · Library · People · Settings | All remaining screens; fixes the 3 screens that write localStorage directly (Calculator, Finance, DailyReports) | L |
| 7 | Polish + cleanup | Dark and phone passes, keyboard/screen-reader pass, per-route lazy loading (bundle is 1.15 MB today), old components to `_archive/`, all `docs/` updated, closes quirks #3, #5, #6 | M |

**Gate for every phase:** lint, unit tests and build pass; manual check at 1440 px
and 390 px; Arabic and English; light and dark.

## 4. Data and translations

- No migration: same 15 localStorage keys + IndexedDB; old backups restore into
  the new UI. New keys (e.g. `pm-theme`) are registered in
  `DataIO.APP_STORAGE_KEYS`. Export a backup before merging Phase 1.
- i18n system and its keys stay; reuse keys where the text is the same; new text
  goes into both `ar/` and `en/` in the same commit; a unit test fails if the
  two key sets differ; unused keys are removed in Phase 7.

## 5. Decisions taken

1. Hash URLs (`/#/record`).
2. CSS Modules + variables, not Tailwind.
3. Merge to `main` after each phase.
4. Photo attachments on phone orders postponed until after Phase 7.
5. Task editing inside the side panel; full page for large edits (element columns).
