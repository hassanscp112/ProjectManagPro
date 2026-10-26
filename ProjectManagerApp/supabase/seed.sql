-- ─────────────────────────────────────────────────────────────
-- LOCAL DEVELOPMENT ONLY — loaded by `npx supabase start` / `supabase db
-- reset` on a developer machine. Never run it on the test laptop or a real
-- server (docs/08-server-setup.md creates the first admin through the app).
--
-- Demo accounts, all with the password  dev-only-password :
--   admin@example.test  (organization admin)
--   pm@example.test     (project manager)
--   site@example.test   (site engineer)
--   acct@example.test   (accountant)
-- and one project, "Demo project", with all four as members.
-- ─────────────────────────────────────────────────────────────

do $$
declare
  v_people jsonb := '[
    {"id": "d0000000-0000-0000-0000-000000000001", "email": "admin@example.test", "name": "Demo Admin", "role": "admin"},
    {"id": "d0000000-0000-0000-0000-000000000002", "email": "pm@example.test", "name": "Demo PM", "role": "pm"},
    {"id": "d0000000-0000-0000-0000-000000000003", "email": "site@example.test", "name": "Demo Site", "role": "site"},
    {"id": "d0000000-0000-0000-0000-000000000004", "email": "acct@example.test", "name": "Demo Accounts", "role": "accountant"}
  ]';
  v_person jsonb;
  v_id uuid;
  v_org uuid := 'd0000000-0000-0000-0000-0000000000a1';
  v_project uuid := 'd0000000-0000-0000-0000-0000000000b1';
begin
  for v_person in select value from jsonb_array_elements(v_people) loop
    v_id := (v_person ->> 'id')::uuid;
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
      v_person ->> 'email', extensions.crypt('dev-only-password', extensions.gen_salt('bf')), now(),
      '{"provider": "email", "providers": ["email"]}', jsonb_build_object('name', v_person ->> 'name'),
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (
      gen_random_uuid(), v_id, v_id::text,
      jsonb_build_object('sub', v_id::text, 'email', v_person ->> 'email', 'email_verified', true),
      'email', now(), now(), now()
    );
  end loop;

  insert into public.orgs (id, name, created_by) values (v_org, 'Demo company', 'd0000000-0000-0000-0000-000000000001');
  insert into public.projects (id, org_id, name, contract, start_date, created_by)
  values (v_project, v_org, 'Demo project', 'Demo contract', current_date, 'd0000000-0000-0000-0000-000000000001');
  for v_person in select value from jsonb_array_elements(v_people) loop
    insert into public.org_members (org_id, user_id, role) values (v_org, (v_person ->> 'id')::uuid, v_person ->> 'role');
    insert into public.project_members (project_id, user_id, role) values (v_project, (v_person ->> 'id')::uuid, v_person ->> 'role');
  end loop;
end
$$;
