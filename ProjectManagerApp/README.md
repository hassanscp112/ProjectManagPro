# ProjectManagerApp

Single-page construction project-management app (React 19 + Vite, plain JS)
for an Iraqi canal rehabilitation contract. Arabic-first (RTL) + English.
**No backend: all data lives in the browser** (localStorage + IndexedDB).

📖 **Full documentation:** [`../docs/README.md`](../docs/README.md) — start with
`01-overview.md`. Agent entry point: [`../AGENTS.md`](../AGENTS.md).

## Run it

```bash
npm install
npm run dev        # → http://localhost:5173
```

(Or double-click `run.cmd` in the repository root.)

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build (`dist/`) |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (Node built-in runner) |

## Where things are

```
src/
├── App.jsx          ← project store + router (tiny)
├── app/             ← routes, shell layout, one page per route (record/, home/, schedule/, reports/ = rebuilt)
├── state/           ← ProjectProvider + pure project/order logic (tested)
├── components/      ← legacy screens, replaced phase by phase
├── ui/              ← shared components + design tokens (UI rebuild)
├── dev/             ← dev-only review page (/#/dev/ui)
├── utils/           ← engines + persistence (tested)
└── i18n/            ← ar/en dictionaries (19 domain files each)
```

⚠️ **Back up before clearing browser data** — use the in-app **Backup** button
(Schedule toolbar → More menu) to export a JSON file; **Restore** re-imports it.
