# 05 — Screens & Components Guide

One section per screen. Routes and props tables are in
[02-architecture.md §2](02-architecture.md); screens are mounted by route pages in
`src/app/pages/`. Component folders live under
`ProjectManagerApp/src/components/`.

**Golden pattern:** screens never call `localStorage` directly — persistence
always goes through `src/utils` helpers.

---

## Home — `src/app/home/` (rebuilt in Phase 3)

Where the project stands and what needs doing, at a glance (`#/`):
- **Headline numbers:** actual vs planned progress (bar with planned marker),
  SPI with deviation, EV of BAC, CPI with actual cost. Tones: ≥ 1.00 on track,
  ≥ 0.90 watch, below behind — judged on the value as shown (2 decimals).
  Phone: progress on top, SPI + CPI side by side, EV below; plus a
  "repeat last order" card that opens Record with the form prefilled
  (`navigate('/record', { state: { repeatLast: true } })`).
- **Needs your attention:** counts (late / in progress / starting soon / done)
  and up to 6 tasks — overdue, then active, then starting within 7 days,
  critical first; each opens `#/schedule/task/:id`. Progress is floored
  (99.99% shows 99%, never "100% done" on an unfinished task).
- **S-curve** (`SCurve.jsx`): PV dashed, EV solid, AC dotted; time runs left →
  right in both languages; earned/actual stop at today; month labels in the UI
  language; plus the six EVM figures (BAC, PV, EV, AC, EAC, VAC).
- **Progress by section:** each top-level WBS with EV / BAC bar and its SPI/CPI.
- **Recently recorded:** last 5 orders with Approve.
- Numbers with `%` or a sign inside Arabic sentences are wrapped in a
  left-to-right isolate (U+2066…U+2069) so they don't reverse.
Logic: `src/state/homeModel.js`.

## Dashboard (legacy) — `dashboard/Dashboard.jsx` (+ `SCurveChart.jsx`)

No longer routed; `SCurveChart` is still used by the legacy Monthly Report
until Phase 5. Archived in Phase 7.

Read-only project overview.
- Status cards + EVM tiles (BAC/PV/EV/AC/SPI/CPI/EAC/VAC from `summary.evm`;
  SPI/CPI tone: ≥1 good, ≥0.9 warn, else bad)
- **S-curve chart** — pure inline SVG (no chart library): 3 polylines
  (PV blue, EV green, AC orange), dashed "today" line, nice-number axis
  (`1/2/5×10ⁿ`), compact units (B/M/K vs Arabic). Container forced LTR.
- Per-WBS EVM roll-up table (`summary.perWbsEvm`) + Action Items
  (overdue-critical / active / next-7-days, sorted by weight).

## Schedule — `src/app/schedule/` (rebuilt in Phase 4)

Three sub-pages (tabs): **Timeline `#/schedule`**, **Lookahead
`#/schedule/lookahead`**, **Baseline `#/schedule/baseline`**.

**Timeline** (`SchedulePage.jsx` + `Gantt.jsx`):
- KPI strip (cost, progress, planned, deviation, duration, active items,
  warnings). Toolbar row 1 = lifecycle: draft → *Sign off contract*; signed →
  *Start execution*; executing → *Complete*; once signed also *Re-baseline* and
  *Variation orders* (count). Plus *Undo* (edit mode), *Edit* toggle and a More
  menu (backup / restore). Row 2 = zoom (week / month / quarter: 12 / 3 / 1 px
  per day), columns (Schedule: progress, days, start, end; Quantities: qty,
  executed, unit, price, amount), *Critical only*, search, *Today* (scrolls the
  today line into view), expand / collapse all.
- **One scroll container**: the item columns are sticky at the reading start,
  the timeline scrolls beside them, so rows can't drift apart. Header tiers per
  zoom; January and the first month carry the year. Group rows draw a span bar;
  leaf bars show actual progress, late items are red-tinted; today line.
  **No drag/resize** — dates are edited in the grid (deliberate).
- **Edit mode**: every cell becomes an input; locks come from `fieldLock()` and
  show a lock icon with the reason: BOQ-linked qty/unit, contract qty/unit/price
  after sign-off (change them with a variation order), executed qty from
  orders, start when a predecessor drives it, relation/lag without a
  predecessor, rolled-up fields on groups. Predecessor/relation/lag columns
  appear in edit mode only. Add sub-item / delete per row, add main group at
  the bottom. Edits send only the changed fields (`onUpdate(id, patch)`).
- Phones: KPIs and toolbars become sideways-swiping rows; optional columns and
  WBS hide; the chart keeps one screen of height and the page scrolls.

**Task panel** (`TaskPanel.jsx`, URL `#/schedule/task/:id`; drawer on desktop,
bottom sheet on phones): status / critical / float / warning chips, progress with
the planned marker, facts (qty, executed, remaining, price, value, earned value,
dates, duration, predecessor), quick edit (same locks), sub-items, latest 5
orders on the item or below it, and actions: *Record work* (opens Record with
the item preselected — `navigate('/record', { state: { taskId } })`), *Files*,
*Full details* (`#/schedule/task/:id/details`, the legacy `TaskDetails`
screen), *Delete* (confirm). A URL whose item no longer exists falls back to
`#/schedule`.

**Dialogs** (`LifecycleDialogs.jsx`): sign-off / re-baseline (name prefilled
with the last signer, else the current user) and variation orders (item,
quantity or unit price, new value, classification, urgency, optional cost and
schedule impact — cost defaults to the quantity increase × unit price, rounded
to 2 decimals — reason, approver, contract clause; list of past VOs).
Delete-item confirmation: `src/app/DeleteTaskDialog.jsx`.

**Baseline** (`BaselinePage.jsx`): when signed — who signed and when, baseline
vs current contract value, the difference and the number of changed items;
table of leaves with baseline/current quantity and price and the value change
(changed rows highlighted, new items badged; *Changed only* on by default).
Unsigned → an empty state with *Sign off contract*.
Logic: `src/state/scheduleModel.js`.

## Record — `src/app/record/` (rebuilt in Phase 2)

**The most important screen — the app's single entry point for site reality.**
Three sub-pages (tabs; Pending shows a count, as does the sidebar item):

- **New order `#/record`** — desktop: 9 type cards in two groups (work / expenses,
  each card says "quick · approved on save" or "formal · needs approval") →
  data-driven form (`ORDER_TYPES` decides the fields; `OrderForm.jsx`). Date =
  Today/Yesterday/Other chips; task = `TaskPicker` with "x of y done · z left";
  quantity box shows the BOQ unit (a unit field appears only if the task has
  none); who = `WhoPicker` (contractor fields: contractor/none; recipient fields:
  contractor/team/workers/none). Optional fields say "(optional)"; required ones
  show "Required" after a save attempt. **Enter / "Save and record next"** saves
  and re-seeds the same type with smart defaults (today, last who); "Save" saves
  and closes. "Repeat last order" copies type, task, unit and who. Side panel:
  pending approvals (Approve) and today's orders.
- **Phone** (`PhoneRecordFlow.jsx`) — type screen (repeat card + cards) →
  full-screen form (bottom bar hidden, Save pinned at the bottom) → done screen
  (record another of this type / another type / Home).
- **Order log `#/record/log`** — today/week figures, filters (dates, type,
  contractor, task), table on desktop / rows on phone, Approve + delete (confirm).
- **Pending `#/record/pending`** — formal orders still `recorded`.

Rules (unchanged): quick orders are approved on save by the current user;
formal orders start `recorded`; approving uses the current user's name or asks
for one (`useApproval.jsx`). Logic: `src/state/orderForm.js`.
The legacy `components/orders/` screen is no longer routed (archived in Phase 7).

## Lookahead — `src/app/schedule/LookaheadPage.jsx` (rebuilt in Phase 4)

Rolling plan at three levels (Month / Week / Day), with previous / next period
and *Today*:
- **Month**: quantity targets per item, grouped in one card per top-level
  section. Each row: item, target quantity (BOQ unit), executed this month (sum
  of **approved quantity orders** in that month) with a bar, note. KPIs:
  targets, target total, executed, achievement (met at 100%, amber ≥ 50%).
- **Week**: crew assignments (item + `WhoPicker` count / team / workers + note);
  *Copy last week*.
- **Day**: the same rows plus, per row, done / not done (done = at least one
  approved quantity order on the item that day), that day's orders and
  *Record work*. KPIs: completion rate (PPC = done ÷ assignments; good ≥ 80%),
  done / total, approved orders that day. *Same as yesterday*.
- Copying over a non-empty week/day asks first (`ConfirmDialog`); nothing to
  copy shows a toast. Rows with no item picked are dropped on reload.
- Storage: `utils/PlanningStore.js` (`pm-plans`). Logic:
  `src/state/lookaheadModel.js`. Month/weekday names come from `Intl`
  (`ar-IQ`, Levantine month names).

## Files — `FileManager.jsx`

Virtual folder tree: root → *Tasks* → one folder per task. Upload via picker or
drag-drop; download via object URL; delete. Blobs live in IndexedDB
(`utils/FileDB`). `targetTask` prop auto-navigates to that task's folder
(used by the task panel's *Files* action).

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
   → App appends the tree with renumbered WBS and jumps to the Timeline.
2. **Rates** — the IQD unit-price library (search/add/edit/delete).
3. **Editor** — save current project as a template, or build one from parts:
   variables, elements (part/group/formula/repeats/dependencies FS/SS/FF/SF
   with lag).
Seed templates keep Arabic names in storage with display-time English mapping.

## Task Details — `taskDetails/TaskDetails.jsx` (`#/schedule/task/:id/details`)

Deep drill-down for ONE task — reached from the task panel's *Full details* or by
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
