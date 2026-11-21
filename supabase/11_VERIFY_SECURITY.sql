-- DAG Esports | SECURITY VERIFICATION (read-only)
-- Run as postgres in Supabase SQL Editor, after BOTH stages.
-- Confirm the statements below, then test app with anon, viewer, coach and manager accounts.
select a.management_role, count(*) as accounts
from public.admin_users a group by a.management_role order by a.management_role;

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and grantee in ('anon','authenticated')
  and table_name in (
    'players','match_player_stats','matches',
    'public_player_profiles','public_match_player_stats',
    'team_achievements','weekly_player_reports','planner_plans'
  )
order by table_name, grantee, privilege_type;

select schemaname, tablename, policyname, cmd, roles, qual, with_check
from pg_policies where schemaname='public'
  and tablename in (
    'players','match_player_stats','matches','weekly_player_reports',
    'team_achievements','planner_plans'
  )
order by tablename, policyname;

-- These should be false for anonymous table reads, true for safe views.
select
  has_table_privilege('anon','public.players','SELECT') as anon_players_base_read,
  has_table_privilege('anon','public.match_player_stats','SELECT') as anon_stats_base_read,
  has_table_privilege('anon','public.public_player_profiles','SELECT') as anon_public_roster_view,
  has_table_privilege('anon','public.public_match_player_stats','SELECT') as anon_public_stats_view;

-- New records should pass these checks. Inspect/repair legacy mismatches
-- MANUALLY before validating old records; do not silently turn 0-0 into DRAW.
select m.id, m.team, m.match_date, m.opponent_name, m.status,
  m.result, m.dag_score, m.opponent_score
from public.matches m
where not (
  m.status is not null and m.result is not null and (
    (m.status='completed' and m.dag_score is not null and m.opponent_score is not null
      and m.dag_score >= 0 and m.opponent_score >= 0
      and (
        (m.dag_score > m.opponent_score and m.result='WIN') or
        (m.dag_score < m.opponent_score and m.result='LOSS') or
        (m.dag_score = m.opponent_score and m.result='DRAW')
      ))
    or (m.status in ('upcoming','awaiting_result','cancelled') and m.result='PENDING')
  )
) or m.status is null or m.result is null
order by m.match_date desc;

-- MANUAL VERIFICATION LIST: 0-0 DRAW is not automatically fraudulent,
-- but older code generated this status for overdue scheduled matches.
select id, team, match_date, opponent_name, status, result, dag_score, opponent_score
from public.matches
where status='completed' and result='DRAW' and dag_score=0 and opponent_score=0
order by match_date desc;

-- Validate the two new NOT VALID constraints only after correcting historical
-- mismatches and confirming genuine draws; leave commented otherwise.
-- alter table public.matches validate constraint dag_match_status_values;
-- alter table public.matches validate constraint dag_match_status_result_consistency;
