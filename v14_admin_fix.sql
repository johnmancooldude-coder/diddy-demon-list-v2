-- DIDDY DEMON LIST V14 ADMIN AUTH FIX
-- Run this once if V14 says you are not an admin even though your admin row exists.

-- The admin check uses this SECURITY DEFINER function so RLS on public.admins
-- cannot accidentally hide the current user's admin row from the admin gate.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path=public
stable
as $$
  select exists (select 1 from public.admins where user_id=auth.uid());
$$;

grant execute on function public.is_admin() to authenticated;

-- Keep direct role lookup available to the signed-in admin.
grant select on public.admins to authenticated;

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins
for select
to authenticated
using (user_id=auth.uid());

