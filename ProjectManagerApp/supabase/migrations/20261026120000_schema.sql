-- ─────────────────────────────────────────────────────────────
-- ProjectManagerApp — the shared database (docs/08-server-setup.md).
--
-- The browser keeps its own copy of every store (offline-first); the server
-- holds the shared truth as items, one row per record, plus an append-only
-- log of every change (who, when, from which device, before → after).
--
--   orgs ─┬─ org_members (user, org role)        shared lists live here:
--         │                                      people, templates, rates
--         └─ projects ─ project_members (user, project role)
--   items    one row per record of a synced store (collection = store key)
--   changes  every applied write + every refused / overruled version
--   invites  e-mail invitations waiting for the person to sign up
--
-- Roles and actions mirror src/utils/permissions.js; the collection rules
-- mirror src/sync/rules.js. src/sync/__tests__/sqlMirror.test.js fails when
-- they drift apart.
-- ─────────────────────────────────────────────────────────────

create schema if not exists app_private;

-- ── the role matrix ────────────────────────────────────────────

create table app_private.roles (
  role text primary key
);

-- BEGIN roles (mirrors ROLES in src/utils/permissions.js)
insert into app_private.roles (role) values
  ('admin'),
  ('pm'),
  ('office'),
  ('site'),
  ('accountant'),
  ('viewer');
-- END roles

create table app_private.role_actions (
  action text not null,
  role text not null references app_private.roles (role),
  primary key (action, role)
);

-- BEGIN role_actions (mirrors ACTIONS in src/utils/permissions.js)
insert into app_private.role_actions (action, role) values
  ('members.manage', 'admin'),
  ('plan.edit', 'admin'),
  ('plan.edit', 'pm'),
  ('plan.edit', 'office'),
  ('plan.lookahead', 'admin'),
  ('plan.lookahead', 'pm'),
  ('plan.lookahead', 'office'),
  ('plan.lookahead', 'site'),
  ('plan.signOff', 'admin'),
  ('plan.signOff', 'pm'),
  ('vo.draft', 'admin'),
  ('vo.draft', 'pm'),
  ('vo.draft', 'office'),
  ('vo.approve', 'admin'),
  ('vo.approve', 'pm'),
  ('record.work', 'admin'),
  ('record.work', 'pm'),
  ('record.work', 'office'),
  ('record.work', 'site'),
  ('orders.approve', 'admin'),
  ('orders.approve', 'pm'),
  ('orders.approve', 'office'),
  ('finance.edit', 'admin'),
  ('finance.edit', 'pm'),
  ('finance.edit', 'site'),
  ('finance.edit', 'accountant'),
  ('certificates.prepare', 'admin'),
  ('certificates.prepare', 'pm'),
  ('certificates.prepare', 'office'),
  ('certificates.prepare', 'accountant'),
  ('certificates.issue', 'admin'),
  ('certificates.issue', 'pm'),
  ('people.edit', 'admin'),
  ('people.edit', 'pm'),
  ('people.edit', 'office'),
  ('files.edit', 'admin'),
  ('files.edit', 'pm'),
  ('files.edit', 'office'),
  ('files.edit', 'site'),
  ('read', 'admin'),
  ('read', 'pm'),
  ('read', 'office'),
  ('read', 'site'),
  ('read', 'accountant'),
  ('read', 'viewer');
-- END role_actions

-- Which action a write to a collection needs. `part` is the list inside the
-- store ('' = the store is the list itself, '$doc' = everything outside the
-- lists; parts of keyed lists — days by date … — are ready for when the
-- store registry declares them). A row with when_field set applies when data->>when_field equals
-- when_value; otherwise the row without a condition applies. `action` may
-- list alternatives separated by '|' (any one is enough).
create table app_private.collection_rules (
  collection text not null,
  scope text not null check (scope in ('project', 'org')),
  part text not null,
  when_field text not null default '',
  when_value text not null default '',
  action text not null,
  primary key (collection, part, when_field, when_value)
);

-- BEGIN collection_rules (mirrors COLLECTION_RULES in src/sync/rules.js)
insert into app_private.collection_rules (collection, scope, part, when_field, when_value, action) values
  ('project-manager-gantt-tasks', 'project', '', '', '', 'plan.edit'),
  ('project-manager-project-meta', 'project', '$doc', '', '', 'plan.signOff'),
  ('project-manager-project-meta', 'project', 'variations', '', '', 'vo.draft'),
  ('project-manager-project-meta', 'project', 'variations', 'status', 'approved', 'vo.approve'),
  ('project-manager-project-meta', 'project', 'planning', '', '', 'plan.edit'),
  ('project-manager-finance-data', 'project', '$doc', '', '', 'finance.edit'),
  ('project-manager-finance-data', 'project', 'machinery', '', '', 'finance.edit'),
  ('project-manager-finance-data', 'project', 'materials', '', '', 'finance.edit'),
  ('project-manager-finance-data', 'project', 'pettyCash', '', '', 'finance.edit'),
  ('project-manager-finance-data', 'project', 'payroll', '', '', 'finance.edit'),
  ('project-manager-finance-config', 'project', '$doc', '', '', 'finance.edit'),
  ('pm-calculator-templates', 'project', '', '', '', 'plan.edit'),
  ('project-manager-daily-reports', 'project', '', '', '', 'record.work'),
  ('pm-orders', 'project', '$doc', '', '', 'record.work|finance.edit'),
  ('pm-orders', 'project', 'orders', '', '', 'record.work'),
  ('pm-orders', 'project', 'orders', 'family', 'expense', 'finance.edit'),
  ('pm-registries', 'org', '$doc', '', '', 'people.edit'),
  ('pm-registries', 'org', 'contractors', '', '', 'people.edit'),
  ('pm-registries', 'org', 'teams', '', '', 'people.edit'),
  ('pm-registries', 'org', 'workers', '', '', 'people.edit'),
  ('pm-plans', 'project', '$doc', '', '', 'plan.lookahead'),
  ('pm-plans', 'project', 'months', '', '', 'plan.edit'),
  ('pm-plans', 'project', 'weeks', '', '', 'plan.lookahead'),
  ('pm-plans', 'project', 'days', '', '', 'plan.lookahead'),
  ('pm-rate-library', 'org', '$doc', '', '', 'plan.edit'),
  ('pm-rate-library', 'org', 'items', '', '', 'plan.edit'),
  ('pm-templates', 'org', '$doc', '', '', 'plan.edit'),
  ('pm-templates', 'org', 'templates', '', '', 'plan.edit'),
  ('pm-work-types', 'org', '$doc', '', '', 'plan.edit'),
  ('pm-work-types', 'org', 'items', '', '', 'plan.edit'),
  ('pm-activity', 'project', '', '', '', 'record.work|finance.edit|certificates.prepare|plan.edit'),
  ('pm-certificates', 'project', '$doc', '', '', 'certificates.prepare'),
  ('pm-certificates', 'project', 'certificates', '', '', 'certificates.prepare'),
  ('pm-certificates', 'project', 'certificates', 'status', 'issued', 'certificates.issue'),
  ('pm-site-diary', 'project', '$doc', '', '', 'record.work'),
  ('pm-site-diary', 'project', 'days', '', '', 'record.work'),
  ('pm-delays', 'project', '$doc', '', '', 'record.work'),
  ('pm-delays', 'project', 'events', '', '', 'record.work'),
  ('files', 'project', '', '', '', 'files.edit');
-- END collection_rules

-- ── people, organizations, projects ───────────────────────────

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null default '',
  name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_email_idx on public.profiles (lower(email));

create table public.org_members (
  org_id uuid not null references public.orgs (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null references app_private.roles (role),
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index org_members_user_idx on public.org_members (user_id);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id),
  name text not null default '',
  contract text not null default '',
  location text not null default '',
  start_date date,
  -- the id the project had on the device that uploaded it
  local_id text,
  archived boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);
create index projects_org_idx on public.projects (org_id);

create table public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null references app_private.roles (role),
  added_by uuid references public.profiles (id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
create index project_members_user_idx on public.project_members (user_id);

-- An invitation by e-mail; claimed (turned into memberships) when that
-- person signs up or signs in. project_id null = the organization only.
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,
  project_id uuid references public.projects (id) on delete cascade,
  email text not null check (email = lower(email) and email <> ''),
  role text not null references app_private.roles (role),
  invited_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_at timestamptz
);
create unique index invites_open_idx on public.invites (org_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), email)
  where claimed_at is null;

-- ── the synced data ──────────────────────────────────────────

-- One row per record. project_id null = an organization-wide store
-- (people, templates, rates). Deleting only sets `deleted` (the last data
-- stays, so it can be restored). `rev` counts the versions; `txid` + `seq`
-- give pulls a cursor that never skips a late-committing write.
create table public.items (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs (id),
  project_id uuid references public.projects (id),
  collection text not null,
  item_id text not null,
  data jsonb,
  pos double precision,
  rev integer not null default 1,
  deleted boolean not null default false,
  -- who first recorded it (null = imported from a device's data)
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  txid xid8 not null default pg_current_xact_id(),
  seq bigint not null default 0,
  unique nulls not distinct (org_id, project_id, collection, item_id)
);
create sequence app_private.items_seq;
create index items_pull_idx on public.items (org_id, project_id, txid, seq);

-- Append-only: rows are only ever inserted (a trigger refuses update and
-- delete, and no policy allows them). outcome 'applied' rows are written by
-- a trigger on items; 'rejected' rows keep a version that lost a conflict or
-- was refused, so nothing a person saved is ever lost.
create table public.changes (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.orgs (id),
  project_id uuid references public.projects (id),
  collection text not null,
  item_id text not null,
  op text not null check (op in ('insert', 'update', 'delete', 'restore', 'import')),
  before jsonb,
  after jsonb,
  rev integer,
  outcome text not null default 'applied' check (outcome in ('applied', 'rejected')),
  note text not null default '',
  actor uuid default auth.uid() references public.profiles (id) on delete set null,
  actor_name text not null default '',
  device_id text not null default '',
  client_at timestamptz,
  server_at timestamptz not null default now(),
  restored_from bigint references public.changes (id)
);
create index changes_item_idx on public.changes (org_id, project_id, collection, item_id, id desc);
create index changes_project_idx on public.changes (project_id, id desc);
create index changes_actor_idx on public.changes (actor, id desc);
