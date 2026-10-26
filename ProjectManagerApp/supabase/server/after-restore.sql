-- ─────────────────────────────────────────────────────────────
-- Run once after loading a data backup into a new database (restore.sh
-- does it; when moving to hosted Supabase run it in the SQL editor).
--
-- Devices pull with a cursor on the transaction that wrote each record
-- (items.txid). A new database counts its transactions from the start, so
-- restored records would look newer than everything written afterwards;
-- re-stamping them with the current transaction puts them before any new
-- write. The triggers are off meanwhile, so the history is not touched.
-- ─────────────────────────────────────────────────────────────
begin;
alter table public.items disable trigger items_10_stamp;
alter table public.items disable trigger items_20_approval;
alter table public.items disable trigger items_90_audit;
update public.items set txid = pg_current_xact_id();
alter table public.items enable trigger items_10_stamp;
alter table public.items enable trigger items_20_approval;
alter table public.items enable trigger items_90_audit;
select setval('app_private.items_seq', greatest(coalesce((select max(seq) from public.items), 0), 1));
commit;
