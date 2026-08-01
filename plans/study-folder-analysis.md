# Study Folder — Analysis & App-Improvement Roadmap

> Source: `Study/` (two sub-bases: `civil_ai_knowledge_base/` reference docs + `civil_pm_boq_database/` datasets & a full open-source ERP).
> Purpose: extract domain knowledge + real production schemas, and map them to concrete improvements for this PM app.

---

## 1. What's in the Study folder

### 1.1 `civil_ai_knowledge_base/` — reference theory
| Doc | Takeaway |
|---|---|
| `Bill_of_Quantities_Measurement.md` | A **BOQ** is a tendering document that itemizes materials, parts, labor + costs so all bidders price the **same quantities**. Prepared by a **Quantity Surveyor**. Includes **contingency sums** (2 types: specific-item vs general pool). |
| `FIDIC_Contracts_Overview.md` | FIDIC "rainbow suite": **Red** (employer-designed), **Yellow** (design-build M&E), **Silver** (EPC/turnkey), **Green** (short form). 2017 = 2nd edition. International contract standard → drives Variation-Order clause references. |
| `Earthworks_Engineering_Overview.md` | Excavation classified by material (topsoil / earth / rock / muck / unclassified) and by purpose (stripping / roadway / drainage / structure). Shoring structures list (retaining wall, gabion, soil nailing, slurry wall…). Useful for **element-type presets**. |
| `Reinforced_Concrete_Design.md` | RC principles — context for concrete-grade element columns (C25/C20/C7). |
| `sample_boq_*.csv` | Minimal real BOQ shape: `Item No, Description, Unit, Qty, Rate`. Confirms our column model is correct. |

### 1.2 `civil_pm_boq_database/` — data + a full ERP
- **Portuguese procurement dataset** (`Fold_1/2/3`, 23 641 rows): a real, deeply **hierarchical** BOQ — Sections (TRABALHOS PREPARATÓRIOS / DEMOLIÇÕES / MOVIMENTO DE TERRAS / CONTENÇÕES / FUNDAÇÕES / ESTRUTURA BETÃO ARMADO / ESTRUTURA METÁLICA…) → numbered sub-sections (1.1, 1.2…) → leaf items. Each row: `Art., Description, Unit`. This is the canonical BOQ hierarchy our WBS already mirrors.
- **OpenConstructionERP** (`scripts/OpenConstructionERP/`): a production-grade, AGPL-3.0 construction ERP — **130+ backend modules**, **55 000+ cost items** (CWICR), 11 regional price sets, 4D schedule + 5D cost + full EVM. This is the richest source of patterns below.
- **`pm_tracking_schemas.json`**: column/row-count catalog of every dataset (machine-readable dictionary).

> ⚠️ Note: the `academic_datasets/` ("SnackerTracker") files are an unrelated hardware BOM — **not** construction. Skip them for domain modeling; only the BOM column pattern (Component / Qty / Unit price / Currency) is transferable.

---

## 2. Real production schemas extracted (the gold)

### 2.1 BOQ Position (`OpenConstructionERP/.../boq/models.py`)
The core estimation entity — far richer than a flat line item:
```
ordinal            – line number (unique within BOQ)
description, unit
quantity, unit_rate, total        – stored as String (Decimal-safe)
classification     – JSON {standard: code}  (DIN 276 / NRM / MasterFormat)
source             – manual | ai | cad | bim
confidence         – AI confidence score
parent_id          – hierarchical nesting (depth up to 8)
reference_code     – USER-FACING reusable code (≠ ordinal)
link_group_id + link_role (master/instance)  – same item reused in many places
wbs_id, cost_code_id
validation_status  – pending | ok | warning | error
version            – optimistic-concurrency token (409 on stale write)
```
Plus: `BOQMarkup` (overhead/profit/VAT/contingency), `BOQSnapshot` (point-in-time version history), `BOQQuantityLink` (live model→position binding).

### 2.2 Quantity Rules (RFC 24 — `docs/rfc/24-quantity-rules-redesign.md`)
Maps element properties → extracted quantity:
```
quantity_source : area_m2 | volume_m3 | length_m | weight_kg | count | property:xxx
multiplier, unit, waste_factor_pct
boq_target      : {position_id} | {auto_create, unit_rate}
```
**`waste_factor_pct`** is the standout — our element columns lack it.

### 2.3 Earned-Value forecast (`full_evm/models.py`)
```
etc  (Estimate To Complete), eac (Estimate At Completion),
vac  (Variance At Completion), tcpi (To-Complete Performance Index),
forecast_method (cpi | spi | manual),
confidence_range_low / high, alert_status
```
Classic EVM: `PV` (planned value), `EV` (earned value), `AC` (actual cost) → `SPI = EV/PV`, `CPI = EV/AC`, `EAC = BAC/CPI`, `VAC = BAC − EAC`.

### 2.4 Variations pipeline (`variations/models.py`) — the most relevant to our lifecycle
A 5-stage formal chain, each its own table:
```
Notice  →  VariationRequest  →  VariationOrder  →  CostImpact + ScheduleImpact  →  FinalAccount
```
Key fields we are **missing** in our VO model:
- `classification` (scope_change / …), `urgency` (low/med/high)
- `estimated_cost_impact`, `estimated_schedule_days` (and `final_*` on the Order)
- `status` workflow: draft → submitted → decided → issued → implemented
- `contract_standard` + `contract_clause_ref` (FIDIC 13.x / NEC4 60-65 / JCT 5.x)
- `ball_in_court` + `response_due_date` (change-intelligence: who owes the next action)
- Separate `SiteMeasurement` (joint measurement record) + `DayworkSheet` (time-and-material) — the **evidence trail** behind "actual quantities".
- `EoTClaim` (extension-of-time) + `DisruptionClaim`.

---

## 3. Gap analysis — our app vs. the reference

| Area | Our app (now) | Reference best-practice | Gap |
|---|---|---|---|
| BOQ hierarchy | ✅ WBS + element columns | ✅ same | none |
| Contract vs actual qty | ✅ baseline + execVariance | ✅ + site-measurement evidence | medium |
| Variation Orders | ⚠️ minimal (reason/approver/date) | ✅ full 5-stage pipeline + clause refs | **high** |
| Waste factor | ❌ | ✅ `waste_factor_pct` | **high (cheap fix)** |
| Markups (OH/profit/VAT) | ❌ | ✅ per-project | medium |
| EVM (SPI/CPI/EAC) | ❌ (we have the inputs!) | ✅ full | **high (cheap fix)** |
| Validation rules | ⚠️ engine warnings only | ✅ 42 BOQ rules | medium |
| Rate library | ❌ | ✅ 55K-item catalog | medium |
| Baseline diff view | ⚠️ stored, no UI | ✅ snapshots | low |
| Schedule from BOQ | ❌ (manual) | ✅ auto-gen cost-proportional | low |

---

## 4. Prioritized improvement roadmap

### 🟢 Tier 1 — high value, fits existing architecture, low effort

**T1.1 — Waste factor on element columns**
- Add `wasteFactorPct` (default 0) to each element column in `TaskDetails`.
- Engine: `effectiveSum = rawSum × (1 + wasteFactorPct/100)`; this becomes the contract qty for `mode:'created'` leaves.
- UI: small `%` input next to each column header; show raw vs effective in the totals row.
- *Why:* standard estimating practice; prevents under-ordering concrete/rebar. ~30 min.

**T1.2 — Earned-Value metrics (we already have the inputs)**
- We compute per-task `qty` (PV basis), `actualQty` (progress), `unitPrice`, `actualCost`.
- Add to `GanttEngine.calculate` project roll-ups:
  - `PV = Σ (task.qty × task.price) × plannedFraction` (planned by today's date)
  - `EV = Σ (task.qty × task.price) × task.progress`
  - `AC = Σ task.actualCost`
  - `SPI = EV/PV`, `CPI = EV/AC`, `EAC = BAC/CPI`, `VAC = BAC−EAC`
- Surface on the Dashboard as KPI tiles + an S-curve (planned vs earned vs actual over time).
- *Why:* "make it advanced" — EVM is the hallmark of advanced PM. Inputs exist; pure computation. ~1–2 h.

**T1.3 — Enrich Variation Orders**
- Extend our `projectMeta.variations[]` entries with: `classification`, `urgency`, `estCostImpact`, `estScheduleDays`, `status` (draft→submitted→approved→issued), `contractClauseRef` (default "FIDIC 13.x"), `ballInCourt`, `responseDue`.
- Add a VO status badge + a "submit/approve" mini-workflow in the VO modal.
- *Why:* directly upgrades the lifecycle feature just built; matches FIDIC practice seen in the docs. ~1 h.

**T1.4 — BOQ validation rules (lightweight)**
- Reuse the existing `GanttEngine` warnings channel. Add checks:
  - leaf with `quantity > 0` but `unitPrice == 0` (unpriced)
  - leaf with `quantity == 0` but used in schedule (orphan)
  - duplicate `name + unit` leaves
  - BOQ-linked column whose element sum ≠ contract qty by > tolerance (reconciliation breach)
- Show count in the lifecycle control bar; list in a warnings panel.
- *Why:* data quality; the reference ships 42 such rules. ~1 h.

### 🟡 Tier 2 — medium value

**T2.1 — Markups (overhead / profit / VAT / contingency)**
- Project-level config (extend `projectMeta`): `{ overheadPct, profitPct, vatPct, contingencyPct }`.
- Engine computes: `subTotal = Σ position totals`; `grandTotal = subTotal × (1+OH) × (1+profit) × (1+contingency) × (1+VAT)`.
- Show breakdown in a project-cost summary card.
- *Why:* a "total" without markups misrepresents the contract value. ~1.5 h.

**T2.2 — Iraqi rate library (seeded catalog)**
- A searchable list of common items (concrete grades, rebar ton, blockwork m², plastering m², excavation m³) with default `unit` + `unitPrice` in IQD.
- On BOQ-leaf creation / TaskDetails, "pick from library" autofills unit + price.
- Seed file: `src/data/rateLibrary.iq.js` (editable). Start small (~40 items), grow later.
- *Why:* speeds entry; the reference's 55K catalog is the same idea localized. ~2 h + data entry.

**T2.3 — Site-measurement evidence for actuals**
- Let each `actualQuantity` update optionally attach a measurement record: `{ date, measuredBy, value, note }`.
- Actual qty = latest approved measurement (auditable trail, not a free typed number).
- *Why:* "actual quantity" gains defensibility — matches `SiteMeasurement` table. ~2 h.

**T2.4 — Baseline diff view**
- We already store `projectMeta.baseline.tasks[id]`. Add a "مقارنة مع الخط الأساسي" view: per-task table of `baseline qty | current qty | Δ` and `baseline price | current | Δ`, color-coded.
- *Why:* closes the loop on the freeze feature; was in the original plan. ~1.5 h.

### 🔴 Tier 3 — larger scope (future)

- **T3.1 — Auto-generate schedule from BOQ**: create WBS tasks from BOQ sections with cost-proportional durations (OCE does this).
- **T3.2 — Tendering / bid comparison**: bid packages → distribute → side-by-side compare → award.
- **T3.3 — Risk register**: probability × impact per task, rolled to project heat-map.
- **T3.4 — Reference codes / link groups**: reusable master position definitions reused across the BOQ.
- **T3.5 — RFI / Submittal / Daily-diary modules**: field workflows (OCE has `rfi/`, `submittals/`, `daily_diary/`).

---

## 5. Recommended next implementation order

1. **T1.1 Waste factor** (quickest win, estimating accuracy)
2. **T1.2 EVM metrics** (biggest "advanced" perception per hour; Dashboard upgrade)
3. **T1.3 VO enrichment** (completes the lifecycle just built)
4. **T1.4 Validation rules** (data quality)
5. **T2.1 Markups** then **T2.2 Rate library** (cost realism + entry speed)

Each Tier-1 item is self-contained, non-breaking (defaults preserve current behavior), and verifiable with `npm run build` + `eslint`.

---

## 6. Reusable assets available locally

- **Portuguese BOQ CSVs** (`.../portuguese_dataset/*.csv`): real hierarchical section names → can seed an Arabic section-template list (أعمال تحضيرية / هدم / حركة تراب / دعم / أساسات / هيكل خرساني / هيكل معدني…).
- **CWICR catalog** (`OpenConstructionERP/data/catalog/*.xlsx`): 55K items, 11 regions incl. `DDC_CWICR_AR_DUBAI_Catalog.xlsx` (closest to Gulf/Arabic market) → candidate source for the Iraqi rate library after currency conversion.
- **OCE RFCs** (`docs/rfc/`): ready-made design specs — esp. `24-quantity-rules-redesign.md`, `37-...-multi-currency-vat-compound.md` (markup/VAT math), `16-data-explorer-analytics.md` (dashboard patterns).
