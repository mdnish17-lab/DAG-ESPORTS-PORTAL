-- DAG Esports SECURITY LOCKDOWN | STAGE 2 OF 2
-- RUN ONLY AFTER:
-- 1) Stage 1 (09_SECURITY_PREPARE.sql) completed successfully.
-- 2) Website code using public_* views is deployed and tested.
-- 3) Public roster/evaluation and owner/manager admin work correctly.
-- 4) DB backup is verified. This script changes API read/write permissions.
--
-- Existing approved admin_users default to 'manager' after Stage 1.
-- Coaches can edit matches, evaluations, reports (but cannot delete matches).
-- Viewers have read-only admin access, without private roster fields.
-- Owner/manager retain private roster and all write permissions.
begin;

do $$
begin
  if current_user <> 'postgres' then
    raise exception 'Run stage 2 as postgres. Actual role: %', current_user;
  end if;
  if to_regprocedure('public.can_manage_dag(text)') is null
    or to_regclass('public.public_player_profiles') is null
    or to_regclass('public.public_match_player_stats') is null then
    raise exception 'Stage 1 has not been applied. Abort.';
  end if;
end $$;

-- Wipe old permissive RLS policies ONLY for the tables listed here and rebuild
-- explicit authorization rules. This happens inside a single transaction.
do $$
declare tbl text;
declare old_policy record;
begin
  foreach tbl in array array[
    'players', 'matches', 'match_player_stats',
    'team_achievements', 'planner_plans', 'weekly_player_reports'
  ] loop
    execute format('alter table public.%I enable row level security', tbl);
    for old_policy in select policyname from pg_policies
      where schemaname='public' and tablename=tbl loop
      execute format('drop policy %I on public.%I', old_policy.policyname, tbl);
    end loop;
  end loop;
end $$;

-- Base players is PRIVATE (all columns can contain personal information).
-- Public and read-only accounts use the safe public_player_profiles view.
revoke all on public.players from public, anon, authenticated;
grant select, insert, update, delete on public.players to authenticated;
create policy dag_private_player_read on public.players for select
  to authenticated using ((select public.can_manage_dag('view_private_roster')));
create policy dag_player_insert on public.players for insert
  to authenticated with check ((select public.can_manage_dag('edit_roster')));
create policy dag_player_update on public.players for update
  to authenticated using ((select public.can_manage_dag('edit_roster')))
  with check ((select public.can_manage_dag('edit_roster')));
create policy dag_player_delete on public.players for delete
  to authenticated using ((select public.can_manage_dag('edit_roster')));

-- Matches remain public; only management or coaches may register/edit results.
revoke all on public.matches from public, anon, authenticated;
grant select on public.matches to anon, authenticated;
grant insert, update, delete on public.matches to authenticated;
create policy dag_matches_public_read on public.matches for select
  to anon, authenticated using (true);
create policy dag_matches_insert on public.matches for insert
  to authenticated with check ((select public.can_manage_dag('edit_matches')));
create policy dag_matches_update on public.matches for update
  to authenticated using ((select public.can_manage_dag('edit_matches')))
  with check ((select public.can_manage_dag('edit_matches')));
create policy dag_matches_delete on public.matches for delete
  to authenticated using ((select public.can_manage_dag('delete_matches')));

-- Private match coach feedback & absent_reason are not granted to visitors.
-- Public evaluation instead reads public_match_player_stats, which omits notes.
revoke all on public.match_player_stats from public, anon, authenticated;
grant select, insert, update, delete on public.match_player_stats to authenticated;
create policy dag_stats_private_read on public.match_player_stats for select
  to authenticated using ((select public.can_manage_dag('edit_evaluations')));
create policy dag_stats_insert on public.match_player_stats for insert
  to authenticated with check ((select public.can_manage_dag('edit_evaluations')));
create policy dag_stats_update on public.match_player_stats for update
  to authenticated using ((select public.can_manage_dag('edit_evaluations')))
  with check ((select public.can_manage_dag('edit_evaluations')));
create policy dag_stats_delete on public.match_player_stats for delete
  to authenticated using ((select public.can_manage_dag('edit_evaluations')));

-- Keep achievement and weekly report published content public; writes role-gated.
revoke all on public.team_achievements from public, anon, authenticated;
grant select on public.team_achievements to anon, authenticated;
grant insert, update, delete on public.team_achievements to authenticated;
create policy dag_achievements_read on public.team_achievements for select
  to anon, authenticated using (true);
create policy dag_achievements_insert on public.team_achievements for insert
  to authenticated with check ((select public.can_manage_dag('edit_achievements')));
create policy dag_achievements_update on public.team_achievements for update
  to authenticated using ((select public.can_manage_dag('edit_achievements')))
  with check ((select public.can_manage_dag('edit_achievements')));
create policy dag_achievements_delete on public.team_achievements for delete
  to authenticated using ((select public.can_manage_dag('edit_achievements')));

revoke all on public.weekly_player_reports from public, anon, authenticated;
grant select on public.weekly_player_reports to anon, authenticated;
grant insert, update, delete on public.weekly_player_reports to authenticated;
create policy dag_weekly_reports_public_read on public.weekly_player_reports for select
  to anon, authenticated using (true);
create policy dag_weekly_reports_insert on public.weekly_player_reports for insert
  to authenticated with check (
    (select public.can_manage_dag('edit_reports')) and
    exists (select 1 from public.public_player_profiles p
      where p.id = player_id and p.team = weekly_player_reports.team)
  );
create policy dag_weekly_reports_update on public.weekly_player_reports for update
  to authenticated using ((select public.can_manage_dag('edit_reports')))
  with check (
    (select public.can_manage_dag('edit_reports')) and
    exists (select 1 from public.public_player_profiles p
      where p.id = player_id and p.team = weekly_player_reports.team)
  );
create policy dag_weekly_reports_delete on public.weekly_player_reports for delete
  to authenticated using ((select public.can_manage_dag('edit_reports')));

-- Preserve EXISTING public planner reads (public tactical sharing was already
-- supported by the website); management and coaches cannot accidentally write
-- outside their assigned permission. Revisit public planner privacy separately.
revoke all on public.planner_plans from public, anon, authenticated;
grant select on public.planner_plans to anon, authenticated;
grant insert, update, delete on public.planner_plans to authenticated;
create policy dag_planner_public_read on public.planner_plans for select
  to anon, authenticated using (true);
create policy dag_planner_insert on public.planner_plans for insert
  to authenticated with check ((select public.can_manage_dag('edit_planner')));
create policy dag_planner_update on public.planner_plans for update
  to authenticated using ((select public.can_manage_dag('edit_planner')))
  with check ((select public.can_manage_dag('edit_planner')));
create policy dag_planner_delete on public.planner_plans for delete
  to authenticated using ((select public.can_manage_dag('edit_planner')));

-- Archive KPI table: leave existing public reads, enforce edit permissions if present.
do $$
declare pol record;
begin
  if to_regclass('public.weekly_player_kpi') is not null then
    alter table public.weekly_player_kpi enable row level security;
    for pol in select policyname from pg_policies
      where schemaname='public' and tablename='weekly_player_kpi' loop
      execute format('drop policy %I on public.weekly_player_kpi', pol.policyname);
    end loop;
    revoke all on public.weekly_player_kpi from public, anon, authenticated;
    grant select on public.weekly_player_kpi to anon, authenticated;
    grant insert, update, delete on public.weekly_player_kpi to authenticated;
    create policy dag_kpi_public_read on public.weekly_player_kpi for select to anon, authenticated using (true);
    create policy dag_kpi_insert on public.weekly_player_kpi for insert
      to authenticated with check ((select public.can_manage_dag('edit_evaluations')));
    create policy dag_kpi_update on public.weekly_player_kpi for update
      to authenticated using ((select public.can_manage_dag('edit_evaluations')))
      with check ((select public.can_manage_dag('edit_evaluations')));
    create policy dag_kpi_delete on public.weekly_player_kpi for delete
      to authenticated using ((select public.can_manage_dag('edit_evaluations')));
  end if;
end $$;

-- Views remain public, and cannot include future private table columns.
grant select on public.public_player_profiles to anon, authenticated;
grant select on public.public_match_player_stats to anon, authenticated;

commit;
