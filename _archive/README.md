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
| `analyze_excel.cjs` | `ProjectManagerApp/analyze_excel.cjs` (the script that generated the txt files; needs `npm install exceljs` to run again — the app no longer depends on it) |

The source Excel files remain untouched in `Excel Sheets/`.

### `ui-rebuild/` *(git-tracked — moved via `git mv`)*
Interim files from the UI rebuild (`plans/ui-rebuild-plan.md`), replaced by
rebuilt screens. Kept for reference; they import paths that may no longer exist.

| File | Original path | Replaced by |
|---|---|---|
| `Phase1-SchedulePage.jsx` | `ProjectManagerApp/src/app/pages/SchedulePage.jsx` (legacy Gantt toolbar + dialogs, Phase 1) | `src/app/schedule/` (Phase 4) |
| `Legacy-GanttChart.jsx` + `.css` | `ProjectManagerApp/src/components/GanttChart.*` (the original Gantt grid + timeline) | `src/app/schedule/Gantt.jsx` (Phase 4) |
| `Legacy-PlanningScreen.jsx` + `.css` | `ProjectManagerApp/src/components/planning/PlanningScreen.*` (rolling lookahead: month targets / week crews / day plan) | `src/app/schedule/LookaheadPage.jsx` + `src/state/lookaheadModel.js` (Phase 4) |
| `Legacy-DailyReports.jsx` + `.css` | `ProjectManagerApp/src/components/reports/DailyReports.*` (daily notes form + filter/print view) | `src/app/reports/DailyReportPage.jsx` + `utils/DailyNotes.js` (Phase 5) |
| `Legacy-MonthlyReport.jsx` + `.css` | `ProjectManagerApp/src/components/reports/MonthlyReport.*` (printable monthly sheet) | `src/app/reports/MonthlyReportPage.jsx` (Phase 5) |
| `Legacy-ActivityScreen.jsx` + `.css` | `ProjectManagerApp/src/components/activity/ActivityScreen.*` (feed / task history / heatmap) | `src/app/reports/ActivityPage.jsx` (Phase 5) |
| `Legacy-Dashboard.jsx` + `.css`, `Legacy-SCurveChart.jsx` + `.css` | `ProjectManagerApp/src/components/dashboard/*` (old Dashboard tab and its S-curve) | `src/app/home/` (Phase 3); the monthly report now uses `home/SCurve.jsx` |
| `legacy-components/finance/` | `ProjectManagerApp/src/components/finance/` (FinanceManager: 4 ledgers + lists, wrote localStorage directly) | `src/app/finance/FinancePage.jsx` + `utils/Finance.js` (Phase 6) |
| `legacy-components/calculator/` | `ProjectManagerApp/src/components/calculator/` (BOQ grids + jspreadsheet editor, wrote localStorage directly) | `src/app/library/BoqPage.jsx`, `BoqTemplateEditor.jsx` + `utils/CalculatorTemplates.js` (Phase 6) |
| `legacy-components/templates/` | `ProjectManagerApp/src/components/templates/` (templates, rate library, builder) | `src/app/library/TemplatesPage.jsx`, `TemplateBuilderPage.jsx`, `RatesPage.jsx` (Phase 6) |
| `legacy-components/registries/` | `ProjectManagerApp/src/components/registries/` (RegistriesScreen, IdentityPicker) | `src/app/people/PeoplePage.jsx`, `src/app/IdentityDialog.jsx` (Phase 6) |
| `legacy-components/snapshots/` | `ProjectManagerApp/src/components/snapshots/` | `src/app/settings/SettingsPage.jsx` (Phase 6) |
| `legacy-components/FileManager.jsx` + `.css` | `ProjectManagerApp/src/components/FileManager.*` | `src/app/library/FilesPage.jsx` (Phase 6) |
| `legacy-components/orders/` | `ProjectManagerApp/src/components/orders/` (old Orders screen, unrouted since Phase 2) | `src/app/record/` (Phase 2) |
| `Phase1-LegacyDialogs.jsx` | `ProjectManagerApp/src/app/legacy/LegacyDialogs.jsx` (identity picker wrapper) | `src/app/IdentityDialog.jsx` (Phase 6) |
| `legacy-components/taskDetails/` | `ProjectManagerApp/src/components/taskDetails/` (full task details: read report + edit) | `src/app/schedule/TaskDetailsPage.jsx`, `TaskDetailsRead.jsx`, `TaskDetailsEdit.jsx` + `state/taskDetailsModel.js` (Phase 7) |
| `Phase1-legacyPages.jsx` | `ProjectManagerApp/src/app/pages/legacyPages.jsx` (route wrappers that mounted old screens) | direct routes to `src/app/<area>/` pages (Phase 7) |
| `legacy-components/LanguageSwitcher.jsx` | `ProjectManagerApp/src/i18n/LanguageSwitcher.jsx` (unused; hardcoded ternary caption, quirk #5) | the page-header language menu / Settings (`l.label`) |
| `legacy-components/App.css`, `index.css` | `ProjectManagerApp/src/App.css`, `src/index.css` (legacy global styles, Inter web font) | `src/ui/base.css` (reset, page lock, scrollbars, focus ring, skip link, print) (Phase 7) |
| `template-assets/` | `ProjectManagerApp/src/assets/` (hero.png, react.svg, vite.svg) and `public/icons.svg` — Vite template files, never used | — |

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
