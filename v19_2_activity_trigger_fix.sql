-- V19.2 Activity Trigger Fix
-- Fixes: record "old" has no field "title"
-- Safe to run after the V18/V19 schema. No data is deleted.

create or replace function public.v18_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path=public
as $v19activity$
declare
  eid uuid;
  summary text;
  action text;
  row_data jsonb;
  row_name text;
  row_title text;
begin
  if tg_op = 'DELETE' then
    eid := old.id;
    row_data := to_jsonb(old);
    action := 'deleted';
  else
    eid := new.id;
    row_data := to_jsonb(new);
    action := case when tg_op = 'INSERT' then 'created' else 'updated' end;
  end if;

  row_name := row_data->>'name';
  row_title := row_data->>'title';
  summary := initcap(tg_table_name)||' '||action;

  if tg_table_name = 'levels' then
    summary := 'Level '||case when action='created' then 'added: ' else case when action='updated' then 'updated: ' else 'deleted: ' end end||coalesce(row_name,'');
  elsif tg_table_name = 'records' then
    summary := 'Victory record '||action;
  elsif tg_table_name = 'players' then
    summary := 'Player '||action||case when row_name is not null then ': '||row_name else '' end;
  elsif tg_table_name = 'changelog' then
    summary := 'Changelog entry '||action||case when row_title is not null then ': '||row_title else '' end;
  elsif tg_table_name = 'hall_entries' then
    summary := 'Hall exhibit '||action||case when row_title is not null then ': '||row_title else '' end;
  end if;

  insert into public.v18_activity_log(actor_id,action,entity_type,entity_id,summary,details)
  values(
    auth.uid(),
    action,
    tg_table_name,
    eid,
    summary,
    jsonb_build_object(
      'operation',tg_op,
      'new',case when tg_op='DELETE' then null else to_jsonb(new) end,
      'old',case when tg_op='INSERT' then null else to_jsonb(old) end
    )
  );

  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$v19activity$;

grant execute on function public.v18_activity_trigger() to authenticated;

-- Recreate the five V18 activity triggers so the corrected function is definitely active.
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
