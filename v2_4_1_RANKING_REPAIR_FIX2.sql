-- V2.4.1 FIX 2 — Global ranking repair
-- Fixes existing rank gaps (e.g. #40 -> #42) and makes deletion repair atomic.
-- Admin only. Run this AFTER the existing V2.4.1 patch.

create or replace function public.v24_repair_rankings()
returns void
language plpgsql
security definer
set search_path=public
as $V2412_REPAIR$
declare
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  perform pg_advisory_xact_lock(hashtext('diddy_v18_ranking'));

  create temporary table _v2412_before(
    id uuid primary key,
    section text not null,
    rank int not null
  ) on commit drop;

  insert into _v2412_before(id,section,rank)
  select id,section,rank from public.levels;

  create temporary table _v2412_plan(
    id uuid primary key,
    new_section text not null,
    new_rank int not null
  ) on commit drop;

  -- Preserve section membership whenever possible. Only overflow crosses a
  -- section boundary: Main >45 flows into Extended, Extended >55 flows into
  -- Legacy. This repairs gaps like #40 -> #42 without pulling Extended levels
  -- into Main just because Main has fewer than 45 entries.
  with main_order as (
    select id, row_number() over(order by rank,id)::int rn
    from public.levels where section='main'
  ),
  ext_order as (
    select id, row_number() over(order by rank,id)::int rn
    from public.levels where section='extended'
  ),
  main_keep as (
    select id, rn from main_order where rn<=45
  ),
  main_overflow as (
    select id, rn-45 as rn from main_order where rn>45
  ),
  ext_all as (
    select id, rn as source_order, false as from_main from ext_order
    union all
    select id, rn as source_order, true as from_main from main_overflow
  ),
  ext_ordered as (
    select id, row_number() over(order by from_main desc, source_order, id)::int rn
    from ext_all
  ),
  ext_keep as (
    select id,rn from ext_ordered where rn<=55
  ),
  ext_overflow as (
    select id,rn-55 as rn from ext_ordered where rn>55
  ),
  legacy_all as (
    select id, row_number() over(order by rank,id)::int source_order, false as from_extended from public.levels where section='legacy'
    union all
    select id, rn as source_order, true as from_extended from ext_overflow
  ),
  legacy_ordered as (
    select id,row_number() over(order by from_extended desc,source_order,id)::int rn
    from legacy_all
  )
  insert into _v2412_plan(id,new_section,new_rank)
  select id,'main',rn from main_keep
  union all
  select id,'extended',45+rn from ext_keep
  union all
  select id,'legacy',100+rn from legacy_ordered;

  -- Park all rows at unique temporary ranks before changing sections/ranks.
  with t as (
    select id,row_number() over(order by id)::int rn from public.levels
  )
  update public.levels l
  set rank=9000000+t.rn
  from t
  where l.id=t.id;

  update public.levels l
  set section=p.new_section,
      rank=p.new_rank
  from _v2412_plan p
  where l.id=p.id;

  insert into public.placement_history(level_id,section,rank,points,note)
  select a.id,a.section,a.rank,public.level_points(a.rank),
         format('V2.4.1 ranking repair: %s #%s -> %s #%s',b.section,b.rank,a.section,a.rank)
  from _v2412_before b
  join public.levels a on a.id=b.id
  where b.section<>a.section or b.rank<>a.rank;
end;
$V2412_REPAIR$;

grant execute on function public.v24_repair_rankings() to authenticated;

-- Replace deletion with a version that ALWAYS repairs the entire list after
-- removing the target. This also repairs old gaps left by previous deletes.
create or replace function public.v24_delete_level(p_level_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $V2412_DELETE$
declare
  target_name text;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  perform pg_advisory_xact_lock(hashtext('diddy_v18_ranking'));

  select name into target_name
  from public.levels
  where id=p_level_id
  for update;

  if not found then raise exception 'level not found'; end if;

  if to_regprocedure('public.v18_capture_backup(text)') is not null then
    perform public.v18_capture_backup('Before deleting level: '||coalesce(target_name,'level'));
  end if;

  delete from public.levels where id=p_level_id;
  perform public.v24_repair_rankings();
end;
$V2412_DELETE$;

grant execute on function public.v24_delete_level(uuid) to authenticated;
notify pgrst,'reload schema';
