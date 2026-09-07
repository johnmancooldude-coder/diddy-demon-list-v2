-- DIDDY DEMON LIST V2.0.3 movement reliability patch
-- Run this AFTER the main V2.0.3 ranking-history patch.
-- It makes the older v18_move_level path record EVERY affected level too.

create or replace function public.v18_move_level(
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
)
returns void language plpgsql security definer set search_path=public as $V203_V18_MOVE$
declare
  old_section text;
  old_rank int;
  target int;
  r record;
  n int;
  old_count int;
  overflow_id uuid;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_new_section not in ('main','extended','legacy') then raise exception 'invalid section'; end if;

  select section,rank
    into old_section,old_rank
  from public.levels
  where id=p_level_id
  for update;

  if not found then raise exception 'level not found'; end if;
  if nullif(trim(coalesce(p_verifier,'')),'') is null then
    raise exception 'verifier is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('diddy_v18_ranking'));
  perform public.v18_capture_backup('Before move: '||coalesce(p_name,'level'));

  -- V2.0.3: capture the complete list state before the move so EVERY level
  -- whose final placement changes (including displaced levels) gets history.
  create temp table _diddy_v203_v18_before_move(
    id uuid primary key,
    section text not null,
    rank int not null
  ) on commit drop;

  insert into _diddy_v203_v18_before_move(id,section,rank)
  select id,section,rank from public.levels;

  target:=greatest(1,coalesce(p_new_rank,1));
  if p_new_section='main' then
    target:=least(45,target);
  elsif p_new_section='extended' then
    target:=greatest(46,target);
  else
    target:=greatest(101,target);
  end if;

  -- Park all rows in the affected sections at unique temporary ranks.
  with t as (
    select id,row_number() over(order by rank,id)::int rn
    from public.levels
    where section=old_section
  )
  update public.levels l
  set rank=1000000+t.rn
  from t
  where l.id=t.id;

  if old_section<>p_new_section then
    with t as (
      select id,row_number() over(order by rank,id)::int rn
      from public.levels
      where section=p_new_section
    )
    update public.levels l
    set rank=2000000+t.rn
    from t
    where l.id=t.id;
  end if;

  update public.levels
  set rank=900000000
  where id=p_level_id;

  -- Rebuild the old section without the moved level.
  n:=case when old_section='main' then 0
          when old_section='extended' then 45
          else 100 end;
  for r in
    select id from public.levels
    where section=old_section and id<>p_level_id
    order by rank,id
  loop
    n:=n+1;
    update public.levels set rank=n where id=r.id;
  end loop;

  -- Rebuild the destination and insert the moved level at the requested slot.
  n:=case when p_new_section='main' then 0
          when p_new_section='extended' then 45
          else 100 end;
  for r in
    select id from public.levels
    where section=p_new_section and id<>p_level_id
    order by rank,id
  loop
    if n+1=target then n:=n+1; end if;
    n:=n+1;
    update public.levels set rank=n where id=r.id;
  end loop;

  update public.levels
  set section=p_new_section,
      rank=target,
      name=p_name,
      creator=nullif(trim(coalesce(p_creator,'')),''),
      verifier=nullif(trim(coalesce(p_verifier,'')),''),
      holder=nullif(trim(coalesce(p_holder,'')),''),
      description=coalesce(p_description,''),
      video_url=nullif(trim(coalesce(p_video_url,'')),''),
      thumbnail_url=nullif(trim(coalesce(p_thumbnail_url,'')),'')
  where id=p_level_id;

  -- Main is capped at 45. If insertion created #46, push the bottom
  -- main level into Extended starting at #46.
  select count(*) into old_count
  from public.levels
  where section='main';

  if old_count>45 then
    select id into overflow_id
    from public.levels
    where section='main' and rank>45
    order by rank desc, id desc
    limit 1;

    if overflow_id is not null then
      with t as (
        select id,row_number() over(order by rank,id)::int rn
        from public.levels
        where section='extended'
      )
      update public.levels l
      set rank=3000000+t.rn
      from t
      where l.id=t.id;

      update public.levels
      set section='extended',rank=46
      where id=overflow_id;

      n:=46;
      for r in
        select id from public.levels
        where section='extended' and id<>overflow_id
        order by rank,id
      loop
        n:=n+1;
        update public.levels set rank=n where id=r.id;
      end loop;
    end if;
  end if;

  perform public.v18_resequence_section('main');
  perform public.v18_resequence_section('extended');
  perform public.v18_resequence_section('legacy');

  -- V2.0.3: record EVERY level whose placement changed.
  -- The note stores the exact before/after placement, so the frontend can
  -- show ▲/▼ even when all rows share the same transaction timestamp.
  insert into public.placement_history(level_id,section,rank,points,note)
  select a.id,
         a.section,
         a.rank,
         public.level_points(a.rank),
         format('V2.0.3 placement: %s #%s -> %s #%s',b.section,b.rank,a.section,a.rank)
  from _diddy_v203_v18_before_move b
  join public.levels a on a.id=b.id
  where b.section<>a.section or b.rank<>a.rank;
end $V203_V18_MOVE$;
grant execute on function public.v18_move_level(uuid,text,int,text,text,text,text,text,text,text) to authenticated;

notify pgrst,'reload schema';
