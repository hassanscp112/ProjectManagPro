> Status: approved 2026-10-26 · wave 0 (scaffolding) done on branch `roadmap/integration`. Sessions build from here; see "Shape of the run".

# Roadmap: a full multi-user project-management app, built by parallel sessions

## Context
The app is a polished single-device product: React + Vite, all data in
localStorage/IndexedDB, Arabic-first, built around an "orders" ledger.

The user wants a **fully fledged project-management app**:
- user accounts and roles;
- a real database;
- version history;
- **who did each thing, fully recorded**.

The work runs in **parallel sessions**:
- a **Planning** session the user works in directly, to build a system that
  creates a whole BOQ + plan + Gantt as automatically as possible (the base is
  `plans/ecosystem-plan.md` §8 and the existing `TemplateEngine`);
- every other feature runs in its own background session.

The vision is already saved: `plans/ecosystem-plan.md` (product),
`plans/advanced-lifecycle-plan.md` (sign-off, baseline, variation orders) and
`plans/ui-rebuild-plan.md` (Aubergine design). This roadmap is saved next to
them as `plans/roadmap-plan.md`.

Decisions made with the user:
- **Supabase** as the backend.
  - Testing: self-hosted Supabase (Docker) on a second laptop acting as the
    server.
  - Launch: a real hosted service.
  - The server address is a **setting, not a build constant**, so moving from
    the laptop to the official service needs no rebuild.
- **Offline-first**: every device keeps a local copy, records without signal,
  and syncs when back online, keeping who made each change and when.
- **Roles**: Admin, Project manager, Technical office engineer
  (control / QA / QS / planning), Site engineer, Accountant, Viewer/client.
- Frontend on **GitHub Pages** (public repo `hassanscp112/ProjectManagPro`),
  deployed from `main`.
- Photos are compressed on pick (JPEG, longest side 1600 px, quality 0.8).
- Dropped: the file-based "send to office" sharing, because real sync
  replaces it.

Branch state: `redesign/aubergine` equals `main`.

---

## Shape of the run

| Wave | Sessions (each in its own worktree and branch) | Mode |
|---|---|---|
| 0 | me, on branch `roadmap/integration` | Scaffolding every session builds on (below) |
| 1 | **P Planning** · **F Foundation** · WS1 Photos · WS2 Platform · WS3 Certificates · WS4 Diary & delays | P is interactive with the user; the others run on their own. F asks the user only for server-laptop steps |
| — | me | Merge the finished wave-1 branches into `roadmap/integration` (WS2, WS1, WS3, WS4, then F); test after each |
| 2 | WS7 Expenses · WS8 Order rules · **H History & accountability UI** | On their own; branched from the merged integration branch |
| 3 | me | Merge, full verification, docs/07 + AGENTS.md, then **ask** before merging to `main` (merging deploys) |

P is long-running. It merges into `roadmap/integration` at milestones the
user approves, and pulls the integration branch in after each merge
(`sync_with_base_branch`).

### Contracts that keep sessions independent (created in wave 0)
1. **Store registry** `src/utils/storeRegistry.js`: one entry per localStorage key.
   - Fields: `{ key, scope: 'project' | 'global' | 'device', shape: 'list' | 'doc', itemsPath?, idField? }`.
   - `DataIO.APP_STORAGE_KEYS` and `Projects.PROJECT_SCOPED_KEYS` are
     **derived** from it.
   - F's sync engine syncs whatever is registered, so feature sessions never
     touch sync code.
   - Wave 0 pre-registers the new stores: `pm-certificates`, `pm-site-diary`,
     `pm-delays`, and device-only `pm-server` / `pm-session`.
2. **Permissions** `src/utils/permissions.js`: a pure `can(role, action)`
   plus a `useCan()` hook. Until F lands, the role comes from the local
   identity (default `admin`).
   - Every session gates its new actions with it, for example
     `certificates.issue`, `orders.approve` and `plan.signOff`.
   - The proposed matrix (the user confirms it in F):

   | Action | Admin | PM | Office eng. | Site eng. | Accountant | Viewer |
   |---|---|---|---|---|---|---|
   | users / members | ✓ | | | | | |
   | plan, BOQ, templates (draft) | ✓ | ✓ | ✓ | | | |
   | sign-off / re-baseline / complete | ✓ | ✓ | | | | |
   | variation order: draft / approve | ✓ | ✓/✓ | ✓/– | | | |
   | record work, tests, diary, photos, delays | ✓ | ✓ | ✓ | ✓ | | |
   | approve formal orders (never own) | ✓ | ✓ | ✓ | | | |
   | expense orders, finance | ✓ | ✓ | | ✓ | ✓ | |
   | certificates: prepare / issue | ✓ | ✓/✓ | ✓/– | | ✓/– | |
   | read everything | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
3. **Actor** `Identity.currentActor()` returns `{ id, name, role }`. It is
   local now and becomes the logged-in user once F lands.
4. **FileDB API**:
   - `saveFile(folderId, file, extra)`, where `extra` carries `orderId`;
   - `getFilesByIds(ids)` and `deleteFiles(ids)`.
   - DataIO carries `orderId` in backups.
5. **Stubs**:
   - dictionaries `certificates`, `diary`, `account` and `history` (ar + en,
     registered in `i18n/index.js`);
   - lazy placeholder routes `finance/certificates[/:id]` (before
     `finance/:ledger`), `reports/delays`, `login`, `settings/users`,
     `settings/server` and `history/:collection/:id`;
   - nav and tab entries.

### Rules in every session brief
- Read `AGENTS.md`, `plans/roadmap-plan.md` (this file) and
  `plans/ecosystem-plan.md`. Follow the golden rules: ar + en text,
  persistence only through `src/utils` owners, archive never delete, executed
  quantity comes from orders.
- **New stores** go through `storeRegistry` (they are pre-registered).
  Gate actions with `useCan`. Shared files beyond the wave-0 stubs (router,
  navigation, registry, `i18n/index.js`, `package.json`): stop and report,
  do not edit. Exceptions: WS2 owns `package.json`; F may add its own
  dependency and tell me.
- `npm install` in the worktree. Dev server on your own port (P 5185, F 5189,
  WS1 5181, WS2 5182, WS3 5183, WS4 5184, WS7 5187, WS8 5188, H 5186).
  **Never use 5173.**
- Pure rules go in `src/state/*Model.js` / `src/utils` with `node:test`
  tests. UI uses `src/ui` components, CSS Modules, `--ui-*` tokens and
  logical properties.
- `npm test`, `npm run lint` and `npm run build` must pass. Verify in the
  browser on your port (DOM checks).
- Update only your area's sections of `docs/03`, `docs/04` and `docs/05`.
  Leave `docs/07`, `AGENTS.md` and `plans/` alone (P is the exception: it
  owns `plans/auto-planning-plan.md`).
- Conventional commits. **No push, no merge.** End with a report: files,
  tests, what was verified, open issues.

---

## Wave 0 — scaffolding (me, before launching)
1. `git checkout -b roadmap/integration`. Save this roadmap as
   `plans/roadmap-plan.md` and list it in `docs/07` §5.
2. `storeRegistry.js`: migrate the 18 existing keys into it and derive
   `APP_STORAGE_KEYS` / `PROJECT_SCOPED_KEYS` from it. Pre-register the new
   keys. Tests: the derived lists equal the old ones plus the new keys.
3. `permissions.js` + `useCan`, and `Identity.currentActor()`. Tests for the
   matrix.
4. The FileDB API + DataIO `orderId`, with a round-trip test.
5. Dictionary stubs, route stubs and nav. Run `npm test`, lint and build,
   then commit as `chore: scaffold roadmap workstreams`.
6. Launch the wave-1 sessions (`start_session`, user_asked, fresh context,
   own worktree). Each brief is its section below plus the rules above.

---

## Wave 1

### P — Planning & auto-planning (interactive, with the user, port 5185)
**Goal:** a person describes a project and the app produces the **whole WBS,
BOQ (quantities + prices), durations, dependencies and Gantt**, as
automatically as possible, for review and edit before sign-off.

**First deliverable:** `plans/auto-planning-plan.md`, written **with the
user**. The session starts in plan mode and builds after the user approves.

**What exists to build on:**
- `TemplateEngine`: PARTS with productivity, templates with variables,
  repeat groups and dependency rules, a generator.
- Template builder, rate library, "save project as template".
- New project from template / blank / copy.
- Lookahead month / week / day with PPC.
- `GanttEngine` + `CriticalPath`, `CalculatorEngine` take-off grids.
- Element columns linked to BOQ leaves.

**Ideas to discuss (seed list, the user decides):**
- Project wizard: type → key parameters (floors, areas, canal length and
  sections …) → generated tree with quantities by formula → priced from the
  rate library + markups → durations from productivity → links from rules →
  Gantt.
- **Linear works** for canals and roads: chainage segments (0+000 …) with
  repeated activities per segment, staggered by crew.
- **BOQ → schedule**: paste or import an Excel BOQ, map each line to a part
  (by name and unit), then generate durations, links and the schedule. The
  user's real contract Excel files are in `Excel Sheets/`.
- **Learned productivity** from approved orders, fed back into templates and
  Lookahead ("at the current pace: N days", suggested crews).
- Working calendar (Fridays, holidays, Ramadan hours) and resource-limited
  scheduling (crew limits).
- Markups (overhead, profit, contingency), part of the agreed roadmap.
- Optional AI help to map BOQ lines to parts. The user decides; it needs a
  server function once F exists.

**Owns:**
- `utils/TemplateEngine.js`, `RateLibrary.js`, `GanttEngine.js`,
  `CriticalPath.js`, `CalculatorEngine.js`, `CalculatorTemplates.js`;
- new `utils/Productivity.js` and anything new under `utils/planning/`;
- `state/scheduleModel.js`, `lookaheadModel.js`, `portfolioModel.js`,
  `libraryModel.js` (BOQ part);
- `app/schedule/*` (except the WS1 evidence card in `TaskDetailsRead.jsx`),
  `app/templates/*`, `app/portfolio/NewProjectPage.jsx`,
  `app/library/Boq*`;
- the dictionaries `templates`, `planning`, `schedule`, `gantt`, `projects`
  and `calculator`;
- granted on 2026-10-26 (request 4 in `plans/auto-planning-plan.md`): the
  predecessor handling in `state/projectModel.js` (`deleteTaskCascade`,
  `describeDelete`, `normalizeTaskUpdate`), which uses P's own
  `utils/planning/links.js`.

Done for P by the integrator on `roadmap/integration`: `pm-work-types` in
the store registry, the `plan.lookahead` permission, `applyTaskPatches` /
`setPlanning` in `ProjectProvider` (pure helpers `applyTaskPatchList` /
`mergePlanning` at the end of `projectModel.js`), and placeholder routes
`#/work-types` (projects-level sidebar) and `#/schedule/resources` (Schedule
tab), with their pages in P's folders. The `.xlsx` parser is waiting for the
user to approve a library (WS2 owns `package.json`).

**Must keep:** the order-derived executed quantity, the sign-off and
baseline locks, and the variation-order flow.

### F — Foundation: accounts, database, offline sync, audit (on its own, port 5189)
**Owns:**
- new `supabase/` (migrations, seed, `config.toml`);
- new `src/sync/*`;
- `utils/Identity.js`, `app/IdentityDialog.jsx` (becomes login / account);
- new pages: `app/account/LoginPage.jsx`, `app/settings/UsersPage.jsx`,
  `app/settings/ServerPage.jsx`;
- the auth gate in `App.jsx` / `ProjectGate.jsx`;
- the project list loading in `utils/Projects.js`;
- the dictionaries `account` and `history`;
- new `docs/08-server-setup.md`.

**Work, in phases:**
1. **Schema (SQL migrations), all with RLS:**
   - `profiles`;
   - `projects`;
   - `project_members(project_id, user_id, role)`;
   - `items(project_id, collection, item_id, data jsonb, rev, updated_by, updated_at, deleted)`;
   - append-only `changes(id, project_id, collection, item_id, op, before, after, actor, device_id, client_at, server_at)`;
   - a Storage bucket `files/{project}/{file}`.
   - RLS: members read; writes per role, by collection, from the matrix;
     approving an order requires an approver role and not the recorder;
     `changes` is insert-only.
2. **Client sync engine (offline-first):**
   - The local stores stay the read model, so **screens do not change**.
   - The engine diffs every registered store on `notifyStoreChange`, on a
     timer and when the page becomes visible. Each item-level change goes to
     an IndexedDB **outbox** with the actor, device and time.
   - Push when online; pull plus Realtime for the open project. Remote
     changes are written to local stores and `notifyStoreChange` refreshes
     the UI.
   - Conflicts: per item, approved beats recorded, otherwise the higher `rev`
     wins. The losing version is kept in `changes` (nothing is lost).
   - FileDB blobs upload to and download from Storage.
3. **Accounts:**
   - Login (email + password; phone OTP later), and the server address in
     `#/settings/server` (`pm-server`, device-only, defaults from env).
   - `#/settings/users`: invite and add members, set the role per project.
   - `currentActor()` returns the real user, and the permissions matrix is
     confirmed with the user.
4. **First move to the server:** "Upload this device's data". It creates
   server projects from the local ones and pushes every store and file,
   after taking a safety backup first.
5. **History API** for H:
   - `getHistory(collection, itemId)`;
   - `getProjectTimeline(filters)`;
   - `restoreVersion(changeId)`, which writes a new change and never
     rewrites history.
6. **Server-laptop guide + scripts** (`docs/08-server-setup.md`):
   - Docker + self-hosted Supabase compose, applying the migrations,
     backups (`pg_dump` schedule).
   - HTTPS for phones: GitHub Pages needs an https API, so use a Cloudflare
     Tunnel or Tailscale to the laptop.
   - The later move to hosted Supabase.

**Tests:** diff/outbox logic, the conflict rules, the permissions matrix,
and RLS (SQL tests with `supabase test db` if Docker is available).

### WS1 — Photo evidence on orders (on its own, port 5181)
**Owns:**
- `app/record/*`
- new `utils/ImageCompress.js`
- new `ui/PhotoPicker.jsx` and `ui/PhotoStrip.jsx` (+ css, exported)
- new `app/useOrderPhotos.js`
- `state/orderForm.js` (evidence only)
- `state/taskDetailsModel.js` (`orderRollup.photoIds`)
- the evidence card in `TaskDetailsRead.jsx`
- `app/library/FilesPage.jsx` and the files part of `libraryModel.js`
- the dictionaries `orders`, `record`, `files`, `taskDetails` and `ui`

**Work:**
- Pure `fitWithin` + `compressImage`.
- Picker:
  - phone (`useMediaQuery`): Take photo (`capture="environment"`) and Gallery;
  - desktop: Add photos;
  - at most 6 photos; it revokes its object URLs.
  - It is rendered after the spec fields for every type, so `OrderEngine`
    types are not touched.
- Async `save`: photos go to `saveFile('order_photos', blob, { orderId })`,
  then the order gets `evidence: ids`. If IndexedDB fails, the order is saved
  without photos and a warning shows. `saving` blocks a double submit.
- Display:
  - order row: a camera button with the count, opening a viewer (loaded
    lazily);
  - task-details Evidence: count + the latest 8;
  - Files: a root folder "Order photos".
- Deleting an order removes its photos.

**Tests:** `fitWithin`, evidence on the order, repeat-last copies no photos,
`photoIds` and the folders.

### WS2 — Platform & quality (on its own, port 5182)
**Owns:**
- `package.json` / lock
- `vite.config.js`, `index.html`, `public/`
- `pwa-assets.config.js`
- new `app/UpdatePrompt.jsx` (mounted in `App.jsx`)
- `.github/workflows/`
- `StoragePersistence.js` and the storage section of Settings
- new `e2e/`
- the dictionaries `app` and `settings` (its sections)

**Work:**
1. **PWA** with `vite-plugin-pwa` (check it supports Vite 8; otherwise a
   hand-made manifest + `sw.js`):
   - `registerType: 'prompt'`, the service worker off in dev;
   - precache `js, css, html, svg, png, ico, woff2` (≤ 4 MB per file);
   - manifest «مدير المشروع», `lang: 'ar'`, `dir: 'rtl'`, standalone,
     `#553285`, scope `'.'`.
2. **New aubergine `app-icon.svg`** to replace the Vite logo, with PNGs
   generated by `@vite-pwa/assets-generator` (script `icons`).
3. **Update banner** "New version ready · Reload" (never auto-reload), plus
   a one-time "Ready to work offline" toast.
4. **Pages workflow:**
   - on push to `main`: `npm ci`, `npm test`, then
     `VITE_BASE=/ProjectManagPro/ npm run build`, then upload and
     deploy-pages;
   - `base: process.env.VITE_BASE || '/'`.
5. **Storage meter** in Settings (`navigator.storage.estimate`, photo count
   and size, a warning at 80 %).
6. **E2E smoke tests** with `@playwright/test` (`npm run test:e2e`,
   `webServer` on port 5190): every route in ar and en and at phone width
   has no console errors; record an order and see it in the log.

### WS3 — Payment certificates (ذرعات) (on its own, port 5183)
**Owns:**
- new `utils/Certificates.js` (`pm-certificates`)
- new `state/certificateModel.js`
- `app/finance/Certificates*.jsx` + css
- the `certificates` dictionary
- read-only use of orders, tasks and registries

**Work:**
- **Two kinds:**
  - **subcontractor**: that contractor's approved value orders at their agreed
    rate per item; a missing rate is flagged;
  - **employer / main contract**: all approved value orders at the BOQ unit
    price.
- Each line: previous cumulative qty / this period / cumulative, × rate.
- Totals: gross, minus retention % (default 5), minus advance recovery, minus
  other deductions, minus previous certificates, which gives the net payable.
- Draft → **issued**: issuing freezes the lines and `orderIds`, logs the
  activity and exposes `certifiedOrderIds()`.
- Gates: `certificates.prepare` / `certificates.issue`.
- UI:
  - the list with filters;
  - a new-certificate dialog;
  - the `ReportSheet` page with signatures and Print;
  - a rates editor (contractor × item).

**Tests:** the line math across periods, retention and advance limits, and a
missing rate.

### WS4 — Site diary & delay register (on its own, port 5184)
**Owns:**
- new `utils/SiteDiary.js` and `utils/Delays.js`
- new `state/diaryModel.js`
- `app/reports/DailyReportPage.jsx` (diary parts; leave a slot for WS8's
  photos)
- new `app/reports/DelaysPage.jsx`
- the delay section of `MonthlyReportPage.jsx`
- the dictionaries `diary` and `reports`

**Work:**
- **Diary per day:**
  - weather, max temperature, working hours;
  - manpower by trade (prefilled from the day's plan crews);
  - equipment by type, visitors, issues;
  - "Same as yesterday".
  - It prints in the daily report.
- **Delay events:**
  - cause, start and end, affected items, excusable or not;
  - **notice date**, with a warning when it is more than 28 days after the
    start (FIDIC 20.1);
  - days claimed and granted, and a status.
- `#/reports/delays`: the register, totals and print. The monthly report gets
  a "Delays this month" section.

**Tests:** overlapping delays are not double counted, the notice warning and
the prefill.

---

## Wave 2 (after wave 1 is merged)

### WS7 — One entry point for expenses (port 5187)
**Owns:**
- `utils/OrderEngine.js` (the expense type specs)
- `app/record/OrderForm.jsx` (new field kinds)
- `state/financeModel.js`, `utils/Finance.js`, `app/finance/FinancePage.jsx`
- the dictionaries `finance` and `orders`

**Work:**
- Expense orders get structured details from the finance lists:
  - machinery: hours × rate, driver hours, fuel liters × price;
  - material: qty × price;
  - payroll: salary, advance, the `'مستقطع'` status.
- The Finance ledgers become filtered views over expense orders.
- A one-time migration turns `project-manager-finance-data` into expense
  orders (`source: 'finance-migration'`): dry-run counts first, a safety
  backup, a migrated flag. The old key is never deleted.

**Tests:** the mapping per ledger, totals before vs after, and idempotency.

### WS8 — Order rules & cross-links (port 5188)
**Owns:**
- `state/orderForm.js` (validation)
- `app/record/useApproval.jsx`, `RecordNewPage.jsx`, `PhoneRecordFlow.jsx`
- `state/reportsModel.js` (`dayReport.photoIds`)
- the photos block in `DailyReportPage.jsx`
- the dictionaries `record` and `reports`

**Work:**
- `draftWarnings` gives warnings with "Save anyway?" for:
  - a quantity over what is left;
  - a likely duplicate;
  - a future date;
  - a date before the project start;
  - an amount more than 10× the type's median.
- Nobody approves their own formal order.
- **Orders in an issued certificate are locked** ("In certificate #N").
- Day photos appear in the daily report and in print.

**Tests:** every warning, the self-approval rule and the lock.

### H — History & accountability UI (port 5186)
**Owns:**
- new `src/ui/History*.jsx`
- new `app/history/*` (`#/history/:collection/:id`)
- the activity feed's data source (`app/reports/ActivityPage.jsx`,
  `state/reportsModel.js` feed part, after WS8 merges)
- small "History" entry points added to the task panel, order row,
  certificate, delay, diary day and people rows

**Work:**
- **Per-item history:** every change with who, when, device and a
  field-level before → after; **Restore this version**, which asks first and
  is recorded as a new change.
- The project timeline feed now comes from server `changes`, with filters by
  person, type and date.
- **Per-person activity** ("what did X do this week").
- "Recorded by / approved by / last edited by" stamps on order rows, task
  panel, certificates and delays.
- Offline: it shows the local outbox ("waiting to sync").

**Tests:** the diff-to-field-list formatter and the restore payload.

---

## Wave 3 — integration & release (me)
- Merge in the order WS7, WS8, H, then P's latest milestone.
- Run `npm test`, lint, build and `npm run test:e2e`, then the end-to-end
  walkthrough below.
- Write `docs/07`:
  - current state: multi-user, sync, PWA;
  - quirk #7 (snapshots) answered by server history;
  - quirk #13: the origin now only caches;
  - the roadmap.
- Update `AGENTS.md` (server, `test:e2e`, `icons`, the store registry rule).
- **Ask the user** before merging into `main`, because that deploys to
  https://hassanscp112.github.io/ProjectManagPro/.
- Pages is enabled once: Settings → Pages → GitHub Actions.

## End-to-end verification
1. **Server:** self-hosted Supabase (test laptop, or local Docker), with the
   migrations applied. Create an admin, invite 3 users (PM, site engineer,
   accountant). Upload one device's data.
2. **Two devices** (ports 5180 and 5179, as different users):
   - the site engineer records an order with 2 photos **offline**, then
     reconnects;
   - the PM sees it live with its photos;
   - the PM approves it, but the site engineer cannot approve their own;
   - the accountant cannot edit the plan (blocked by both the UI and RLS).
3. **History:** edit a task quantity, then restore the previous version. The
   timeline shows both acts with names, and the item history shows the field
   diffs.
4. Issue a certificate: its numbers match the order log, and its orders are
   locked.
5. A diary day and a delay event print correctly; the 28-day warning shows.
6. The finance migration on a copy of real data (port 5180, never 5173): the
   totals are unchanged.
7. **Planning:** create a project with the auto-planning flow (from the
   P plan) and get a complete WBS + BOQ + Gantt; edit, sign off, record.
8. **PWA:** a preview build with `VITE_BASE` has a registered service worker
   and loads offline. On a real phone, install it from Pages, point it at the
   test server's https address, and record a photo in airplane mode; it syncs
   later.
