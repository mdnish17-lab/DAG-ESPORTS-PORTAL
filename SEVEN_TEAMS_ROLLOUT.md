# DAG Esports — 7-team expansion

## Division structure

**Men Division:** DAG Esports, DAG Inferyx, DAG Ascend, DAG Junior.

**Ladies Division:** DAG Ladies, DAG Montrix, DAG Valkyrie.

The organization homepage at `/` lists both divisions. Selecting a team stores its name in the existing `dag-active-team` browser setting and opens the existing Team Performance page. The seven team names and logo/color definitions live in `lib/teamTheme.ts`; `lib/TeamSelector.tsx` provides a grouped selection menu on team pages and in Coaches / Manager.

## Uploaded logos and visual theme

- `public/team-logos/dag-esports.webp` — red/orange
- `public/team-logos/dag-inferyx.webp` — gold/orange
- `public/team-logos/dag-ascend.webp` — red/coral
- `public/team-logos/dag-junior.webp` — yellow/gold
- `public/team-logos/dag-valkyrie.webp` — orange/copper
- `public/ladies.jpeg`, `public/montrix.jpeg` — retained unchanged

The five new assets are resized/optimized WebP versions of the images supplied by the owner. The original files are not recreated or replaced with generic badges.

## Existing features reused for all seven

- Team Performance: match history, match outcomes, upcoming matches and player count
- Public roster, achievements and player evaluation/KPI charts
- Management → Coaches / Manager → roster, match registration, player evaluations, weekly reports, improvement targets and achievement editing
- Coach Dashboard, assessment progress, monthly PDF/Excel performance exports
- Strategy Planner: unchanged clean workspace; it still stores plans under the **last selected team**, even though Planner itself has no team switcher
- Owner-curated DAG Hall of Fame now naturally includes achievements from all seven teams, selected from existing achievement records

No initial player, match, report, achievement or KPI values are fabricated for new teams. A new division appears empty until you create its own records.

## Database deployment — read before merging

1. Make a verified backup in Supabase.
2. Run `supabase/14_SEVEN_TEAMS.sql` (requires SQL 13). It adds public-readable, Owner-editable team introductions for all seven, retaining the legacy Ladies and Montrix introduction fields and their existing values in `dag_site_profile`.
3. **Confirmed from the user's SQL 14 audit:** `weekly_player_kpi_team_check` and `weekly_player_reports_team_check` currently permit only DAG Ladies and DAG Montrix. After a verified backup, run [`supabase/15_EXPAND_WEEKLY_TEAM_CHECKS.sql`](supabase/15_EXPAND_WEEKLY_TEAM_CHECKS.sql). SQL 15 guards the exact existing definitions, updates only these two constraints transactionally and verifies the seven permitted teams. It is rerunnable and stops on unexpected definitions. Do **not** rerun it blindly if the audit changes or it fails.
4. Run the final SQL 15 verification SELECT: both constraints must show seven exact team names and `validated = true`. All seven new team names can then pass these two CHECK constraints. Other table permissions and data must still be verified independently.
5. Check the four new introduction RLS policies: anonymous can SELECT and only a verified approved Owner can INSERT/UPDATE/DELETE.
6. On the Vercel preview, visit the main page and confirm the 4+3 team listing and logo/color mapping; choose each and confirm correct team name and empty-state records.
7. Log in as Owner, edit the five new introductions in Management → Admin and verify they appear on the homepage. Existing Ladies and Montrix intro editing remains unchanged.
8. Test creating one test player, match and weekly report for a new team, then remove test data carefully. Verify records never appear under another team.
9. Test all existing data and exports for DAG Ladies and DAG Montrix to confirm no regressions.
10. Only merge after database checks, build validation and preview smoke tests are complete.

**Important:** GitHub deployment does not run SQL 14 or SQL 15 automatically. Database migration and CI preview are separate approval steps. Do not merge to production until both succeed.

## Privacy

Player private identifiers, DOBs, absence reasons, coach notes and protected evaluations remain under existing Supabase RLS. Adding team labels does not alter who can read or edit private records.
