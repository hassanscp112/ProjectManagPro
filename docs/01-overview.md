# 01 — What Is This Project?

A plain-language overview. No code knowledge needed to read this file.

---

## 1. The one-paragraph summary

**ProjectManagerApp** is a single-page web app for managing a real civil-engineering
contract in Iraq: a canal rehabilitation project
(*مشروع استصلاح اراضي واسط / عقد ٥ لسنة ٢٠٢٣ / غرب الغراف / ايسر MC7*).
The site engineer records what actually happened each day (work done, concrete
tests, materials, fuel, payroll…) as **orders** in one fast entry screen, and
*every other screen in the app is a live view over that record* — schedule,
dashboard, daily/monthly reports, contractor accountability, activity history.
The core philosophy, from the design blueprint (`plans/ecosystem-plan.md`), is:

> **"Enter once, read everywhere"** — one entry point for site reality,
> everything else is a view over it. Speed is the product.

---

## 2. Tech stack (intentionally small)

| Layer | Choice | Notes |
|---|---|---|
| UI | **React 19** (plain JavaScript, no TypeScript) | Hash-URL router (`src/app/router.jsx`), project store in `src/state/` |
| Build | **Vite 8** | `npm run dev` / `npm run build` |
| Spreadsheet grid | **jspreadsheet-ce v5** | Used ONLY in the calculator template editor |
| Storage | **Browser localStorage** (+ IndexedDB for uploaded files) | No backend, no server, works offline |
| Language | Arabic (default, RTL) + English (LTR) | Custom lightweight i18n, see [06-i18n-guide.md](06-i18n-guide.md) |
| New UI components | **Radix UI** primitives, **cmdk**, **lucide-react** icons, IBM Plex Sans Arabic (bundled) | `src/ui/` — UI rebuild in progress, see `plans/ui-rebuild-plan.md` |
| Tests | Node built-in `node:test` | Pure logic only (`npm test`) |

Declared but currently **unused** dependencies: `exceljs`, `mathjs`
(see quirks doc — do not assume Excel export exists).

---

## 3. Domain concepts you must know

These words appear everywhere in the code and UI. Learn them once here.

### 🧱 WBS / Task tree
The project is a tree of tasks identified by WBS numbers (`1`, `1.1`, `1.1.1`).
- **Group task** (`isGroup: true`) = a section heading (e.g. "اولا / الحفريات").
- **Leaf task** (`isGroup: false`) = actual payable work with quantity, unit
  price, unit, duration, and dependencies.

### 📋 BOQ (Bill of Quantities)
The contract's priced list of work. In this app the **leaf tasks ARE the BOQ
items** (quantity × unit price = contract value). Some groups also carry
**element columns** — quantity take-off columns (e.g. "area", "depth") with
per-element rows that sum into the contract quantity. A column can be **linked**
to a child BOQ leaf (🔗) so the take-off drives the contract quantity.

### 📦 Orders — the heart of the app
An **order** is one dated, attributed record of site reality. 9 types in two
families:

| Family | Meaning | Types |
|---|---|---|
| **value** | work done on a BOQ task (has quantity + unit) | `quick_work`, `completion`, `concrete_test`, `soil_test` |
| **expense** | money spent (has amount + category) | `material`, `payroll`, `machinery`, `fuel`, `other_expense` |

And two **tiers**:
- **quick** — informal, auto-approved (e.g. daily quick work). Fast path: seconds to record.
- **formal** — saved as `recorded`, needs an explicit **Approve** click (e.g. concrete tests).

Executed quantity on the Gantt is **derived from approved value orders** — the
engineer never types "actual quantity" by hand (unless no orders exist).

### 👷 Who (Registries)
Every order is attributed to a **who**: a contractor, a team, a list of workers,
or nobody. The registries screen manages that roster. The current app user is
the **identity** (name + role) used for stamps/approvals.

### 📅 Lookahead planning (Plans)
Rolling plans in three zoom levels: **monthly targets** (planned quantity per
task), **weekly crew assignments**, **daily work assignments**. Daily execution
is compared against the plan (PPC % = planned-percent-complete of the day).

### 📸 Snapshots & Baseline
- **Auto snapshots**: the app checkpoints the whole project on the first change
  each day (keeps the last 14 days).
- **Named snapshots**: user-created restore points, kept forever.
- **Baseline**: created at **sign-off** — freezes contract quantities/prices and
  locks those fields. After that, contract changes must go through a **Variation
  Order**.

### 📝 Variation Orders (VO)
A FIDIC-style record for changing a locked contract field (quantity or unit
price): reason, approver, urgency, classification, estimated cost/schedule
impact, clause reference (defaults to "FIDIC 13.x").

### 📈 EVM (Earned Value Management)
The dashboard/report math. GanttEngine computes per-week: **PV** (planned value),
**EV** (earned value), **AC** (actual cost), then **SPI** = EV/PV (schedule
performance), **CPI** = EV/AC (cost performance), **EAC**, **VAC**, **BAC**.
The S-curve chart plots cumulative PV/EV/AC. You don't need the formulas — the
engine produces them; just know these letters appear in the dashboard and
monthly report.

### 🔄 Project lifecycle
`draft → signed → executing → completed` — controlled from the Schedule toolbar
(`#/schedule`: Sign off contract, then Start execution, then Complete; re-baseline
allowed). After sign-off, contract quantities and prices change only through
variation orders; `#/schedule/baseline` compares them with the signed baseline.

---

## 4. What each screen does (30-second tour)

| Route | Screen | One-liner |
|---|---|---|
| Home `#/` | `app/home/*` | Headline progress / SPI / EV / CPI, needs-attention list, S-curve + EVM figures, progress by section, recent orders |
| Schedule `#/schedule` | `app/schedule/*` | Timeline: task grid + Gantt in one scroller (week/month/quarter), KPI strip, lifecycle/VO/backup toolbar, edit mode with locks; task side panel at `#/schedule/task/:id` |
| Record `#/record` (+ `/log`, `/pending`) | `app/record/*` | THE entry screen: pick type → fill → save (phone: full-screen flow); order log; pending approvals |
| Schedule › Lookahead `#/schedule/lookahead` | `app/schedule/LookaheadPage` | Month targets vs approved orders, week crews, day plan with completion rate (PPC) |
| Schedule › Baseline `#/schedule/baseline` | `app/schedule/BaselinePage` | Signed contract quantities/prices vs today, per item and in total |
| Library › Files `#/library/files` | `app/library/FilesPage` | Document folders per top-level section; files stored in IndexedDB |
| Library › BOQ `#/library/boq` | `calculator/*` | BOQ quantity take-off grids (templates with formulas) |
| Reports › Daily `#/reports/daily` | `app/reports/DailyReportPage` | A day (or a period) on site: work done and expenses built from the orders, plus site notes; printable |
| Reports › Monthly `#/reports/monthly` | `app/reports/MonthlyReportPage` | Printable monthly report recomputed from the order ledger |
| Reports › Activity `#/reports/activity` | `app/reports/ActivityPage` | Audit feed, one item's whole story, 12-month activity heatmap (`?view=task` / `?view=heatmap`) |
| Settings `#/settings` | `app/settings/SettingsPage` | You (identity), theme and language, lifecycle status, backup / restore, restore points |
| Finance `#/finance/:ledger` | `app/finance/FinancePage` | Site cost ledgers (machinery / materials / petty cash / payroll) + their dropdown lists |
| People `#/people/:kind` | `app/people/PeoplePage` | Contractors / teams / workers |
| Library › Templates `#/library/templates` (+ `/new`) | `app/library/TemplatesPage` | Generate a task tree from parametric templates; build templates |
| Library › BOQ `#/library/boq` · Rates `#/library/rates` | `app/library/BoqPage`, `RatesPage` | Quantity take-off grids; the IQD rate library |
| Task details `#/schedule/task/:id/details` | `taskDetails/TaskDetails` | *(Full details from the task panel)* drill-down per task: element columns, BOQ links, edit mode |

---

## 5. Repository folder map

```
Project Management Package/          ← repository root
├── AGENTS.md                        ← AI-agent entry point (short!)
├── run.cmd                          ← double-click to start the dev server
├── docs/                            ← THIS documentation
├── plans/                           ← design blueprints (read ecoplan first)
│   ├── ecosystem-plan.md            ← the master vision: "orders as foundation" (IMPLEMENTED)
│   ├── advanced-lifecycle-plan.md   ← baseline/VO/lifecycle design (IMPLEMENTED)
│   ├── ui-rebuild-plan.md           ← Aubergine UI rebuild, 8 phases (IN PROGRESS)
│   └── study-folder-analysis.md     ← notes on the Study/ research data
├── ProjectManagerApp/               ← THE APP (only folder with real code)
│   ├── src/App.jsx                  ← ProjectProvider + router (tiny)
│   ├── src/state/                   ← project store + pure task/lifecycle logic
│   ├── src/app/                     ← router, shell layout, one page per route
│   ├── src/components/              ← one folder per screen (see 05-screens-guide)
│   ├── src/utils/                   ← pure-logic engines + persistence (see 04-utils-reference)
│   ├── src/i18n/                    ← ar/en dictionaries (see 06-i18n-guide)
│   ├── src/ui/                      ← new shared components + design tokens (UI rebuild)
│   ├── src/dev/                     ← dev-only review page (/#/dev/ui)
│   └── src/**/__tests__/            ← node:test unit tests (npm test)
├── Excel Sheets/                    ← the real contract Excel files (reference input data)
├── Study/                           ← research library (PDFs, BOQ datasets) — NOT app code
└── _archive/                        ← old scripts/outputs, kept per the archive-don't-delete rule
```

---

## 6. Related docs

- How it all wires together → [02-architecture.md](02-architecture.md)
- Where every byte is stored → [03-data-model.md](03-data-model.md)
