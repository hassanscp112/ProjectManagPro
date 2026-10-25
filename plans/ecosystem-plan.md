# App Ecosystem Master Plan — Orders as the Foundation

> Status: design agreed in discussion (Sept 2026). Companion to `advanced-lifecycle-plan.md`
> (which is implemented). This document is the blueprint for everything after it.
> Philosophy: **enter once, read everywhere** — one entry point for site reality,
> every other screen is a view over it.

---

## 1. Vision & principles

The app is a **daily site truth-recording system**, not a classic planning tool:

- Actual work is recorded **daily** as dated, attributed records ("orders").
- Anyone (engineer, manager) opening any screen knows exactly what is happening.
- **Speed is the product**: one dedicated entry screen; smart defaults; the fast path takes seconds.
- Contractor accountability: every piece of work carries who/what/how much/where/when —
  payments and disputes are settled from the ledger, not from memory and meetings.
- Every completed project teaches the system (real durations, productivity, prices).

Core inversion: **entry is centralized, everything else is a view.** The Gantt's executed-quantity
column stops being a place you type and becomes a place you see (with a per-task breakdown on click).

---

## 2. Order system (the foundation) — CONFIRMED

Everything done on site is an **order**. Two orthogonal dimensions:

### 2.1 Tier (ceremony level)
| Tier | Fields | Use |
|---|---|---|
| **Quick** | contractor + task + quantity + date (~5 sec) | dynamic daily work |
| **Formal** | full details, evidence, approval flow | tests, completions |

### 2.2 Family (economic effect)
| Family | Effect | Examples |
|---|---|---|
| **Value** | earns BOQ value → executed qty → progress → EV → contractor payment | quick work, completion, concrete test, soil test |
| **Expense** | money out; no executed qty; real AC (fixes "app can't see overspend") | materials, payroll, machinery, fuel, misc. |

### 2.3 The rule
`actualQuantity` on any task **= sum of its (approved) value orders — always.**
No override field. Hand-written numbers enter as quick orders, never as bare task edits.
A task can show its split: formal-backed vs quick-entry quantity.

Expense orders: always tagged to recipient (who got paid); *optionally* tagged to a task
("where this cost belongs"). Direct vs indirect cost mapping falls out of this.

### 2.4 Order types (initial draft — extendable)
`quick_work`, `completion` (element handover: location + evidence), `concrete_test`
(location, cube/sample ref, result), `soil_test` (location, depth, compaction/result);
expenses: `material`, `payroll`, `machinery`, `fuel`, `other`.

### 2.5 Dedicated order screen — CONFIRMED
- One entry point for all site reality (the whole point of the app).
- Order type shapes the form; smart defaults: date = today, contractor = last used,
  searchable task/element picker sorted recent-first.
- Element statuses in TaskDetails (e.g. flip wall → مكتمل) become **completion orders**
  in disguise — today that flip is anonymous, undated, drives nothing. Orders wire it in.

### 2.6 Data model sketch
```
order {
  id, type, family: 'value'|'expense', tier: 'quick'|'formal',
  date (work date — late entries keep original date), recordedAt, recordedBy,
  taskId (leaf) [, elementId],
  who: contractorId | teamId | workerIds[],
  quantity, unit            // value orders
  amount, category          // expense orders
  details: { …type-specific… },
  evidence: [fileIds],
  status: 'recorded' | 'approved', approvedBy
}
```

### 2.7 Engine change
`GanttEngine.calculate` gains: per-leaf `actualQty` = Σ approved value orders;
`actualCost` layering real expense totals; formal/quick split per task.

---

## 3. Identity (minimal now, real later) — CONFIRMED

No accounts/network/security yet. A **name picker / simple login** at startup so every
record and edit is attributed ("who did it" trail). Designed to grow into real auth later.

---

## 4. Memory: event log + snapshots — CONFIRMED

Reason for version history: **track everything happening in the ecosystem.**

- **Event log** = source of truth: orders, VOs, sign-offs, batched meaningful edits.
  "BOQ at date T" = query orders by date — no diffing, any slice (daily/weekly/monthly/any).
- **Snapshots** = checkpoints: auto on first change each day + named ones
  ("تقرير أيلول"). Baseline freeze (already built) is the governance-grade instance.
- Diff-conflation trap avoided: a snapshot diff can't distinguish work executed from
  contract changed; the log separates work orders from variation orders by type.

---

## 5. Reports — CONFIRMED

**Live view until printed.** The printout/PDF is the frozen record; no sealed copies in the DB.

- Every printed report carries **period + generation timestamp** (authoritative-print rule).
- **Late-entry policy**: late orders keep original work date; next report absorbs them visibly.
- **Daily report builds itself**: body = today's orders grouped by task/contractor;
  engineer adds weather, manpower, equipment, visitors, issues, prints. Never disagrees
  with BOQ numbers (same records). Existing DailyReports input screens get connected to this.
- **Monthly report checklist** (contents confirmed):
  1. Header (project, period, generation timestamp, lifecycle badge)
  2. Executive summary (actual vs planned progress, deviation, SPI/CPI)
  3. S-curve (planned / earned / actual)
  4. BOQ progress table (contract | to-last-month | this month | total | remaining | %)
  5. This month's order log
  6. Variation orders this period
  7. Per-contractor quantities (payment verification)
  8. Finance summary (expenses vs executed value)
  9. Signature blocks
- Arabic RTL print/PDF is its own build item (no print story exists yet).

---

## 6. Task Details — read-first living document — CONFIRMED

Opens as a **report**; editing is a deliberate mode. Not an "old XP app showing basic info":
opening a main task must tell the reader everything. Sections:

1. **What** — identity, scope, lifecycle badge, schedule window, big progress number
2. **How much** — per type: contract vs executed vs remaining (bars, not just numbers)
3. **Where** — elements with locations + statuses
4. **Who & lately** — contractors on task + recent orders (builds itself from the ledger)
5. **Money** — contract value, executed value, expenses logged
6. **Evidence** — tests, files, photos (via order evidence)

Sections 4–5 (and half of 2) light up automatically once orders exist. Read-first also
agrees with lifecycle locking (signed → read-only anyway).

---

## 7. Planning section — CONFIRMED (direction)

New section **based on the Gantt, without BOQ columns**. Replaces "ongoing tasks" dashboard
(too simple). Two-layer model (rolling-wave / Last-Planner style):

- **Layer 1 — master plan**: the existing Gantt + baseline (project-long, vague, formal changes).
- **Layer 2 — lookahead plans**: rolling near-future, living, disposable, detailed.

### Zoom levels (bigger = vaguer)
| View | Granularity |
|---|---|
| Monthly | quantity targets per section ("20,000 m³ backfill this month") |
| Weekly | work assignments per task/area |
| Daily | crews + counts + locations (firm numbers) |

Two-way connection: master tells lookahead what must happen; lookahead reveals feasibility
early ("can't hit October with one crew" — discover now). **PPC** (percent plan complete) =
daily commitments actually completed — computes itself from plan vs orders.

### Labor assignment — fluid (CONFIRMED: both allowed)
Three valid forms, loose→tight: **count** ("12 laborers") / **team** ("طقم علي" with default
composition) / **individuals**. Count feeds math, name feeds accountability, neither mandatory.
Shared "who" registry (contractors, teams, workers) serves orders + planning + payroll.
**"Same as yesterday"** duplication button = the biggest speed win.
Productivity per work type (qty/day/crew) → suggested crew = planned daily qty ÷ productivity.
Start manual + hints; library grows from real order data (orders teach true productivity).

---

## 8. Auto-planning (templates) — CONFIRMED

### Parts library + templates
- **Parts library**: elements defined once (flat/solid slab, roof, block wall, plaster…):
  unit, quantity rule, productivity, dependency behavior.
- **Templates** compose parts: **school, apartment, mall, house, villa** + user-created.
- A template is **data, not code**: variables (floors, area, classrooms), element tree,
  quantity formulas using variables, repetition groups (typical floor ×N), dependency rules.
- Generator outputs WBS + links + Gantt; parallelism emerges from links (staggered typical floors).
- **In-app template editor** (guided WBS builder) + **"save project as template"** — extracts
  structure AND actual durations/productivity learned from order history (2nd school starts
  from your real numbers).
- Generated plan = draft the engineer reviews/edits → then sign-off / orders flow as usual.

### Critical path engine (new)
Backward pass from project end → total float per task → zero-float = critical, highlighted
on the Gantt. Upgrades every project, not just generated ones.

### Durations
`duration = quantity ÷ productivity` — one productivity number shared by auto-planning,
lookahead planning, and labor assignment.

### Rate library (CONFIRMED: templates carry prices, editable later)
- Editable IQD catalog: item, unit, unit price. Feeds templates, BOQ leaf entry
  ("pick from library"), calculator.
- **Copy-on-generate**: prices are snapshotted into the project at generation —
  library edits never rewrite old projects; project edits never corrupt the library.
  (Same philosophy as baseline freeze.)

---

## 9. Activity system (GitHub-inspired) — CONFIRMED

The visible face of the event log; not a bolted-on feature.

- **Timeline feed** (commit log): all meaningful acts — orders, VOs, sign-offs, batched edits.
- **Diffs**: "quantity 9,413 → 10,200 by VO #3, reason: rock at 0+400".
- **Per-object history** (file-history/blame): every task's full story — who created,
  who recorded each quantity, who approved each change. Outlasts departing contractors.
- Log **meaningful units only** (deliberate acts with reasons), never keystrokes.
- **No branches/forks** (one site, one reality). Someday: what-if plan copies.

### 9.1 Activity heatmap (contribution map) — CONFIRMED, add to plan
- **Empty day is suspicious**: the site works 7 days/week → a blank day = unrecorded work.
  The map is a **data-gap radar** ("the ledger has holes — go fill them"), plus a soft
  streak-nudge toward the daily entry habit.
- **Color = intensity of value recorded** → the year reads as the project's heartbeat
  (mobilization ramp, peaks, stalls).
- **Click a day → open that day** (orders + daily report) — navigation into history.
- **Filters: whole project or per contractor** — the per-contractor calendar corroborates
  or exposes "I worked all month" at payment time. (Hidden gem for disputes.)
- Cheap **later**: pure derived view over the event log. Build after orders exist.

---

## 10. Existing modules = consumers (not changed architecturally)

Finance ledgers, Calculator, FileManager, DailyReports inputs — they sit on top of the
foundation. One open decision: expense-entry overlap between FinanceManager and expense
orders must be reconciled (single entry point rule must hold).

---

## 11. Open questions (to settle before/while building)

1. FinanceManager vs expense orders — who owns expense entry? (likely: orders own entry, Finance becomes views)
2. Approval flow depth for formal orders (single approver enough?)
3. Snapshot storage location if localStorage gets tight (IndexedDB already used for files).
4. Element-level vs task-level targeting granularity for each order type.
5. Print/PDF approach for Arabic RTL reports.

---

## 12. Build order (phases — each self-contained, non-breaking)

1. **Foundation**: who-registries (contractors/teams/workers), order types + dedicated
   screen, engine: actualQty from orders, name-picker identity.
2. **Memory**: event log + daily auto-snapshots + named snapshots; activity feed +
   per-task history (read side).
3. **Reports**: daily report auto-build, monthly report checklist, print story (RTL).
4. **Planning section**: lookahead layers, 3 zooms, labor assignment + same-as-yesterday, PPC.
5. **Auto-planning**: parts library, 5 seeded templates + editor, generator, critical path,
   rate library with copy-on-generate.
6. **Heatmap + polish**: activity heatmap (project + per-contractor), template learning
   from actuals.

---

*Decisions marked CONFIRMED were explicitly agreed in discussion; everything else is
design intent pending validation during build.*
