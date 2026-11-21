# DAG Esports Visual Polish + SQL 13 Rerun Safety

This branch is **based on the open redesign PR #8**, not on production `main`. Merge into PR #8's branch first; do not deploy it alone.

## New visual styling
- The real `/dag-logo.jpg` is a large, subtle center watermark behind the website's content.
- Soft pink ambient glows, slow logo drift and a faint halo create a more premium esports look without covering text or blocking buttons.
- Shared `SiteDecor` means the atmosphere appears on the DAG organization homepage and the existing team pages.
- No external image or animation dependency; CSS animations respect `prefers-reduced-motion` and use a low-contrast backdrop on phones.

## Public roster
- Hide **Signature / Main Hero** on player cards.
- Do not request `main_hero` in the public roster query.
- Existing `players.main_hero` column, stored data and Management roster editing remain unchanged.

## SQL 13 duplicate-policy error
Reported error: `ERROR 42710: policy "dag_site_public_read" for table "dag_site_profile" already exists`.

This usually occurs when the migration is executed after the policy already exists. A failed transaction does not by itself prove that none of the SQL previously succeeded.

Revised `supabase/13_DAG_SITE_AND_HALL_OF_FAME.sql`:
- Before each of the eight `CREATE POLICY` statements, checks `pg_policies`.
- Creates each missing policy; leaves existing policies alone.
- Uses the original additive tables and default profile content with `ON CONFLICT DO NOTHING`.
- Does NOT drop existing policies, delete data, reset accounts, or grant owner privileges.
- Includes a read-only policy definition audit `SELECT` at the end.

**Security caution:** If a policy with the same name exists but a different definition, this rerunnable migration does **not** fix it. Compare `qual` and `with_check` from the final audit to the intended Owner-only conditions before relying on it. Only the verified owner account should have `management_role = 'owner'`.

### Diagnostic query (read-only)
```sql
select tablename, policyname, cmd, roles, qual, with_check
from pg_policies
where schemaname = 'public'
  and tablename in ('dag_site_profile','dag_hall_of_fame')
order by tablename, policyname;
```

### Test
1. In Supabase, run the diagnostic query above first and inspect the eight intended policies. Share any unexpected output instead of dropping policies.
2. Backup before migration. If SQL 13 must be rerun, use the revised version in this branch, not the original.
3. Preview on desktop and phone; check readable text and logo visible faintly behind content. Enable reduced motion and verify animation stops.
4. Open Roster in Ladies and Montrix: player cards must not display Signature, but the existing Admin roster editing should still preserve stored hero data.
5. Verify all eight RLS policy definitions, then test Owner / Manager permission boundaries on management site content.

No new database table or storage migration beyond the existing redesign SQL 13.
