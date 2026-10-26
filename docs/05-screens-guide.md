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
- **New project `#/projects/new?step=…`** — a step-by-step wizard (stepper
  on top, Back / Next in a sticky footer; a step opens once every step
  before it is complete; leaving with unsaved answers asks first — the
  shell's `#/` links are routed through the router while answers exist).
  Needs `plan.edit`.
  1. **Details** — name (required), contract, location, start date.
  2. **Start from** — a template (cards), **Blank** (one empty main group) or
     **Copy a project** (task tree, quantities, prices, links, its
     `meta.planning`; nothing executed; dates moved by the start-date gap).
  3. **Building** — the template's variables (numbers, choices, yes / no)
     with a live summary (levels · items · value).
  For a **building template** (schema 2) the wizard continues:
  4. **Levels** — per level area / height / use (defaults greyed).
  5. **Quantities** — items grouped by section / level, each with its
     formula; type a quantity to replace it, untick to drop the item.
  6. **Prices** — overhead / contingency / profit %, direct cost vs
     contract value; per-item unit cost (rate cost greyed; unpriced rows
     highlighted) → unit price with markups.
  7. **Calendar & durations** — calendar preset (Friday + Iraqi holidays ·
     Friday · Friday + Saturday · every day), rest-day toggles, holidays
     list (add / remove), reduced-pace periods (Ramadan, pace 0.75);
     crews per task per trade (auto, or fixed 1–6); productivity per work
     type for this project (library value greyed; fixed-duration types
     show their days).
  8. **Links** — every item with the items it waits for (type, lag); click a
     link to switch it off; filter "switched off".
  9. **Review** — contract value, direct cost, start, finish, duration
     (calendar and working days), items, critical items; warnings
     (unpriced, no productivity, tasks over 120 working days, template
     problems, schedule warnings); read-only Gantt with zoom.
  **From a BOQ** (*Start from* → *From a BOQ*, building templates only): the
  template gives the levels and the order of work, the contract BOQ the
  quantities and prices. Extra steps after *Levels*:
  - **Paste BOQ** — paste rows copied from Excel (header included), or
    *Open an Excel file (.xlsx)* (`read-excel-file`, loaded on demand; the
    sheet with the most BOQ lines is chosen, another can be picked); the
    header row and each column's meaning (item no., description, unit,
    quantity, unit price, amount) are found automatically and can be changed
    per column; a preview of the first rows; items / sections / total.
  - **Match lines** — each BOQ item → a work type (automatic, with a
    confidence: sure / likely / no match), lowest confidence first; filters
    *Needs a look* / *Chosen by you* / all; pick any work type or *None*.
    A line of work the building type doesn't use goes to *Other BOQ items*.
    Lines chosen by hand are remembered (work-type aliases) on *Create*.
  Then Quantities (BOQ items show "BOQ item n" instead of a formula) …
  Review, with BOQ warnings (lines without a work type / outside the
  template / unit differs; template work not in the BOQ is left out —
  the items after it keep their predecessors).
  Older (schema-1) templates go Details → Start → Building → Review (the
  previous preview table). *Create and start planning* creates the draft
  (tasks + `meta.planning` with calendar, markups, crews), logs it, and
  opens the Schedule with editing on. Arriving from Templates preselects
  that template and its values. Logic: `src/state/plannerModel.js`; steps:
  `app/portfolio/wizard/*`.
- **Templates `#/templates`** — template cards (archived ones hidden): the
  nine building templates (names and variable labels in the UI language;
  choice and yes / no variables as selects) plus any custom ones; picking
  one (`?t=id`) shows its variables, a live preview priced from the rate
  library with the default markups and *New project from this template*.
  A building template creates its project with `meta.planning` (markups);
  a copied project keeps the source's `meta.planning`. *Save
  project as template* picks one of the projects. Builder at
  `#/templates/new`. A template saved from a project keeps, for items with
  approved work, the pace the site reached. Seed template names and rate categories are stored in
  Arabic and shown in the UI language (`templateLabels.js`).
- **Rates `#/rates`** — the rate library (shared, direct cost): search,
  add / edit in a dialog, delete (asks first). Prices are copied at
  generation time. (`?tab=work-types` redirects to Work types.)
- **Work types `#/work-types`** — the work-type library
  (`templates/WorkTypesPanel.jsx`): search, filter by trade, per crew-day
  productivity, crew size, the rate it is priced by, *Mark checked* for
  seeded values (the hint counts what is left), add / edit (names ar + en,
  unit, trade, productivity, crew, fixed days, rate, keywords) / delete.
  Under each productivity: the **site pace** (approved orders, every
  project: per crew-day, working days, % off the library) and, when it is
  more than 15 % off over at least 5 working days, *Use …* (keeps the old
  value in the type's history); a hint counts those suggestions.
  Adding, editing, deleting, taking a site pace and rates need `plan.edit`.

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

Four sub-pages (tabs): **Timeline `#/schedule`**, **Lookahead
`#/schedule/lookahead`**, **Baseline `#/schedule/baseline`**, **Resources
`#/schedule/resources`**.

**Permissions** (`useCan`): *Edit*, add / delete and quick edit need
`plan.edit`; sign-off, start execution, complete and re-baseline need
`plan.signOff`; *Variation orders* needs `vo.draft`. Lookahead month targets
need `plan.edit`, week and day plans `plan.lookahead` (until that action
exists: the `record.work` roles) — read-only otherwise (a disabled
fieldset). Templates (new / delete / save project), the template builder's
*Save*, rates, work types and BOQ grids need `plan.edit`.

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
  orders, start when a predecessor drives it, rolled-up fields on groups.
  A **Predecessors** text column appears in edit mode only: every link of the
  item as `2.1FS+3; 2.4SS; 3.2FF-2d` (WBS, type — FS when left out — lag in
  working days, `d` = calendar days); applied on Enter / leaving the cell,
  text naming no item stays red with a tooltip, Esc restores. Add sub-item /
  delete per row, add main group at the bottom. Edits send only the changed
  fields (`onUpdate(id, patch)`).
- Bars are drawn over the calendar days they span (`spanDays`): with a
  project calendar, days off widen a bar.
- Phones: KPIs and toolbars become sideways-swiping rows; optional columns and
  WBS hide; the chart keeps one screen of height and the page scrolls.

**Task panel** (`TaskPanel.jsx`, URL `#/schedule/task/:id`; drawer on desktop,
bottom sheet on phones): status / critical / float / warning chips, progress with
the planned marker, facts (qty, executed, remaining, price, value, earned value,
dates, duration, predecessor), quick edit (same locks), sub-items, latest 5
orders on the item or below it (facts list every predecessor), and actions: *Record work* (opens Record with
the item preselected — `navigate('/record', { state: { taskId } })`), *Files*,
*Full details* (`#/schedule/task/:id/details`, see Task Details below), *Delete* (confirm). A URL whose item no longer exists falls back to
`#/schedule`.

Quick edit lists the predecessors (`LinksEditor.jsx`): one row per link —
the item it waits for, type, lag and whether the lag counts working or
calendar days — plus *Add predecessor*; a *Pin dates* toggle (resource
leveling never moves a pinned item); the item's trade, crews and people.
Facts show the trade (crews, people), the People team and *Waits for a crew
from* (leveling hand-overs), and — once it has approved work — the **pace on
site** (per working day, over how many days, against the plan) and the
working days left at that pace.

**Resources** (`ResourcesPage.jsx`, `ResourceChart.jsx`, `CalendarEditor.jsx`;
logic `src/state/resourcesModel.js`, `utils/planning/ResourceLeveler.js`):
- KPIs: limits set, overloads now, finish, items waiting for a crew.
- **Level the plan** — a live preview of the plan fitted to the limits:
  finish now → leveled, working days added, items moved (largest first,
  from → to, *waits for …*), crew changes, items too big for the site even
  alone, overloads left in pinned / started work. *Apply leveling* and
  *Clear leveling* are one undo step each (*Undo* beside them), stamp
  `planning.leveledAt` and log an activity event. Pinned, started and done
  items (and the work they wait for) never move; a signed baseline is kept.
- **What the project has** — per trade used: items, most crews on one item,
  crews available (empty = no limit) and People teams (a team belongs to one
  trade; teams without a number count one crew each); people on site at
  once; key equipment used by the items. Items planned before resources
  existed can be filled from their work types.
- **Use per week** — one resource at a time (the most overloaded first):
  bars = most in use in the week (two weeks once the plan passes two
  years), over the limit in the danger colour, the limit as a dashed line,
  hover for figures, *Show as a table*.
- **Working calendar** (the wizard's editor: preset, rest days, holidays,
  reduced-pace periods) — changing it moves every date; **markups** read-only.
Editing needs `plan.edit` (otherwise read-only).

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
- **Expense details** (last verified 2026-10-26) — machinery (machine type,
  size, driver, machine hours × rate, driver hours × rate, fuel liters ×
  price), material (material, quantity, unit, unit price, receipt no.),
  payroll (employee, salary, advance, advance status) and other expense
  (expense type) pick their values from the Finance lists (selects with
  "— Choose —"; a value no longer in the list stays selectable). Machinery,
  material and payroll show **the amount computed** in a tinted box with the
  lines it adds up from ("Machine: 6 h × 40,000 = 240,000"; payroll "Salary
  … / Less advance … (deducted)"); it updates as you type and cannot be
  typed. Payroll net = salary − advance only for the status `'مستقطع'`. A
  computed amount of 0 or less blocks saving ("Fill in the fields above…").
  Fuel and other expenses keep a typed amount.
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
- **Warnings, not blocks** (`useDraftWarnings.js` over `orderForm.draftWarnings`)
  — a complete draft that looks wrong asks first: quantity over what is left on
  the item's contract (orders awaiting approval count), a likely duplicate (same
  type, item, date, quantity and who), a date in the future or before the project
  start, an expense over 10× its type's median. Desktop: a **"Save anyway?"**
  dialog lists them (*Go back* / *Save anyway*). Phone: the first Save shows them
  above the Save bar and the button becomes *Save anyway*; changing the draft so
  the warnings change asks again. Required-field errors stay errors.
- **Who approves** (`OrderRuleBadges.jsx` `ApproveButton`, `useApproval.jsx`) —
  Approve shows only when `orderForm.approvalBlock` allows it: never one's own
  formal order (accounts; compared by `recordedById`, else name) and only roles
  with `orders.approve` (`useCan`). Otherwise the row says why ("Pending · You
  recorded it", "Your role cannot approve"; on phones the reason is the badge),
  and an approve that slips through is refused with a toast. Without accounts the
  one local user approves as before. New orders carry `recordedById`.
- **Certificate lock** — an order in an **issued** payment certificate shows
  "In certificate No. N" (main contract: "In main-contract certificate No. N";
  phones "Cert. N"; "+1" when two certificates hold it) linking to
  `#/finance/certificates/:id`, in the row's subtitle and in the log's status
  column. Delete (and approving again) opens "This order is in an issued
  certificate" with a link to each certificate instead of deleting.

Rules: quick orders are approved on save by the current user; formal orders
start `recorded`; approving uses the current user's name or asks for one
(`useApproval.jsx`). Logic: `src/state/orderForm.js`.
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
- **Pace** (`utils/Productivity.js`): a month row shows *At the current pace
  (X a day): N working days left* (or that there is no approved work yet);
  week and day rows show the suggested crews (planned daily quantity ÷ one
  crew's pace — the site's when known — with the people it means). The
  month view ends with **Pace by work type**: this project, all projects
  and the library per crew-day; *Use …* takes the site value into the
  library (`plan.edit`) and, with *Also re-time…* ticked, re-times this
  project's items of that type that have not started (one undo step;
  activity event `refId: 'productivity'`).
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
value, expenses, pending), **Site diary** (weather, max temperature, working
hours; manpower by trade and equipment by type with totals; recorded by /
last edited by),
**Work done** (quantity orders grouped by item with who did it, valued at the
contract unit price), **Recorded expenses**, **Visitors** and **Issues** (from
the diary), **Photos of the day** (`DayPhotos.jsx`: every photo of the day's
orders, `dayReport().photoIds`, in report order; thumbnails open the viewer; on
paper 18 mm thumbnails kept together), and **Site notes**. A period prints the days with orders, notes or a diary (diary-only
days only when no engineer is picked); the day view says when a day has no
diary. The side column (day view, screen only) holds the **diary card** — the
day at a glance with its *Recorded by · Last edited by* stamps and a History
link, and *Fill in / Edit the diary* (`record.work`; other roles see a
read-only line) — and the note form (engineer prefilled from the identity,
optional item, the note). The diary editor is a drawer (a bottom sheet on
phones): weather chips (tap again to clear), temperature, hours, rows for
manpower (trade + count), equipment (type + count) and visitors (name,
organisation, purpose), issues. A new day opens with manpower **prefilled from
the day's plan crews** (Lookahead); *From the day plan* refills it and *Same as
yesterday* copies weather, hours, manpower and equipment from the last
recorded day. Saving an empty diary removes the day. Notes never record
quantities (golden rule 5); old notes that have one show it as "Quantity
noted". Deleting a note asks first. Storage: `utils/DailyNotes.js`,
`utils/SiteDiary.js`; diary components `reports/DiaryParts.jsx`
(+ `Diary.module.css`).

**Monthly `#/reports/monthly`** — month with previous / next (defaults to the
**previous** month). Sections: summary figures (as of today — said under them),
S-curve (`home/SCurve.jsx`), BOQ progress per top-level section (approved
quantity orders before vs within the month, remaining, %), the month's orders,
variation orders (old → new follows the reading direction), quantities per
contractor plus internal crews, money summary (work value − expenses per
category, net), **Delays this month** (`reports/MonthDelays.jsx`: the events
that touch the month with the part inside it, days in the month — a day under
two events counts once — excusable days, claimed / granted), signature lines.
The project name comes from `ui.projectName` / `ui.projectContract` (the
legacy sheet had it hardcoded in Arabic).

**Delays `#/reports/delays`** — the delay register (`reports/DelaysPage.jsx`),
a printable `ReportSheet` "as of today": figures (events, delay days with
overlaps counted once, excusable days, claimed — drafts excluded — granted,
awaiting decision, notice warnings), the events newest first (title with
cause, *Recorded by · Last edited by* with a History link, and affected items; period; days — an open event runs to
today; excusable; notice date with a badge: in time / late notice / no notice
/ due by; claimed / granted; status), totals and signature lines. Filters:
status and cause (the totals follow them; a badge on the sheet names them). On
phones the register is a list of cards (stamps and History link under each);
paper always gets the table. *New
delay*, a row's edit button (or a click on the row / card) open the editor
drawer (`record.work` only):
title, cause chips, start / end (empty = ongoing), affected items (task picker
plus removable chips), excusable or not, **notice date** with a live warning
when it is more than 28 days after the start, or when no notice was given and
the 28 days have passed (FIDIC 20.1), status, days claimed, days granted (when
granted), notes; Delete asks first. A new event records `recordedBy` from
`currentActor()`. Storage: `utils/Delays.js`; rules: `state/diaryModel.js`.

**Activity `#/reports/activity`** — four views kept in the URL (`?view=person`,
`?view=task`, `?view=heatmap`):
1. **Feed** — *in a shared project (signed in)*: the server's timeline, i.e.
   everyone's changes (`getProjectTimeline`), newest first, 100 at a time
   with *Load older changes*; filters **type** (work orders, expenses,
   variation orders, plan items, diary, delays, certificates, photos and
   files, events, or the organization's people / templates / rates), **person**
   (project members and everyone in the rows) and **dates** (local days, both
   included). Each row: kind and record, what happened, who, when, *Waiting to
   sync* / *Not kept* / *Refused* badges, the order's figure and a History
   link. *Offline or the server can't be read*: a notice, this device's
   waiting changes, then the local feed below. *No server, local mode or a
   project only on this device*: the local feed — orders, variation orders
   and app events, newest first; kind chips, date range, recorded-by search,
   100 at a time. Expense rows show the category in words, app events their
   kind in words (payment certificate, project status, project, template);
   order and variation rows have a History link (stamps in its tooltip).
2. **By person** — "what did X do": a person (starts on you) and a period
   (today, last 7 days, last 30 days, dates). Shared project: their changes in
   the project and the organization's lists, with totals (changes, active
   days, waiting, not kept) and counts per type. Otherwise the names recorded
   on this device, with totals per kind.
3. **Item history** — pick an item → totals (contract vs executed, variance,
   values, entries / approved) and its entries oldest first.
4. **Heatmap** — approved work value per day over 12 months, Saturday →
   Friday weeks, plum ramp (5 steps), a ring on days with orders but no
   approved value; whole project or one contractor; 90-day recorded / empty
   days; click a day for its entries (variation orders only in whole-project
   scope). Opens scrolled to the latest weeks.

Logic: `src/state/reportsModel.js` (local feed: `filterFeed`, `feedActors`,
`feedSummary`, `eventKindKey`) and `src/state/historyModel.js` (server
timeline: `timelineQuery`, `filterTimeline`, `timelineActors`,
`personSummary`, `periodDays`); the server views are `app/history/Timeline.jsx`
(+ `timelineHooks.jsx`). Diary and delays: `src/state/diaryModel.js`; month /
weekday names and the issue stamp: `src/app/dates.js`.

## History — `src/app/history/HistoryPage.jsx`

`#/history/:collection/:id` (collection = the store key, e.g. `pm-orders`; id =
the record id or its item key, encoded — a diary day is
`days%2F2026-10-26`). Opened from the **History** buttons
(`ui/HistoryButton.jsx`: an icon link; with `record` its tooltip and
accessible name carry the stamps) on order rows (`record/OrderRow.jsx`, so
also Home, Record, the task panel and task details), Activity rows, the
certificate toolbar, delay rows and cards, the diary card and people rows.
- Header: kind of record, its name, and the stamps *Recorded by · Approved
  by · Issued by · Last edited by* (`ui/HistoryStamps.jsx`; the last editor
  comes from the server's newest change when it is later than the record's
  own `updatedBy`).
- **Signed in, shared project:** every version newest first
  (`getHistory`; this device's waiting changes on top, marked *Waiting to
  sync*): what happened (added / changed / deleted / restored / uploaded),
  who, when, which device (*This device* or a short id), *Not kept* for a
  version that lost a conflict or was refused (with the reason), *Restored an
  earlier version*, and the **fields before → after** (`ui/HistoryDiff.jsx`:
  labelled fields, nested values as *Who › Kind*, lists of records matched by
  id as *Manpower › Helper › Count*, plain lists as *Added / Removed*, ids
  shown as names — tasks, contractors, teams, workers, an order's *who* —
  codes in words and dates as dates; six fields, then *Show N more*). The version in force is marked *Current
  version*.
- **Restore this version** (older versions, a deletion — brings the record
  back — or a version that was not kept): shown when the role may write that
  version over the current one (the same sync rule as any edit:
  `historyModel.restoreGate` → `src/sync/rules.checkChange`; e.g. replacing an
  approved formal order needs `orders.approve`), disabled with the reason
  otherwise and while offline. It asks first, then `restoreVersion` writes it
  as a **new** change by you; nothing in the history is removed.
- **Offline / server unreadable:** a notice and only the changes waiting on
  this device (with *Try again* when the server failed).
- **No server, signed out or a project only on this device:** a clear empty
  state, then *On this device*: the record's own stamps (or that it is no
  longer here) and the app events logged about it.

## Finance — `src/app/finance/FinancePage.jsx` (rebuilt in Phase 6)

(Last verified 2026-10-26.) **Expenses are entered once, as expense orders**
(Record or here); the ledgers are views over them. `#/finance/:ledger` — four
ledgers as tabs plus **Lists**:

| Ledger | Shows expense orders of type | "Add" opens |
|---|---|---|
| machinery | `machinery` | machinery |
| materials | `material` | material |
| petty cash | `other_expense`, `fuel` | other expense |
| payroll | `payroll` | payroll |

A totals strip (all ledgers + each one; together = every expense order) on
top. Each ledger: a table with date-range and per-ledger filters on the order
details (machine type / driver, material, expense type, employee), the
period total, delete (`finance.edit`; the order delete dialog, its photos go
too) and Print (only the table prints). **Add** (`finance.edit`) is the
Record screen's order form for that type (`OrderForm`, photos included),
beside the table on wide screens (≥ 1100 px) and in a drawer / bottom sheet
otherwise; it says "Saved as an expense order — it shows in the order log
too". After a save the date and the slow-changing fields stay (machine type,
size, driver, rates, fuel price; material, unit, unit price; expense type;
advance status). Rows of moved orders also show the old machine name /
badge and the old free-text quantity.
- **The old ledger** (`project-manager-finance-data`) — until it is moved, a
  yellow notice: "The old finance ledger is not in these tables yet … holds N
  records (total)". **Review the move** (`finance.edit`; others read "Someone
  who can edit finance can move them") opens the dry run: per ledger the old
  records and total, already moved, to move and the amount; then **Download
  backup and move N** downloads `project-backup-before-finance-migration-….json`
  (if the backup fails nothing moves), adds one approved expense order per
  record (original date and amount, `source: 'finance-migration'`) and sets
  the migrated flag. After: "The old ledger was moved into expense orders on
  {date} by {name} (N records). It is kept, read-only." with **Compare the old
  ledger with its orders** (old records / total vs orders / total per ledger).
  Records added to the old ledger later (an old app version, another device)
  show "N records were added … since" and **Move N more**; nothing is ever
  moved twice and a moved order deleted since is not brought back. The old
  key is never deleted.
- **Lists** — the dropdown values (machine types and sizes, employees,
  materials, expense types, advance statuses) the expense order details pick
  from: add / remove; they are user data and stay as entered.
Storage: `utils/Finance.js` (old ledger + lists), orders `utils/OrderEngine.js`;
rules: `src/state/financeModel.js`.

### Payment certificates (الذرعات) — `src/app/finance/Certificate*.jsx`

The Finance tab **Certificates**. Two kinds: **subcontractor** (that
contractor's approved work at the rates agreed with them) and **main contract
/ employer** (all approved work, by anyone, at the BOQ unit prices). Numbers
run per kind and contractor.
- **List `#/finance/certificates`** (`CertificatesPage.jsx`) — filters: kind
  (all / subcontractor / main contract) and contractor; a table on desktop
  (No., for, period, status, gross to date, net payable, "N without a rate")
  and rows on phones; each opens its certificate. *New certificate* needs
  `certificates.prepare`.
- **New certificate** (`CertificateNewDialog.jsx`) — kind, contractor, period
  end (default today). A series has one draft at a time: if one exists the
  dialog offers *Open draft No. N*; the period must end after the last issued
  certificate.
- **Rates & terms `?view=rates`** (`CertificateRates.jsx`) — the agreed rates
  as a contractor × item table (BOQ price shown beside them); *With orders*
  (default) / *All items*, search, and a contractor picker (one contractor at a
  time on phones; `&contractor=id` preselects one). A cell where that
  contractor has orders but no rate is marked "needs a rate". Below: the
  default terms (retention %, retention limit, main-contract advance, advance
  recovery %, currency label). Fields save when left (Enter too).
- **Certificate `#/finance/certificates/:id`** (`CertificatePage.jsx`) — the
  toolbar shows *Recorded by · Issued by · Last edited by* and a History link
  (screen only); a printable `ReportSheet`: who it is for, number, terms, orders counted; **Work
  done** per item — quantity and amount, each previous / this period / to date,
  × the rate ("No rate" lines are flagged and left out); **Summary** — gross,
  less retention, less advance recovery (with the advance left), less other
  deductions → net due to date, less previous certificates → **net payable**;
  other deductions; note; three signature lines (subcontractor: preparer,
  project manager, subcontractor; main contract: contractor, resident engineer,
  employer's representative). *Print* prints the sheet only.
  - **Draft**: follows the order log live; notices say what blocks issuing
    (items without a rate → *Set the rates*; a period before the last issued
    one; no approved work). The side card edits the period end, the terms
    (copied from the previous certificate of the series), other deductions and
    the note. *Delete draft* asks first. *Issue certificate*
    (`certificates.issue`) asks first, then freezes lines, totals and the
    certified orders and logs it in Activity.
  - **Issued**: frozen; the side card shows who issued it and when.

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
- Each row (and team card) has a **History** link (`#/history/pm-registries/<list>%2F<id>`).

## Settings — `src/app/settings/SettingsPage.jsx` (rebuilt in Phase 6)

- **You** — the current user (name, role) and *Change* (opens the identity
  dialog, `src/app/IdentityDialog.jsx`, which also opens on first launch).
- **Appearance** — theme Light / Dark / Device (`utils/Theme.js`, `pm-theme`,
  applied before the first paint in `main.jsx`) and language.
- **Project lifecycle** — the status, and a link to the Schedule where the
  lifecycle actions are.
- **Backup & restore** — full JSON backup / restore incl. uploaded files
  (`useBackupRestore.jsx`, shared with the Schedule's More menu). Restore
  downloads a safety backup of the current data first. Signed in to a server,
  its confirm also says the restored data will be sent to the server as edits
  by you, recorded in the history. The "Browser storage"
  row shows whether the browser may clear the data (Protect asks again).
  Under it, the storage meter (`utils/StoragePersistence.getStorageUsage`):
  *Space used on this device* (the browser's quota for the app, shown when
  the browser reports it), *Project data* (localStorage of its ~5 MB limit)
  and *Order photos* (count · size, all projects). A bar turns orange and a
  warning asks for a backup when either reaches 80 %. Read once when the
  page opens.
- **Snapshots** — counts and size; create a named snapshot; named ones can be
  restored, renamed, deleted; automatic daily ones (last 14) restored. Restore
  asks first, keeps the current data as a "Before restoring …" snapshot, and reloads. Snapshots cover tasks + project meta only.

## App updates and offline — `src/app/UpdatePrompt.jsx` (every screen)

Builds only (no service worker in dev; see [02 §7](02-architecture.md)).
- **"A new version is ready · Reload"** — a banner at the top centre (above
  the page, hidden when printing) when a new deployment has downloaded.
  *Reload* switches to it; *Later* (×) hides the banner until the next
  launch. The app never reloads on its own, so nothing being typed is lost.
- **"Ready to work offline"** — a toast once, when the app has finished
  saving itself for offline use after the first visit.

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
