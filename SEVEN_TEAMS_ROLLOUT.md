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
3. Review the **final read-only constraint audit output**. The original production database might have been created with two-team `CHECK` constraints, outside this repository's tracked migrations. If any constraint restricts `team` to DAG Ladies / DAG Montrix, STOP: report its exact table and definition before adding data. Do not drop or weaken it blindly. The expansion will need a targeted reviewed migration for that constraint.
4. Check the four new introduction RLS policies: anonymous can SELECT and only a verified approved Owner can INSERT/UPDATE/DELETE.
5. On the Vercel preview, visit the main page and confirm the 4+3 team listing and logo/color mapping; choose each and confirm correct team name and empty-state records.
6. Log in as Owner, edit the five new introductions in Management → Admin and verify they appear on the homepage. Existing Ladies and Montrix intro editing remains unchanged.
7. Test creating one test player, match and weekly report for a new team, then remove test data carefully. Verify records never appear under another team.
8. Test all existing data and exports for DAG Ladies and DAG Montrix to confirm no regressions.
9. Only merge after database checks, build validation and preview smoke tests are complete.

**Important:** GitHub deployment does not run SQL 14 automatically. Database migration and CI preview are separate approval steps. Do not merge to production until both succeed.

## Privacy

Player private identifiers, DOBs, absence reasons, coach notes and protected evaluations remain under existing Supabase RLS. Adding team labels does not alter who can read or edit private records.
