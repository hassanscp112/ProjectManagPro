# 08 — Server Setup: the Shared Database

> Last verified 2026-10-26. Read [02-architecture.md](02-architecture.md) §7
> first for how the app syncs. Scripts: `ProjectManagerApp/supabase/server/`.

The app works fully on one device without any server. A server adds
**accounts, roles, sharing between devices and the full change history**.
The server is [Supabase](https://supabase.com) (Postgres + sign-in + file
storage + live updates):

- **Testing:** self-hosted with Docker on a second laptop (this guide).
- **Launch:** hosted Supabase (§9). The server address is a setting on each
  device, so moving needs no new app build.

```
 phones / laptops (the app, offline-first)
        │  https://<laptop>.<tailnet>.ts.net   (Tailscale Funnel or Cloudflare Tunnel)
        ▼
 test laptop ── Docker ── Supabase: API gateway :8000 · Postgres · Auth · Storage · Realtime · Studio
```

**Passwords and keys:** you type them into files on the server laptop
(`.env`). Never paste them into a chat, an issue or the repository. The app
only ever gets the **public (anon) key**.

---

## 1. What the server laptop needs

| Need | Notes |
|---|---|
| Windows 10/11, macOS or Linux, 8 GB RAM or more | It must stay on (and awake) while people sync |
| ~10 GB free on the disk Docker uses | On Windows Docker Desktop keeps its disk on C: by default; move it in Docker Desktop → Settings → Resources → Advanced → Disk image location |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/macOS) or Docker Engine + compose plugin (Linux) | Check: `docker compose version` |
| [Git](https://git-scm.com/) — on Windows it brings **Git Bash**, used for every `sh` / `.sh` command below | |
| A copy of this repository (for the migrations and scripts) | `git clone https://github.com/hassanscp112/ProjectManagPro.git` |
| Node.js 20+ — only for §9 and the optional CLI | |

## 2. Install self-hosted Supabase

In Git Bash (Windows) or a terminal, in a folder of your choice:

```bash
git clone --depth 1 https://github.com/supabase/supabase
mkdir supabase-project
cp -rf supabase/docker/. supabase-project
cd supabase-project
cp .env.example .env
sh utils/generate-keys.sh
```

`generate-keys.sh` fills `JWT_SECRET`, `ANON_KEY` and `SERVICE_ROLE_KEY`
in `.env` (review its output). Then open `.env` in an editor and set:

| Variable | Set it to |
|---|---|
| `POSTGRES_PASSWORD` | a long random password (letters and digits) |
| `DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD` | the login of Studio (the admin web UI) — a strong password, Studio is reachable through the tunnel |
| `SITE_URL` | `https://hassanscp112.github.io/ProjectManagPro/` |
| `ADDITIONAL_REDIRECT_URLS` | `http://localhost:5173,http://localhost:5189` |
| `ENABLE_EMAIL_AUTOCONFIRM` | `true` — the laptop sends no e-mail, so new accounts are confirmed at once |
| `DISABLE_SIGNUP` | `false` — people create their own account; the admin then adds them (§5) |
| `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL` | after §4: replace `http://localhost:8000` with your https address (keep any path that follows) |

Keep `.env` private (it holds the secret key). Then:

```bash
docker compose pull      # first time: several GB
docker compose up -d
docker compose ps        # every service "Up … (healthy)" after a minute or two
```

Studio: `http://localhost:8000` on the laptop (asks for the dashboard login).

## 3. Apply the app's database

From the repository copy, in Git Bash:

```bash
cd ProjectManagPro/ProjectManagerApp/supabase/server
./apply-migrations.sh /path/to/supabase-project
```

It runs every file in `supabase/migrations/` once (tables, row-level
security, sync functions, the `files` storage bucket, live updates) and
records it, so running it again after an app update applies only new
files. Check in Studio → Table editor: `projects`, `items`, `changes` …
exist.

(With Node installed you can use the Supabase CLI instead:
`npx supabase db push --db-url "postgresql://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@localhost:5432/postgres"`
from `ProjectManagerApp/`.)

**Never run `supabase/seed.sql` on this server** — it creates demo accounts
with a known password (it is for `npx supabase start` on a developer machine).

## 4. HTTPS for phones

The published app (GitHub Pages) is https, and a browser lets an https page
talk only to an https server. Phones also need to reach the laptop from
anywhere (site, office, mobile data). Pick one:

**A. Tailscale Funnel (recommended: free, fixed address, no domain needed)**

1. Install [Tailscale](https://tailscale.com/download) on the laptop and
   sign in.
2. In the Tailscale admin console: DNS → enable **MagicDNS** and **HTTPS
   certificates**.
3. On the laptop: `tailscale funnel --bg 8000` (the first time it links to
   the console to allow Funnel for this machine).
4. It prints the address, e.g. `https://pm-laptop.tailxxxx.ts.net` —
   that is the **server address** for the app. Phones do **not** need
   Tailscale.

**B. Cloudflare Tunnel**

- Quick test: `cloudflared tunnel --url http://localhost:8000` prints a
  `https://….trycloudflare.com` address — it changes every time it starts,
  so every device would need the new address. Fine for an hour of testing.
- Lasting: with a domain on Cloudflare, create a named tunnel
  (`cloudflared tunnel login`, `cloudflared tunnel create pm`,
  `cloudflared tunnel route dns pm pm.example.com`, ingress
  `service: http://localhost:8000`) and run it as a service.

Then put the https address in `.env` (`SUPABASE_PUBLIC_URL`,
`API_EXTERNAL_URL`) and restart: `docker compose up -d`.

Check from a phone: open `https://<address>/auth/v1/health` — it should
answer (an "API key" message also means the server is reachable).

## 5. First use

1. **Any device, in the app:** the sign-in page (or Settings → Server) →
   *Server address* = the https address, *Public (anon) key* = `ANON_KEY`
   from `.env` → **Test** ("The server answers") → **Save**.
2. **Create account** (name, e-mail, password ≥ 8). On a new server the
   first account is asked to **Set up your company** and becomes its admin.
3. **The device with the real data** (today: the browser at
   `localhost:5173`, or the published app): sign in with that admin account →
   Settings → Server → **Upload this device's data**. It downloads a full
   backup file first, then shares every project, the people / templates /
   rates and all files. Keep the backup file.
4. **Team:** each person creates an account (sign-in page → *Create an
   account*). The admin opens a project → Settings → Users → **Invite**
   (their e-mail + role). Inviting an e-mail that has no account yet is fine:
   they join the moment they sign up with it.
5. Roles: see Settings → Users → *What each role may do*. The company role
   (same page, *Company members*) decides who edits the shared lists and
   creates projects; a company admin is admin in every project.

A device can also **Use without an account** (sign-in page): it works on
its own data only, as before.

## 6. Backups

```bash
./backup.sh /path/to/supabase-project /path/to/pm-backups
```

writes `pm-data-<time>.sql.gz` (the app's tables, the full change history
and the accounts), `pm-storage-<time>.sql.gz` (the file list) and
`pm-files-<time>.tar.gz` (the uploaded files), keeping the newest 28 sets.
The structure is not in the backup — it comes from the migrations.

- **Schedule it** every 6 hours: Linux/macOS `crontab -e`; Windows Task
  Scheduler running Git Bash (the exact lines are at the top of
  `backup.sh`).
- **Copy the backup folder off the laptop** (USB disk / cloud drive)
  regularly — a backup on the same disk does not survive the disk.
- Every device also keeps its own full copy of its projects, and the app's
  own backup button still works.

**Restore** (laptop lost, disk failed): set up a new server (§2–3, do not
sign up), then

```bash
./restore.sh /path/to/supabase-project pm-data-….sql.gz pm-storage-….sql.gz pm-files-….tar.gz
```

It loads the data with triggers off (the history stays exactly as it was)
and runs `after-restore.sql`, which re-stamps the records so devices'
incremental pulls stay correct. Same address → devices just continue; a
device whose address changed pulls everything again by itself.

## 7. Updating

When the app gets new migrations: `git pull` the repository copy on the
laptop, then run `./apply-migrations.sh /path/to/supabase-project` again.
Supabase itself: `docker compose pull && docker compose up -d` (read the
Supabase release notes first).

## 8. Developer machine (no laptop needed)

- `npm run test:db` (in `ProjectManagerApp/`) runs the database tests and
  the app's sync code against the real migrations in **PGlite**
  (in-process Postgres) — no Docker needed.
- With Docker: `npx supabase start` (uses `supabase/config.toml`,
  migrations and `seed.sql` — demo accounts `admin@example.test`,
  `pm@…`, `site@…`, `acct@…`, password `dev-only-password`), then
  `npx supabase test db` runs the same pgTAP tests against the real stack.
  Point the dev app (`npm run dev -- --port 5189`) at
  `http://127.0.0.1:54321` with the anon key `npx supabase status` prints.
- Build defaults: copy `supabase/server/app.env.example` to
  `ProjectManagerApp/.env.local`.

## 9. Moving to hosted Supabase (launch)

1. Create a project on supabase.com (a region near the team). Note the
   **Project URL**, the **anon / publishable key** (Settings → API) and the
   database password.
2. In `ProjectManagerApp/`: `npx supabase login`, `npx supabase link
   --project-ref <ref>`, `npx supabase db push` — the same migrations.
3. Dashboard → Authentication → URL configuration: Site URL = the Pages
   URL. Hosted sends e-mail, so e-mail confirmation can stay on.
4. On the laptop: `./backup.sh …` once more (stop people syncing first:
   `docker compose stop` after the backup).
5. Load the data (connection string: dashboard → Connect → *Session
   pooler*):
   ```bash
   gunzip -c pm-data-<time>.sql.gz > data.sql
   psql --single-transaction -v ON_ERROR_STOP=1 \
     -c 'set session_replication_role = replica' -f data.sql \
     -f supabase/server/after-restore.sql "<connection string>"
   ```
   (not `pm-storage-…`: the next step recreates the file list.)
6. Files: start the laptop again and run `supabase/server/copy-storage.mjs`
   with both servers' **secret** keys in the environment for that one
   command (see the comment at its top). Then stop the laptop.
7. Every device: Settings → Server → the new address and key → Save →
   sign in with the same e-mail and password. Devices pull everything again
   and carry on; nothing queued on a device is lost (it goes out after the
   sign-in).
8. Set `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for the Pages build
   so new devices start on the hosted server.

## 10. Troubleshooting

| Symptom | Check |
|---|---|
| "The server cannot be reached" | The tunnel is running (`tailscale funnel status`); the laptop is awake; `docker compose ps` all healthy |
| "From this page the server must use https" | The address starts with `http://` — use the https tunnel address (§4) |
| "The server refused this key" | Use `ANON_KEY` from `.env` (not `SERVICE_ROLE_KEY`) |
| "The server answers but is not set up for this app" | Run `apply-migrations.sh` (§3) |
| Signed up but "Your account is ready — ask your admin" | The admin invites that e-mail (§5 step 4) |
| Settings → Server shows "N changes the server keeps refusing" | Usually a role that may not do that change; *Try again* after the admin fixes the role, or *Give up on them* (they stay in the device's data and in the history) |
| Studio | `http://localhost:8000` on the laptop, dashboard login from `.env` |

## 11. What is verified, and what needs the laptop

Verified on the development machine (no Docker there):
- every migration, row-level security, the approval rule, the conflict
  rules and `after-restore.sql` — in PGlite (Postgres 18) with a Supabase
  stand-in (`npm run test:db`: pgTAP files + the app's own sync code
  against the schema);
- the sync engine with two simulated devices (`npm test`);
- the sign-in, server, users and account screens in the browser, against
  an unreachable server and a simulated session.

Needs the real server (first run on the laptop): sign-up / sign-in through
Supabase Auth, Realtime live updates, Storage uploads through the gateway,
`apply-migrations.sh` / `backup.sh` / `restore.sh` themselves, the tunnel,
and `seed.sql` with `npx supabase start`.
