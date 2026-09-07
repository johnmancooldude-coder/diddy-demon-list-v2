-- DIDDY DEMON LIST V2.0.3
-- Reliable rank-movement history: every level whose rank/section changes
-- during a move is recorded in placement_history.
-- This powers accurate ▲/▼ movement badges on the site.

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
as $$V203_MOVE$
declare
  old_section text;
  old_rank int;
  target_section text;
  target_rank int;
  r record;
  overflow_id uuid;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_new_section not in ('main','extended','legacy') then raise exception 'invalid section'; end if;
  if not exists(select 1 from public.levels where id=p_level_id) then raise exception 'level not found'; end if;

  select section, rank into old_section, old_rank
  from public.levels where id=p_level_id for update;

  target_section := p_new_section;
  target_rank := greatest(1, coalesce(p_new_rank,1));
  if target_section='main' then
    target_rank := least(45,target_rank);
  elsif target_section='extended' then
    target_rank := greatest(46,target_rank);
  else
    target_rank := greatest(101,target_rank);
  end if;

  -- Capture the complete affected sections before any ranks change.
  create temp table _diddy_v203_before_move(
    id uuid primary key,
    section text not null,
    rank int not null
  ) on commit drop;

  insert into _diddy_v203_before_move(id,section,rank)
  select id,section,rank
  from public.levels
  where section in (old_section,target_section);

  -- Park the selected level at a unique temporary rank.
  update public.levels set rank=1000000 where id=p_level_id;

  if old_section = target_section then
    if target_rank < old_rank then
      for r in select id,rank from public.levels
        where section=old_section and id<>p_level_id and rank>=target_rank and rank<old_rank
        order by rank desc loop
        update public.levels set rank=r.rank+1 where id=r.id;
      end loop;
    elsif target_rank > old_rank then
      for r in select id,rank from public.levels
        where section=old_section and id<>p_level_id and rank>old_rank and rank<=target_rank
        order by rank asc loop
        update public.levels set rank=r.rank-1 where id=r.id;
      end loop;
    end if;
  else
    for r in select id,rank from public.levels
      where section=old_section and id<>p_level_id and rank>old_rank
      order by rank asc loop
      update public.levels set rank=r.rank-1 where id=r.id;
    end loop;
  end if;

  if old_section <> target_section then
    for r in select id,rank from public.levels
      where section=target_section and rank>=target_rank
      order by rank desc loop
      update public.levels set rank=r.rank+1 where id=r.id;
    end loop;
  end if;

  update public.levels
  set section=target_section, rank=target_rank,
      name=p_name, creator=p_creator, verifier=p_verifier, holder=p_holder,
      description=coalesce(p_description,''),
      video_url=nullif(trim(coalesce(p_video_url,'')),''),
      thumbnail_url=nullif(trim(coalesce(p_thumbnail_url,'')),'')
  where id=p_level_id;

  -- Main is capped at #45; overflow becomes Extended #46.
  select id into overflow_id
  from public.levels
  where section='main' and rank=46
  limit 1;

  if overflow_id is not null then
    for r in select id,rank from public.levels
      where section='extended' and rank>=46
      order by rank desc loop
      update public.levels set rank=r.rank+1 where id=r.id;
    end loop;
    update public.levels set section='extended', rank=46 where id=overflow_id;
  end if;

  -- Record EVERY existing level whose final placement differs from its
  -- pre-move placement. This includes levels pushed up/down by the move.
  insert into public.placement_history(level_id,section,rank,points,note)
  select afters.id,
         afters.section,
         afters.rank,
         public.level_points(afters.rank),
         format('V2.0.3 placement: %s #%s -> %s #%s',before.section,before.rank,afters.section,afters.rank)
  from _diddy_v203_before_move before
  join public.levels afters on afters.id=before.id
  where before.section<>afters.section or before.rank<>afters.rank;

  -- If this was only an edit, preserve the existing history behavior.
  if not exists(
    select 1 from _diddy_v203_before_move b
    join public.levels a on a.id=b.id
    where b.id=p_level_id and (b.section<>a.section or b.rank<>a.rank)
  ) then
    insert into public.placement_history(level_id,section,rank,points,note)
    values(p_level_id,target_section,target_rank,public.level_points(target_rank),'V2.0.3 level edit');
  end if;
end;
V203_MOVE$;

grant execute on function public.move_level(uuid,text,int,text,text,text,text,text,text,text) to authenticated;

-- Keep create_level's existing V16.2 ranking behavior, but also record
-- every existing level displaced by a new insertion.
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
as $$V203_CREATE$
declare
  new_id uuid;
  target_section text;
  target_rank int;
  r record;
  overflow_id uuid;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_section not in ('main','extended','legacy') then raise exception 'invalid section'; end if;
  if nullif(trim(coalesce(p_verifier,'')),'') is null then raise exception 'verifier is required'; end if;

  target_section := p_section;
  target_rank := greatest(1,coalesce(p_rank,1));
  if target_section='main' then
    target_rank := least(45,target_rank);
  elsif target_section='extended' then
    target_rank := greatest(46,target_rank);
  else
    target_rank := greatest(101,target_rank);
  end if;

  -- Capture all sections that can be affected before any rank changes.
  create temp table _diddy_v203_before_create(
    id uuid primary key,
    section text not null,
    rank int not null
  ) on commit drop;

  insert into _diddy_v203_before_create(id,section,rank)
  select id,section,rank
  from public.levels
  where section=target_section
     or (target_section='main' and section='extended');

  if target_section='main' then
    for r in select id,rank from public.levels
      where section='main' and rank>=target_rank
      order by rank desc loop
      update public.levels set rank=r.rank+1 where id=r.id;
    end loop;

    -- If Main #45 was pushed to #46, make Extended #46 free first.
    select id into overflow_id
    from public.levels where section='main' and rank=46 limit 1;

    if overflow_id is not null then
      for r in select id,rank from public.levels
        where section='extended' and rank>=46
        order by rank desc loop
        update public.levels set rank=r.rank+1 where id=r.id;
      end loop;
    end if;
  elsif target_section='extended' then
    for r in select id,rank from public.levels
      where section='extended' and rank>=target_rank
      order by rank desc loop
      update public.levels set rank=r.rank+1 where id=r.id;
    end loop;
  else
    for r in select id,rank from public.levels
      where section='legacy' and rank>=target_rank
      order by rank desc loop
      update public.levels set rank=r.rank+1 where id=r.id;
    end loop;
  end if;

  insert into public.levels(section,rank,name,creator,verifier,holder,description,video_url,thumbnail_url)
  values(
    target_section,target_rank,p_name,
    nullif(trim(coalesce(p_creator,'')),''),
    nullif(trim(coalesce(p_verifier,'')),''),
    nullif(trim(coalesce(p_holder,'')),''),
    coalesce(p_description,''),
    nullif(trim(coalesce(p_video_url,'')),''),
    nullif(trim(coalesce(p_thumbnail_url,'')),'')
  ) returning id into new_id;

  -- Main overflow becomes Extended #46.
  select id into overflow_id
  from public.levels where section='main' and rank=46 limit 1;

  if overflow_id is not null then
    update public.levels set section='extended', rank=46 where id=overflow_id;
  end if;

  -- Record every displaced existing level.
  insert into public.placement_history(level_id,section,rank,points,note)
  select afters.id,afters.section,afters.rank,public.level_points(afters.rank),
         format('V2.0.3 placement: %s #%s -> %s #%s',before.section,before.rank,afters.section,afters.rank)
  from _diddy_v203_before_create before
  join public.levels afters on afters.id=before.id
  where before.section<>afters.section or before.rank<>afters.rank;

  insert into public.placement_history(level_id,section,rank,points,note)
  values(new_id,target_section,target_rank,public.level_points(target_rank),'V2.0.3 level added');

  return new_id;
end;
V203_CREATE$;

grant execute on function public.create_level(text,int,text,text,text,text,text,text,text) to authenticated;

notify pgrst,'reload schema';
