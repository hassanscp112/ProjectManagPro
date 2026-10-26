-- Membership and row-level security: who can see and write what.
-- Runs with `npx supabase test db` (pgTAP) and `npm run test:db` (PGlite).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- People: one per role, someone outside the organization, and someone
-- invited before they had an account.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000001', 'admin@test.local', '{"name":"Amal Admin"}'),
  ('a0000000-0000-0000-0000-000000000002', 'pm@test.local', '{"name":"Pat PM"}'),
  ('a0000000-0000-0000-0000-000000000003', 'office@test.local', '{"name":"Omar Office"}'),
  ('a0000000-0000-0000-0000-000000000004', 'site@test.local', '{"name":"Sara Site"}'),
  ('a0000000-0000-0000-0000-000000000005', 'acct@test.local', '{"name":"Ali Accounts"}'),
  ('a0000000-0000-0000-0000-000000000006', 'viewer@test.local', '{"name":"Vera Viewer"}'),
  ('a0000000-0000-0000-0000-000000000007', 'outsider@test.local', '{"name":"Otto Outsider"}');

create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

select is((select count(*)::int from public.profiles), 7, 'every new account gets a profile');
select is((select name from public.profiles where email = 'site@test.local'), 'Sara Site', 'the profile takes the sign-up name');
select is((select (server_info() ->> 'has_org')::boolean), false, 'a new server has no organization');

-- The first admin sets up the organization and a project.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001"}', true);
insert into ids select 'org', bootstrap_org('Test company');
select ok((select v from ids where k = 'org') is not null, 'the first account creates the organization');
select throws_ok($$ select bootstrap_org('Second') $$, 'P0001', 'pm_org_exists', 'a second organization is refused');
insert into ids select 'project', (create_project((select v from ids where k = 'org'), 'Canal', 'Contract 5', '', '2026-01-01', 'p-local-1') ->> 'id')::uuid;
select ok((select v from ids where k = 'project') is not null, 'an admin creates a project');
select is((select invite_member(null, (select v from ids where k = 'project'), 'PM@test.local', 'pm') ->> 'status'), 'added', 'an existing account is added at once');
select invite_member(null, (select v from ids where k = 'project'), 'office@test.local', 'office');
select invite_member(null, (select v from ids where k = 'project'), 'site@test.local', 'site');
select invite_member(null, (select v from ids where k = 'project'), 'acct@test.local', 'accountant');
select invite_member(null, (select v from ids where k = 'project'), 'viewer@test.local', 'viewer');
select is((select invite_member(null, (select v from ids where k = 'project'), 'late@test.local', 'site') ->> 'status'), 'invited', 'an unknown e-mail gets an invitation');
select throws_ok($$ select invite_member(null, (select v from ids where k = 'project'), 'x@test.local', 'boss') $$, 'P0001', 'pm_bad_role', 'unknown roles are refused');
select is((select count(*)::int from public.invites where claimed_at is null), 1, 'the admin sees the open invitation');
reset role;

-- The invited person signs up later: the invitation becomes a membership.
insert into auth.users (id, email, raw_user_meta_data) values
  ('a0000000-0000-0000-0000-000000000008', 'late@test.local', '{"name":"Lina Late"}');
select is((select role from public.project_members where user_id = 'a0000000-0000-0000-0000-000000000008'), 'site', 'signing up claims the invitation');
select is((select role from public.org_members where user_id = 'a0000000-0000-0000-0000-000000000008'), 'site', 'and joins the organization');

-- Only admins manage members.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002"}', true);
select throws_ok($$ select invite_member(null, (select v from ids where k = 'project'), 'y@test.local', 'site') $$, 'P0001', 'pm_not_allowed', 'a project manager cannot invite');
select throws_ok($$ select set_member_role((select v from ids where k = 'project'), 'a0000000-0000-0000-0000-000000000004', 'admin') $$, 'P0001', 'pm_not_allowed', 'nor change roles');
select is((select count(*)::int from public.invites), 0, 'non-admins do not see invitations');
select is((select count(*)::int from public.project_members), 7, 'members see who else is in the project');
select is((select my_access() -> 'projects' -> 0 ->> 'role'), 'pm', 'my_access returns the role per project');
reset role;

-- Members read the project; outsiders see nothing.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007"}', true);
select is((select count(*)::int from public.projects), 0, 'an outsider sees no project');
select is((select count(*)::int from public.profiles), 1, 'an outsider sees only their own profile');
select is((select jsonb_array_length(my_access() -> 'projects')), 0, 'an outsider has no access');
reset role;

-- Writes per role, by collection.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004"}', true);
select throws_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'project-manager-gantt-tasks', 't1', '{"id":"t1","name":"Dig"}') $$,
  '42501', 'new row violates row-level security policy for table "items"', 'a site engineer cannot edit the plan');
select lives_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-orders', 'orders/o1', '{"id":"o1","family":"value","tier":"formal","status":"recorded"}') $$,
  'a site engineer records work');
select lives_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'project-manager-daily-reports', 'n1', '{"id":"n1"}') $$,
  'and writes site notes');
select throws_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), null, 'pm-registries', 'workers/w1', '{"id":"w1"}') $$,
  '42501', 'new row violates row-level security policy for table "items"', 'a site engineer cannot edit the shared people lists');
select is((select count(*)::int from public.items), 2, 'members read the project items');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000003"}', true);
select lives_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'project-manager-gantt-tasks', 't1', '{"id":"t1","name":"Dig"}') $$,
  'a technical office engineer edits the plan');
select throws_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'project-manager-project-meta', '$doc', '{"status":"signed"}') $$,
  '42501', 'new row violates row-level security policy for table "items"', 'but cannot sign off');
select throws_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-orders', 'orders/e1', '{"id":"e1","family":"expense","tier":"quick","status":"approved"}') $$,
  '42501', 'new row violates row-level security policy for table "items"', 'nor record expenses');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005"}', true);
select lives_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-orders', 'orders/e2', '{"id":"e2","family":"expense","tier":"quick","status":"approved"}') $$,
  'an accountant records an expense');
select throws_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-orders', 'orders/v2', '{"id":"v2","family":"value","tier":"quick","status":"approved"}') $$,
  '42501', 'new row violates row-level security policy for table "items"', 'but not site work');
-- (rows the accountant may not write are simply not updated)
update public.items set data = '{"id":"t1","name":"Changed"}' where item_id = 't1';
select is((select data ->> 'name' from public.items where item_id = 't1'), 'Dig', 'and cannot change the plan');
select lives_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-certificates', 'certificates/c1', '{"id":"c1","status":"draft"}') $$,
  'an accountant prepares a certificate');
select throws_ok($$ update public.items set data = '{"id":"c1","status":"issued"}' where item_id = 'certificates/c1' $$,
  '42501', 'new row violates row-level security policy for table "items"', 'but cannot issue it');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006"}', true);
select is((select count(*)::int from public.items), 5, 'a viewer reads everything');
select throws_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-activity', 'ev1', '{"id":"ev1"}') $$,
  '42501', 'new row violates row-level security policy for table "items"', 'and writes nothing');
select throws_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), (select v from ids where k = 'project'), 'pm-unknown-store', 'x1', '{"id":"x1"}') $$,
  '42501', 'new row violates row-level security policy for table "items"', 'unknown collections are refused');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000002"}', true);
select lives_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), null, 'pm-registries', 'workers/w1', '{"id":"w1","name":"Hassan"}') $$,
  'a project manager edits the shared people lists');
select throws_ok($$ insert into public.items (org_id, project_id, collection, item_id, data)
  values ((select v from ids where k = 'org'), null, 'pm-orders', 'orders/x', '{"id":"x"}') $$,
  '42501', 'new row violates row-level security policy for table "items"', 'project stores cannot be written at organization level');
select lives_ok($$ update public.projects set name = 'Canal phase 2' where id = (select v from ids where k = 'project') $$, 'a project manager renames the project');
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004"}', true);
select is((select count(*)::int from public.items where project_id is null), 1, 'every organization member reads the shared lists');
update public.projects set name = 'Hacked' where id = (select v from ids where k = 'project');
select is((select name from public.projects where id = (select v from ids where k = 'project')), 'Canal phase 2', 'a site engineer cannot rename the project');
select throws_ok($$ update public.profiles set email = 'admin@test.local' where id = 'a0000000-0000-0000-0000-000000000004' $$,
  '42501', 'permission denied for table profiles', 'nobody changes the e-mail on a profile');
select lives_ok($$ update public.profiles set name = 'Sara S.' where id = 'a0000000-0000-0000-0000-000000000004' $$, 'people rename themselves');
update public.profiles set name = 'Not me' where id = 'a0000000-0000-0000-0000-000000000003';
select is((select name from public.profiles where id = 'a0000000-0000-0000-0000-000000000003'), 'Omar Office', 'but nobody else');
reset role;

-- Files: members read, roles with files.edit add, nobody else.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000004"}', true);
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('files', (select v from ids where k = 'project')::text || '/f1') $$, 'a site engineer uploads a photo');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000005"}', true);
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('files', (select v from ids where k = 'project')::text || '/f2') $$,
  '42501', 'new row violates row-level security policy for table "objects"', 'an accountant cannot upload');
select is((select count(*)::int from storage.objects), 1, 'but sees the project files');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000007"}', true);
select is((select count(*)::int from storage.objects), 0, 'an outsider sees no files');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('files', (select v from ids where k = 'project')::text || '/f3') $$,
  '42501', 'new row violates row-level security policy for table "objects"', 'and uploads none');
reset role;

-- The organization keeps at least one admin.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000001"}', true);
select throws_ok($$ select set_org_role((select v from ids where k = 'org'), 'a0000000-0000-0000-0000-000000000001', 'pm') $$, 'P0001', 'pm_last_admin', 'the last admin cannot step down');
select lives_ok($$ select set_org_role((select v from ids where k = 'org'), 'a0000000-0000-0000-0000-000000000002', 'admin') $$, 'an admin makes another admin');
select lives_ok($$ select remove_member((select v from ids where k = 'project'), 'a0000000-0000-0000-0000-000000000006') $$, 'an admin removes a member');
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"a0000000-0000-0000-0000-000000000006"}', true);
select is((select count(*)::int from public.items where project_id is not null), 0, 'a removed member no longer reads the project');
reset role;

select * from finish();
rollback;
