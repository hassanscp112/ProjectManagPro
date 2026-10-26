# 📚 Project Documentation — Start Here

This folder documents **everything** in this repository. It was written so that a
new person (or a new AI agent) can understand the whole project **without reading
the source code**.

> **Last verified:** 2026-10-26 · covers the app after the complete UI rebuild (Phases 0–7, see `plans/ui-rebuild-plan.md`) and the roadmap scaffolding (`plans/roadmap-plan.md`, wave 0).

---

## 🗺️ Which document should I read?

| I want to… | Read |
|---|---|
| Understand what this app **is** and its domain words (BOQ, WBS, orders, EVM…) | [01-overview.md](01-overview.md) |
| Understand how the **code is organized** and how data flows | [02-architecture.md](02-architecture.md) |
| Know **where data is stored** (every localStorage key & data shape) | [03-data-model.md](03-data-model.md) |
| Work inside `src/utils/` (the calculation engines) | [04-utils-reference.md](04-utils-reference.md) |
| Work on a **screen** (what each screen does, its flows) | [05-screens-guide.md](05-screens-guide.md) |
| Add or translate **UI text** (Arabic / English / new language) | [06-i18n-guide.md](06-i18n-guide.md) |
| Follow project **rules, known quirks, and what's next** | [07-conventions-quirks-roadmap.md](07-conventions-quirks-roadmap.md) |

**AI agents:** read the root [`AGENTS.md`](../AGENTS.md) first — it is a short
map of this documentation and the project's golden rules.

---

## ⏱️ Suggested 10-minute onboarding path (for humans)

1. **01-overview.md** — what the app does, the domain, the core idea ("orders are the foundation").
2. **02-architecture.md** — the one diagram + who owns which data.
3. Skim the table of contents of **03-data-model.md** — you don't need to memorize it, just know it exists.
4. **07-conventions-quirks-roadmap.md** — the rules that prevent mistakes.
5. Run the app (see below) and click through the tabs.

---

## ▶️ How to run the app

```bash
# from the repository root (Windows)
run.cmd            # double-click works too — starts dev server + opens browser

# or manually:
cd ProjectManagerApp
npm install        # first time only
npm run dev        # http://localhost:5173
```

| Command | What it does |
|---|---|
| `npm run dev` | Start Vite dev server (hot reload) |
| `npm run build` | Production build to `dist/` |
| `npm run lint` | ESLint check |
| `npm test` | Unit tests (Node built-in runner): engines + ar/en dictionary parity |
| `npm run dev` → `/#/dev/ui` | Dev-only review page showing every shared `src/ui/` component |

⚠️ **All data lives in the browser** (localStorage + IndexedDB). There is no
server and no database. Clearing browser data = losing the project — use the
in-app **Backup** button (Gantt toolbar) to export a JSON file.
