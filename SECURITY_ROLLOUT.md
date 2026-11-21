# DAG Esports — Security and data-accuracy rollout

**Two SQL stages plus a frontend deployment are required.**
Do not merge and assume private data is protected immediately. Back up your
existing Supabase database and keep a known-good Vercel production deployment.

## Improvements
- Overdue scheduled matches no longer silently turn into completed 0–0 DRAW.
  Confirm actual scores in Match Log, or manually mark Awaiting Result / Cancelled / Restore.
- Public roster uses a strictly limited safe view, excluding real name, DOB,
  age, stay, MLBB ID and server.
- Public evaluation uses a safe stats view, excluding absent reasons and private
  match-specific coach notes.
- Owner/Manager/Coach/Viewer permissions are implemented in database RLS, and
  edit controls are hidden for read-only roles.

## Permission matrix

| Role | Private roster | Roster writes | Edit matches | Delete matches | Player evaluations | Weekly reports | Achievements | Planner writes |
|---|---|---|---|---|---|---|---|---|
| Owner | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Manager | Yes | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Coach | No | No | Yes | No | Yes | Yes | No | No |
| Viewer | No | No | No | No | No | No | No | No |

Existing approved admins remain Managers by default, preserving their access.
Only a database owner changes account roles. The client cannot assign roles.

## Required deployment order

1. Back up the **existing** Supabase project and verify recovery options.
2. Run supabase/09_SECURITY_PREPARE.sql in the Supabase SQL Editor as postgres.
   It creates read-safe views, the role lookup RPC and new match constraints.
   **Existing public base-table privileges remain unchanged at this stage.**
3. Test the PR Vercel Preview for public roster and evaluation, dashboard,
   Manager login, existing matches, reports and planner. Verify Vercel Preview
   environment variables refer to your existing Supabase project.
4. Merge this pull request into main after the preview is Ready and tests pass.
   Confirm Vercel Production is Ready and public/admin screens work.
5. In the same planned maintenance window, run
   supabase/10_SECURITY_LOCKDOWN.sql in the same Supabase project.
   This revokes publicly accessible SELECT on base players and
   match_player_stats, and enables role-restricted RLS policies.
   The old open API remains exposed until this stage is complete.
6. Run supabase/11_VERIFY_SECURITY.sql. Confirm anon cannot SELECT the
   private base players or match_player_stats tables, but can read safe
   views. Confirm roles and policies are what you expect.
7. Test anonymous, Manager, Coach and Viewer accounts, including attempting
   to read private player details from the network API as anon/Viewer.
8. Check legacy completed 0–0 DRAW matches manually: older code may have
   auto-generated false results. Do not change genuine draws automatically.
   Validate new NOT VALID constraints only after historical mismatches are fixed.

## Assign roles (optional, ONLY in Supabase SQL Editor)

Use your approved account's email instead of the example placeholder:

    update public.admin_users a
    set management_role = 'owner' -- or manager, coach, viewer
    from auth.users u
    where a.user_id = u.id
      and lower(u.email) = lower('REPLACE_WITH_APPROVED_EMAIL');

Verify the affected row. Do not demote the only account that can manage the
roster without first confirming another Manager/Owner login works.

## Test cases

- Public Roster: IGN, role, main hero, image and public achievements only.
  No date of birth, home/stay, real name, MLBB ID or server.
- Public Evaluation: six ratings and attendance; no absence reasons or
  private match-specific coaching comments. Publicly authored weekly
  reports remain visible by design.
- Manager/Owner: full roster, Match Log, evaluations, weekly reports,
  achievements and planner editing still work.
- Coach: match entry/evaluations/reports work. Roster details are restricted,
  and delete-match, achievements, roster or planner writes are denied.
- Viewer: can view Coach Dashboard and Match Log, but cannot write.
- Overdue scheduled match: stays non-completed with PENDING result;
  manually marking Awaiting Result or Cancelled is not counted as played.
- Completed score: actual numeric scores determine WIN/LOSS/DRAW.
- After stage 2: anonymous SELECT on private base tables fails; safe views work.

## Known remaining privacy decisions

Weekly narrative reports and team match reviews are currently public by
site design. Do not enter confidential information there. Planner plans
remain publicly readable to preserve existing sharing functionality;
do not put confidential tactics there. Review these as separate privacy tasks.
The public achievements field must contain only intended public content.
Previously cached data or screenshots are not retroactively erased.

## Rollback

If preview fails, do not merge or apply stage 2.
If production fails before stage 2, roll back the code; additive stage 1
may remain. **After stage 2**, do not roll back to old frontend code that
requests private base tables: it will correctly fail. Restore the updated
frontend or prepare a reviewed authorization migration. Do not re-enable
anonymous access to private data as a shortcut.
