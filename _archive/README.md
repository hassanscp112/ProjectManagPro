# Archive — moved during repo cleanup (2026-09-27)

Nothing here was deleted. These items were moved out of the repo root because
they were one-off outputs or tooling unrelated to ProjectManagerApp. To restore
anything, move it back to its original path (listed below).

## Contents

### `excel-analysis-outputs/` *(git-tracked — moved via `git mv`)*
Early one-off analysis of the Excel Sheets folder. The `.txt` files were produced
with broken Arabic text encoding (unreadable mojibake), which is why they were archived.

| File | Original path |
|---|---|
| `account_analysis.txt` | repo root |
| `deep_analysis.txt` | repo root |
| `excel_files.txt` | repo root |
| `excel_info.txt` | repo root |
| `finance_analysis.txt` | repo root |
| `analyze_excel.cjs` | `ProjectManagerApp/analyze_excel.cjs` (the script that generated the txt files) |

The source Excel files remain untouched in `Excel Sheets/`.

### `ui-rebuild/` *(git-tracked — moved via `git mv`)*
Interim files from the UI rebuild (`plans/ui-rebuild-plan.md`), replaced by
rebuilt screens. Kept for reference; they import paths that may no longer exist.

| File | Original path | Replaced by |
|---|---|---|
| `Phase1-SchedulePage.jsx` | `ProjectManagerApp/src/app/pages/SchedulePage.jsx` (legacy Gantt toolbar + dialogs, Phase 1) | `src/app/schedule/` (Phase 4) |
| `Legacy-GanttChart.jsx` + `.css` | `ProjectManagerApp/src/components/GanttChart.*` (the original Gantt grid + timeline) | `src/app/schedule/Gantt.jsx` (Phase 4) |
| `Legacy-PlanningScreen.jsx` + `.css` | `ProjectManagerApp/src/components/planning/PlanningScreen.*` (rolling lookahead: month targets / week crews / day plan) | `src/app/schedule/LookaheadPage.jsx` + `src/state/lookaheadModel.js` (Phase 4) |

### `.agent/` *(gitignored — 243 MB)*
"Antigravity Kit" AI-agent toolkit (20 agents / 36 skills / 11 workflows).
Unrelated to this project's app. **If you use the Antigravity IDE in this
workspace, move this folder back to the repo root.**

### `.codex_tmp/` *(gitignored)*
Temporary output from a Codex session (`workbook_inventory.mjs` + scratch
`node_modules`).

## Note
- `.agents/` was an **empty** directory at the repo root and was removed (it contained nothing to keep).
- `.agent/` and `.codex_tmp/` kept their original names here so the existing
  `.gitignore` rules (`.agent/`, `.codex_tmp/`) still cover them at this location.
