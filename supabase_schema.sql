create extension if not exists pgcrypto;
create table if not exists public.list_settings(id uuid primary key default gen_random_uuid(),list_name text not null default 'DIDDY DEMON LIST',tagline text default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now());
insert into public.list_settings(list_name,tagline) select 'DIDDY DEMON LIST','The most scientifically questionable demon list on Earth.' where not exists(select 1 from public.list_settings);
create table if not exists public.admins(user_id uuid primary key references auth.users(id) on delete cascade,role text not null default 'admin' check(role in('owner','admin','moderator')));
create table if not exists public.point_values(rank int primary key check(rank between 1 and 100),points int not null check(points>=0));
insert into public.point_values(rank,points) select r, greatest(1,round(100-99*power((r-1)::numeric/99,.62)))::int from generate_series(1,100) r on conflict do nothing;
create table if not exists public.levels(id uuid primary key default gen_random_uuid(),section text not null check(section in('main','extended','legacy')),rank int not null,name text not null,creator text,verifier text,holder text,video_url text,thumbnail_url text,description text default '',difficulty text,status text,aliases text,notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(section,rank));
create table if not exists public.players(id uuid primary key default gen_random_uuid(),name text not null unique,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.records(id uuid primary key default gen_random_uuid(),player_id uuid not null references public.players(id) on delete cascade,level_id uuid not null references public.levels(id) on delete cascade,progress int not null default 100 check(progress between 0 and 100),video_url text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(player_id,level_id));
create table if not exists public.placement_history(id uuid primary key default gen_random_uuid(),level_id uuid not null references public.levels(id) on delete cascade,section text not null,rank int not null,points int not null,recorded_at timestamptz not null default now(),note text);
create table if not exists public.featured_level(id uuid references public.levels(id) on delete set null);
create table if not exists public.changelog(id uuid primary key default gen_random_uuid(),title text not null,body text not null,created_at timestamptz not null default now());
create or replace function public.is_admin() returns boolean language sql security definer set search_path=public stable as $$ select exists(select 1 from public.admins where user_id=auth.uid()); $$;
create or replace function public.sync_level_points() returns trigger language plpgsql security definer set search_path=public as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists levels_updated on public.levels; create trigger levels_updated before update on public.levels for each row execute function public.sync_level_points();
create or replace function public.move_level(p_level_id uuid,p_new_section text,p_new_rank int,p_name text,p_creator text,p_verifier text,p_holder text,p_description text,p_video_url text,p_thumbnail_url text) returns void language plpgsql security definer set search_path=public as $$ declare old_section text; old_rank int; target_rank int; cur record; begin if not public.is_admin() then raise exception 'not admin'; end if; select section,rank into old_section,old_rank from public.levels where id=p_level_id for update; if not found then raise exception 'level not found'; end if; target_rank=greatest(1,p_new_rank); update public.levels set rank=rank+10000 where section=p_new_section and id<>p_level_id and rank>=target_rank; update public.levels set section=p_new_section,rank=target_rank,name=p_name,creator=p_creator,verifier=p_verifier,holder=p_holder,description=p_description,video_url=nullif(p_video_url,''),thumbnail_url=nullif(p_thumbnail_url,'') where id=p_level_id; with ranked as(select id,row_number() over(order by rank,id)::int r from public.levels where section=p_new_section) update public.levels l set rank=ranked.r from ranked where l.id=ranked.id; if old_section is not null then with ranked as(select id,row_number() over(order by rank,id)::int r from public.levels where section=old_section) update public.levels l set rank=ranked.r from ranked where l.id=ranked.id; end if; insert into public.placement_history(level_id,section,rank,points,note) select p_level_id,p_new_section,target_rank,p.points,case when old_section<>p_new_section or old_rank<>target_rank then 'Placement changed' else 'Level edited' end from public.point_values p where p.rank=least(100,target_rank); end $$;
create or replace function public.create_level(
  p_section text, p_rank int, p_name text, p_creator text default '', p_verifier text default '',
  p_holder text default '', p_description text default '', p_video_url text default null, p_thumbnail_url text default null
) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid; target_rank int; begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_section not in ('main','extended','legacy') then raise exception 'invalid section'; end if;
  if nullif(trim(p_verifier),'') is null then raise exception 'verifier is required'; end if;
  target_rank=greatest(1,p_rank);
  update public.levels set rank=rank+10000 where section=p_section and rank>=target_rank;
  update public.levels set rank=rank-9999 where section=p_section and rank>=target_rank+10000;
  insert into public.levels(section,rank,name,creator,verifier,holder,description,video_url,thumbnail_url)
    values(p_section,target_rank,p_name,nullif(trim(p_creator),''),nullif(trim(p_verifier),''),nullif(trim(p_holder),''),
           coalesce(p_description,''),nullif(trim(p_video_url),''),nullif(trim(p_thumbnail_url),'')) returning id into new_id;
  insert into public.placement_history(level_id,section,rank,points,note)
    select new_id,p_section,target_rank,coalesce((select points from public.point_values where rank=least(100,target_rank)),0),'Level added';
  return new_id;
end $$;
create or replace function public.add_victory(p_player_id uuid,p_level_id uuid,p_progress int default 100,p_video_url text default null) returns int language plpgsql security definer set search_path=public as $$
declare earned int; begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if not exists(select 1 from public.players where id=p_player_id) then raise exception 'player not found'; end if;
  select public.level_points(l.rank) into earned from public.levels l where l.id=p_level_id;
  if earned is null then raise exception 'level not found'; end if;
  insert into public.records(player_id,level_id,progress,video_url)
    values(p_player_id,p_level_id,coalesce(p_progress,100),nullif(p_video_url,''))
    on conflict(player_id,level_id) do update set progress=excluded.progress,video_url=excluded.video_url,updated_at=now();
  return earned;
end $$;
create or replace function public.level_points(level_rank int) returns int language sql stable as $$ select coalesce((select points from public.point_values where rank=level_rank),0); $$;
create or replace view public.player_leaderboard as select p.id,p.name,coalesce(sum(public.level_points(l.rank)),0)::int total_points,count(r.id)::int victors,min(l.rank) highest_victory,case when count(r.id)>0 then round(avg(l.rank),1) else null end average_placement from public.players p left join public.records r on r.player_id=p.id left join public.levels l on l.id=r.level_id group by p.id,p.name;
-- Public reads.
alter table public.list_settings enable row level security; alter table public.point_values enable row level security; alter table public.levels enable row level security; alter table public.players enable row level security; alter table public.records enable row level security; alter table public.placement_history enable row level security; alter table public.changelog enable row level security; alter table public.admins enable row level security; alter table public.featured_level enable row level security;
do $$ begin create policy settings_read on public.list_settings for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy points_read on public.point_values for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy levels_read on public.levels for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy players_read on public.players for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy records_read on public.records for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy history_read on public.placement_history for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy featured_read on public.featured_level for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy featured_write on public.featured_level for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy changelog_read on public.changelog for select using(true); exception when duplicate_object then null; end $$;
do $$ begin create policy admins_self on public.admins for select using(user_id=auth.uid()); exception when duplicate_object then null; end $$;
do $$ begin create policy settings_write on public.list_settings for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy points_write on public.point_values for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy levels_write on public.levels for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy players_write on public.players for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy records_write on public.records for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy history_write on public.placement_history for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
do $$ begin create policy changelog_write on public.changelog for all using(public.is_admin()) with check(public.is_admin()); exception when duplicate_object then null; end $$;
