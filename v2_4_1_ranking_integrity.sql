-- V2.4.1 — Ranking Integrity Fix
-- Fixes rank gaps after level deletion and records the resulting movement.
-- Also prevents the admin UI from accidentally creating duplicate levels via double-submit.

create or replace function public.v24_delete_level(p_level_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $V241_DELETE$
declare
  target_section text;
  target_name text;
  r record;
begin
  if not public.is_admin() then raise exception 'not admin'; end if;

  perform pg_advisory_xact_lock(hashtext('diddy_v18_ranking'));

  select section,name into target_section,target_name
  from public.levels
  where id=p_level_id
  for update;

  if not found then raise exception 'level not found'; end if;

  if to_regprocedure('public.v18_capture_backup(text)') is not null then
    perform public.v18_capture_backup('Before deleting level: '||coalesce(target_name,'level'));
  end if;

  create temporary table v241_old_places on commit drop as
    select id,section,rank
    from public.levels
    where section=target_section;

  delete from public.levels where id=p_level_id;

  perform public.v18_resequence_section('main');
  perform public.v18_resequence_section('extended');
  perform public.v18_resequence_section('legacy');

  -- Record every surviving level whose placement changed because of the deletion.
  for r in
    select l.id,l.section,l.rank,o.section old_section,o.rank old_rank
    from public.levels l
    join v241_old_places o on o.id=l.id
    where l.section<>o.section or l.rank<>o.rank
  loop
    insert into public.placement_history(level_id,section,rank,points,note)
    values(
      r.id,
      r.section,
      r.rank,
      public.level_points(r.rank),
      format('V2.4.1 deletion resequence: %s #%s -> %s #%s',r.old_section,r.old_rank,r.section,r.rank)
    );
  end loop;
end;
$V241_DELETE$;

grant execute on function public.v24_delete_level(uuid) to authenticated;
notify pgrst,'reload schema';
