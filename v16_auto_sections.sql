-- DIDDY DEMON LIST V16
-- Admin ordering + correct insertion behavior
-- Main #1-45 | Extended #46+ | Legacy #101+

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
  target_section text;
  target_rank int;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_new_section not in ('main','extended','legacy') then raise exception 'invalid section'; end if;
  if not exists(select 1 from public.levels where id=p_level_id) then raise exception 'level not found'; end if;

  target_section:=p_new_section;
  target_rank:=greatest(1,coalesce(p_new_rank,1));
  if target_section='main' then target_rank:=least(45,target_rank);
  elsif target_section='extended' then target_rank:=greatest(46,target_rank);
  else target_rank:=greatest(101,target_rank);
  end if;

  create temporary table if not exists _v16_before(id uuid primary key,section text,rank int) on commit drop;
  truncate _v16_before;
  insert into _v16_before select id,section,rank from public.levels;

  update public.levels set rank=rank+1000000 where true;

  update public.levels
  set section=target_section, rank=target_rank, name=p_name,
      creator=p_creator, verifier=p_verifier, holder=p_holder,
      description=coalesce(p_description,''),
      video_url=nullif(trim(coalesce(p_video_url,'')),''),
      thumbnail_url=nullif(trim(coalesce(p_thumbnail_url,'')),'')
  where id=p_level_id;

  -- Rebuild Main. Levels at/after the requested position move down.
  with ordered as (
    select l.id,row_number() over(order by
      case when l.id=p_level_id and target_section='main' then target_rank
           when b.section='main' then (b.rank + case when b.rank>=target_rank and target_section='main' then 1 else 0 end)
           else 1000000000 end,l.id)::int new_rank
    from public.levels l join _v16_before b on b.id=l.id
    where l.section='main'
  )
  update public.levels l set rank=o.new_rank from ordered o where l.id=o.id;

  -- Main overflow becomes Extended.
  update public.levels set section='extended' where section='main' and rank>45;

  -- Rebuild Extended from #46. Existing Extended insertion works at any requested rank.
  with ordered as (
    select l.id,
      45+row_number() over(order by
        case
          when l.id=p_level_id and target_section='extended' then target_rank-45
          when b.section='main' then l.rank
          when b.section='extended' then b.rank + case when target_section='extended' and b.rank>=target_rank then 1 else 0 end
          else 1000000000
        end,l.id)::int new_rank
    from public.levels l join _v16_before b on b.id=l.id
    where l.section='extended'
  )
  update public.levels l set rank=o.new_rank from ordered o where l.id=o.id;

  -- Rebuild Legacy from #101.
  with ordered as (
    select id,100+row_number() over(order by rank,id)::int new_rank
    from public.levels where section='legacy'
  )
  update public.levels l set rank=o.new_rank from ordered o where l.id=o.id;

  insert into public.placement_history(level_id,section,rank,points,note)
  select l.id,l.section,l.rank,public.level_points(l.rank),
         format('V16 placement change: %s #%s -> %s #%s',b.section,b.rank,l.section,l.rank)
  from public.levels l join _v16_before b on b.id=l.id
  where b.section<>l.section or b.rank<>l.rank;
end;
$$;

grant execute on function public.move_level(uuid,text,int,text,text,text,text,text,text,text) to authenticated;

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
  if nullif(trim(coalesce(p_verifier,'')),'') is null then raise exception 'verifier is required'; end if;

  target_section:=p_section;
  target_rank:=greatest(1,coalesce(p_rank,1));
  if target_section='main' then target_rank:=least(45,target_rank);
  elsif target_section='extended' then target_rank:=greatest(46,target_rank);
  else target_rank:=greatest(101,target_rank);
  end if;

  create temporary table if not exists _v16_before_create(id uuid primary key,section text,rank int) on commit drop;
  truncate _v16_before_create;
  insert into _v16_before_create select id,section,rank from public.levels;

  update public.levels set rank=rank+1000000 where true;

  insert into public.levels(section,rank,name,creator,verifier,holder,description,video_url,thumbnail_url)
  values(target_section,target_rank,p_name,
         nullif(trim(coalesce(p_creator,'')),''),nullif(trim(coalesce(p_verifier,'')),''),
         nullif(trim(coalesce(p_holder,'')),''),coalesce(p_description,''),
         nullif(trim(coalesce(p_video_url,'')),''),nullif(trim(coalesce(p_thumbnail_url,'')),''))
  returning id into new_id;

  -- Rebuild Main with real insertion-position behavior.
  with ordered as (
    select l.id,row_number() over(order by
      case when l.id=new_id and target_section='main' then target_rank
           when b.section='main' then (b.rank + case when b.rank>=target_rank and target_section='main' then 1 else 0 end)
           else 1000000000 end,l.id)::int new_rank
    from public.levels l join _v16_before_create b on b.id=l.id
    where l.section='main'
  )
  update public.levels l set rank=o.new_rank from ordered o where l.id=o.id;

  -- Main overflow automatically moves to Extended.
  update public.levels set section='extended' where section='main' and rank>45;

  -- Rebuild Extended correctly. A new Extended level can be inserted at #46, #60, etc.
  with ordered as (
    select l.id,
      45+row_number() over(order by
        case
          when l.id=new_id and target_section='extended' then target_rank-45
          when b.section='main' then l.rank
          when b.section='extended' then b.rank + case when target_section='extended' and b.rank>=target_rank then 1 else 0 end
          else 1000000000
        end,l.id)::int new_rank
    from public.levels l join _v16_before_create b on b.id=l.id
    where l.section='extended' or l.id=new_id
  )
  update public.levels l set rank=o.new_rank from ordered o where l.id=o.id;

  -- Rebuild Legacy from #101.
  with ordered as (
    select id,100+row_number() over(order by rank,id)::int new_rank
    from public.levels where section='legacy'
  )
  update public.levels l set rank=o.new_rank from ordered o where l.id=o.id;

  insert into public.placement_history(level_id,section,rank,points,note)
  select id,section,rank,public.level_points(rank),'Level added'
  from public.levels where id=new_id;

  return new_id;
end;
$$;

grant execute on function public.create_level(text,int,text,text,text,text,text,text,text) to authenticated;
notify pgrst,'reload schema';
