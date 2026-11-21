# DAG Esports Official Homepage + Management Split

## Approved design
- The public `/` path always opens the **DAG Esports organization homepage** with the existing DAG logo, an editable intro, an editable owner photo/name/title/bio, team-selection cards for **DAG Ladies** and **DAG Montrix**, then a curated **DAG Hall of Fame**.
- The main homepage's navigation sits in a separate bar **below the hero/banner background**, not inside the banner. Team pages follow the same approach.
- Choosing a team saves `dag-active-team` and opens `/team-performance`. The original statistics/matches UI is reused intact. The existing Ladies/Montrix toggles remain on team pages.
- `/team-performance` replaces the old Dashboard page; other team pages still work. The public team navigation now lists **DAG Home**, Team Performance, Roster, Achievement, Evaluation, Planner, and Management.
- The old `/admin` URL redirects approved accounts to `/management`; the existing login route remains available and also redirects to `/management` after sign-in.

## Management
- `/management`: approved account workspace hub.
- `/management/admin`: **Owner-only**, with website intro, Ladies/Montrix intro, owner bio/photo URL, and owner-curated Hall of Fame. Both server route and Supabase row policies enforce Owner, with `is_approved_admin()` verified on writes.
- `/management/coaches`: the entire existing coaching/manager panel (Coach Dashboard, roster, Match Log, mobile Evaluation, weekly Coach Reports, improvement targets, upcoming matches, achievements, monthly PDF/Excel exports). No Account tab.
- `/management/account`: change your **own** password, for every approved management account. Uses existing authenticated password form and unchanged Supabase Auth permissions.
- Owner, Manager, Coach, Viewer permissions for existing team data remain unchanged.

## Data model and release (IMPORTANT)
Run `supabase/13_DAG_SITE_AND_HALL_OF_FAME.sql` **after a verified backup** and before testing editorial features. It creates:
- `dag_site_profile`: one publicly readable row of editable text/photo URL.
- `dag_hall_of_fame`: owner-selected references to existing `team_achievements.id`, with an explicit order. No duplicate awards.
- Owner-only write policies and public read policies. All existing tables stay unchanged.

**OWNER ROLE MUST BE ASSIGNED EXPLICITLY**:
Earlier management accounts may all still be `manager`. Do NOT blindly promote a user, and do NOT change every manager to owner. Identify the correct approved owner user ID in Supabase Auth and run a reviewed statement in SQL Editor such as:

```sql
-- Replace with the ACTUAL approved owner's Supabase Auth UUID.
-- Check the row and account identity before running.
select user_id, management_role from public.admin_users;
-- update public.admin_users
-- set management_role = 'owner'
-- where user_id = 'REPLACE_WITH_VERIFIED_OWNER_UUID';
```

The update is intentionally commented out. Without a verified Owner account, the website still has its public read-only landing page; Owner Admin editing will be inaccessible.

## Required manual content
- Owner name, real portrait and biography were **not supplied**. The design uses non-identifying placeholders until the approved Owner publishes accurate information.
- `owner_photo_url` must be a publicly accessible HTTPS image URL (e.g., an appropriate Supabase Storage public asset). No private file buckets, credentials or personal data in the image URL.
- Only existing team achievements can be chosen as featured Hall of Fame entries. Select them in Owner Admin. Deleting a team achievement automatically removes its feature selection.

## Testing (Vercel preview)
1. Verify `/` shows DAG logo, intro, owner placeholder, both team choices, Hall of Fame section and navigation below hero. Opening `/` **never** auto-selects a team.
2. Choose DAG Ladies: `/team-performance` loads original team stats. Switch to DAG Montrix inside the same interface and confirm no cross-team data mixing.
3. Check separate nav bars beneath banner backgrounds on Roster, Achievement, Evaluation and Planner.
4. Confirm `/team-performance` is Team Performance, not the old Achievements redirect.
5. From public Management, unauthenticated users are sent to existing `/admin/login` and then the Management hub.
6. Owner sees Admin / Coaches / Account Settings, can save intro/owner details, feature existing awards and see them on homepage.
7. Manager/Coach/Viewer cannot open `/management/admin` or mutate `dag_site_profile` / `dag_hall_of_fame` even with direct REST requests.
8. Approved Manager/Coach can use the original coaching workspace; only existing role-appropriate writes succeed; no Account tab there.
9. Any approved account can change its own password from Management → Account Settings.
10. Verify weekly targets, PDF/Excel exports, public KPI graphs, existing matches, and past achievements remain intact on both teams.
11. Small phone (320–430px): check logo, owner section, team cards, Hall of Fame and navigation wrapping.

## Rollout
1. Review and backup database; apply SQL 13.
2. Explicitly assign Owner role to the confirmed approved owner user ID.
3. Open Vercel Preview and complete the test checklist on desktop and mobile.
4. Merge only after testing passes. No public profile/roster/match database rows are migrated or deleted.

## Rollback
- Code: revert this PR if necessary, preserving existing match, KPI and achievement data.
- Database: the two new site tables may remain unused; do NOT drop them during an urgent rollback or alter other security policies.
