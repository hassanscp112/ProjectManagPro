> Status: approved 2026-10-26 · workstream **P** of `plans/roadmap-plan.md` ·
> built on branch `claude/ws-planning-edc69c` and merged into
> `roadmap/integration` one milestone at a time.

# Auto-planning: describe a building or paste its BOQ, get the whole plan

## Context
A person describes a building, or pastes its BOQ, and the app produces:
- the **whole WBS**;
- the **BOQ**, with quantities and prices;
- **durations**, **links** and the **Gantt chart**.

All of it is as automatic as possible. The result is reviewed step by step
and created as a draft project. Sign-off, baseline and variation orders then
work as they do today.

The base already exists:
- `TemplateEngine.generateProject`: five parametric building templates, about
  20 items each. Productivity sits in a fixed `PARTS` list, and a
  floor-to-floor chain uses FS + 7.
- The rate library, with prices copied at generation time.
- New project from template / blank / copy, and the Lookahead (month / week /
  day, PPC).
- `GanttEngine` + `CriticalPath`, the BOQ take-off grids, and element columns
  linked to BOQ leaves.

Limits today:
- one predecessor per task;
- a 7-day week, with no holidays;
- no crews or resources;
- no markups;
- productivity never learns from the site.

**Must keep:**
- executed quantity derived from approved orders;
- the sign-off and baseline locks;
- the variation-order flow;
- gating with `useCan()('plan.edit')` and `'plan.signOff'`.

### What the real Excel files show (`Excel Sheets/`)
- `جدول تقدم عمل جمبازي.xlsx` (the Wasit / Kut Batira programmes, built on
  Vertex42) already does by hand what this plan automates. For each row it
  holds:
  - the WBS id;
  - the predecessor item number and the link type FS / SS / FF;
  - the lag;
  - the **daily productivity** and duration = quantity ÷ productivity.
- The same workbook has a `الانتاجية` sheet (productivity per activity) and a
  "with Friday" variant. That is the working calendar.
- Quantities come from parametric take-off:
  - canal lining = length × section perimeter;
  - backfill = station tables, by average-end-area.
  This is the same idea as template formulas.

## Decisions (with the user, 2026-10-26)
- **Scope.** Every building type that is regularly built:
  - **existing:** school, apartments, mall, house, villa;
  - **new:** health center / hospital, mosque, office / mixed-use,
    warehouse / steel hangar.
- **Detail: per floor, by trade.** Every floor gets structure, blockwork, MEP
  rough-in, plaster, tiles, paint and so on, staggered floor after floor.
  Substructure, roof and external works sit around the floors.
- **Inputs.** A standard set, each with a default:
  - type, floors, area per floor, floor height, footprint L×W;
  - basement, units / rooms / bathrooms;
  - slab system (solid / hordi / flat), finish level (economy / standard /
    luxury).
  On top of that come **per-level overrides** of area, height and use, for
  example shops below and flats above.
- **One flow.** Items come from a template **or** an imported BOQ.
  - The wizard runs step by step, then shows a review screen, then *Create*.
  - New projects only.
- **Working calendar per project.** The wizard offers presets, all editable:
  - Friday off + fixed-date Iraqi holidays, with Ramadan at a 0.75 pace and
    the Eid dates entered per year;
  - Friday only;
  - Friday + Saturday;
  - 7 days.
  Durations are counted in **working days**.
- **Markups.** Rates are direct cost. The project adds overhead %,
  contingency % and profit %:
  - contract price = cost × (1 + Σ% / 100);
  - the cost / price breakdown stays visible.
- **BOQ import.**
  - **Paste from Excel** first.
  - `.xlsx` upload comes once a spreadsheet library is approved (WS2 owns
    `package.json`).
- **Matching BOQ lines to work types** is local, by keywords, unit and
  Arabic / English synonyms, with a confidence score.
  - A line mapped by hand is remembered.
  - AI help comes later, as a server function once the Foundation session
    (F) exists.
- **Resources: as flexible as possible**, with **full resource leveling**.
  - The limits are crews per trade, total labour on site, key equipment, and
    People teams used as named crews.
  - Re-leveling after sign-off is allowed: the baseline is kept, tasks that
    have started are never moved, and an activity entry is logged.
- **Learned productivity.** Approved orders produce a suggestion, and a
  person accepts it. Nothing changes silently.
- **Seed data.** Typical Iraqi 2026 mid-range prices and standard
  productivity norms, marked "check"; the user corrects them.
- **Generated item names** are stored in the **wizard's language**.
  - Work types and template elements carry both `name` (ar) and `nameEn`.
  - Section and level labels come from the dictionaries.
- **Lookahead.** Plan editors and site engineers may edit week and day plans
  (new action `plan.lookahead`). Month targets need `plan.edit`.
- **Order.** Engine → template wizard → BOQ import → resources / leveling →
  learning → template editor v2.

---

## Engine design

### Working time
- Scheduling runs on an integer **working-time axis**: one normal working day
  is 100 units.
- `utils/planning/WorkCalendar.js` gives each day a capacity, in this order:
  1. a `workdays` exception gives 100, or the period factor if one applies;
  2. a holiday gives 0;
  3. a weekly rest day gives 0;
  4. otherwise the minimum overlapping period factor × 100 (Ramadan 75), or
     100.
- Implementation:
  - a memoized cumulative `Int32Array` that grows lazily, with binary-search
    inverses;
  - `startDateOf(T)`, which snaps to a working day;
  - `endDateOf(T)`, an **exclusive** end with the same meaning as today's
    `start + duration`;
  - `addWorkingDays`, `workingDaysBetween`, `isWorkingDay`,
    `nextWorkingDay`.
- **Identity calendar.** A project without `meta.planning` uses pure
  arithmetic, so every existing project computes **bit-identical** dates.
- Duration = `clamp(ceil(qty ÷ (productivity × crews)), 1, 365)` in *normal*
  working days. The Ramadan factor is applied only when scheduling, never in
  this formula, so it is not counted twice.

### Links (`utils/planning/links.js`; every reader and writer uses it)
- Shape: `task.predecessors: [{ id, type: FS|SS|FF|SF, lag, lagUnit?: 'wd'|'cd' }]`.
  Lags are in working days; `cd` counts calendar days, for curing.
- `readLinks(task)`:
  - slot 0 **always** comes from the legacy `dependsOn` / `depType` / `lag`;
  - `predecessors[1..]` are the extra links.
  Old writers therefore keep working as they appear to: clearing `dependsOn`
  removes the first link.
- `writeLinks(task, links)` mirrors slot 0 back into the legacy fields.
- `removeLinksTo` and `hasLinkTo` cover `dependsOn`, `predecessors` and
  `levelLinks`. For a legacy task they return exactly today's object.

### Forward pass (GanttEngine)
- An **iterative DFS** replaces the recursion. It reproduces the recursion's
  visiting / cycle semantics and the cycle text, without the O(n²) stack
  copies or the risk of a stack overflow.
- **ES** = the maximum over all logic links:
  - FS `pred.EF + lag`;
  - SS `pred.ES + lag`;
  - FF `pred.EF + lag − dur`;
  - SF `pred.ES + lag − dur`.
  `manualStart` is ignored when links exist (legacy behaviour). `levelLinks`
  then only *delay* a task.
- Warning codes and their order are unchanged:
  - `selfDependency`, `missingPredecessor`, `dependencyCycle` and
    `invalidDepType`, now one per link;
  - new: `resourceOverload`.
- **Group roll-up** is O(N·depth): costs accumulate in array order, so the
  sums stay bit-identical.
- New output (added keys only):
  - per task: `links`, `spanDays`, `drivingLinkId`;
  - on the result: `calendar`, `projectWorkingDays`, `overloads`,
    `calendarIssues`.

### Critical path
- Acyclic networks: one reverse topological (Kahn) pass. Cyclic data falls
  back to today's relaxation, so it stays identical.
- Float is in working days, with `-0` normalized to 0.
- After leveling, `levelLinks` give a resource-critical path.

### Resource leveling (`utils/planning/ResourceLeveler.js`)
- It is an **explicit action**, not part of `calculate()`. Leveling on every
  keystroke would make the schedule jump.
- It is a serial schedule-generation scheme on the unit axis, with a priority
  key of (LS, ES, index).
- Its output is **`levelLinks`**: FS/0 links to the tasks that free the
  resource, at most 3. Compared with a stored delay, these:
  - follow the task they wait for;
  - read as "waits for the masonry crew from floor 1";
  - apply as one undo step;
  - give a resource-critical path.
- Fixed tasks are never moved: `pinned`, started (they have orders) or done.
  A typed `manualStart` counts as "start no earlier than".
- `calculate()` only *detects* overloads.
- Leveling is deterministic, and 1500 tasks take under 300 ms.

### Generator v2 (`utils/planning/templateLinks.js`, `autoPlan.js`)
- Template elements get stable **keys** and explicit `links`:
  - `floor`: `same` / `prev` / `next` / `first` / `last` / `all` /
    `{offset}`;
  - `if`: `first` / `notFirst` / `last` / `notLast`;
  - plus type, lag and lagUnit.
- There is **no implicit floor chaining**. Crews sequence the floors through
  leveling, and physical logic stays explicit (e.g. columns N after slab N−1,
  cd + 7).
- v1 templates still generate through today's wiring, unchanged.
  `migrateTemplateToV2` converts them when they are edited.
- `planProject` runs generate → calculate → level once → apply.

### Data additions (all optional; absent = today's behaviour)
- **Task:** `predecessors`, `levelLinks`, `pinned`, `workTypeId`, `trade`,
  `crews`, `productivity`, `durationSource`, `resources`, `teamId`,
  `unitCost`, `templateKey`, `floor`.
  - EVM and the baseline keep using `unitPrice`, the contract rate.
- **`meta.planning`** (not added to `DEFAULT_META`):
  `{ version, calendar: { weekRest, holidays, periods, workdays }, markups,
  crews, resources, leveledAt }`.
- **New global store `pm-work-types`** (`utils/planning/WorkTypes.js`). Each
  work type carries:
  - `name`, `nameEn`, unit, trade;
  - productivity per crew-day;
  - crew composition (labour, equipment);
  - a rate link, keywords and aliases;
  - learned stats and a `checked` flag.

### Testing guard
- A frozen copy of today's engine is kept in
  `__tests__/fixtures/legacyEngine.js`.
- **Differential tests:**
  - 500 seeded random networks (all link types, lags, missing / self links,
    cycles, invalid types, duplicate WBS, groups as predecessors, zero
    durations);
  - plus `INITIAL_TASKS` and the seed templates.
  Each is `deepEqual` on dates, float, criticality, warnings, costs, EVM and
  the S-curve.
- A 5000-task chain must run without a stack overflow, and 1500 tasks must
  compute in under 100 ms.

---

## Milestones
Each milestone:
- passes `npm test`, `npm run lint` and `npm run build`;
- is checked in the browser on port 5185;
- is committed, then reported to the integrator.

**M0, this document.**

**M1, engine groundwork** (no visible change for existing projects)
- Refactor with parity tests: iterative DFS, O(N) roll-up, Kahn CPM.
- `links.js` and multiple predecessors in the engine and CPM.
- `WorkCalendar`, with the engine on units.
- Gantt bars drawn from `spanDays`.
- Schedule edits several predecessors:
  - the grid cell shows "first + N" and parses `2.1FS+3; 2.4SS`;
  - TaskPanel gets a list editor and a *pin* toggle;
  - `fieldLock` reads the links.

**M2, work types, generator v2, building templates, markups**
- `Formula.js`: a safe parser (no `new Function`) with comparisons and `?:`.
- `WorkTypes.js`:
  - seeded from `PARTS` plus about 80 building work types;
  - the matching rates are added to `RateLibrary`.
- `TRADES`, generator v2, `planProject` and markups.
- **Nine schema-2 building templates:** the five existing ones reworked to
  per floor by trade, plus the four new types.
- Fix `cleanTemplateDraft`: today it destroys `'5@2'` and forces version 1.
- Copying a project keeps `meta.planning`.

**M3, the template wizard** (`#/projects/new?step=…`)
- Steps:
  1. Details.
  2. Start from (template · blank · copy).
  3. Building inputs.
  4. Levels table.
  5. Quantities: a tree with formulas, overrides and dropped items.
  6. Prices: rate matching, an inline rate picker, markups, cost and price
     totals.
  7. Calendar preset, holidays, Ramadan; productivity per work type; crews
     and resources.
  8. Links: each shows the rule it came from, with a toggle per link.
  9. **Review:** a read-only Gantt, BOQ totals, the finish date, the
     critical count and warnings. Then *Create*.
- The wizard state is a pure reducer, `state/plannerModel.js`.
- **Permissions:**
  - `plan.edit`: Schedule edit / add / delete / quick edit, templates, rates,
    work types, BOQ grids, new project;
  - `plan.signOff`: sign-off / re-baseline / start / complete;
  - `vo.draft`: the VO dialog;
  - `plan.lookahead`: week and day plans.
- **Work types page:** a tab on `#/rates` until it gets its own route.
- **Plan settings dialog in Schedule**, once the provider can update
  `meta.planning`.

**M4, BOQ import in the same wizard**
- `BoqImport.js`:
  - parses pasted TSV and finds the header row;
  - guesses the column roles (item no., description, unit, qty, rate,
    amount);
  - normalizes units (م3 / m3 / م³ / متر مكعب);
  - builds the WBS from item numbers and section headers ("أولاً …").
- `Matcher.js`:
  - Arabic normalization (diacritics, tatweel, alef / ya / ta marbuta);
  - scoring of keywords, aliases and unit, with a confidence score;
  - a confirmed manual match goes into the work type's `aliases`.
- **Flow:**
  1. Building type and levels; the template is the logic skeleton.
  2. Paste.
  3. Map columns.
  4. Match lines, lowest confidence first.
  5. Spread the per-level trades over the levels by area share.
     Substructure, roof and external items stay whole.
  6. BOQ prices become the contract prices, and the rates show the margin.
     Unmatched lines go to "Other items" with a warning.
  7. Then wizard steps 7–9.

**M5, resources and leveling**
- `planning.resources`:
  - **trade pools:** typed counts, or derived from People teams tagged with
    the trade;
  - **labour:** a site headcount cap;
  - **equipment:** crane, excavator, loader, pump, mixers…;
  - **teams:** capacity 1 each.
- Demand per task = the work type's crew composition × `crews`, with a
  per-task override.
- *Level resources*:
  - a preview report: delays, conflicts, the change in end date;
  - Apply or Clear, each one undo step;
  - the first free team of each trade is assigned (`teamId`), and the task
    shows "waits for …".
- A resources view: a histogram per resource per week, against capacity.
- *Built (2026-10-26):* `#/schedule/resources` with a live leveling preview
  (no separate preview step), `teamIds` (several crews → several teams),
  crew fitting to the pool, and *Fill from work types* for items planned
  before resources existed. Fixed work = pinned, started or done items
  plus everything they wait for.

**M6, learned productivity and Lookahead pace**
- `utils/Productivity.js`:
  - observed rate = approved quantity ÷ working days with approved orders,
    per crew when the Lookahead day crews give a count;
  - the median per work type across projects.
- A suggestion appears at > 15 % difference over at least 5 working days.
  Accepting it updates the work type (with history) and, optionally, the
  remaining durations of unfinished tasks.
- In the Lookahead:
  - month view: "at the current pace: N working days left";
  - week and day views: suggested crews = planned daily qty ÷ productivity
    per crew.
- *Save project as template* uses the observed productivity.

**M7, template editor v2.** Edit and duplicate any template, the seeded ones
included:
- work type, scope;
- a formula with a live check;
- a condition;
- a link editor;
- validation.

**Later**
- AI matching, after F.
- `.xlsx` upload, once the library is approved.
- A schedule baseline, with dates in the sign-off snapshot.

---

## Requests to other owners (P does not edit these files)
1. **`utils/storeRegistry.js`:** register `pm-work-types`, with:
   - global scope, `shape: 'list'`, `itemsPath: 'items'`, `idField: 'id'`;
   - owner `utils/planning/WorkTypes.js`.
2. **`utils/permissions.js`:**
   `'plan.lookahead': ['admin', 'pm', 'office', 'site']`.
3. **`state/ProjectProvider.jsx`:**
   - `setPlanning(updaterOrPatch)` merges into `meta.planning`;
   - `applyTaskPatches(patches)` applies the patches as one undo step.
4. **`state/projectModel.js`:**
   - `deleteTaskCascade` uses `removeLinksTo(t, ids)`;
   - `describeDelete` counts with `hasLinkTo`;
   - when `predecessors` exists, `normalizeTaskUpdate` returns
     `writeLinks(t, readLinks(t))`.
   The helpers come from `utils/planning/links.js`.
5. **`app/router.jsx`, `app/navigation.js`, `PortfolioLayout`:**
   - `work-types` in the projects frame, with a sidebar entry;
   - `schedule/resources`, with a Schedule tab.
6. **WS2 (`package.json`):** a spreadsheet library for `.xlsx` upload.
