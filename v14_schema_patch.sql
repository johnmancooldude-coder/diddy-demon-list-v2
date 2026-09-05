-- DIDDY DEMON LIST V14 OVERDRIVE
-- Run AFTER V13. Safe to run repeatedly.

create index if not exists records_created_at_idx on public.records(created_at desc);
create index if not exists records_player_id_idx on public.records(player_id);
create index if not exists records_level_id_idx on public.records(level_id);
create index if not exists placement_history_recorded_at_idx on public.placement_history(recorded_at desc);
create index if not exists placement_history_level_id_recorded_at_idx on public.placement_history(level_id, recorded_at desc);
create index if not exists changelog_created_at_idx on public.changelog(created_at desc);
create index if not exists levels_section_rank_idx on public.levels(section, rank);
create index if not exists level_votes_created_at_idx on public.level_votes(created_at desc);
create index if not exists hall_entries_created_at_idx on public.hall_entries(created_at desc);

-- Optional challenge metadata; safe if the columns already exist.
alter table public.records add column if not exists notes text;
alter table public.players add column if not exists bio text;
alter table public.players add column if not exists avatar_url text;

-- A lightweight public activity stream. It reads existing sources and does not duplicate data.
create or replace view public.activity_feed as
select r.id, 'victory'::text as activity_type, r.created_at, r.player_id, r.level_id,
       null::text as title, null::text as body
from public.records r
union all
select ph.id, 'placement'::text, ph.recorded_at, null::uuid, ph.level_id,
       null::text, ph.note
from public.placement_history ph
union all
select c.id, 'news'::text, c.created_at, null::uuid, null::uuid,
       c.title, c.body
from public.changelog c;

grant select on public.activity_feed to anon, authenticated;

-- Helpful for fast record-book queries.
create or replace view public.record_book as
select r.id, r.player_id, r.level_id, r.created_at, r.attempts, r.completion_seconds,
       p.name as player_name, l.name as level_name, l.rank,
       public.level_points(l.rank) as points
from public.records r
join public.players p on p.id=r.player_id
join public.levels l on l.id=r.level_id;

grant select on public.record_book to anon, authenticated;

create or replace view public.level_victory_counts as
select l.id as level_id, count(r.id)::int as victory_count
from public.levels l left join public.records r on r.level_id=l.id
group by l.id;
grant select on public.level_victory_counts to anon, authenticated;

-- Featured level migration: older schema versions created this table with only `id`.
-- V14 stores the selected level in `level_id`.
alter table public.featured_level
  add column if not exists level_id uuid references public.levels(id) on delete set null;

create index if not exists featured_level_level_id_idx on public.featured_level(level_id);
notify pgrst, 'reload schema';
