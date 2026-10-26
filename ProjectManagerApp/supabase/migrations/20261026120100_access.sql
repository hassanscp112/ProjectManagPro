-- ─────────────────────────────────────────────────────────────
-- Who may see and do what: role helpers, row-level security on every
-- table, and the membership functions (organization, invitations, roles).
--
-- Roles are per project (project_members.role). The organization role
-- (org_members.role) governs the shared lists (people, templates, rates) and
-- creating projects; an organization admin is admin in every project.
-- Membership tables change only through the functions below.
-- ─────────────────────────────────────────────────────────────

-- ── role helpers (used by the policies) ───────────────────────

create or replace function app_private.org_role(p_org uuid)
returns text language sql stable security definer set search_path = '' as $$
  select m.role from public.org_members m where m.org_id = p_org and m.user_id = auth.uid()
$$;

create or replace function app_private.project_role(p_project uuid)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select m.role from public.project_members m where m.project_id = p_project and m.user_id = auth.uid()),
    (select 'admin' from public.projects p
       join public.org_members o on o.org_id = p.org_id
      where p.id = p_project and o.user_id = auth.uid() and o.role = 'admin')
  )
$$;

-- The role in a scope: a project, or (project null) the organization.
create or replace function app_private.role_in(p_org uuid, p_project uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case when p_project is null then app_private.org_role(p_org) else app_private.project_role(p_project) end
$$;

-- p_actions: one action, or alternatives separated by '|'.
create or replace function app_private.role_can(p_role text, p_actions text)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_role is not null and exists (
    select 1 from app_private.role_actions ra
     where ra.role = p_role and ra.action = any (string_to_array(p_actions, '|'))
  )
$$;

create or replace function app_private.can(p_org uuid, p_project uuid, p_actions text)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.role_can(app_private.role_in(p_org, p_project), p_actions)
$$;

create or replace function app_private.is_member(p_org uuid, p_project uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app_private.role_in(p_org, p_project) is not null
$$;

create or replace function app_private.shares_org(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.org_members a
      join public.org_members b on b.org_id = a.org_id
     where a.user_id = auth.uid() and b.user_id = p_user
  )
$$;

create or replace function app_private.try_uuid(p_text text)
returns uuid language plpgsql immutable set search_path = '' as $$
begin
  return p_text::uuid;
exception when others then
  return null;
end
$$;

-- The list a record belongs to: '$doc', a list path, or '' (the store is
-- the list itself). Item ids are '<path>/<record id>' for stores with
-- named lists (src/sync/itemDiff.js).
create or replace function app_private.item_part(p_collection text, p_item_id text)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when p_item_id = '$doc' then '$doc'
    when position('/' in p_item_id) > 0 and exists (
      select 1 from app_private.collection_rules r
       where r.collection = p_collection and r.part = split_part(p_item_id, '/', 1)
    ) then split_part(p_item_id, '/', 1)
    else ''
  end
$$;

-- The action(s) writing this version of a record needs; null = unknown.
create or replace function app_private.write_action(p_collection text, p_item_id text, p_data jsonb)
returns text language sql stable security definer set search_path = '' as $$
  select r.action from app_private.collection_rules r
   where r.collection = p_collection
     and r.part = app_private.item_part(p_collection, p_item_id)
     and (r.when_field = '' or (p_data ->> r.when_field) = r.when_value)
   order by (r.when_field <> '') desc
   limit 1
$$;

create or replace function app_private.can_write(p_org uuid, p_project uuid, p_collection text, p_item_id text, p_data jsonb)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select r.scope from app_private.collection_rules r where r.collection = p_collection limit 1)
      = case when p_project is null then 'org' else 'project' end
    and app_private.can(p_org, p_project, app_private.write_action(p_collection, p_item_id, p_data)),
    false
  )
$$;

-- ── row-level security ───────────────────────────────────────

alter table public.orgs enable row level security;
alter table public.profiles enable row level security;
alter table public.org_members enable row level security;
alter table public.projects enable row level security;
alter table public.project_members enable row level security;
alter table public.invites enable row level security;
alter table public.items enable row level security;
alter table public.changes enable row level security;

create policy orgs_read on public.orgs
  for select to authenticated using (app_private.org_role(id) is not null);

create policy profiles_read on public.profiles
  for select to authenticated using (id = auth.uid() or app_private.shares_org(id));
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy org_members_read on public.org_members
  for select to authenticated using (app_private.org_role(org_id) is not null);

create policy projects_read on public.projects
  for select to authenticated using (app_private.project_role(id) is not null);
create policy projects_update on public.projects
  for update to authenticated
  using (app_private.can(org_id, id, 'plan.signOff'))
  with check (app_private.can(org_id, id, 'plan.signOff'));

create policy project_members_read on public.project_members
  for select to authenticated using (app_private.project_role(project_id) is not null);

create policy invites_read on public.invites
  for select to authenticated using (app_private.can(org_id, project_id, 'members.manage'));

-- Members read; writes need the collection's action for the version before
-- (USING) and after (WITH CHECK). Nothing is ever deleted (only `deleted`).
create policy items_read on public.items
  for select to authenticated using (app_private.is_member(org_id, project_id));
create policy items_insert on public.items
  for insert to authenticated
  with check (app_private.can_write(org_id, project_id, collection, item_id, data));
create policy items_update on public.items
  for update to authenticated
  using (app_private.can_write(org_id, project_id, collection, item_id, data))
  with check (app_private.can_write(org_id, project_id, collection, item_id, data));

-- Members read the history. People may only add their own refused /
-- overruled versions; applied rows come from the items trigger.
create policy changes_read on public.changes
  for select to authenticated using (app_private.is_member(org_id, project_id));
create policy changes_insert_rejected on public.changes
  for insert to authenticated
  with check (actor = auth.uid() and outcome = 'rejected' and app_private.is_member(org_id, project_id));

-- ── privileges (explicit, so the schema is the same on any Postgres) ──

revoke all on public.orgs, public.profiles, public.org_members, public.projects,
  public.project_members, public.invites, public.items, public.changes from anon, public;
revoke all on public.orgs, public.profiles, public.org_members, public.projects,
  public.project_members, public.invites, public.items, public.changes from authenticated;

grant select on public.orgs, public.profiles, public.org_members, public.projects,
  public.project_members, public.invites, public.items, public.changes to authenticated;
grant update (name) on public.profiles to authenticated;
grant update (name, contract, location, start_date, archived) on public.projects to authenticated;
grant insert, update on public.items to authenticated;
grant insert on public.changes to authenticated;

-- ── housekeeping triggers ────────────────────────────────────

create or replace function app_private.touch_updated()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_table_name = 'projects' then
    new.updated_by := auth.uid();
  end if;
  return new;
end
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function app_private.touch_updated();
create trigger projects_touch before update on public.projects
  for each row execute function app_private.touch_updated();

-- ── membership ───────────────────────────────────────────────

-- Turn open invitations for this e-mail into memberships. Returns how many.
create or replace function app_private.claim_invites_for(p_user uuid, p_email text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites%rowtype;
  v_count integer := 0;
begin
  for v_invite in
    select * from public.invites
     where email = lower(trim(p_email)) and claimed_at is null
     order by created_at
     for update
  loop
    insert into public.org_members (org_id, user_id, role, added_by)
    values (v_invite.org_id, p_user, v_invite.role, v_invite.invited_by)
    on conflict (org_id, user_id) do update
      set role = case when v_invite.project_id is null then excluded.role else public.org_members.role end;
    if v_invite.project_id is not null then
      insert into public.project_members (project_id, user_id, role, added_by)
      values (v_invite.project_id, p_user, v_invite.role, v_invite.invited_by)
      on conflict (project_id, user_id) do update set role = excluded.role;
    end if;
    update public.invites set claimed_by = p_user, claimed_at = now() where id = v_invite.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end
$$;

-- Every new account gets a profile (name from the sign-up form) and the
-- invitations waiting for its e-mail.
create or replace function app_private.on_auth_user_created()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;
  if coalesce(new.email, '') <> '' then
    perform app_private.claim_invites_for(new.id, new.email);
  end if;
  return new;
end
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app_private.on_auth_user_created();

create or replace function app_private.on_auth_user_email()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end
$$;

create trigger on_auth_user_email after update of email on auth.users
  for each row execute function app_private.on_auth_user_email();

-- The caller's profile (created on the spot for accounts made before this schema).
create or replace function app_private.ensure_profile()
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'pm_not_signed_in';
  end if;
  insert into public.profiles (id, email, name)
  select u.id, lower(coalesce(u.email, '')), split_part(coalesce(u.email, ''), '@', 1)
    from auth.users u where u.id = v_uid
  on conflict (id) do nothing;
  return v_uid;
end
$$;

-- What a sign-in screen may know before anyone has an account.
create or replace function public.server_info()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('app', 'projectmanager', 'schema', 1, 'has_org', exists (select 1 from public.orgs))
$$;

-- The first account on a new server creates the organization and becomes
-- its admin. Refused once an organization exists.
create or replace function public.bootstrap_org(p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app_private.ensure_profile();
  v_org uuid;
begin
  lock table public.orgs in exclusive mode;
  if exists (select 1 from public.orgs) then
    raise exception 'pm_org_exists';
  end if;
  insert into public.orgs (name, created_by) values (coalesce(nullif(trim(p_name), ''), 'Organization'), v_uid)
  returning id into v_org;
  insert into public.org_members (org_id, user_id, role, added_by) values (v_org, v_uid, 'admin', v_uid);
  return v_org;
end
$$;

-- Everything the app needs after signing in: profile, organizations with
-- the caller's role, and every project the caller may open with the role.
create or replace function public.my_access()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user', (select jsonb_build_object('id', p.id, 'email', p.email, 'name', p.name)
               from public.profiles p where p.id = auth.uid()),
    'has_org', exists (select 1 from public.orgs),
    'orgs', coalesce((
      select jsonb_agg(jsonb_build_object('id', o.id, 'name', o.name, 'role', m.role) order by o.created_at)
        from public.org_members m join public.orgs o on o.id = m.org_id
       where m.user_id = auth.uid()), '[]'::jsonb),
    'projects', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id, 'org_id', p.org_id, 'name', p.name, 'contract', p.contract,
               'location', p.location, 'start_date', p.start_date, 'local_id', p.local_id,
               'archived', p.archived, 'created_at', p.created_at, 'updated_at', p.updated_at,
               'role', app_private.project_role(p.id)) order by p.created_at)
        from public.projects p
       where app_private.project_role(p.id) is not null), '[]'::jsonb)
  )
$$;

create or replace function public.claim_invites()
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app_private.ensure_profile();
begin
  return app_private.claim_invites_for(v_uid, (select u.email from auth.users u where u.id = v_uid));
end
$$;

-- A new project in an organization (sign-off right there: admin, pm). The
-- creator becomes a member with their organization role.
create or replace function public.create_project(
  p_org uuid, p_name text, p_contract text default '', p_location text default '',
  p_start_date date default null, p_local_id text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app_private.ensure_profile();
  v_role text := app_private.org_role(p_org);
  v_project public.projects%rowtype;
begin
  if not app_private.role_can(v_role, 'plan.signOff') then
    raise exception 'pm_cannot_create_project';
  end if;
  insert into public.projects (org_id, name, contract, location, start_date, local_id, created_by, updated_by)
  values (p_org, coalesce(p_name, ''), coalesce(p_contract, ''), coalesce(p_location, ''), p_start_date, p_local_id, v_uid, v_uid)
  returning * into v_project;
  insert into public.project_members (project_id, user_id, role, added_by) values (v_project.id, v_uid, v_role, v_uid);
  return to_jsonb(v_project) || jsonb_build_object('role', app_private.project_role(v_project.id));
end
$$;

-- Add a person by e-mail to a project (or, project null, the organization).
-- Someone who has an account is added at once ('added'); otherwise an
-- invitation waits for them to sign up ('invited').
create or replace function public.invite_member(p_org uuid, p_project uuid, p_email text, p_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app_private.ensure_profile();
  v_org uuid := p_org;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_user uuid;
begin
  if not exists (select 1 from app_private.roles r where r.role = p_role) then
    raise exception 'pm_bad_role';
  end if;
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'pm_bad_email';
  end if;
  if p_project is not null then
    select p.org_id into v_org from public.projects p where p.id = p_project;
  end if;
  if v_org is null or not app_private.can(v_org, p_project, 'members.manage') then
    raise exception 'pm_not_allowed';
  end if;

  select pr.id into v_user from public.profiles pr where lower(pr.email) = v_email limit 1;
  if v_user is null then
    insert into public.invites (org_id, project_id, email, role, invited_by)
    values (v_org, p_project, v_email, p_role, v_uid)
    on conflict (org_id, coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid), email)
      where claimed_at is null
      do update set role = excluded.role, invited_by = excluded.invited_by, created_at = now();
    return jsonb_build_object('status', 'invited', 'email', v_email);
  end if;

  insert into public.org_members (org_id, user_id, role, added_by)
  values (v_org, v_user, p_role, v_uid)
  on conflict (org_id, user_id) do update
    set role = case when p_project is null then excluded.role else public.org_members.role end;
  if p_project is not null then
    insert into public.project_members (project_id, user_id, role, added_by)
    values (p_project, v_user, p_role, v_uid)
    on conflict (project_id, user_id) do update set role = excluded.role;
  end if;
  return jsonb_build_object('status', 'added', 'email', v_email, 'user_id', v_user);
end
$$;

create or replace function public.set_member_role(p_project uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := (select p.org_id from public.projects p where p.id = p_project);
begin
  if not exists (select 1 from app_private.roles r where r.role = p_role) then
    raise exception 'pm_bad_role';
  end if;
  if v_org is null or not app_private.can(v_org, p_project, 'members.manage') then
    raise exception 'pm_not_allowed';
  end if;
  update public.project_members set role = p_role where project_id = p_project and user_id = p_user;
  if not found then
    raise exception 'pm_not_member';
  end if;
end
$$;

create or replace function public.remove_member(p_project uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid := (select p.org_id from public.projects p where p.id = p_project);
begin
  if v_org is null or not app_private.can(v_org, p_project, 'members.manage') then
    raise exception 'pm_not_allowed';
  end if;
  delete from public.project_members where project_id = p_project and user_id = p_user;
end
$$;

create or replace function app_private.assert_other_admin(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.org_members m where m.org_id = p_org and m.role = 'admin' and m.user_id <> p_user
  ) then
    raise exception 'pm_last_admin';
  end if;
end
$$;

-- The organization role (shared lists, creating projects). Organization admins only.
create or replace function public.set_org_role(p_org uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from app_private.roles r where r.role = p_role) then
    raise exception 'pm_bad_role';
  end if;
  if not app_private.role_can(app_private.org_role(p_org), 'members.manage') then
    raise exception 'pm_not_allowed';
  end if;
  if p_role <> 'admin' then
    perform app_private.assert_other_admin(p_org, p_user);
  end if;
  update public.org_members set role = p_role where org_id = p_org and user_id = p_user;
  if not found then
    raise exception 'pm_not_member';
  end if;
end
$$;

-- Remove someone from the organization and all of its projects.
create or replace function public.remove_org_member(p_org uuid, p_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not app_private.role_can(app_private.org_role(p_org), 'members.manage') then
    raise exception 'pm_not_allowed';
  end if;
  perform app_private.assert_other_admin(p_org, p_user);
  delete from public.project_members pm
   using public.projects p
   where p.id = pm.project_id and p.org_id = p_org and pm.user_id = p_user;
  delete from public.org_members where org_id = p_org and user_id = p_user;
end
$$;

create or replace function public.cancel_invite(p_invite uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_invite public.invites%rowtype;
begin
  select * into v_invite from public.invites where id = p_invite;
  if not found then
    return;
  end if;
  if not app_private.can(v_invite.org_id, v_invite.project_id, 'members.manage') then
    raise exception 'pm_not_allowed';
  end if;
  delete from public.invites where id = p_invite and claimed_at is null;
end
$$;

revoke execute on function public.server_info(), public.bootstrap_org(text), public.my_access(),
  public.claim_invites(), public.create_project(uuid, text, text, text, date, text),
  public.invite_member(uuid, uuid, text, text), public.set_member_role(uuid, uuid, text),
  public.remove_member(uuid, uuid), public.set_org_role(uuid, uuid, text),
  public.remove_org_member(uuid, uuid), public.cancel_invite(uuid) from public, anon;
grant execute on function public.server_info() to anon, authenticated;
grant execute on function public.bootstrap_org(text), public.my_access(), public.claim_invites(),
  public.create_project(uuid, text, text, text, date, text), public.invite_member(uuid, uuid, text, text),
  public.set_member_role(uuid, uuid, text), public.remove_member(uuid, uuid),
  public.set_org_role(uuid, uuid, text), public.remove_org_member(uuid, uuid),
  public.cancel_invite(uuid) to authenticated;

-- app_private is not reachable through the API. Policies run as the
-- signed-in user, so they need the helpers; everything else there (trigger
-- functions, invite claiming) is closed to callers.
revoke execute on all functions in schema app_private from public;
grant usage on schema app_private to authenticated;
grant execute on function app_private.org_role(uuid), app_private.project_role(uuid),
  app_private.role_in(uuid, uuid), app_private.role_can(text, text), app_private.can(uuid, uuid, text),
  app_private.is_member(uuid, uuid), app_private.shares_org(uuid), app_private.try_uuid(text),
  app_private.item_part(text, text), app_private.write_action(text, text, jsonb),
  app_private.can_write(uuid, uuid, text, text, jsonb) to authenticated;
