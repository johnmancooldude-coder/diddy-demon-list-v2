-- V14 FEATURED LEVEL FIX 3 — schema-independent
-- Run this AFTER your existing V12/V13/V14 patches.
-- This version works whether featured_level has only id, only level_id, or both.

create or replace function public.get_featured_level()
returns uuid
language plpgsql
security definer
set search_path=public
stable
as $$
declare
  result uuid;
  has_id boolean;
  has_level_id boolean;
begin
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='featured_level' and column_name='id') into has_id;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='featured_level' and column_name='level_id') into has_level_id;
  if has_level_id then
    execute 'select level_id from public.featured_level where level_id is not null limit 1' into result;
  elsif has_id then
    execute 'select id from public.featured_level where id is not null limit 1' into result;
  end if;
  return result;
end;
$$;

grant execute on function public.get_featured_level() to anon, authenticated;

create or replace function public.set_featured_level(p_level_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  has_id boolean;
  has_level_id boolean;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if p_level_id is not null and not exists(select 1 from public.levels where id=p_level_id) then raise exception 'level not found'; end if;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='featured_level' and column_name='id') into has_id;
  select exists(select 1 from information_schema.columns where table_schema='public' and table_name='featured_level' and column_name='level_id') into has_level_id;
  delete from public.featured_level;
  if p_level_id is null then return; end if;
  if has_id and has_level_id then
    execute 'insert into public.featured_level(id,level_id) values ($1,$1)' using p_level_id;
  elsif has_level_id then
    execute 'insert into public.featured_level(level_id) values ($1)' using p_level_id;
  elsif has_id then
    execute 'insert into public.featured_level(id) values ($1)' using p_level_id;
  else
    raise exception 'featured_level table has no supported level column';
  end if;
end;
$$;

grant execute on function public.set_featured_level(uuid) to authenticated;
notify pgrst, 'reload schema';
