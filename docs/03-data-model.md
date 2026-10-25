# 03 — Data Model: Where Every Byte Lives

There is **no server and no database**. Everything is stored in the browser:

- **localStorage** — all structured data (16 keys, listed first)
- **IndexedDB** (`ProjectManagerDB`) — uploaded file blobs only

> If you add a new localStorage key, you MUST register it in
> `DataIO.APP_STORAGE_KEYS` or backups will silently miss it.

---

## 1. Master table of localStorage keys

| # | Key | Owner module | What it holds |
|---|-----|--------------|---------------|
| 1 | `project-manager-gantt-tasks` | ProjectProvider | Task tree (raw array) |
| 2 | `project-manager-project-meta` | ProjectProvider | status / baseline / variations |
| 3 | `project-manager-finance-data` | Finance | cost ledger entries |
| 4 | `project-manager-finance-config` | Finance | editable dropdown lists |
| 5 | `pm-calculator-templates` | CalculatorTemplates | BOQ calculator templates |
| 6 | `project-manager-daily-reports` | DailyNotes | daily site notes |
| 7 | `pm-orders` | OrderEngine | order ledger + lastWhoByType |
| 8 | `pm-registries` | Registries | contractors / teams / workers |
| 9 | `pm-identity` | Identity | current user {name, role} |
| 10 | `pm-plans` | PlanningStore | lookahead targets/assignments |
| 11 | `pm-rate-library` | RateLibrary | IQD unit-price catalog |
| 12 | `pm-templates` | TemplateEngine | project structure templates |
| 13 | `pm-activity` | ActivityLog | app event log (cap 2000) |
| 14 | `pm-snapshots` | Snapshots | auto (14 days) + named snapshots |
| 15 | `pm-language` | i18n | `'ar'` \| `'en'` |
| 16 | `pm-theme` | Theme | `'light'` \| `'dark'` \| `'system'` (default light) |

---

## 2. Task object

### Raw task (what's saved in `project-manager-gantt-tasks`)

```js
{
  id: 'uuid',                    // crypto.randomUUID or timestamp-random
  wbs: '1.1.1',                  // hierarchical number, children = '1.1.1.x'
  name: '…',                     // Arabic work description
  isGroup: false,                // true = section heading (no qty)
  manualStart: '2025-08-23',     // ISO date, honored by scheduler
  duration: 60,                  // working days
  quantity: 9413.4,              // contract qty (manual, or frozen at sign-off)
  actualQuantity: 9413,          // executed qty (manual ONLY if no orders exist)
  unitPrice: 1350,               // IQD per unit
  unit: 'م3',
  dependsOn: 'other-task-id' | null,
  depType: 'FS' | 'SS' | 'FF' | 'SF',
  lag: 7,                        // days, can be negative (overlap)

  // quantity take-off (group tasks, editable in the full task details page, Edit view):
  elementColumns: [{ id, name, unit, wasteFactor, linkedTaskId|null }],
  elements: [{ id, name, status, values: { [columnId]: number } }],
  // element.status: 'not_started' | 'in_progress' | 'completed' | 'on_hold'

  // set when the task was created BY an element-column BOQ link:
  boqLink: { parentId, colId, mode: 'created' | 'existing' },
}
```

### Computed task (same object **plus** fields added by `GanttEngine.calculate`)

`qty, actualQty, price, totalCost, actualCost, progress, startDate, endDate,
elementSumRaw, elementSum, boqLinked, orderSource {manual, formalQty, quickQty,
orderCount}, baselineQty, scopeVariance, execVariance, weight,
weightedProgress, plannedProgress, plannedCost, isCritical, warnings`

Rule of thumb: **raw = what the user set, computed = what the engine derived.**
Screens that let editing receive raw `tasks` from App; read-only views receive
`engineResult.tasks` (computed) — check the props table in
[02-architecture.md](02-architecture.md).

---

## 3. Project meta (`project-manager-project-meta`)

```js
{
  status: 'draft' | 'signed' | 'executing' | 'completed',
  baseline: {
    signedAt: 'ISO datetime',
    signedBy: 'name',
    tasks: { [taskId]: { quantity, unitPrice, unit, duration,
                         manualStart, name, wbs } }   // frozen copy per task
  } | null,
  variations: [ /* Variation Order records, below */ ]
}
```

### Variation Order record

```js
{
  id, date: 'ISO',
  taskId, taskWbs, taskName,
  type: 'qty' | 'price',
  field: 'quantity' | 'unitPrice',
  oldValue, newValue,
  reason, approver,
  urgency: 'low' | 'medium' | 'high',
  classification: 'qty' | 'price' | 'scope' | 'add' | 'remove' | '',
  estCostImpact: number,        // auto-derived from qty delta × unitPrice if blank
  estScheduleDays: number | null,
  clauseRef: 'FIDIC 13.x',
  status: 'issued',
}
```

---

## 4. Orders (`pm-orders`)

```js
{
  orders: [ /* order records, below */ ],
  lastWhoByType: { [orderType]: who }   // smart default: re-seed last crew per type
}
```

### Order record

```js
{
  id, type,                    // type see table in 01-overview §3
  family: 'value' | 'expense',
  tier: 'quick' | 'formal',
  date: 'YYYY-MM-DD',
  who: { kind: 'contractor'|'team'|'workers'|'none',
         contractorId?, teamId?, workerIds?, count? },
  taskId, elementId,           // value orders point at a leaf task (+ optional element)
  quantity, unit,              // value family
  amount, category,            // expense family (category = type label)
  location, sampleRef, result, depth, note,   // test/order extras
  status: 'recorded' | 'approved',   // quick orders are born approved
  approvedBy,
  recordedAt: 'ISO', recordedBy,
  details,
}
```

---

## 5. Registries (`pm-registries`), Identity (`pm-identity`)

```js
// pm-registries
{
  contractors: [{ id, name, phone, notes }],
  teams:       [{ id, name, foremanWorkerId, memberWorkerIds, defaultSize, notes }],
  workers:     [{ id, name, trade, dailyRate, phone, notes }],
}
// pm-identity
{ name: 'string', role: 'string' }
```

Team `defaultSize` convention: when it equals the member count it displays as
"auto"; a typed number makes it manual; clearing restores auto.

---

## 6. Plans / lookahead (`pm-plans`)

```js
{
  months: { 'YYYY-MM':    { targets:     [{ id, taskId, quantity, note }] } },
  weeks:  { 'YYYY-Www':   { assignments: [{ id, taskId, who, note }] } },
  days:   { 'YYYY-MM-DD': { assignments: [{ id, taskId, who, note }] } },
}
```

`who` here reuses the same shape as orders. Keys: ISO month, ISO week
(`2026-W39`), ISO date.

---

## 7. Snapshots (`pm-snapshots`)

```js
{
  auto:  { 'YYYY-MM-DD': { tasks, projectMeta, createdAt, actor } },  // capped at 14, oldest dropped
  named: [ { id, name, tasks, projectMeta, createdAt, actor } ],      // kept forever
}
```

⚠️ Snapshots cover **tasks + projectMeta only** — not orders/finance/reports.
`restoreSnapshot()` writes back into `project-manager-gantt-tasks` and
`project-manager-project-meta`, then the app page-reloads.

---

## 8. Templates & rate library

```js
// pm-templates
{ templates: [{
    id, name, icon, version, createdAt, source,
    variables: [{ key, label, default }],          // e.g. floors, lengths
    elements: [{
      partId, name, qtyFormula,                    // formula references variables
      group, repeatsVar,                           // repeat element per variable value
      depOn, depType, lag,                         // dependency wiring
      isGroup, depth, unit, fixedUnitPrice, productivity, rateName
    }]
}]}

// pm-rate-library  (copy-on-generate: templates snapshot prices, later edits don't propagate)
{ items: [{ id, name, unit, unitPrice /*IQD*/, category }] }   // ~40 seeded defaults
```

---

## 9. Activity events (`pm-activity`)

```js
[ { id, at: 'ISO', actor, kind, summary, refType, refId, payload } ]
// capped at 2000 (MAX_APP_EVENTS)
```

The Activity screen feed merges three sources at read time:
orders + variations (from project-meta) + these app events —
`ActivityLog.buildUnifiedFeed()` produces normalized feed entries
`{id, at, date, actor, kind: 'order'|'variation'|'event', family, title,
subtitle, tone, refTaskId, payload}`.

---

## 10. Calculator & reports & finance keys

| Key | Shape |
|-----|-------|
| `pm-calculator-templates` | `[{ id, name, columns: [{ id, label, source: 'input'\|'design'\|'formula', formula }], rows: [{ …, values: { [colId]: number } }] }]` |
| `project-manager-daily-reports` | site notes `[{ id, date, engineer, taskId, taskName, taskWbs, details, timestamp, quantity? }]` — the manual part of the daily report (the "work done" part is derived live from orders). `quantity` exists only on notes written before Phase 5 and is shown read-only; new notes don't record quantities |
| `project-manager-finance-data` | ledger rows per tab (machinery / materials / petty cash / payroll). Payroll status `'مستقطع'` is a stored data value — see quirks doc |
| `project-manager-finance-config` | editable dropdown option lists for the finance forms |

---

## 11. IndexedDB — `ProjectManagerDB` (files)

- DB `ProjectManagerDB` v1, object store **`files`** (keyPath `id`, index `folderId`).
- Record: `{ id, folderId, name, size, type, blob, createdAt }`.
- Folder tree itself is virtual — root → per-task folders derived from the task list.
- Managed only through `utils/FileDB.js` (`initDB/saveFile/getFiles/deleteFile`).

---

## 12. Backup file format (DataIO)

`exportAppData()` downloads `project-backup-YYYY-MM-DD_HH-MM.json`:

```js
{
  magic: 'projectmanager-backup',
  version: 1,
  exportedAt: 'ISO',
  app: 'ProjectManagerApp',
  storage: { '<localStorageKey>': '<raw JSON string, exactly as stored>' }
}
```

`validateBackup()` checks magic/version and returns stats (keys + bytes);
`restoreAppData()` writes every key back and the app reloads. Restore is
all-or-nothing (overwrites current data — the confirmation modal shows key/KB counts).
