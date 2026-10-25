# 05 — Screens & Components Guide

One section per screen. Routes and props tables are in
[02-architecture.md §2](02-architecture.md); screens are mounted by route pages in
`src/app/pages/`. Component folders live under
`ProjectManagerApp/src/components/`.

**Golden pattern:** screens never call `localStorage` directly — persistence
always goes through `src/utils` helpers.

---

## Dashboard — `dashboard/Dashboard.jsx` (+ `SCurveChart.jsx`)

Read-only project overview.
- Status cards + EVM tiles (BAC/PV/EV/AC/SPI/CPI/EAC/VAC from `summary.evm`;
  SPI/CPI tone: ≥1 good, ≥0.9 warn, else bad)
- **S-curve chart** — pure inline SVG (no chart library): 3 polylines
  (PV blue, EV green, AC orange), dashed "today" line, nice-number axis
  (`1/2/5×10ⁿ`), compact units (B/M/K vs Arabic). Container forced LTR.
- Per-WBS EVM roll-up table (`summary.perWbsEvm`) + Action Items
  (overdue-critical / active / next-7-days, sorted by weight).

## Gantt — `GanttChart.jsx`

The planning workbench. Split view: **editable data grid + timeline**.
- Grid columns: WBS, name, dates, durations, quantities, prices… Contract
  cells (qty/unit/price) **locked** when signed (`isSigned`) or BOQ-linked (🔗);
  executed qty is read-only when order-derived.
- Timeline: day-based (12px/day in week view, 3px in month view), year/month/week
  tiers, today line, leaf bars show actual-progress fill + planned strip,
  critical tasks get the `critical` class. Bars are anchored right in RTL.
  **No drag/resize** — dates are edited via grid inputs (deliberate).
- Two-way scroll sync + ResizeObserver row-height sync between grid and timeline.
- Row actions: jump to task folder (Files), jump to task details.
- The Gantt page (`src/app/pages/SchedulePage.jsx`, `#/schedule`) adds: KPI
  strip, lifecycle buttons, week/month toggle, undo, backup/restore, edit-mode
  toggle, and the sign-off / VO / restore dialogs (see 02-architecture).

## Orders — `orders/OrdersScreen.jsx` (+ `OrderTypePicker`, `TaskPicker`)

**The most important screen — the app's single entry point for site reality.**
- Top: KPI strip → type picker chips grouped by family (formal types show a
  "formal" badge) → data-driven draft form (`ORDER_TYPES` decides which fields).
- Save validates required fields, then **re-seeds the same type** with smart
  defaults (date, last who) for rapid consecutive entry.
- Order log: filters (date range/type/contractor/task), **Approve** (formal &
  recorded only; approver = identity name or modal input), delete with confirm.
- Watches browser `storage` events on `pm-orders`/`pm-registries` → two tabs stay in sync.
- **TaskPicker**: searchable leaf-task combobox, ranked recent-orders-first
  (by `recordedAt`), then numeric WBS order (`1.2` before `1.10`); caps at 40 shown.
- Unit autofills from the task's BOQ unit; changing task resets element.

## Planning — `planning/PlanningScreen.jsx`

Rolling lookahead, three zoom levels (month / week / day):
- **Month**: quantity targets per task per month.
- **Week**: crew assignments ("who on which task"), or *Copy Last Week*.
- **Day**: assignments, *Same as Yesterday* clone (confirm-replace), PPC badge.
- Execution math: month achievement uses **approved value orders** only
  (green ≥100%, amber ≥50%). Daily PPC = assignments with ≥1 approved value
  order ÷ total (green ≥80%, amber ≥50%).
- WhoPicker modes (count / team / workers) convert losslessly; picking workers
  that match a team roster preselects that team.
- Deleted tasks appear as "(deleted)" options. Arabic UI uses Levantine
  month/weekday names.

## Files — `FileManager.jsx`

Virtual folder tree: root → *Tasks* → one folder per task. Upload via picker or
drag-drop; download via object URL; delete. Blobs live in IndexedDB
(`utils/FileDB`). `targetTask` prop auto-navigates to that task's folder
(used by Gantt's "folder" jump).

## Calculator — `calculator/CalculatorView.jsx` (+ `CalculatorGrid`, `TemplateEditor`)

Quantity take-off tool:
- **CalculatorView** — template manager shell; persists `pm-calculator-templates`.
- **CalculatorGrid** — rows × columns grid; column sources: `input` (number),
  `design` (orange-tinted input), `formula` (read-only, computed by
  `CalculatorEngine.calculateRow`). Totals row for formula/input/design.
- **TemplateEditor** — builds a template using **jspreadsheet-ce** (the only
  jspreadsheet use in the app): Row 0 = headers, Row 1 = test values; typing
  `=` marks the column as formula; sidebar maps the selected column to a
  source. Saves raw formulas (from `sheet.options.data`, not evaluated values).
  Sheet container forced LTR.

## Daily Reports — `reports/DailyReports.jsx`

Daily site log = **manual entries + auto-generated "work done" section**.
- The auto section is derived live from the order ledger (`buildDayOrdersModel`
  groups value orders by task; values each as Σ qty × task.unitPrice; counts
  pending formal orders).
- Engineer name prefilled once from identity. Print via `window.print()`
  (one block per day in the selected range).

## Monthly Report — `reports/MonthlyReport.jsx`

Printable monthly report, **recomputed live from the order ledger on every
render**; printing freezes a stamped copy (`generatedAt`).
Sections: header/status, exec KPIs (progress, deviation, SPI/CPI, cost),
S-curve (reuses `SCurveChart`), BOQ progress per top-level WBS (approved value
orders, current − prior months), month's order log, variations, per-contractor
quantities + internal crews, financial summary (value − expenses), signatures.
Month selector defaults to **previous** month. Timezone-safe local dates;
change-arrows flip for RTL.

## Activity — `activity/ActivityScreen.jsx`

Audit & history, three tabs:
1. **Feed** — unified (orders + variations + app events), newest first; filter
   chips (all/value/expense/variation/event), date range, actor search,
   Load More (100/page).
2. **Task story** — pick a leaf task → chronological events + totals
   (contract vs executed, signed variance).
3. **Heatmap** — GitHub-style, IQD of approved value orders per day,
   Sat→Fri weeks, last 12 months, whole-project or per-contractor scope;
   click a day → ascending detail. Includes a 90-day "empty days" radar
   (site works 7 days/week, so empty = unrecorded).
Note: variations have no contractor attribution → appear only in whole-project day details.

## Snapshots — `snapshots/SnapshotsScreen.jsx`

Restore points. **Auto** (daily, restore-only, capped 14) and **Named**
(create with Enter, rename inline, delete, restore with confirm → page reload).
Stats strip via `snapshotsStats()`. Scope note in UI: snapshots cover
tasks/projectMeta only.

## Finance — `finance/FinanceManager.jsx`

Site cost ledgers, four tabs: machinery / materials / petty cash / payroll,
plus a Settings tab for the editable dropdown lists (`-config`).
- Machinery total = machine + driver + fuel subtotals.
- Payroll net = salary − advance **only when status === `'مستقطع'`** (stored
  Arabic data value, deliberately not translated — see quirks).
- Per-ledger filters; printing via `window.print()`.

## Registries — `registries/RegistriesScreen.jsx` (+ `IdentityPicker`)

CRUD for **contractors / teams / workers** + the current-identity card.
- Every mutation goes through `commit()` = setState + `saveRegistries` + notify App.
- Teams: member chips, foreman pick, default size (auto = member count; typing
  a number makes it manual; clearing restores auto).
- Deleting a worker re-syncs auto teams and warns how many teams used them.
- Trade field has datalist suggestions.
- **IdentityPicker** — "who is using the app?" modal (name required + role);
  App opens it on first launch (`hasIdentity()` false).

## Templates — `templates/TemplatesScreen.jsx`

Template studio, three tabs:
1. **Templates** — pick a card → fill variables + start date → live preview
   (items/qty/unit/price/cost/duration; warns on unpriced leaves) → Generate
   → App appends the tree with renumbered WBS and jumps to Gantt.
2. **Rates** — the IQD unit-price library (search/add/edit/delete).
3. **Editor** — save current project as a template, or build one from parts:
   variables, elements (part/group/formula/repeats/dependencies FS/SS/FF/SF
   with lag).
Seed templates keep Arabic names in storage with display-time English mapping.

## Task Details — `taskDetails/TaskDetails.jsx` *(hidden tab)*

Deep drill-down for ONE task — reached from Gantt/"jump to task details" or by
clicking a child inside itself. **Read-first design**: opens as a read-only
report (progress, quantities, element map, orders incl. WBS descendants,
money, evidence, children) — the ✏️ Edit button unlocks structure editing
(sub-tasks, element columns with waste factor + BOQ link/unlink, elements grid).
Switching tasks always resets to read mode.
- Element sort in read mode: in_progress → on_hold → not_started → completed
  (+ hide/show-completed toggle).
- Linked BOQ columns show contract/executed/remaining from the linked leaf with
  reconciliation delta; unlinked show column sum × waste factor.
- Locks: signed contract locks qty/unit/price; 🔗 children lock contract qty;
  executed qty locked when order-derived (`orderSource.manual === false`).
- BOQ link/unlink only on **group** tasks (leaves are "record only"); elements
  need ≥1 column; deletes confirm via `window.confirm`.
