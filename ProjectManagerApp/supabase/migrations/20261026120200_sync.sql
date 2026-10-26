-- ─────────────────────────────────────────────────────────────
-- Sync: how items change, how every change is recorded, how devices push
-- their queued changes (with conflict rules) and pull what is new.
--
-- push_changes runs as the caller, so the row-level security of items is
-- the one permission check for both pushes and any direct write. The audit
-- trigger writes the history row of every applied write; the push records
-- the versions that lost a conflict or were refused (outcome 'rejected').
-- Conflict rule (mirrors src/sync/conflict.js): approved beats recorded,
-- otherwise the higher rev wins; on a tie the version already on the
-- server stays.
-- ─────────────────────────────────────────────────────────────

-- ── items: keys, server stamps, cursor ───────────────────────

create or replace function app_private.items_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  if tg_op = 'INSERT' then
    if new.project_id is not null then
      select p.org_id into v_org from public.projects p where p.id = new.project_id;
      if v_org is null then
        raise exception 'pm_no_project';
      end if;
      new.org_id := v_org;
    end if;
    new.recorded_by := case when current_setting('pm.op', true) = 'import' then null else auth.uid() end;
    new.created_at := now();
    new.rev := greatest(coalesce(new.rev, 1), 1);
  else
    if new.org_id <> old.org_id or new.project_id is distinct from old.project_id
       or new.collection <> old.collection or new.item_id <> old.item_id then
      raise exception 'pm_immutable_key';
    end if;
    new.recorded_by := old.recorded_by;
    new.created_at := old.created_at;
    new.rev := greatest(coalesce(new.rev, 0), old.rev + 1);
  end if;
  new.updated_by := auth.uid();
  new.updated_at := now();
  new.txid := pg_current_xact_id();
  new.seq := nextval('app_private.items_seq');
  return new;
end
$$;

-- Approving a formal order needs the approve right and someone other than
-- the person who recorded it. A formal order is never born approved (except
-- when a device's existing data is imported). Changing or deleting an
-- approved formal order also needs the approve right.
create or replace function app_private.items_approval()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_formal boolean;
  v_old_status text;
  v_new_status text;
begin
  if new.collection <> 'pm-orders' or app_private.item_part(new.collection, new.item_id) <> 'orders' then
    return new;
  end if;
  v_new_status := case when new.deleted then null else new.data ->> 'status' end;
  v_old_status := case when tg_op = 'UPDATE' and not old.deleted then old.data ->> 'status' end;
  v_formal := coalesce(new.data ->> 'tier', '') <> 'quick'
              or (tg_op = 'UPDATE' and coalesce(old.data ->> 'tier', '') <> 'quick');
  if not v_formal then
    return new;
  end if;

  if v_new_status = 'approved' and v_old_status is distinct from 'approved' then
    if tg_op = 'INSERT' or old.deleted then
      if coalesce(current_setting('pm.op', true), '') <> 'import' then
        raise exception 'pm_approve_unrecorded';
      end if;
    else
      if not app_private.can(new.org_id, new.project_id, 'orders.approve') then
        raise exception 'pm_not_approver';
      end if;
      if old.recorded_by is not null and old.recorded_by = auth.uid() then
        raise exception 'pm_own_record';
      end if;
    end if;
  elsif tg_op = 'UPDATE' and v_old_status = 'approved'
        and (new.deleted or new.data is distinct from old.data) then
    if not app_private.can(new.org_id, new.project_id, 'orders.approve') then
      raise exception 'pm_not_approver';
    end if;
  end if;
  return new;
end
$$;

-- The history row of every applied write. Context (op, device, client time,
-- restored version, note) comes from the push through transaction-local
-- settings; a direct write gets what can be derived.
create or replace function app_private.items_audit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_op text := nullif(current_setting('pm.op', true), '');
begin
  if new.deleted and (tg_op = 'INSERT' or not old.deleted) then
    v_op := 'delete';
  elsif v_op is null then
    v_op := case when tg_op = 'INSERT' then 'insert' else 'update' end;
  end if;
  insert into public.changes (
    org_id, project_id, collection, item_id, op, before, after, rev, outcome, note,
    actor, actor_name, device_id, client_at, restored_from
  ) values (
    new.org_id, new.project_id, new.collection, new.item_id, v_op,
    case when tg_op = 'UPDATE' and not old.deleted then old.data end,
    case when new.deleted then null else new.data end,
    new.rev, 'applied', coalesce(current_setting('pm.note', true), ''),
    auth.uid(),
    coalesce((select p.name from public.profiles p where p.id = auth.uid()), ''),
    coalesce(current_setting('pm.device_id', true), ''),
    nullif(current_setting('pm.client_at', true), '')::timestamptz,
    nullif(current_setting('pm.restored_from', true), '')::bigint
  );
  return null;
end
$$;

create trigger items_10_stamp before insert or update on public.items
  for each row execute function app_private.items_stamp();
create trigger items_20_approval before insert or update on public.items
  for each row execute function app_private.items_approval();
create trigger items_90_audit after insert or update on public.items
  for each row execute function app_private.items_audit();

-- ── changes: append-only ─────────────────────────────────────

create or replace function app_private.changes_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'pm_changes_append_only';
end
$$;

create trigger changes_no_update before update or delete on public.changes
  for each row execute function app_private.changes_append_only();
create trigger changes_no_truncate before truncate on public.changes
  for each statement execute function app_private.changes_append_only();

-- Stamp who and when on refused / overruled versions people record.
create or replace function app_private.changes_stamp()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.actor := coalesce(auth.uid(), new.actor);
  new.server_at := now();
  if new.actor_name = '' then
    new.actor_name := coalesce((select p.name from public.profiles p where p.id = new.actor), '');
  end if;
  return new;
end
$$;

create trigger changes_stamp before insert on public.changes
  for each row execute function app_private.changes_stamp();

-- ── conflicts ────────────────────────────────────────────────

create or replace function app_private.status_rank(p_data jsonb)
returns integer language sql immutable set search_path = '' as $$
  select case p_data ->> 'status'
    when 'approved' then 2 when 'issued' then 2
    when 'recorded' then 1 when 'draft' then 1
    else 0 end
$$;

-- 'incoming:<why>' or 'current:<why>' (why: status, rev, tie).
create or replace function app_private.pick_winner(
  p_cur_data jsonb, p_cur_deleted boolean, p_cur_rev integer,
  p_in_data jsonb, p_in_deleted boolean, p_in_rev integer
)
returns text language plpgsql immutable set search_path = '' as $$
declare
  v_cur integer;
  v_in integer;
begin
  if not p_cur_deleted and not p_in_deleted then
    v_cur := app_private.status_rank(p_cur_data);
    v_in := app_private.status_rank(p_in_data);
    if v_cur > 0 and v_in > 0 and v_cur <> v_in then
      return case when v_in > v_cur then 'incoming:status' else 'current:status' end;
    end if;
  end if;
  if p_in_rev > p_cur_rev then
    return 'incoming:rev';
  elsif p_in_rev < p_cur_rev then
    return 'current:rev';
  end if;
  return 'current:tie';
end
$$;

-- ── push ─────────────────────────────────────────────────────

create or replace function app_private.try_timestamptz(p_text text)
returns timestamptz language plpgsql stable set search_path = '' as $$
begin
  return nullif(p_text, '')::timestamptz;
exception when others then
  return null;
end
$$;

create or replace function app_private.try_bigint(p_text text)
returns bigint language plpgsql immutable set search_path = '' as $$
begin
  return nullif(p_text, '')::bigint;
exception when others then
  return null;
end
$$;

-- The fields of an item a device needs back.
create or replace function app_private.item_json(p_item public.items)
returns jsonb language sql stable set search_path = '' as $$
  select case when p_item.id is null then null else jsonb_build_object(
    'collection', p_item.collection, 'item_id', p_item.item_id, 'data', p_item.data,
    'pos', p_item.pos, 'rev', p_item.rev, 'deleted', p_item.deleted,
    'recorded_by', p_item.recorded_by, 'updated_by', p_item.updated_by,
    'updated_at', p_item.updated_at, 'txid', p_item.txid::text, 'seq', p_item.seq
  ) end
$$;

-- p_changes: [{ k, org_id, project_id, collection, item_id, op, data,
--   deleted, pos, base_rev, rev, device_id, client_at, restored_from }]
--   op: insert | update | delete | restore | import (a device's existing data)
--   base_rev: the server rev the device edited; rev: the device's own count
-- Returns one result per entry, in order:
--   { k, status: applied | same | rejected | denied | error, code?, message?, item }
--   item = the server's version after this entry (null if none / not visible)
create or replace function public.push_changes(p_changes jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  v_entry jsonb;
  v_results jsonb := '[]'::jsonb;
  v_chain jsonb := '{}'::jsonb;
  v_key text;
  v_org uuid;
  v_project uuid;
  v_collection text;
  v_item text;
  v_op text;
  v_data jsonb;
  v_deleted boolean;
  v_pos double precision;
  v_base integer;
  v_rev integer;
  v_restored bigint;
  v_cur public.items%rowtype;
  v_new public.items%rowtype;
  v_winner text;
  v_status text;
  v_code text;
  v_message text;
begin
  if auth.uid() is null then
    raise exception 'pm_not_signed_in';
  end if;
  if jsonb_typeof(p_changes) <> 'array' or jsonb_array_length(p_changes) > 500 then
    raise exception 'pm_bad_batch';
  end if;

  for v_entry in select value from jsonb_array_elements(p_changes) loop
    v_org := app_private.try_uuid(v_entry ->> 'org_id');
    v_project := app_private.try_uuid(v_entry ->> 'project_id');
    v_collection := coalesce(v_entry ->> 'collection', '');
    v_item := coalesce(v_entry ->> 'item_id', '');
    v_op := coalesce(nullif(v_entry ->> 'op', ''), 'update');
    v_deleted := coalesce((v_entry ->> 'deleted')::boolean, v_op = 'delete');
    v_data := case when jsonb_typeof(v_entry -> 'data') = 'null' then null else v_entry -> 'data' end;
    v_pos := (v_entry ->> 'pos')::double precision;
    v_base := coalesce((v_entry ->> 'base_rev')::integer, 0);
    v_rev := coalesce((v_entry ->> 'rev')::integer, v_base + 1);
    v_status := null;
    v_cur := null;
    v_new := null;

    begin
      if v_project is not null then
        -- visible only to members (row-level security)
        select p.org_id into v_org from public.projects p where p.id = v_project;
        if v_org is null then
          raise exception 'pm_not_member';
        end if;
      end if;
      if v_org is null or v_collection = '' or v_item = '' then
        raise exception 'pm_bad_entry';
      end if;
      if v_op not in ('insert', 'update', 'delete', 'restore', 'import') then
        raise exception 'pm_bad_op';
      end if;
      if v_op = 'import' and not app_private.can(v_org, v_project, 'plan.signOff') then
        raise exception 'pm_import_denied';
      end if;
      if not v_deleted and v_data is null then
        raise exception 'pm_bad_entry';
      end if;

      -- A restore names the history row it brings back (same record).
      v_restored := case when v_op = 'restore' then app_private.try_bigint(v_entry ->> 'restored_from') end;
      if v_op = 'restore' and not exists (
        select 1 from public.changes c
         where c.id = v_restored and c.org_id = v_org and c.project_id is not distinct from v_project
           and c.collection = v_collection and c.item_id = v_item
      ) then
        raise exception 'pm_bad_restore';
      end if;

      v_key := concat_ws('|', v_org, v_project, v_collection, v_item);
      perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
      perform set_config('pm.op', case when v_op in ('import', 'restore') then v_op else '' end, true);
      perform set_config('pm.device_id', left(coalesce(v_entry ->> 'device_id', ''), 100), true);
      perform set_config('pm.client_at', coalesce(app_private.try_timestamptz(v_entry ->> 'client_at')::text, ''), true);
      perform set_config('pm.restored_from', coalesce(v_restored::text, ''), true);
      perform set_config('pm.note', '', true);

      -- A continuation of this device's own write earlier in this batch.
      if v_chain ? v_key and (v_chain -> v_key ->> 'claimed')::integer = v_base then
        v_base := (v_chain -> v_key ->> 'actual')::integer;
      end if;

      select * into v_cur from public.items i
       where i.org_id = v_org and i.project_id is not distinct from v_project
         and i.collection = v_collection and i.item_id = v_item;

      -- The same rule as the row-level security, checked up front so a
      -- version nobody may write is refused (not "lost a conflict"): the
      -- role must be allowed to write the version on the server and the
      -- one sent.
      if not app_private.can_write(v_org, v_project, v_collection, v_item, coalesce(v_data, v_cur.data))
         or (v_cur.id is not null and not app_private.can_write(v_org, v_project, v_collection, v_item, v_cur.data)) then
        raise exception 'pm_not_allowed';
      end if;

      if v_cur.id is null then
        if v_deleted then
          v_status := 'same'; -- the server never had it
        else
          insert into public.items (org_id, project_id, collection, item_id, data, pos, rev, deleted)
          values (v_org, v_project, v_collection, v_item, v_data, v_pos, 1, false)
          returning * into v_new;
          v_status := 'applied';
        end if;
      elsif (v_deleted and v_cur.deleted)
            or (not v_deleted and not v_cur.deleted and v_cur.data = v_data) then
        v_status := 'same';
        v_new := v_cur;
      else
        if v_cur.rev = v_base then
          v_winner := 'incoming:fast-forward';
        else
          v_winner := app_private.pick_winner(v_cur.data, v_cur.deleted, v_cur.rev, v_data, v_deleted, v_rev);
        end if;
        if v_winner like 'incoming:%' then
          if v_winner <> 'incoming:fast-forward' then
            perform set_config('pm.note', 'conflict-won:' || split_part(v_winner, ':', 2), true);
          end if;
          update public.items
             set data = case when v_deleted then data else v_data end,
                 deleted = v_deleted,
                 pos = coalesce(v_pos, pos),
                 rev = v_cur.rev + 1
           where id = v_cur.id
          returning * into v_new;
          if v_new.id is null then
            raise exception 'pm_not_allowed'; -- row-level security left the row alone
          end if;
          v_status := 'applied';
        else
          insert into public.changes (
            org_id, project_id, collection, item_id, op, before, after, rev, outcome, note,
            device_id, client_at, restored_from
          ) values (
            v_org, v_project, v_collection, v_item,
            case when v_op in ('import', 'restore') then v_op when v_deleted then 'delete' else 'update' end,
            case when v_cur.deleted then null else v_cur.data end,
            case when v_deleted then null else v_data end,
            v_rev, 'rejected', 'conflict-lost:' || split_part(v_winner, ':', 2),
            current_setting('pm.device_id', true),
            nullif(current_setting('pm.client_at', true), '')::timestamptz,
            nullif(current_setting('pm.restored_from', true), '')::bigint
          );
          v_status := 'rejected';
          v_new := v_cur;
        end if;
      end if;

      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'k', v_entry -> 'k', 'status', v_status, 'item', app_private.item_json(v_new)
      ));
      if v_status in ('applied', 'same') and v_new.id is not null then
        v_chain := v_chain || jsonb_build_object(v_key, jsonb_build_object('claimed', v_rev, 'actual', v_new.rev));
      else
        v_chain := v_chain - v_key;
      end if;
    exception when others then
      v_code := sqlstate;
      v_message := sqlerrm;
      v_status := case when v_code = '42501' or v_message like 'pm\_%' then 'denied' else 'error' end;
      -- A refused version stays on record (who tried what) when the person
      -- is a member of that scope.
      if v_status = 'denied' and v_org is not null and v_collection <> '' and v_item <> '' then
        begin
          insert into public.changes (
            org_id, project_id, collection, item_id, op, before, after, rev, outcome, note, device_id, client_at
          ) values (
            v_org, v_project, v_collection, v_item,
            case when v_op in ('insert', 'update', 'delete', 'restore', 'import') then v_op else 'update' end,
            null, case when v_deleted then null else v_data end, v_rev, 'rejected',
            'denied:' || left(v_message, 200),
            left(coalesce(v_entry ->> 'device_id', ''), 100),
            app_private.try_timestamptz(v_entry ->> 'client_at')
          );
        exception when others then
          null; -- not a member: nothing to record against
        end;
      end if;
      begin
        select * into v_cur from public.items i
         where i.org_id = v_org and i.project_id is not distinct from v_project
           and i.collection = v_collection and i.item_id = v_item;
      exception when others then
        v_cur := null;
      end;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'k', v_entry -> 'k', 'status', v_status, 'code', v_code, 'message', v_message,
        'item', app_private.item_json(v_cur)
      ));
      v_chain := v_chain - coalesce(v_key, '');
    end;
  end loop;
  return v_results;
end
$$;

-- ── pull ─────────────────────────────────────────────────────

-- Items of one scope (project, or project null = the organization's shared
-- lists) after a cursor (txid, seq), oldest first. Only writes whose
-- transaction is finished are returned, so a write that commits late is
-- never skipped.
create or replace function public.pull_items(
  p_org uuid, p_project uuid, p_after_txid text default '0', p_after_seq bigint default 0, p_limit integer default 500
)
returns table (
  collection text, item_id text, data jsonb, pos double precision, rev integer, deleted boolean,
  recorded_by uuid, updated_by uuid, updated_at timestamptz, txid text, seq bigint
)
language sql stable security invoker set search_path = '' as $$
  select i.collection, i.item_id, i.data, i.pos, i.rev, i.deleted,
         i.recorded_by, i.updated_by, i.updated_at, i.txid::text, i.seq
    from public.items i
   where i.org_id = p_org
     and i.project_id is not distinct from p_project
     and (i.txid, i.seq) > (coalesce(nullif(p_after_txid, ''), '0')::xid8, coalesce(p_after_seq, 0))
     and (i.txid < pg_snapshot_xmin(pg_current_snapshot()) or i.txid = pg_current_xact_id_if_assigned())
   order by i.txid, i.seq
   limit least(greatest(coalesce(p_limit, 500), 1), 1000)
$$;

revoke execute on function public.push_changes(jsonb), public.pull_items(uuid, uuid, text, bigint, integer) from public, anon;
grant execute on function public.push_changes(jsonb), public.pull_items(uuid, uuid, text, bigint, integer) to authenticated;

revoke execute on all functions in schema app_private from public;
grant execute on function app_private.org_role(uuid), app_private.project_role(uuid),
  app_private.role_in(uuid, uuid), app_private.role_can(text, text), app_private.can(uuid, uuid, text),
  app_private.is_member(uuid, uuid), app_private.shares_org(uuid), app_private.try_uuid(text),
  app_private.item_part(text, text), app_private.write_action(text, text, jsonb),
  app_private.can_write(uuid, uuid, text, text, jsonb), app_private.status_rank(jsonb),
  app_private.pick_winner(jsonb, boolean, integer, jsonb, boolean, integer),
  app_private.item_json(public.items), app_private.try_timestamptz(text), app_private.try_bigint(text)
  to authenticated;
