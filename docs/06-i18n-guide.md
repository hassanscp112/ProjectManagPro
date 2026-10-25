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
├── LanguageSwitcher.jsx  ← one button per language
└── dictionaries/
    ├── ar/               ← 18 domain files: activity, app, calculator, common,
    │                        dashboard, files, finance, gantt, orders, planning,
    │                        registries, reports, snapshots, taskDetails, templates,
    │                        ui (shared src/ui/ components + new navigation),
    │                        record (rebuilt Record area; reuses orders.* labels),
    │                        home (rebuilt Home; reuses dashboard.* EVM/chart labels)
    └── en/               ← same 18 files, same keys
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
- Numeric/chart containers override locally: `SCurveChart` and the jspreadsheet
  editor container force `dir="ltr"`.

## 4. How to add a new UI string ⭐

1. Add the key to **both** dictionaries — e.g. `finance.myLabel` in
   `dictionaries/ar/finance.js` AND `dictionaries/en/finance.js`.
2. Use it: `t('finance.myLabel')`.
3. Never hardcode user-visible text in JSX (Arabic seed task names in
   `src/state/projectModel.js` INITIAL_TASKS are data, not UI — that's fine).

## 5. How to add a third language ⭐

1. Create `dictionaries/<code>/` mirroring `ar/` — the same 15 files, the same keys.
2. In `src/i18n/index.js`:
   - import the new dictionary modules;
   - add `{ code, label, dir }` to `LANGUAGES`;
   - add the language to `DICTIONARIES` with the same domain mapping.
3. Fix `LanguageSwitcher.jsx`: its caption is a hardcoded ternary
   (`l.code === 'ar' ? 'عربي' : 'EN'`) — switch it to `l.label` or the new
   language button will wrongly read "EN".
4. Everything else (provider, persistence, direction) follows automatically.

## 6. Formatting helpers (`src/i18n/index.js`)

- `formatNumber(value, lang)` — locale-aware numbers.
- `compactCurrency(value, lang)` — IQD-compacted amounts (B/M/K vs Arabic forms);
  used for KPI strips.

## 7. Known i18n quirks

- The **fallback chain ends at Arabic**: a typo'd key shows the key itself.
- `FinanceManager` payroll status `'مستقطع'` is compared as raw Arabic data
  (stored value, not UI text) — don't "translate" that comparison.
- `PlanningScreen` Arabic labels use Levantine month/weekday names.
