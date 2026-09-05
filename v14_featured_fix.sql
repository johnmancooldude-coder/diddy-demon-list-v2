-- DIDDY DEMON LIST V14 FEATURED LEVEL FIX (LEGACY-SAFE)
-- This intentionally uses the original `featured_level.id` column.
-- Older versions created featured_level(id uuid references levels(id)).
-- Run this AFTER your V13/V14 schema patches.

create or replace function public.set_featured_level(p_level_id uuid)
returns void
language plpgsql
security definer
set search_path=public
as $$
begin
  if not public.is_admin() then
    raise exception 'not admin';
  end if;

  if p_level_id is null then
    delete from public.featured_level;
    return;
  end if;

  if not exists (select 1 from public.levels where id=p_level_id) then
    raise exception 'level not found';
  end if;

  -- Keep exactly one featured row. The original schema stores the level UUID in `id`.
  delete from public.featured_level;
  insert into public.featured_level(id) values (p_level_id);
end;
$$;

grant execute on function public.set_featured_level(uuid) to authenticated;

-- Make sure public pages can read the selected level.
grant select on public.featured_level to anon, authenticated;

-- Refresh PostgREST after the function replacement.
notify pgrst, 'reload schema';
