-- DAG Esports 09B | PUBLIC PROFILE FIELDS (after 09_SECURITY_PREPARE)
-- RUN IN SUPABASE SQL EDITOR as postgres, only after Stage 1 succeeded.
-- Additive: does not change RLS or expose date_of_birth / MLBB IDs.
-- "Location" comes from players.stay: enter only a general area, NEVER a
-- home address or other sensitive location in public-facing records.
begin;
do $$
begin
  if to_regclass('public.public_player_profiles') is null then
    raise exception 'Run 09_SECURITY_PREPARE.sql first. public_player_profiles does not exist.';
  end if;
end $$;

-- PostgreSQL CREATE OR REPLACE VIEW permits new columns added at the END.
-- Keep the original seven columns in the same order for already-run Stage 1.
create or replace view public.public_player_profiles
with (security_barrier = true) as
select
  p.id, p.team, p.ign, p.role, p.main_hero, p.image_url, p.achievements,
  p.full_name,
  p.stay,
  case
    when p.date_of_birth is not null then
      extract(year from age(current_date, p.date_of_birth))::integer
    else p.age
  end as age
from public.players p;

revoke all on public.public_player_profiles from public;
grant select on public.public_player_profiles to anon, authenticated;
commit;

notify pgrst, 'reload schema';

-- Check the public view columns (DOB and MLBB ID/server must NOT appear).
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'public_player_profiles'
order by ordinal_position;
