# 06 — Internationalization (i18n) Guide

Arabic-first app with English support. Custom lightweight system — **no i18n library**.
Default language: **Arabic (RTL)**. Second language: English (LTR).

---

## 1. File layout

```
src/i18n/
├── index.js              ← dictionary registry, LANGUAGES, translate(), loadLanguage, formatNumber/compactCurrency
├── I18nContext.jsx       ← React provider: { t, lang, setLang, isRTL, dir, languages }
├── context.js            ← createContext (plain JS — no JSX, importable from utils!)
├── useI18n.js            ← hook (falls back to Arabic outside a provider)
└── dictionaries/
    ├── ar/               ← 23 domain files: activity, app, calculator, common,
    │                        dashboard, files, finance, gantt, orders, planning,
    │                        registries, reports, snapshots, taskDetails, templates,
    │                        ui (shared src/ui/ components + new navigation),
    │                        record (rebuilt Record area; reuses orders.* labels),
    │                        home (rebuilt Home; reuses dashboard.* EVM/chart labels),
    │                        schedule (rebuilt Schedule: timeline, panel, lookahead,
    │                        baseline; reuses gantt.*, app.* and planning.* labels).
    │                        The rebuilt Reports reuse reports.* / activity.* and
    │                        add their new keys there ("rebuilt … (Phase 5)" blocks);
    │                        library, people, settings (rebuilt in Phase 6; reuse
    │                        calculator.*, templates.*, files.*, registries.*,
    │                        snapshots.*; new Finance keys sit in finance.js),
    │                        details (rebuilt full task details; reuses
    │                        taskDetails.*). Keys no code used were removed in
    │                        Phase 7 (264 per language).
    └── en/               ← same 23 files, same keys
```

`npm test` runs `src/i18n/__tests__/dictionaryParity.test.js`, which fails if
the two folders have different files, different keys in any file, or an empty
translation.

Each dictionary file exports a **flat** object: `{ 'domain.key': 'text' }`.
The prefix before the dot is a **naming convention only** — lookup does NOT
traverse nested objects.

## 2. How `t()` works

```jsx
const { t, lang, dir } = useI18n();
t('orders.approveBtn')                    // → 'اعتماد' or 'Approve'
t('app.modal.restoreText', { keys: 15, kb: 42 })  // {placeholders} interpolated via replaceAll
```

Lookup order: every domain dictionary of the active language (registration
order) → fallback language (**ar**) → the raw key string. So a missing English
string silently shows Arabic — that's the safety net.

Some utils (OrderEngine, ActivityLog, PlanningStore, Registries) call
`translate()` directly from `index.js` because they run outside React.

## 3. Direction (RTL/LTR)

- `I18nProvider` sets `document.documentElement.dir` + `.lang` on change and
  persists to localStorage key **`pm-language`**.
- `isRTL` / `dir` come from `LANGUAGES` entries (`ar: rtl`, `en: ltr`).
- Numeric/chart containers override locally: the S-curve (`home/SCurve.jsx`,
  time runs left → right) and the jspreadsheet editor container.

## 4. How to add a new UI string ⭐

1. Add the key to **both** dictionaries — e.g. `finance.myLabel` in
   `dictionaries/ar/finance.js` AND `dictionaries/en/finance.js`.
2. Use it: `t('finance.myLabel')`.
3. Never hardcode user-visible text in JSX (Arabic seed task names in
   `src/state/projectModel.js` INITIAL_TASKS are data, not UI — that's fine).

## 5. How to add a third language ⭐

1. Create `dictionaries/<code>/` mirroring `ar/` — the same 23 files, the same keys.
2. In `src/i18n/index.js`:
   - import the new dictionary modules;
   - add `{ code, label, dir }` to `LANGUAGES`;
   - add the language to `DICTIONARIES` with the same domain mapping.
3. Everything else (the language menu in the page header and Settings list
   `LANGUAGES` by their `label`), (provider, persistence, direction) follows automatically.

## 6. Formatting helpers (`src/i18n/index.js`)

- `formatNumber(value, lang)` — locale-aware numbers.
- `compactCurrency(value, lang)` — IQD-compacted amounts (B/M/K vs Arabic forms);
  used for KPI strips.

## 7. Known i18n quirks

- The **fallback chain ends at Arabic**: a typo'd key shows the key itself.
- The payroll status `'مستقطع'` (`financeModel.DEDUCTED_STATUS`) is compared as raw Arabic data
  (stored value, not UI text) — don't "translate" that comparison.
- Month/weekday names in the Schedule and Lookahead come from `Intl` with
  `ar-IQ-u-nu-latn` (Levantine month names, Latin digits) / `en-GB`.
- The engine stays untranslated: its task **warnings** carry a `code` and
  `params`, which `app/schedule/warningText.js` turns into `schedule.warn*`
  text (the engine's Arabic `message` is only a fallback).
