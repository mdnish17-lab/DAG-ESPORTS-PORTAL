-- DAG Esports organization home and management split | SQL 13
-- Apply AFTER existing DAG security migrations 09-12, and after a verified backup.
-- Rerunnable: existing public policies are preserved, not dropped or replaced.
-- New additive tables only; existing player, achievement, match and KPI data untouched.
-- Owner elevation is NOT automatic. See docs for the separate manual role assignment.
begin;

do $$
begin
  if to_regclass('public.team_achievements') is null or
     to_regclass('public.admin_users') is null or
     to_regprocedure('public.my_management_role()') is null or
     to_regprocedure('public.is_approved_admin()') is null then
    raise exception 'Previous DAG security migrations must exist before running SQL 13';
  end if;
end $$;

create table if not exists public.dag_site_profile (
  id smallint primary key default 1 check (id = 1),
  intro_title text not null default 'Welcome to DAG Esports',
  intro_body text not null default 'De Ant Gaming brings together DAG Ladies and DAG Montrix. Explore the teams, their players, matches and achievements.',
  ladies_intro text not null default 'Meet DAG Ladies and follow their esports journey.',
  montrix_intro text not null default 'Meet DAG Montrix and follow their esports journey.',
  owner_name text not null default '',
  owner_title text not null default 'Founder & Owner',
  owner_bio text not null default '',
  owner_photo_url text not null default '',
  updated_at timestamptz not null default now(),
  constraint dag_site_profile_lengths check (
    char_length(intro_title) <= 100 and char_length(intro_body) <= 2000 and
    char_length(ladies_intro) <= 1200 and char_length(montrix_intro) <= 1200 and
    char_length(owner_name) <= 160 and char_length(owner_title) <= 160 and
    char_length(owner_bio) <= 1600 and char_length(owner_photo_url) <= 1200
  )
);

insert into public.dag_site_profile (id)
values (1) on conflict (id) do nothing;

-- Existing achievement records remain the source of truth.
-- Featured selection/order is controlled separately, so managers can still
-- edit team achievements without gaining permission to curate DAG-wide fame.
create table if not exists public.dag_hall_of_fame (
  achievement_id bigint primary key references public.team_achievements(id) on delete cascade,
  featured_order integer not null default 0 check (featured_order >= 0 and featured_order <= 100000),
  featured_at timestamptz not null default now()
);
create index if not exists dag_hall_of_fame_order_idx
  on public.dag_hall_of_fame (featured_order, achievement_id);

alter table public.dag_site_profile enable row level security;
alter table public.dag_hall_of_fame enable row level security;

revoke all on public.dag_site_profile from public, anon, authenticated;
revoke all on public.dag_hall_of_fame from public, anon, authenticated;
grant select on public.dag_site_profile to anon, authenticated;
grant select on public.dag_hall_of_fame to anon, authenticated;
grant insert, update, delete on public.dag_site_profile to authenticated;
grant insert, update, delete on public.dag_hall_of_fame to authenticated;

-- Never rely on a hidden button as an authorization boundary.
-- Both approved admin session and explicit owner role must hold for writes.
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dag_site_profile' and policyname = 'dag_site_public_read'
  ) then
    create policy dag_site_public_read on public.dag_site_profile
      for select to anon, authenticated using (true);
  end if;
end
$policy$;
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dag_site_profile' and policyname = 'dag_site_owner_insert'
  ) then
    create policy dag_site_owner_insert on public.dag_site_profile
      for insert to authenticated
      with check ((select public.is_approved_admin()) and (select public.my_management_role()) = 'owner');
  end if;
end
$policy$;
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dag_site_profile' and policyname = 'dag_site_owner_update'
  ) then
    create policy dag_site_owner_update on public.dag_site_profile
      for update to authenticated
      using ((select public.is_approved_admin()) and (select public.my_management_role()) = 'owner')
      with check ((select public.is_approved_admin()) and (select public.my_management_role()) = 'owner');
  end if;
end
$policy$;
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dag_site_profile' and policyname = 'dag_site_owner_delete'
  ) then
    create policy dag_site_owner_delete on public.dag_site_profile
      for delete to authenticated
      using ((select public.is_approved_admin()) and (select public.my_management_role()) = 'owner');
  end if;
end
$policy$;

do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dag_hall_of_fame' and policyname = 'dag_fame_public_read'
  ) then
    create policy dag_fame_public_read on public.dag_hall_of_fame
      for select to anon, authenticated using (true);
  end if;
end
$policy$;
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dag_hall_of_fame' and policyname = 'dag_fame_owner_insert'
  ) then
    create policy dag_fame_owner_insert on public.dag_hall_of_fame
      for insert to authenticated
      with check ((select public.is_approved_admin()) and (select public.my_management_role()) = 'owner');
  end if;
end
$policy$;
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dag_hall_of_fame' and policyname = 'dag_fame_owner_update'
  ) then
    create policy dag_fame_owner_update on public.dag_hall_of_fame
      for update to authenticated
      using ((select public.is_approved_admin()) and (select public.my_management_role()) = 'owner')
      with check ((select public.is_approved_admin()) and (select public.my_management_role()) = 'owner');
  end if;
end
$policy$;
do $policy$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'dag_hall_of_fame' and policyname = 'dag_fame_owner_delete'
  ) then
    create policy dag_fame_owner_delete on public.dag_hall_of_fame
      for delete to authenticated
      using ((select public.is_approved_admin()) and (select public.my_management_role()) = 'owner');
  end if;
end
$policy$;
commit;

notify pgrst, 'reload schema';

-- Verify the new tables and permission isolation (no mutations).
select relname as table_name, relrowsecurity as rls_enabled
from pg_class where oid in ('public.dag_site_profile'::regclass, 'public.dag_hall_of_fame'::regclass)
order by relname;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('dag_site_profile', 'dag_hall_of_fame')
order by table_name, grantee, privilege_type;


-- Security audit: inspect all defined policies and their SQL definitions.
-- A policy that already existed is not silently replaced by this migration.
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('dag_site_profile', 'dag_hall_of_fame')
order by tablename, policyname;
