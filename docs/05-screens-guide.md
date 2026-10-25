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

## Reports — `src/app/reports/` (rebuilt in Phase 5)

All three are live views over the order ledger. Printable pages render a
`ReportSheet` (project name and contract, title, period, "issued" stamp, then
sections); **Print** refreshes the stamp and calls `window.print()`. On paper
only the sheet prints — shell, tabs and controls (`.ui-no-print`) are hidden —
black on white with thin plum rules (`@media print` in `src/ui/base.css`,
`Shell.module.css`, `Reports.module.css`). `.ui-print-sheet` stays visible even
though the legacy Finance CSS hides `body *` when printing.

**Daily `#/reports/daily`** — *Day* (date with previous / next / Today) or
*Period* (from–to, notes filtered by engineer). Per day: figures (orders, work
value, expenses, pending), **Work done** (quantity orders grouped by item with
who did it, valued at the contract unit price), **Recorded expenses**, and
**Site notes**. The side card adds a note (engineer prefilled from the
identity, optional item, the note). Notes never record quantities (golden rule
5); old notes that have one show it as "Quantity noted". Deleting a note asks
first. Storage: `utils/DailyNotes.js`.

**Monthly `#/reports/monthly`** — month with previous / next (defaults to the
**previous** month). Sections: summary figures (as of today — said under them),
S-curve (`home/SCurve.jsx`), BOQ progress per top-level section (approved
quantity orders before vs within the month, remaining, %), the month's orders,
variation orders (old → new follows the reading direction), quantities per
contractor plus internal crews, money summary (work value − expenses per
category, net), signature lines. The project name comes from `ui.projectName`
/ `ui.projectContract` (the legacy sheet had it hardcoded in Arabic).

**Activity `#/reports/activity`** — three views kept in the URL (`?view=task`,
`?view=heatmap`):
1. **Feed** — orders, variation orders and app events, newest first; kind
   chips, date range, recorded-by search, 100 at a time. Expense rows show the
   category in words.
2. **Item history** — pick an item → totals (contract vs executed, variance,
   values, entries / approved) and its entries oldest first.
3. **Heatmap** — approved work value per day over 12 months, Saturday →
   Friday weeks, plum ramp (5 steps), a ring on days with orders but no
   approved value; whole project or one contractor; 90-day recorded / empty
   days; click a day for its entries (variation orders only in whole-project
   scope). Opens scrolled to the latest weeks.

Logic: `src/state/reportsModel.js`; month / weekday names and the issue stamp:
`src/app/dates.js`.

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
