-- DIDDY DEMON LIST V12 ATOMIC PATCH
-- Run AFTER the existing V10/V11 schema. Safe to run repeatedly.

create table if not exists public.level_votes (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  voter_key text not null,
  rating int not null check(rating between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(level_id,voter_key)
);

alter table public.level_votes enable row level security;
do $$ begin
  create policy level_votes_read on public.level_votes for select using(true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy level_votes_insert on public.level_votes for insert with check(length(voter_key) between 16 and 128 and rating between 1 and 5);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy level_votes_update on public.level_votes for update using(true) with check(length(voter_key) between 16 and 128 and rating between 1 and 5);
exception when duplicate_object then null; end $$;
grant select,insert,update on public.level_votes to anon,authenticated;

-- Public helper: aggregated community pulse. This is not an official list score.
create or replace view public.level_vote_summary as
select level_id, count(*)::int vote_count, round(avg(rating),2)::numeric average_rating,
       count(*) filter(where rating>=4)::int hype_votes
from public.level_votes group by level_id;
grant select on public.level_vote_summary to anon,authenticated;

-- Keep an updated timestamp on votes.
create or replace function public.touch_level_vote() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
drop trigger if exists level_votes_updated on public.level_votes;
create trigger level_votes_updated before update on public.level_votes for each row execute function public.touch_level_vote();
