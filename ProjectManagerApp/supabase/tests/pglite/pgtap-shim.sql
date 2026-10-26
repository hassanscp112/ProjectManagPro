-- The few pgTAP functions the database tests use, so the same test files run
-- in PGlite (run.mjs) and on a real server (`npx supabase test db`, real
-- pgTAP). Each returns a TAP line: 'ok 3 - description' / 'not ok 3 - …'.
-- The counter lives in a table written by a definer helper, because tests
-- switch to the `authenticated` role; the assertions that run SQL
-- (lives_ok / throws_ok) stay invoker so that SQL runs as the test's role.

create table extensions.tap_state (id integer primary key default 1, n integer not null default 0, failed integer not null default 0);
insert into extensions.tap_state default values;

create function extensions.tap_line(p_ok boolean, p_desc text, p_diag text default null)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_n integer;
begin
  update extensions.tap_state set n = n + 1, failed = failed + case when coalesce(p_ok, false) then 0 else 1 end
   where id = 1 returning n into v_n;
  return case when coalesce(p_ok, false) then 'ok ' else 'not ok ' end || v_n || ' - ' || coalesce(p_desc, '')
         || case when coalesce(p_ok, false) or p_diag is null then '' else E'\n# ' || p_diag end;
end
$$;

create function public.no_plan() returns setof boolean language sql as $$
  update extensions.tap_state set n = 0, failed = 0 where id = 1 returning true
$$;

create function public.plan(integer) returns text language sql as $$
  update extensions.tap_state set n = 0, failed = 0 where id = 1 returning '1..' || $1
$$;

create function public.finish() returns setof text language sql security definer set search_path = '' as $$
  select '# tests: ' || n || ', failed: ' || failed from extensions.tap_state where id = 1
$$;

create function public.ok(boolean, text) returns text language sql as $$
  select extensions.tap_line($1, $2)
$$;

create function public.is(anyelement, anyelement, text) returns text language sql as $$
  select extensions.tap_line($1 is not distinct from $2, $3, 'have: ' || coalesce($1::text, 'NULL') || ' want: ' || coalesce($2::text, 'NULL'))
$$;

create function public.isnt(anyelement, anyelement, text) returns text language sql as $$
  select extensions.tap_line($1 is distinct from $2, $3, 'both: ' || coalesce($1::text, 'NULL'))
$$;

create function public.lives_ok(text, text) returns text language plpgsql as $$
begin
  execute $1;
  return extensions.tap_line(true, $2);
exception when others then
  return extensions.tap_line(false, $2, 'died: ' || sqlstate || ' ' || sqlerrm);
end
$$;

-- throws_ok(sql, errcode, errmsg, description); errmsg null = any message.
create function public.throws_ok(text, character, text, text) returns text language plpgsql as $$
begin
  execute $1;
  return extensions.tap_line(false, $4, 'no error raised');
exception when others then
  return extensions.tap_line(
    sqlstate = $2 and ($3 is null or sqlerrm = $3), $4,
    'got: ' || sqlstate || ' ' || sqlerrm || ' want: ' || $2 || ' ' || coalesce($3, '(any)')
  );
end
$$;

grant usage on schema extensions to anon, authenticated;
grant execute on all functions in schema extensions to anon, authenticated;
