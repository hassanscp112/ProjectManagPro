-- Sync: approvals, pushing with conflicts, the append-only history, pulls.
-- Runs with `npx supabase test db` (pgTAP) and `npm run test:db` (PGlite).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, raw_user_meta_data) values
  ('b0000000-0000-0000-0000-000000000001', 'admin@test.local', '{"name":"Amal Admin"}'),
  ('b0000000-0000-0000-0000-000000000002', 'pm@test.local', '{"name":"Pat PM"}'),
  ('b0000000-0000-0000-0000-000000000003', 'office@test.local', '{"name":"Omar Office"}'),
  ('b0000000-0000-0000-0000-000000000004', 'site@test.local', '{"name":"Sara Site"}');

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;
create temp table res (k text primary key, v jsonb);
grant all on res to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000001"}', true);
insert into ids select 'org', bootstrap_org('Test company');
insert into ids select 'project', (create_project((select v from ids where k = 'org'), 'Canal') ->> 'id')::uuid;
select invite_member(null, (select v from ids where k = 'project'), 'pm@test.local', 'pm');
select invite_member(null, (select v from ids where k = 'project'), 'office@test.local', 'office');
select invite_member(null, (select v from ids where k = 'project'), 'site@test.local', 'site');
reset role;

-- ── approving formal orders ──────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000004"}', true);
insert into public.items (org_id, project_id, collection, item_id, data)
values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-orders', 'orders/o1',
        '{"id":"o1","family":"value","tier":"formal","status":"recorded","quantity":10}');
select is((select recorded_by::text from public.items where item_id = 'orders/o1'), 'b0000000-0000-0000-0000-000000000004', 'the server remembers who recorded it');
select throws_ok($$ update public.items set data = data || '{"status":"approved"}' where item_id = 'orders/o1' $$,
  'P0001', 'pm_not_approver', 'a site engineer cannot approve');
select throws_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-orders', 'orders/o2',
          '{"id":"o2","family":"value","tier":"formal","status":"approved"}') $$,
  'P0001', 'pm_approve_unrecorded', 'a formal order is never born approved');
select lives_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-orders', 'orders/q1',
          '{"id":"q1","family":"value","tier":"quick","status":"approved"}') $$,
  'quick orders are born approved');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000003"}', true);
insert into public.items (org_id, project_id, collection, item_id, data)
values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-orders', 'orders/o3',
        '{"id":"o3","family":"value","tier":"formal","status":"recorded"}');
select throws_ok($$ update public.items set data = data || '{"status":"approved"}' where item_id = 'orders/o3' $$,
  'P0001', 'pm_own_record', 'nobody approves their own order');
select throws_ok($$ update public.items set data = data || '{"status":"approved","tier":"quick"}' where item_id = 'orders/o3' $$,
  'P0001', 'pm_own_record', 'not even by turning it into a quick order');
select lives_ok($$ update public.items set data = data || '{"status":"approved","approvedBy":"Omar"}' where item_id = 'orders/o1' $$,
  'an office engineer approves someone else''s order');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000004"}', true);
select throws_ok($$ update public.items set data = data || '{"quantity":99}' where item_id = 'orders/o1' $$,
  'P0001', 'pm_not_approver', 'an approved formal order is changed only by approvers');
select throws_ok($$ update public.items set deleted = true where item_id = 'orders/o1' $$,
  'P0001', 'pm_not_approver', 'and deleted only by approvers');
reset role;

-- ── the history is append-only ───────────────────────────────

select is((select count(*)::int from public.changes where item_id = 'orders/o1'), 2, 'every applied write is recorded');
select is(
  (select actor_name || ' ' || op || ' ' || coalesce(before ->> 'status', '-') || '>' || (after ->> 'status')
     from public.changes where item_id = 'orders/o1' order by id desc limit 1),
  'Omar Office update recorded>approved', 'with who, what and before → after');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002"}', true);
select throws_ok($$ update public.changes set note = 'edited' $$, '42501', 'permission denied for table changes', 'nobody edits history');
select throws_ok($$ delete from public.changes $$, '42501', 'permission denied for table changes', 'nobody deletes history');
select throws_ok($$ insert into public.changes (org_id, project_id, collection, item_id, op, outcome)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-orders', 'orders/o1', 'update', 'applied') $$,
  '42501', 'new row violates row-level security policy for table "changes"', 'nobody forges an applied change');
reset role;
select throws_ok($$ delete from public.changes $$, 'P0001', 'pm_changes_append_only', 'not even the database owner');

-- ── pushing queued changes ───────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000003"}', true);
insert into res select 'p1', push_changes(jsonb_build_array(
  jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'), 'collection', 'project-manager-gantt-tasks',
    'item_id', 't1', 'op', 'insert', 'data', '{"id":"t1","name":"Dig","quantity":5}'::jsonb, 'pos', 0, 'base_rev', 0, 'rev', 1,
    'device_id', 'dev-office', 'client_at', '2026-10-26T08:00:00Z'),
  jsonb_build_object('k', 2, 'project_id', (select v from ids where k = 'project'), 'collection', 'project-manager-gantt-tasks',
    'item_id', 't1', 'op', 'update', 'data', '{"id":"t1","name":"Dig","quantity":6}'::jsonb, 'base_rev', 1, 'rev', 2,
    'device_id', 'dev-office', 'client_at', '2026-10-26T08:01:00Z')
));
select is((select v -> 0 ->> 'status' || ',' || (v -> 1 ->> 'status') from res where k = 'p1'), 'applied,applied', 'a device pushes an insert and an edit');
select is((select (v -> 1 -> 'item' ->> 'rev')::int from res where k = 'p1'), 2, 'each version raises rev');
select is((select device_id || ' ' || client_at::text from public.changes where item_id = 't1' order by id desc limit 1),
  'dev-office 2026-10-26 08:01:00+00', 'the history keeps the device and the time it was made');
reset role;

-- Another device edited the same task from rev 1: tie on rev → the server keeps its version.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002"}', true);
insert into res select 'p2', push_changes(jsonb_build_array(
  jsonb_build_object('k', 'a', 'project_id', (select v from ids where k = 'project'), 'collection', 'project-manager-gantt-tasks',
    'item_id', 't1', 'op', 'update', 'data', '{"id":"t1","name":"Dig deeper","quantity":5}'::jsonb, 'base_rev', 1, 'rev', 2,
    'device_id', 'dev-pm')
));
select is((select v -> 0 ->> 'status' from res where k = 'p2'), 'rejected', 'a stale edit loses to the version already on the server');
select is((select v -> 0 -> 'item' -> 'data' ->> 'quantity' from res where k = 'p2'), '6', 'the device gets the winning version back');
select is((select outcome || ' ' || note || ' ' || (after ->> 'name') from public.changes where item_id = 't1' order by id desc limit 1),
  'rejected conflict-lost:tie Dig deeper', 'the losing version is kept in the history');

-- The same device worked longer offline (higher rev): it wins.
insert into res select 'p3', push_changes(jsonb_build_array(
  jsonb_build_object('k', 'b', 'project_id', (select v from ids where k = 'project'), 'collection', 'project-manager-gantt-tasks',
    'item_id', 't1', 'op', 'update', 'data', '{"id":"t1","name":"Dig 3","quantity":5}'::jsonb, 'base_rev', 1, 'rev', 4)
));
select is((select v -> 0 ->> 'status' || ' ' || (v -> 0 -> 'item' ->> 'rev') from res where k = 'p3'), 'applied 3', 'otherwise the higher rev wins');
select is((select note from public.changes where item_id = 't1' and outcome = 'applied' order by id desc limit 1), 'conflict-won:rev', 'and the history says why');
reset role;

-- Approved beats recorded, whatever the revs.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000004"}', true);
insert into res select 'p4', push_changes(jsonb_build_array(
  jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'), 'collection', 'pm-orders', 'item_id', 'orders/o9',
    'op', 'insert', 'data', '{"id":"o9","family":"value","tier":"formal","status":"recorded","quantity":4}'::jsonb, 'base_rev', 0, 'rev', 1),
  jsonb_build_object('k', 2, 'project_id', (select v from ids where k = 'project'), 'collection', 'pm-orders', 'item_id', 'orders/o9',
    'op', 'update', 'data', '{"id":"o9","family":"value","tier":"formal","status":"recorded","quantity":5}'::jsonb, 'base_rev', 1, 'rev', 2)
));
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000002"}', true);
-- the PM approved the first version (rev 1) while offline
insert into res select 'p5', push_changes(jsonb_build_array(
  jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'), 'collection', 'pm-orders', 'item_id', 'orders/o9',
    'op', 'update', 'data', '{"id":"o9","family":"value","tier":"formal","status":"approved","quantity":4}'::jsonb, 'base_rev', 1, 'rev', 2)
));
select is((select v -> 0 ->> 'status' || ' ' || (v -> 0 -> 'item' -> 'data' ->> 'status') from res where k = 'p5'), 'applied approved', 'an approval beats a newer recorded edit');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000004"}', true);
insert into res select 'p6', push_changes(jsonb_build_array(
  jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'), 'collection', 'pm-orders', 'item_id', 'orders/o9',
    'op', 'update', 'data', '{"id":"o9","family":"value","tier":"formal","status":"recorded","quantity":7}'::jsonb, 'base_rev', 2, 'rev', 9)
));
select is((select v -> 0 ->> 'status' from res where k = 'p6'), 'rejected', 'and a recorded edit never overrules an approval');

-- Refused writes come back as denied and stay on record.
insert into res select 'p7', push_changes(jsonb_build_array(
  jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'), 'collection', 'project-manager-gantt-tasks',
    'item_id', 't2', 'op', 'insert', 'data', '{"id":"t2"}'::jsonb, 'base_rev', 0, 'rev', 1),
  jsonb_build_object('k', 2, 'project_id', (select v from ids where k = 'project'), 'collection', 'project-manager-daily-reports',
    'item_id', 'n1', 'op', 'insert', 'data', '{"id":"n1"}'::jsonb, 'base_rev', 0, 'rev', 1)
));
select is((select v -> 0 ->> 'status' || ',' || (v -> 1 ->> 'status') from res where k = 'p7'), 'denied,applied', 'one refused entry does not stop the batch');
select is((select outcome || ' ' || left(note, 7) from public.changes where item_id = 't2'), 'rejected denied:', 'the refused attempt is on record');
select is((select v -> 0 ->> 'status' from (select push_changes(jsonb_build_array(jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'),
  'collection', 'project-manager-gantt-tasks', 'item_id', 't1', 'op', 'update', 'data', '{"id":"t1","name":"x"}'::jsonb, 'base_rev', 0, 'rev', 99))) as v) x),
  'denied', 'a stale edit without the right is refused, not merely outvoted');
select is((select v -> 0 ->> 'status' from (select push_changes(jsonb_build_array(jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'),
  'collection', 'pm-orders', 'item_id', 'orders/o9', 'op', 'import', 'data', '{"id":"o9"}'::jsonb))) as v) x), 'denied', 'only admins and project managers import');
reset role;

-- Deleting keeps the data; restoring brings back a version as a new change.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000003"}', true);
insert into res select 'p8', push_changes(jsonb_build_array(
  jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'), 'collection', 'project-manager-gantt-tasks',
    'item_id', 't1', 'op', 'delete', 'base_rev', 3, 'rev', 4)
));
select is((select deleted::text || ' ' || (data ->> 'name') from public.items where item_id = 't1'), 'true Dig 3', 'a delete keeps the last data');
insert into res select 'p9', push_changes(jsonb_build_array(
  jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'), 'collection', 'project-manager-gantt-tasks',
    'item_id', 't1', 'op', 'restore', 'data', '{"id":"t1","name":"Dig","quantity":6}'::jsonb, 'base_rev', 4, 'rev', 5,
    'restored_from', (select id from public.changes where item_id = 't1' and outcome = 'applied' and after ->> 'quantity' = '6' limit 1))
));
select is((select v -> 0 ->> 'status' from res where k = 'p9'), 'applied', 'restoring a version is a new change');
select is((select op || ' ' || (restored_from is not null)::text from public.changes where item_id = 't1' order by id desc limit 1), 'restore true', 'which names the version it restored');
select is((select deleted::text || ' ' || (data ->> 'quantity') from public.items where item_id = 't1'), 'false 6', 'and the record is back');
-- insert, update, conflict lost, conflict won, refused attempt, delete, restore
select is((select count(*)::int from public.changes where item_id = 't1'), 7, 'nothing in the history was rewritten');
select is((select v -> 0 ->> 'status' from (select push_changes(jsonb_build_array(jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'),
  'collection', 'project-manager-gantt-tasks', 'item_id', 't1', 'op', 'restore', 'data', '{"id":"t1"}'::jsonb, 'base_rev', 5, 'rev', 6, 'restored_from', 999999))) as v) x),
  'denied', 'a restore must name a version of the same record');
reset role;

-- An admin uploads a device's existing data: approved formal orders included.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000001"}', true);
insert into res select 'p10', push_changes(jsonb_build_array(
  jsonb_build_object('k', 1, 'project_id', (select v from ids where k = 'project'), 'collection', 'pm-orders', 'item_id', 'orders/old1',
    'op', 'import', 'data', '{"id":"old1","family":"value","tier":"formal","status":"approved"}'::jsonb, 'base_rev', 0, 'rev', 1)
));
select is((select v -> 0 ->> 'status' from res where k = 'p10'), 'applied', 'importing keeps approved history');
select is((select coalesce(recorded_by::text, 'unknown') from public.items where item_id = 'orders/old1'), 'unknown', 'with no recorder (anyone may approve it later)');
select is((select op from public.changes where item_id = 'orders/old1'), 'import', 'and is recorded as an import');
reset role;

-- ── pulling ──────────────────────────────────────────────────

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"b0000000-0000-0000-0000-000000000004"}', true);
select is((select count(*)::int from pull_items((select v from ids where k = 'org'), (select v from ids where k = 'project'))), 7, 'a pull returns every item of the project');
select is(
  (select count(*)::int from pull_items((select v from ids where k = 'org'), (select v from ids where k = 'project'),
     (select txid from pull_items((select v from ids where k = 'org'), (select v from ids where k = 'project')) order by txid desc, seq desc limit 1),
     (select seq from pull_items((select v from ids where k = 'org'), (select v from ids where k = 'project')) order by txid desc, seq desc limit 1))),
  0, 'and nothing after its cursor');
select is((select count(*)::int from pull_items((select v from ids where k = 'org'), null)), 0, 'the organization scope is separate');
reset role;

select * from finish();
rollback;
