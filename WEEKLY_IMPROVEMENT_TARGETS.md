# Weekly Player Improvement Targets

**Draft feature**: Coach/Manager/Owner sets numeric goals for the **following week** from the existing **Admin → Weekly Report** editor. Goals appear on the selected player's public Evaluation KPI graph and alongside the corresponding Weekly Coach Report.

## Workflow

1. Run `supabase/12_WEEKLY_PLAYER_TARGETS.sql` in the existing Supabase project (after backup and review), **before opening the Vercel preview**. This is a new table; it does not modify past match evaluations or reports.
2. Choose DAG Ladies or DAG Montrix; sign in to an approved Owner, Manager or Coach account.
3. Open **Admin → Weekly Report**, choose a player and report week (Monday).
4. Write or edit ordinary weekly coach feedback as before. In **Player Improvement Targets**, select one of the six existing KPI metrics, set a score from 1.0 to 5.0 in 0.1 steps, optionally add a public focus note, and click **Save KPI Target**. Multiple metrics may be targeted in the same week.
5. The target automatically applies to **the next Monday–Sunday week**, not the week the feedback was written. Targets save independently of narrative reports, so an existing report can be updated without resetting targets.
6. Public **Evaluation → select player → Weekly Performance**: choose the metric. Yellow dashed markers show goals for weeks with actual KPI points. An outcome list also shows unassessed goals when no scored match took place. Each Weekly Coach Report shows linked goals for the following week.

## KPI progress calculation

- Targets are compared with the existing weekly averages derived from **completed matches only**, for played player assessments that contain **all six valid 1–5 categories**.
- Each goal applies to one of Mechanics, Macro, Communication, Role Execution, Discipline or Hero Pool. It does not alter the team KPI weights or the existing Overall Evaluation formula.
- Actual >= target = **Achieved**; actual < target = **Below target**.
- No real scored assessment that week = **Not assessed**, not below target and not zero.
- Duplicate match/player assessment records are reduced to the latest saved row in the weekly target editor.
- A goal may be updated or deleted by approved coaching roles. No automatic target creation, score inflation, or retroactive assessment modifications.

## Privacy and access

- Target score and focus note are deliberately **public**, alongside published KPI graphs and weekly coach comments. Only enter coaching-related, non-sensitive observations.
- **Owner, Manager and Coach** can save/edit/delete goals, authenticated with `can_manage_dag('edit_reports')` in Supabase RLS. **Viewer and anonymous** access is read-only.
- SQL enforces a valid player/team relationship, restricts staff targets, requires a Monday week start, allows only six KPI keys and 1.0–5.0 scores, caps focus notes at 300 characters, and forbids multiple goals for the same player/week/metric.
- Existing public profile security remains unchanged: no birth dates, location, account identifiers or private absence reasons are introduced.

## Release order

1. Back up Supabase.
2. Apply `supabase/12_WEEKLY_PLAYER_TARGETS.sql` in Supabase SQL Editor and confirm successful execution.
3. Test Vercel Preview on both teams with a Coach/Manager account.
4. Test anonymous read-only goals on the public Evaluation page and confirm Viewer cannot write via direct REST requests.
5. Only merge the PR once preview works and Vercel reports Ready.

## Suggested smoke tests

- Save two targets (different categories) for one player from a weekly report, reload, edit one, delete one.
- Verify week of 2026-11-16 creates goals for week of 2026-11-23.
- Select a week with complete KPI assessments: a goal above and below the actual result.
- Select a week without completed evaluated matches: **Not assessed** in the list, no fabricated data on the graph.
- Switch between DAG Ladies and DAG Montrix: records never mix.
- Empty historical week, player who has been benched/absent, invalid metric/score, Viewer role.
- Check old weekly reports and the public KPI graph still render with zero saved targets.
