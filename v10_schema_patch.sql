-- DIDDY DEMON LIST V10 BACKEND UPGRADE
-- Run AFTER the existing schema. Safe to run repeatedly.

create or replace function public.move_level(p_level_id uuid,p_new_section text,p_new_rank int,p_name text,p_creator text,p_verifier text,p_holder text,p_description text,p_video_url text,p_thumbnail_url text) returns void language plpgsql security definer set search_path=public as $$
declare old_section text; old_rank int; target_rank int; before_points int; affected record; begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  select section,rank into old_section,old_rank from public.levels where id=p_level_id for update;
  if not found then raise exception 'level not found'; end if;
  target_rank=greatest(1,p_new_rank);
  -- Snapshot every level in both affected sections before renumbering.
  create temporary table if not exists _v10_before(id uuid primary key,section text,rank int) on commit drop;
  truncate _v10_before;
  insert into _v10_before select id,section,rank from public.levels where section in (old_section,p_new_section);
  update public.levels set rank=rank+10000 where section=p_new_section and id<>p_level_id and rank>=target_rank;
  update public.levels set section=p_new_section,rank=target_rank,name=p_name,creator=p_creator,verifier=p_verifier,holder=p_holder,description=p_description,video_url=nullif(p_video_url,''),thumbnail_url=nullif(p_thumbnail_url,'') where id=p_level_id;
  with ranked as(select id,row_number() over(order by rank,id)::int r from public.levels where section=p_new_section) update public.levels l set rank=ranked.r from ranked where l.id=ranked.id;
  if old_section is not null then with ranked as(select id,row_number() over(order by rank,id)::int r from public.levels where section=old_section) update public.levels l set rank=ranked.r from ranked where l.id=ranked.id; end if;
  -- Record every level whose placement actually changed.
  insert into public.placement_history(level_id,section,rank,points,note)
  select l.id,l.section,l.rank,public.level_points(l.rank),format('V10 placement change: #%s → #%s',b.rank,l.rank)
  from public.levels l join _v10_before b on b.id=l.id
  where b.section<>l.section or b.rank<>l.rank;
  -- Also record an edit when nothing moved.
  if not exists(select 1 from public.placement_history h where h.level_id=p_level_id and h.recorded_at>now()-interval '3 seconds' and h.note like 'V10 placement change:%') then
    insert into public.placement_history(level_id,section,rank,points,note) values(p_level_id,p_new_section,target_rank,public.level_points(target_rank),'Level edited');
  end if;
end $$;

-- SECURITY: remove SECURITY DEFINER from the public leaderboard view if it exists.
drop view if exists public.player_leaderboard;
create view public.player_leaderboard as
select p.id,p.name,coalesce(sum(public.level_points(l.rank)),0)::int total_points,count(r.id)::int victors,
min(l.rank) highest_victory,case when count(r.id)>0 then round(avg(l.rank),1) else null end average_placement
from public.players p left join public.records r on r.player_id=p.id left join public.levels l on l.id=r.level_id
group by p.id,p.name;
grant select on public.player_leaderboard to anon, authenticated;
