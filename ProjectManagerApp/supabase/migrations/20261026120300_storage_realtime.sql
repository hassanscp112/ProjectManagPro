-- ─────────────────────────────────────────────────────────────
-- Files and live updates.
--
-- Storage bucket `files`, objects named '<project id>/<file id>' (the
-- FileDB id). Members of the project read; roles with files.edit add.
-- Objects are never replaced or removed by the app (a deleted file only
-- marks its `files` item deleted), so there are no update/delete policies.
--
-- Realtime: devices subscribe to `items` and pull when something changes
-- (Realtime checks the same read policy before it sends an event).
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('files', 'files', false)
on conflict (id) do nothing;

create policy pm_files_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'files'
    and app_private.project_role(app_private.try_uuid(split_part(name, '/', 1))) is not null
  );

create policy pm_files_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'files'
    and app_private.role_can(app_private.project_role(app_private.try_uuid(split_part(name, '/', 1))), 'files.edit')
  );

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.items;
  end if;
end
$$;
