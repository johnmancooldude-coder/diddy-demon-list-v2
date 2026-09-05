-- DIDDY DEMON LIST V13 LEGENDS PATCH
-- Run AFTER V12. Safe to run repeatedly.

-- Optional metadata for better record-based Hall of Fame stats.
alter table public.records add column if not exists attempts int check(attempts is null or attempts>=0);
alter table public.records add column if not exists completion_seconds numeric check(completion_seconds is null or completion_seconds>=0);

-- Curated Hall of Fame entries. These supplement automatically calculated records.
create table if not exists public.hall_entries(
  id uuid primary key default gen_random_uuid(),
  category text not null,
  title text not null,
  body text not null,
  player_id uuid references public.players(id) on delete set null,
  level_id uuid references public.levels(id) on delete set null,
  year int,
  created_at timestamptz not null default now()
);

alter table public.hall_entries enable row level security;
do $$ begin
  create policy hall_entries_read on public.hall_entries for select using(true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy hall_entries_admin_insert on public.hall_entries for insert to authenticated with check(public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy hall_entries_admin_update on public.hall_entries for update to authenticated using(public.is_admin()) with check(public.is_admin());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy hall_entries_admin_delete on public.hall_entries for delete to authenticated using(public.is_admin());
exception when duplicate_object then null; end $$;
grant select on public.hall_entries to anon,authenticated;
grant insert,update,delete on public.hall_entries to authenticated;

-- Useful for the Hall time-machine. Existing placement_history remains the source of truth.
grant select on public.placement_history to anon,authenticated;
