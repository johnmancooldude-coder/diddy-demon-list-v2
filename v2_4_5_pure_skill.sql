-- DIDDY DEMON LIST V2.4.5 — PURE SKILL
-- Run this once in Supabase SQL Editor.
-- Additive only. Does not change official ranking/points tables.
create table if not exists public.pure_skill_rankings(
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null unique references public.players(id) on delete cascade,
  skill_rank integer not null check(skill_rank>0),
  tier text not null default '🗿 SOLID',
  note text,
  updated_at timestamptz not null default now()
);
alter table public.pure_skill_rankings enable row level security;
do $$ begin
  create policy pure_skill_public_read on public.pure_skill_rankings for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pure_skill_admin_write on public.pure_skill_rankings for all to authenticated using (public.is_admin()) with check (public.is_admin());
exception when duplicate_object then null; end $$;
grant select on public.pure_skill_rankings to anon, authenticated;
grant insert, update, delete on public.pure_skill_rankings to authenticated;
create index if not exists pure_skill_rank_idx on public.pure_skill_rankings(skill_rank);
create index if not exists pure_skill_player_idx on public.pure_skill_rankings(player_id);
notify pgrst,'reload schema';
