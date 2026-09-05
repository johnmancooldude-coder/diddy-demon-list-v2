-- DIDDY DEMON LIST V17 — EVOLUTION PATCH
-- Run once in Supabase SQL Editor AFTER the V16.2 SQL.
-- No service_role key required. Views are normal invoker views.

create table if not exists public.list_snapshots(
  id uuid primary key default gen_random_uuid(),
  captured_at timestamptz not null default now(),
  label text,
  snapshot jsonb not null default '[]'::jsonb
);

alter table public.list_snapshots enable row level security;
do $$ begin
  create policy v17_snapshots_read on public.list_snapshots for select using(true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy v17_snapshots_admin on public.list_snapshots for all using(public.is_admin()) with check(public.is_admin());
exception when duplicate_object then null; end $$;

grant select on public.list_snapshots to anon, authenticated;
grant insert, update, delete on public.list_snapshots to authenticated;

create or replace function public.capture_list_snapshot(p_label text default null)
returns uuid
language plpgsql security definer set search_path=public as $$
declare sid uuid;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  insert into public.list_snapshots(label,snapshot)
  select p_label,
         coalesce(jsonb_agg(to_jsonb(x) order by x.section,x.rank),'[]'::jsonb)
  from (select id,section,rank,name,creator,verifier,holder,description,difficulty,status,aliases,notes from public.levels) x
  returning id into sid;
  return sid;
end $$;
grant execute on function public.capture_list_snapshot(text) to authenticated;

create or replace view public.v17_player_stats as
select p.id,p.name,
  coalesce(sum(public.level_points(l.rank)),0)::int as total_points,
  count(r.id)::int as victories,
  min(l.rank) as highest_victory,
  round(avg(l.rank),1) as average_placement,
  count(*) filter (where l.rank<=10)::int as top10_victories,
  count(*) filter (where l.rank<=25)::int as top25_victories,
  count(*) filter (where l.rank<=50)::int as top50_victories,
  coalesce(sum(r.attempts),0)::bigint as total_attempts,
  round(avg(r.completion_seconds)::numeric,2) as avg_completion_seconds,
  min(r.created_at) as first_victory_at,
  max(r.created_at) as latest_victory_at
from public.players p
left join public.records r on r.player_id=p.id
left join public.levels l on l.id=r.level_id
group by p.id,p.name;

grant select on public.v17_player_stats to anon, authenticated;

create or replace view public.v17_level_stats as
select l.id,l.section,l.rank,l.name,l.creator,l.verifier,l.holder,l.description,l.difficulty,l.status,l.created_at,
  public.level_points(l.rank)::int as points,
  count(r.id)::int as victor_count,
  count(distinct r.player_id)::int as unique_players,
  min(r.created_at) as first_victory_at,
  max(r.created_at) as latest_victory_at,
  coalesce(sum(r.attempts),0)::bigint as total_attempts,
  round(avg(r.completion_seconds)::numeric,2) as avg_completion_seconds,
  min(r.completion_seconds) as fastest_completion_seconds
from public.levels l
left join public.records r on r.level_id=l.id
group by l.id;

grant select on public.v17_level_stats to anon, authenticated;

create or replace view public.v17_record_book as
select r.id,r.player_id,r.level_id,r.progress,r.video_url,r.attempts,r.completion_seconds,r.created_at,
 p.name as player_name,l.name as level_name,l.section,l.rank,public.level_points(l.rank)::int as points
from public.records r
join public.players p on p.id=r.player_id
join public.levels l on l.id=r.level_id;
grant select on public.v17_record_book to anon, authenticated;

create or replace view public.v17_number_one_hall as
select ph.id,ph.level_id,ph.section,ph.rank,ph.points,ph.recorded_at,ph.note,l.name as level_name
from public.placement_history ph
join public.levels l on l.id=ph.level_id
where ph.rank=1;
grant select on public.v17_number_one_hall to anon, authenticated;

create or replace view public.v17_news_feed as
select c.id as source_id,'announcement'::text as kind,c.created_at as event_at,c.title,c.body,null::uuid as player_id,null::uuid as level_id
from public.changelog c
union all
select r.id,'victory',r.created_at,
       coalesce(p.name,'A player') || ' conquered ' || coalesce('#'||l.rank||' '||l.name,'a level'),
       coalesce((r.progress::text||'% completion') || case when r.video_url is not null then ' · proof attached' else '' end,''),
       r.player_id,r.level_id
from public.records r join public.players p on p.id=r.player_id join public.levels l on l.id=r.level_id
union all
select ph.id,'placement',ph.recorded_at,
       coalesce(l.name,'A level') || ' is now #' || ph.rank,
       coalesce(ph.note,upper(ph.section)||' placement update.'),null,ph.level_id
from public.placement_history ph join public.levels l on l.id=ph.level_id;
grant select on public.v17_news_feed to anon, authenticated;

create index if not exists v17_snapshots_captured_at_idx on public.list_snapshots(captured_at desc);
create index if not exists v17_records_created_at_idx on public.records(created_at desc);
create index if not exists v17_ph_rank_recorded_idx on public.placement_history(rank,recorded_at desc);

notify pgrst,'reload schema';
