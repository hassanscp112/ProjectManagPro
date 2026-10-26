# 05 — Screens & Components Guide

One section per screen. Routes are in [02-architecture.md §2](02-architecture.md);
every screen lives in `ProjectManagerApp/src/app/<area>/` and is built from the
shared components in `src/ui/`.

**Golden pattern:** screens never call `localStorage` directly — persistence
always goes through `src/utils` helpers.

---

## Projects level — `src/app/portfolio/`, `src/app/templates/`

The level above every project, in its own frame (`PortfolioLayout`: sidebar
with *New project*, Projects, Templates, Rates; phone bottom bar). No project
store is mounted here. Inside a project, the sidebar's project name links
back to `#/projects` (and the phone *More* page lists the three pages).
- **Projects `#/projects`** — a card per project (newest first): name,
  contract, status, contract value, items, orders, actual progress with the
  planned marker, schedule span, location; *Open project*; ⋯ menu: *Edit
  details* (dialog), *Delete project* (asks, downloads a full backup first,
  then removes its keys and files). Empty state with *New project*. Figures
  come from each project's own stores (`portfolioModel.summarizeProject`).
- **New project `#/projects/new`** — details (name required, contract,
  location, start date) and *Start from*: **Template** (pick one, its
  variables, live preview priced from the rate library, dated from the start
  date), **Blank** (one empty main group), **Copy a project** (task tree,
  quantities, prices, links; nothing executed; dates moved by the start-date
  gap). *Create and start planning* creates it as a draft, logs it in the new
  project's activity, and opens the Schedule with editing on. Arriving from
  Templates preselects that template and its values.
- **Templates `#/templates`** — template cards; picking one (`?t=id`) shows
  its variables, a live preview and *New project from this template*. *Save
  project as template* picks one of the projects. Builder at
  `#/templates/new`. Seed template names and rate categories are stored in
  Arabic and shown in the UI language (`templateLabels.js`).
- **Rates `#/rates`** — the IQD rate library (shared): search, add / edit in
  a dialog, delete (asks first). Prices are copied at generation time.

Logic: `src/state/portfolioModel.js`; storage: `utils/Projects.js`.

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
*Full details* (`#/schedule/task/:id/details`, see Task Details below), *Delete* (confirm). A URL whose item no longer exists falls back to
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
  and closes. "Repeat last order" copies type, task, unit and who (never photos).
  Side panel: pending approvals (Approve) and today's orders.
- **Photos** (every type, after the spec fields; `ui/PhotoPicker`) — phone:
  *Take photo* (rear camera, `capture="environment"`) and *Gallery* (several);
  desktop: *Add photos*. At most 6; each is compressed first (thumbnail shows
  a spinner meanwhile, Save waits: "Preparing photos…") and can be removed.
  `useOrderEntry` keeps `photos` beside `draft`; `save()` is async: new order
  id → each photo to FileDB (`order_photos`, `{ orderId }`) → order with
  `evidence: ids`. A `saving` flag blocks a double submit ("Saving…"). If the
  photos cannot be stored the order is saved without them and a red toast
  says so.
- **Phone** (`PhoneRecordFlow.jsx`) — type screen (repeat card + cards) →
  full-screen form (bottom bar hidden, Save pinned at the bottom) → done screen
  (photo count when photos were attached; record another of this type /
  another type / Home).
- **Order log `#/record/log`** — today/week figures, filters (dates, type,
  contractor, task), table on desktop / rows on phone, Approve + delete
  (confirm; it names the photos, which are deleted with the order).
- **Order rows** (`OrderRow`, the log table, Home, task panel / details) — a
  camera button with the photo count opens the order's photos
  (`OrderPhotos.jsx`; the viewer dialog `OrderPhotosDialog.jsx` is loaded
  lazily). Viewer (`ui/PhotoViewer`): one photo, previous / next (arrow keys,
  mirrored in RTL), "2 / 5", download. Photos are read by
  `app/useOrderPhotos.js` (ids → `getFilesByIds` → object URLs, revoked on
  change / unmount).
- **Pending `#/record/pending`** — formal orders still `recorded`.

Rules (unchanged): quick orders are approved on save by the current user;
formal orders start `recorded`; approving uses the current user's name or asks
for one (`useApproval.jsx`). Logic: `src/state/orderForm.js`.
The old Orders screen is archived (`_archive/ui-rebuild/legacy-components/orders/`).

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

## Library — `src/app/library/` (rebuilt in Phase 6)

Two sub-pages (tabs) — templates and rates moved up to the projects level:
- **BOQ `#/library/boq`** — quantity take-off grids. A list of grids and the
  open one (`?grid=id`): a row per element, input cells (`design` columns
  tinted), formula cells computed by `CalculatorEngine.calculateRow`, a total
  per column, add / rename / delete rows. *Edit columns* opens
  `BoqTemplateEditor.jsx`: a small **jspreadsheet-ce** sheet (the only
  jspreadsheet use; kept left-to-right in its own light box) where row 1 =
  column names and row 2 = a test value or an Excel-style formula
  (`=A2*B2` — typing `=` marks the column as a formula); the side panel sets
  the selected column's source. Saves raw formulas. Storage:
  `utils/CalculatorTemplates.js`.
- **Files `#/library/files`** — folders: root → *Items* → one per top-level
  section (`task_<id>`), and root → *Order photos* (`order_photos`); the open
  folder is in `?folder=`; `#/library/files/:taskId` opens the folder of that
  item's section (the task panel's *Files*). Upload (button or drop),
  download, delete (asks first). *Order photos* lists every order's photos,
  newest first, with a thumbnail and the order (type · item · date, or
  "Deleted order"): view (viewer), download, delete — no upload; deleting a
  photo also removes it from its order. Blobs live in IndexedDB (`utils/FileDB`).
Logic: `src/state/libraryModel.js`.

## Reports — `src/app/reports/` (rebuilt in Phase 5)

All three are live views over the order ledger. Printable pages render a
`ReportSheet` (project name and contract, title, period, "issued" stamp, then
sections); **Print** refreshes the stamp and calls `window.print()`. On paper
only the sheet prints — shell, tabs and controls (`.ui-no-print`) are hidden —
black on white with thin plum rules (`@media print` in `src/ui/base.css`,
`Shell.module.css`, `Reports.module.css`). Paper always uses the light tokens,
whatever the screen theme.

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

## Finance — `src/app/finance/FinancePage.jsx` (rebuilt in Phase 6)

`#/finance/:ledger` — four ledgers as tabs (machinery, materials, petty cash,
payroll) plus **Lists**. A totals strip (all ledgers + each one) on top. Each
ledger: a table with date-range and per-ledger filters (machine type / driver,
material, expense type, employee), the period total, delete (asks first) and
Print (only the table prints); the add-record form sits beside it on wide
screens (≥ 1100 px) and opens in a drawer / bottom sheet otherwise. After a
save the date and the slow-changing fields stay for fast repeated entry.
- Machinery total = machine hours × rate + driver hours × rate + fuel liters
  × price.
- Payroll net = salary − advance **only when the status is `'مستقطع'`**
  (stored Arabic data value, deliberately not translated — see quirks).
- **Lists** — the dropdown values (machine types and sizes, employees,
  materials, expense types, advance statuses): add / remove; they are user
  data and stay as entered.
Storage: `utils/Finance.js`; rules: `src/state/financeModel.js`.

## People — `src/app/people/PeoplePage.jsx` (rebuilt in Phase 6)

`#/people/:kind` — contractors, teams, workers. Edits save as you type
(`saveRegistries` notifies the store, so every picker updates).
- Contractors / workers: editable tables (name, phone, notes; workers add
  trade with suggestions and daily rate).
- Teams: cards with name, foreman, member chips (★ marks the foreman), default
  size — automatic while it equals the member count; typing a number makes it
  manual; *Auto* resets it.
- Deleting asks first; deleting a worker says how many teams use them and
  automatic teams resize. Rules: `src/state/peopleModel.js`.

## Settings — `src/app/settings/SettingsPage.jsx` (rebuilt in Phase 6)

- **You** — the current user (name, role) and *Change* (opens the identity
  dialog, `src/app/IdentityDialog.jsx`, which also opens on first launch).
- **Appearance** — theme Light / Dark / Device (`utils/Theme.js`, `pm-theme`,
  applied before the first paint in `main.jsx`) and language.
- **Project lifecycle** — the status, and a link to the Schedule where the
  lifecycle actions are.
- **Backup & restore** — full JSON backup / restore incl. uploaded files
  (`useBackupRestore.jsx`, shared with the Schedule's More menu). Restore
  downloads a safety backup of the current data first. The "Browser storage"
  row shows whether the browser may clear the data (Protect asks again).
- **Snapshots** — counts and size; create a named snapshot; named ones can be
  restored, renamed, deleted; automatic daily ones (last 14) restored. Restore
  asks first, keeps the current data as a "Before restoring …" snapshot, and reloads. Snapshots cover tasks + project meta only.

## Task Details — `src/app/schedule/TaskDetailsPage.jsx` (rebuilt in Phase 7)

`#/schedule/task/:id/details` — the full page behind the task panel's *Full
details*. Header: back to the item panel, WBS + name, badges (group / work
item, signed, elements, linked BOQ items), dates and duration, and a
View / Edit switch (opening another item returns to View).

**View** (`TaskDetailsRead.jsx`) — overall progress (groups roll up from their
children); one card per **quantity type** (element column): contract,
executed, remaining and a bar — linked columns read their BOQ leaf and show
the reconciliation (element sum vs contract), unlinked ones show the column
sum × waste factor; the **elements map** sorted in progress → on hold → not
started → completed (completed hidden behind a toggle); the latest 10
**orders** on the item or below it (Approve inline) with a per-contractor
roll-up; **money** (contract, executed, variance, linked expenses);
**evidence** (tests, completions, photo count + the latest 8 photos from
orders on the item or below it — `orderRollup().photoIds`, newest order
first — and a link to the item's files); and the
**sub-items** table (name opens the sub-item's panel, or its details for
groups).

**Edit** (`TaskDetailsEdit.jsx`) — sub-items (name; quantity / executed /
unit / price with the same locks as the Schedule grid and the same lock
texts, `lockText.js`); **quantity types** (name, unit, waste %, total with
waste, BOQ: *New BOQ item*, *Link to an existing item…*, *Unlink*; BOQ links
only on groups — leaves are "record only"); **elements** (name, station,
status, a value per type, notes, totals). Deleting a type or element asks
first; deleting a type also unlinks it. Signed contracts show a note: contract
quantities and prices stay locked.
Rules: `src/state/taskDetailsModel.js`; BOQ linking: `projectModel`
(`toggleBoqLink`, `linkExistingBoq`).
