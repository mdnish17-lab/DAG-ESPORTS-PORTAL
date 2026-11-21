# DAG Esports — Achievements + Weekly Player Performance

## What's changed
1. Navigation label **Team Performance** is now **Achievement** (`/achievement`). The original `/team-performance` URL permanently redirects to `/achievement`, so old links still work. The existing Supabase `team_achievements` table is **unchanged**.
2. The public Evaluation page includes a **Weekly Performance** graph for each selected player. Switch between weighted Overall KPI and each of the 6 individual measures.
3. Approved management users get a new **Weekly KPI** tab in `/admin`, with a player selector, review date, six 1–5 scores, save/update, edit and delete.
4. Based on your spreadsheet: Mechanics 20%, Macro 25%, Communication 15%, Role Execution 20%, Discipline 10%, Hero Pool 10%. The sheet supplies a scoring framework, not player history; no scores have been fabricated or imported.

## Safe installation order
1. **Backup** the working `DAG-ESPORTS-NEW` folder and export a Supabase backup before database changes.
2. Extract this ZIP in a **new** local project folder. It has no `.env.local`; create one using your existing working `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
3. In Supabase Dashboard → SQL Editor, check that `public.is_approved_admin()` exists and that `public.players.id` is `bigint` (int8), as in the shared project schema. Run **only** `supabase/04_WEEKLY_PLAYER_KPI.sql` as `postgres`. This creates a new table and four policies; it does not replace your existing table policies.
4. In the new local folder run `npm install`, then `npm run dev`.
5. Open `/admin`, sign in with your existing approved management email and password. Click the new **Weekly KPI** tab. Select the team, player, date (automatically normalized to Monday), scores, and **Save Weekly KPI**. Scores for the same player and week update that review rather than creating duplicates.
6. Visit `/evaluation` as a public visitor, select the same player, and check the weekly chart. Choose Overall KPI, Mechanics, Macro etc. A single week shows a point; a second week reveals a trend line. Weeks with no review are not shown as zeros.
7. Visit `/achievement`; confirm old achievement records remain. Test `/team-performance` redirects.
8. Run `npx tsc --noEmit` and `npm run build` locally, then deploy through your normal GitHub → Vercel process. No new environment variables or chart library are required.

## Security and privacy
- The new SQL grants public **read-only** access to numeric weekly ratings and the linked player ID, because Evaluation is public; only approved managers may add/edit/delete weekly records (via `is_approved_admin()` RLS). No private comments or contact details are stored in the new table.
- Your existing Supabase RLS remains unchanged. Never replace the browser anon key with a Supabase secret/service-role key.
- The old Excel workbook uses an illustrative/template reporting structure; it contains no filled weekly reviews. We have **not imported fake values**.

## Files updated/added
- New `app/achievement/page.tsx` and alias `app/achievements/page.tsx`
- Legacy redirect `app/team-performance/page.tsx`
- Navigation labels in all public pages
- New `app/evaluation/WeeklyPerformanceChart.tsx`
- Updated `app/evaluation/page.tsx`
- New `app/admin/WeeklyKpiManager.tsx`
- Updated `app/admin/AdminClient.tsx`
- New `lib/weeklyKpi.ts`
- New `supabase/04_WEEKLY_PLAYER_KPI.sql`
