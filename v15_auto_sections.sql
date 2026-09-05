-- DIDDY DEMON LIST V15 — AUTOMATIC MAIN/EXTENDED RANKING
-- Run this AFTER your existing V14/V14 Featured Fix SQL.
-- This changes ONLY ranking/section behavior. Your config.js stays untouched.

-- Main List is always #1–#45.
-- Extended List is always #46 and up.
-- If a main-list level gets pushed past #45, it automatically moves to Extended.

create or replace function public.move_level(
  p_level_id uuid,
  p_new_section text,
  p_new_rank int,
  p_name text,
  p_creator text,
  p_verifier text,
  p_holder text,
  p_description text,
  p_video_url text,
  p_thumbnail_url text
) returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  old_section text;
  old_rank int;
  target_section text;
  target_rank int;
  rec record;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_new_section not in ('main','extended','legacy') then raise exception 'invalid section'; end if;

  select section, rank into old_section, old_rank
  from public.levels where id=p_level_id for update;
  if not found then raise exception 'level not found'; end if;

  target_section := p_new_section;
  target_rank := greatest(1, coalesce(p_new_rank,1));

  -- A requested Main rank below #45 becomes Extended automatically.
  if target_section='main' and target_rank>45 then
    target_section := 'extended';
    target_rank := greatest(46, target_rank);
  elsif target_section='extended' then
    target_rank := greatest(46, target_rank);
  elsif target_section='legacy' then
    target_rank := greatest(101, target_rank);
  else
    target_rank := least(45, target_rank);
  end if;

  -- Snapshot current placements for history.
  create temporary table if not exists _v15_before(
    id uuid primary key, section text, rank int
  ) on commit drop;
  truncate _v15_before;
  insert into _v15_before
  select id,section,rank from public.levels;

  -- Move every rank temporarily out of the way so section/rank uniqueness
  -- can never collide while we reorganize the lists.
  update public.levels set rank=rank+1000000;

  -- Put the selected level in the requested insertion position.
  update public.levels
  set section=target_section,
      rank=target_rank,
      name=p_name,
      creator=p_creator,
      verifier=p_verifier,
      holder=p_holder,
      description=p_description,
      video_url=nullif(p_video_url,''),
      thumbnail_url=nullif(p_thumbnail_url,'')
  where id=p_level_id;

  -- Normalize Main to exactly #1–#45. Anything beyond #45 is moved to
  -- Extended, preserving its relative order.
  create temporary table if not exists _v15_main(
    id uuid primary key, desired_rank int
  ) on commit drop;
  truncate _v15_main;
  insert into _v15_main
  select id,
         row_number() over (
           order by
             case when id=p_level_id and target_section='main' then target_rank else 1000000000 end,
             case when id=p_level_id and target_section='main' then 0 else case when rank>=1000000 then rank-1000000 else rank end end,
             id
         )::int
  from public.levels
  where section='main';

  update public.levels l
  set rank=m.desired_rank
  from _v15_main m
  where l.id=m.id;

  -- Any Main overflow is now automatically Extended.
  update public.levels
  set section='extended'
  where section='main' and rank>45;

  -- Rebuild Extended starting at #46. Main overflow levels keep their
  -- relative order, and a level intentionally moved to Extended can be
  -- inserted at the requested Extended rank.
  create temporary table if not exists _v15_extended(
    id uuid primary key, desired_rank int
  ) on commit drop;
  truncate _v15_extended;
  insert into _v15_extended
  select id,
         45 + row_number() over (
           order by
             case when id=p_level_id and target_section='extended' then target_rank else 1000000000 end,
             case when id=p_level_id and target_section='extended' then 0 else case when rank>=1000000 then rank-1000000 else rank end end,
             id
         )::int
  from public.levels
  where section='extended';

  update public.levels l
  set rank=e.desired_rank
  from _v15_extended e
  where l.id=e.id;

  -- Legacy always begins at #101.
  create temporary table if not exists _v15_legacy(
    id uuid primary key, desired_rank int
  ) on commit drop;
  truncate _v15_legacy;
  insert into _v15_legacy
  select id,
         100 + row_number() over (
           order by
             case when id=p_level_id and target_section='legacy' then target_rank else 1000000000 end,
             case when id=p_level_id and target_section='legacy' then 0 else case when rank>=1000000 then rank-1000000 else rank end end,
             id
         )::int
  from public.levels
  where section='legacy';

  update public.levels l
  set rank=e.desired_rank
  from _v15_legacy e
  where l.id=e.id;

  -- Record every placement that changed, including automatic Main → Extended
  -- promotions/demotions caused by the #45 boundary.
  insert into public.placement_history(level_id,section,rank,points,note)
  select l.id,l.section,l.rank,public.level_points(l.rank),
         format('V15 placement change: %s #%s → %s #%s',
                b.section,b.rank,l.section,l.rank)
  from public.levels l
  join _v15_before b on b.id=l.id
  where b.section<>l.section or b.rank<>l.rank;

  if not exists(
    select 1 from public.placement_history h
    where h.level_id=p_level_id
      and h.recorded_at>now()-interval '3 seconds'
      and h.note like 'V15 placement change:%'
  ) then
    insert into public.placement_history(level_id,section,rank,points,note)
    values(p_level_id,target_section,target_rank,public.level_points(target_rank),'Level edited');
  end if;
end;
$$;

grant execute on function public.move_level(uuid,text,int,text,text,text,text,text,text,text) to authenticated;

-- New levels use the same automatic boundary behavior.
create or replace function public.create_level(
  p_section text,
  p_rank int,
  p_name text,
  p_creator text default '',
  p_verifier text default '',
  p_holder text default '',
  p_description text default '',
  p_video_url text default null,
  p_thumbnail_url text default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  new_id uuid;
  target_section text;
  target_rank int;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_section not in ('main','extended','legacy') then raise exception 'invalid section'; end if;
  if nullif(trim(p_verifier),'') is null then raise exception 'verifier is required'; end if;

  target_section:=p_section;
  target_rank:=greatest(1,coalesce(p_rank,1));
  if target_section='main' and target_rank>45 then
    target_section:='extended'; target_rank:=greatest(46,target_rank);
  elsif target_section='extended' then
    target_rank:=greatest(46,target_rank);
  elsif target_section='legacy' then
    target_rank:=greatest(101,target_rank);
  else
    target_rank:=least(45,target_rank);
  end if;

  update public.levels set rank=rank+1000000;
  insert into public.levels(section,rank,name,creator,verifier,holder,description,video_url,thumbnail_url)
  values(target_section,target_rank,p_name,nullif(trim(p_creator),''),nullif(trim(p_verifier),''),
         nullif(trim(p_holder),''),coalesce(p_description,''),nullif(trim(p_video_url),''),nullif(trim(p_thumbnail_url,'')))
  returning id into new_id;

  -- Normalize all sections and establish the #1–45 / #46+ boundary.
  update public.levels set rank=rank-1000000;
  update public.levels l set rank=x.r
  from (select id,row_number() over(order by rank,id)::int r from public.levels where section='main') x
  where l.id=x.id;
  update public.levels set section='extended'
  where section='main' and rank>45;
  update public.levels l set rank=x.r
  from (select id,45+row_number() over(order by rank,id)::int r from public.levels where section='extended') x
  where l.id=x.id;
  update public.levels l set rank=x.r
  from (select id,100+row_number() over(order by rank,id)::int r from public.levels where section='legacy') x
  where l.id=x.id;

  insert into public.placement_history(level_id,section,rank,points,note)
  select id,section,rank,public.level_points(rank),'Level added' from public.levels where id=new_id;
  return new_id;
end;
$$;

grant execute on function public.create_level(text,int,text,text,text,text,text,text,text) to authenticated;

notify pgrst, 'reload schema';
