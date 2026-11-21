-- DAG Esports SECURITY PREPARE | STAGE 1 OF 2
-- RUN AS postgres in Supabase SQL Editor, after backing up project/database.
-- This stage is ADDITIVE. It does not revoke old privileges or replace RLS.
-- DO NOT consider the project protected until stage 2 is applied.
begin;
do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Run as postgres in Supabase SQL Editor. Actual role: %', current_user;
  end if;
  if to_regclass('public.players') is null
     or to_regclass('public.match_player_stats') is null
     or to_regclass('public.admin_users') is null then
    raise exception 'Existing DAG tables are missing; abort without changes.';
  end if;
end $$;

-- Backward-compatible: all currently approved accounts retain manager-level
-- permissions until an owner explicitly assigns coach or viewer roles.
alter table public.admin_users
  add column if not exists management_role text not null default 'manager';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.admin_users'::regclass
      and conname = 'dag_management_role_allowed'
  ) then
    alter table public.admin_users
      add constraint dag_management_role_allowed
      check (management_role in ('owner', 'manager', 'coach', 'viewer'));
  end if;
end $$;

-- Functions are SECURITY DEFINER, but return only the caller's own role.
-- Do not make management administration an RPC: role assignment is SQL-owner only.
create or replace function public.my_management_role()
returns text language sql stable security definer set search_path = ''
as $fn$
  select coalesce(
    (select a.management_role from public.admin_users a
      where a.user_id = (select auth.uid())),
    'none'
  );
$fn$;
revoke all on function public.my_management_role() from public, anon;
grant execute on function public.my_management_role() to authenticated;

create or replace function public.can_manage_dag(action text)
returns boolean language sql stable security definer set search_path = ''
as $fn$
  select coalesce(
    case (select public.my_management_role())
      when 'owner' then action = any(array[
        'view_private_roster', 'edit_roster', 'edit_matches', 'delete_matches',
        'edit_evaluations', 'edit_reports', 'edit_achievements', 'edit_planner'
      ])
      when 'manager' then action = any(array[
        'view_private_roster', 'edit_roster', 'edit_matches', 'delete_matches',
        'edit_evaluations', 'edit_reports', 'edit_achievements', 'edit_planner'
      ])
      when 'coach' then action = any(array[
        'edit_matches', 'edit_evaluations', 'edit_reports'
      ])
      else false
    end, false
  );
$fn$;
revoke all on function public.can_manage_dag(text) from public, anon;
grant execute on function public.can_manage_dag(text) to authenticated;

-- The public views intentionally exclude PII, match-specific private comments,
-- absence reasons, and internal player identifiers such as MLBB account ID.
-- Views are owned by postgres (not security_invoker), and expose only listed columns.
create or replace view public.public_player_profiles
with (security_barrier = true) as
select id, team, ign, role, main_hero, image_url, achievements
from public.players;

create or replace view public.public_match_player_stats
with (security_barrier = true) as
select id, match_id, ign, status, kills, deaths, assists,
  mechanics_score, macro_score, communication_score,
  role_execution_score, discipline_score, hero_pool_score
from public.match_player_stats;

revoke all on public.public_player_profiles from public;
revoke all on public.public_match_player_stats from public;
grant select on public.public_player_profiles to anon, authenticated;
grant select on public.public_match_player_stats to anon, authenticated;

-- New statuses are prospective. NOT VALID keeps existing records intact.
-- Scores are not changed, and historical 0-0 DRAW records need manual review.
do $$
begin
  if not exists (select 1 from pg_constraint
    where conrelid='public.matches'::regclass and conname='dag_match_status_values') then
    alter table public.matches add constraint dag_match_status_values
      check (status in ('upcoming','awaiting_result','completed','cancelled')) not valid;
  end if;
end $$;

commit;

-- Safe role inventory (Supabase SQL Editor only; do not paste user emails publicly).
select a.user_id, a.management_role, a.created_at
from public.admin_users a order by a.created_at;

-- IMPORTANT: Stage 2 must follow successful app-preview smoke tests.
