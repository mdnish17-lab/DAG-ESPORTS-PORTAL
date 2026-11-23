-- DAG Esports: Seven teams, two divisions (additive SQL 14).
-- Review, back up, then run after SQL 13. Does not modify existing players/matches.
begin;

do $$
begin
  if to_regclass('public.dag_site_profile') is null
     or to_regprocedure('public.is_approved_admin()') is null
     or to_regprocedure('public.my_management_role()') is null then
    raise exception 'Run DAG SQL 13 and security migrations first.';
  end if;
end $$;

create table if not exists public.dag_team_introductions (
  team text primary key,
  intro text not null default '',
  updated_at timestamptz not null default now(),
  constraint dag_team_intro_known_team check (team in (
    'DAG Esports', 'DAG Inferyx', 'DAG Ascend', 'DAG Junior',
    'DAG Ladies', 'DAG Montrix', 'DAG Valkyrie'
  )),
  constraint dag_team_intro_length check (char_length(intro) <= 1200)
);

insert into public.dag_team_introductions (team, intro)
values
  ('DAG Esports', 'Discover DAG Esports in the Men Division.'),
  ('DAG Inferyx', 'Discover DAG Inferyx in the Men Division.'),
  ('DAG Ascend', 'Discover DAG Ascend in the Men Division.'),
  ('DAG Junior', 'Discover DAG Junior in the Men Division.'),
  ('DAG Ladies', 'Meet DAG Ladies and follow their esports journey.'),
  ('DAG Montrix', 'Meet DAG Montrix and follow their esports journey.'),
  ('DAG Valkyrie', 'Discover DAG Valkyrie in the Ladies Division.')
on conflict (team) do nothing;

alter table public.dag_team_introductions enable row level security;
revoke all on public.dag_team_introductions from public, anon, authenticated;
grant select on public.dag_team_introductions to anon, authenticated;
grant insert, update, delete on public.dag_team_introductions to authenticated;

do $policy$
begin
  if not exists (select 1 from pg_policies
      where schemaname = 'public' and tablename = 'dag_team_introductions'
      and policyname = 'dag_team_intro_public_read') then
    create policy dag_team_intro_public_read on public.dag_team_introductions
      for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies
      where schemaname = 'public' and tablename = 'dag_team_introductions'
      and policyname = 'dag_team_intro_owner_insert') then
    create policy dag_team_intro_owner_insert on public.dag_team_introductions
      for insert to authenticated
      with check ((select public.is_approved_admin())
        and (select public.my_management_role()) = 'owner');
  end if;
  if not exists (select 1 from pg_policies
      where schemaname = 'public' and tablename = 'dag_team_introductions'
      and policyname = 'dag_team_intro_owner_update') then
    create policy dag_team_intro_owner_update on public.dag_team_introductions
      for update to authenticated
      using ((select public.is_approved_admin())
        and (select public.my_management_role()) = 'owner')
      with check ((select public.is_approved_admin())
        and (select public.my_management_role()) = 'owner');
  end if;
  if not exists (select 1 from pg_policies
      where schemaname = 'public' and tablename = 'dag_team_introductions'
      and policyname = 'dag_team_intro_owner_delete') then
    create policy dag_team_intro_owner_delete on public.dag_team_introductions
      for delete to authenticated
      using ((select public.is_approved_admin())
        and (select public.my_management_role()) = 'owner');
  end if;
end
$policy$;
commit;
notify pgrst, 'reload schema';

-- Read-only installation / security checks.
select team, length(intro) as intro_length from public.dag_team_introductions order by team;
select policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'dag_team_introductions'
order by policyname;

-- IMPORTANT: inspect any existing hardcoded two-team CHECK constraints
-- before testing writes to new teams. This diagnostic makes no schema changes.
select cls.relname as table_name, con.conname as constraint_name,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class cls on cls.oid = con.conrelid
join pg_namespace n on n.oid = cls.relnamespace
where n.nspname = 'public' and con.contype = 'c'
  and cls.relname in ('players', 'matches', 'team_achievements',
    'planner_plans', 'weekly_player_reports', 'weekly_player_targets', 'weekly_player_kpi')
  and pg_get_constraintdef(con.oid) ilike '%team%'
order by table_name, constraint_name;
