-- DIDDY DEMON LIST V18 — RELIABILITY / SAFETY PATCH
-- Run once after the previous schema patches. Safe to run repeatedly.
-- Everything is additive; existing tables/data are preserved.

create table if not exists public.v18_activity_log(
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.v18_activity_log enable row level security;
do $$ begin create policy v18_activity_read on public.v18_activity_log for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy v18_activity_admin on public.v18_activity_log for all to authenticated using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
grant select on public.v18_activity_log to anon, authenticated;
grant insert, update, delete on public.v18_activity_log to authenticated;

create table if not exists public.v18_news_posts(
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  created_at timestamptz not null default now(),
  author_id uuid references auth.users(id) on delete set null
);
alter table public.v18_news_posts enable row level security;
do $$ begin create policy v18_news_read on public.v18_news_posts for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy v18_news_admin on public.v18_news_posts for all to authenticated using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
grant select on public.v18_news_posts to anon, authenticated;
grant insert, update, delete on public.v18_news_posts to authenticated;

create table if not exists public.v18_backups(
  id uuid primary key default gen_random_uuid(),
  label text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  payload jsonb not null
);
alter table public.v18_backups enable row level security;
do $$ begin create policy v18_backups_admin on public.v18_backups for all to authenticated using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
grant select, insert, update, delete on public.v18_backups to authenticated;

create index if not exists v18_activity_created_idx on public.v18_activity_log(created_at desc);
create index if not exists v18_activity_entity_idx on public.v18_activity_log(entity_type,entity_id,created_at desc);
create index if not exists v18_news_created_idx on public.v18_news_posts(created_at desc);
create index if not exists v18_backups_created_idx on public.v18_backups(created_at desc);

create or replace function public.v18_log(p_action text,p_entity_type text,p_entity_id uuid,p_summary text,p_details jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
  if auth.uid() is null then return null; end if;
  insert into public.v18_activity_log(actor_id,action,entity_type,entity_id,summary,details)
  values(auth.uid(),p_action,p_entity_type,p_entity_id,p_summary,coalesce(p_details,'{}'::jsonb)) returning id into aid;
  return aid;
end $$;
grant execute on function public.v18_log(text,text,uuid,text,jsonb) to authenticated;

create or replace function public.v18_activity_trigger()
returns trigger language plpgsql security definer set search_path=public as $$
declare eid uuid; summary text; action text;
begin
  eid:=coalesce(new.id,old.id);
  if tg_op='INSERT' then action:='created'; elsif tg_op='UPDATE' then action:='updated'; else action:='deleted'; end if;
  summary:=initcap(tg_table_name)||' '||action;
  if tg_table_name='levels' then
    summary:=case when tg_op='INSERT' then 'Level added: '||coalesce(new.name,'') else case when tg_op='UPDATE' then 'Level updated: '||coalesce(new.name,'') else 'Level deleted: '||coalesce(old.name,'') end end;
  elsif tg_table_name='records' then summary:='Victory record '||action;
  elsif tg_table_name='players' then summary:='Player '||action||': '||coalesce(new.name,old.name,'');
  elsif tg_table_name='changelog' then summary:='Changelog entry '||action||': '||coalesce(new.title,old.title,'');
  elsif tg_table_name='hall_entries' then summary:='Hall exhibit '||action||': '||coalesce(new.title,old.title,'');
  end if;
  insert into public.v18_activity_log(actor_id,action,entity_type,entity_id,summary,details)
  values(auth.uid(),action,tg_table_name,eid,summary,jsonb_build_object('operation',tg_op,'new',case when new is null then null else to_jsonb(new) end,'old',case when old is null then null else to_jsonb(old) end));
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

-- Triggers are intentionally additive and do not change existing behavior.
drop trigger if exists v18_levels_activity on public.levels;
create trigger v18_levels_activity after insert or update or delete on public.levels for each row execute function public.v18_activity_trigger();
drop trigger if exists v18_records_activity on public.records;
create trigger v18_records_activity after insert or update or delete on public.records for each row execute function public.v18_activity_trigger();
drop trigger if exists v18_players_activity on public.players;
create trigger v18_players_activity after insert or update or delete on public.players for each row execute function public.v18_activity_trigger();
drop trigger if exists v18_changelog_activity on public.changelog;
create trigger v18_changelog_activity after insert or update or delete on public.changelog for each row execute function public.v18_activity_trigger();
drop trigger if exists v18_hall_activity on public.hall_entries;
create trigger v18_hall_activity after insert or update or delete on public.hall_entries for each row execute function public.v18_activity_trigger();

create or replace function public.v18_capture_backup(p_label text default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare bid uuid; payload jsonb;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  payload:=jsonb_build_object(
    'version','V18',
    'exported_at',now(),
    'settings',coalesce((select jsonb_agg(to_jsonb(x)) from public.list_settings x),'[]'::jsonb),
    'points',coalesce((select jsonb_agg(to_jsonb(x) order by rank) from public.point_values x),'[]'::jsonb),
    'levels',coalesce((select jsonb_agg(to_jsonb(x) order by section,rank) from public.levels x),'[]'::jsonb),
    'players',coalesce((select jsonb_agg(to_jsonb(x) order by name) from public.players x),'[]'::jsonb),
    'records',coalesce((select jsonb_agg(to_jsonb(x) order by created_at) from public.records x),'[]'::jsonb),
    'placement_history',coalesce((select jsonb_agg(to_jsonb(x) order by recorded_at) from public.placement_history x),'[]'::jsonb),
    'hall_entries',coalesce((select jsonb_agg(to_jsonb(x) order by created_at) from public.hall_entries x),'[]'::jsonb),
    'changelog',coalesce((select jsonb_agg(to_jsonb(x) order by created_at) from public.changelog x),'[]'::jsonb),
    'featured_level',coalesce((select jsonb_agg(to_jsonb(x)) from public.featured_level x),'[]'::jsonb)
  );
  insert into public.v18_backups(label,created_by,payload) values(p_label,auth.uid(),payload) returning id into bid;
  return bid;
end $$;
grant execute on function public.v18_capture_backup(text) to authenticated;

create or replace function public.v18_get_latest_backup()
returns jsonb language plpgsql security definer set search_path=public stable as $$
declare result jsonb;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  select payload into result
  from public.v18_backups
  order by created_at desc
  limit 1;
  return result;
end $$;
grant execute on function public.v18_get_latest_backup() to authenticated;

create or replace function public.v18_publish_news(p_title text,p_body text,p_add_changelog boolean default true)
returns uuid language plpgsql security definer set search_path=public as $$
declare nid uuid;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'headline is required'; end if;
  if nullif(trim(coalesce(p_body,'')),'') is null then raise exception 'body is required'; end if;
  insert into public.v18_news_posts(title,body,author_id) values(trim(p_title),trim(p_body),auth.uid()) returning id into nid;
  if coalesce(p_add_changelog,true) then
    insert into public.changelog(title,body) values(trim(p_title),trim(p_body));
  end if;
  perform public.v18_log('published','news_posts',nid,'News published: '||trim(p_title),jsonb_build_object('also_changelog',coalesce(p_add_changelog,true)));
  return nid;
end $$;
grant execute on function public.v18_publish_news(text,text,boolean) to authenticated;

create or replace view public.v18_news_feed as
select n.id,'announcement'::text kind,n.created_at event_at,n.title,n.body,n.author_id player_id,null::uuid level_id
from public.v18_news_posts n
union all
select r.id,'victory'::text,r.created_at,
       coalesce(p.name,'A player')||' conquered #'||l.rank||' '||l.name,
       coalesce(case when r.video_url is not null then 'Proof attached.' else '' end,''),null::uuid,r.level_id
from public.records r join public.players p on p.id=r.player_id join public.levels l on l.id=r.level_id
union all
select ph.id,'placement'::text,ph.recorded_at,
       coalesce(l.name,'A level')||' is now #'||ph.rank,
       coalesce(ph.note,'Placement update.'),null::uuid,ph.level_id
from public.placement_history ph
left join public.levels l on l.id=ph.level_id;
grant select on public.v18_news_feed to anon,authenticated;

-- Reliable ranking engine. Uses an advisory lock and unique temporary ranks.
create or replace function public.v18_resequence_section(p_section text)
returns void language plpgsql security definer set search_path=public as $$
declare r record; n int;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_section not in ('main','extended','legacy') then raise exception 'invalid section'; end if;
  perform pg_advisory_xact_lock(hashtext('diddy_v18_ranking'));

  -- First move every row to a unique temporary rank so the (section,rank)
  -- unique constraint can never collide during resequencing.
  with t as (
    select id,row_number() over(order by rank,id)::int rn
    from public.levels
    where section=p_section
  )
  update public.levels l
  set rank=5000000+t.rn
  from t
  where l.id=t.id;

  n:=case when p_section='main' then 0
          when p_section='extended' then 45
          else 100 end;

  for r in
    select id from public.levels
    where section=p_section
    order by rank,id
  loop
    n:=n+1;
    update public.levels set rank=n where id=r.id;
  end loop;
end $$;
grant execute on function public.v18_resequence_section(text) to authenticated;

create or replace function public.v18_capture_backup_if_possible(p_label text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if public.is_admin() then perform public.v18_capture_backup(p_label); end if;
end $$;
grant execute on function public.v18_capture_backup_if_possible(text) to authenticated;

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
returns void language plpgsql security definer set search_path=public as $$
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

  insert into public.placement_history(level_id,section,rank,points,note)
  select p_level_id,l.section,l.rank,public.level_points(l.rank),
         format('V18 placement: %s #%s -> %s #%s',old_section,old_rank,l.section,l.rank)
  from public.levels l
  where l.id=p_level_id;
end $$;
grant execute on function public.v18_move_level(uuid,text,int,text,text,text,text,text,text,text) to authenticated;

create or replace function public.v18_create_level(
  p_section text,
  p_rank int,
  p_name text,
  p_creator text default '',
  p_verifier text default '',
  p_holder text default '',
  p_description text default '',
  p_video_url text default null,
  p_thumbnail_url text default null
)
returns uuid language plpgsql security definer set search_path=public as $$
declare
  nid uuid;
  target int;
  r record;
  n int;
  old_count int;
  overflow_id uuid;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_section not in ('main','extended','legacy') then raise exception 'invalid section'; end if;
  if nullif(trim(coalesce(p_verifier,'')),'') is null then
    raise exception 'verifier is required';
  end if;

  perform pg_advisory_xact_lock(hashtext('diddy_v18_ranking'));
  perform public.v18_capture_backup('Before adding level: '||coalesce(p_name,'level'));

  target:=greatest(1,coalesce(p_rank,1));
  if p_section='main' then
    target:=least(45,target);
  elsif p_section='extended' then
    target:=greatest(46,target);
  else
    target:=greatest(101,target);
  end if;

  -- Park destination rows first so the unique (section,rank) constraint
  -- cannot collide while we insert and shift levels.
  with t as (
    select id,row_number() over(order by rank,id)::int rn
    from public.levels
    where section=p_section
  )
  update public.levels l
  set rank=6000000+t.rn
  from t
  where l.id=t.id;

  insert into public.levels(
    section,rank,name,creator,verifier,holder,description,video_url,thumbnail_url
  )
  values(
    p_section,
    900000000,
    p_name,
    nullif(trim(p_creator),''),
    nullif(trim(p_verifier),''),
    nullif(trim(p_holder),''),
    coalesce(p_description,''),
    nullif(trim(coalesce(p_video_url,'')),''),
    nullif(trim(coalesce(p_thumbnail_url,'')),'')
  )
  returning id into nid;

  -- Rebuild destination around the insertion point.
  n:=case when p_section='main' then 0
          when p_section='extended' then 45
          else 100 end;
  for r in
    select id from public.levels
    where section=p_section and id<>nid
    order by rank,id
  loop
    if n+1=target then n:=n+1; end if;
    n:=n+1;
    update public.levels set rank=n where id=r.id;
  end loop;

  update public.levels set rank=target where id=nid;

  -- Main is capped at 45. Push the lowest level beyond #45 into Extended.
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

  insert into public.placement_history(level_id,section,rank,points,note)
  select nid,l.section,l.rank,public.level_points(l.rank),
         'V18 level added at requested position'
  from public.levels l
  where l.id=nid;

  return nid;
end $$;
grant execute on function public.v18_create_level(text,int,text,text,text,text,text,text,text) to authenticated;

notify pgrst,'reload schema';
