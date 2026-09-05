-- DIDDY DEMON LIST V17.1 — CONTENT PUBLISH FIX
-- Run after V17 schema patches. This makes Admin publishing use verified RPCs.

create or replace function public.v17_publish_announcement(p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'headline is required'; end if;
  if nullif(trim(coalesce(p_body,'')),'') is null then raise exception 'body is required'; end if;
  insert into public.changelog(title,body) values(trim(p_title),trim(p_body)) returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.v17_publish_announcement(text,text) to authenticated;

create or replace function public.v17_add_hall_entry(
  p_category text,
  p_title text,
  p_body text,
  p_year int default null,
  p_player_id uuid default null,
  p_level_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare new_id uuid;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;
  if nullif(trim(coalesce(p_category,'')),'') is null then raise exception 'category is required'; end if;
  if nullif(trim(coalesce(p_title,'')),'') is null then raise exception 'title is required'; end if;
  if nullif(trim(coalesce(p_body,'')),'') is null then raise exception 'story/body is required'; end if;
  insert into public.hall_entries(category,title,body,year,player_id,level_id)
  values(trim(p_category),trim(p_title),trim(p_body),p_year,p_player_id,p_level_id)
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.v17_add_hall_entry(text,text,text,int,uuid,uuid) to authenticated;

notify pgrst,'reload schema';
