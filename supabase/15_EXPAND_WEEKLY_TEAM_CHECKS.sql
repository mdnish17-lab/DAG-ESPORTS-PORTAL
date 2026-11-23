-- DAG Esports SQL 15: Expand the two verified weekly team CHECK constraints.
-- Run AFTER SQL 14 and a verified Supabase backup, as postgres in SQL Editor.
-- The reported current checks allow only DAG Ladies and DAG Montrix.
-- Transactional, rerunnable, no table/row deletes, no KPI formula or RLS changes.
BEGIN;

DO $dag$
DECLARE
  item record;
  actual_def text;
  original_def text := 'CHECK ((team = ANY (ARRAY[''DAG Ladies''::text, ''DAG Montrix''::text])))';
  -- pg_get_constraintdef() canonical output for the new CHECK after creation:
  expanded_def text := 'CHECK ((team = ANY (ARRAY[''DAG Esports''::text, ''DAG Inferyx''::text, ''DAG Ascend''::text, ''DAG Junior''::text, ''DAG Ladies''::text, ''DAG Montrix''::text, ''DAG Valkyrie''::text])))';
BEGIN
  IF current_user <> 'postgres' THEN
    RAISE EXCEPTION 'Run SQL 15 as postgres in the Supabase SQL Editor, not as %. ', current_user;
  END IF;

  FOR item IN
    SELECT * FROM (VALUES
      ('weekly_player_kpi', 'weekly_player_kpi_team_check'),
      ('weekly_player_reports', 'weekly_player_reports_team_check')
    ) AS names(table_name, constraint_name)
  LOOP
    IF to_regclass(format('public.%I', item.table_name)) IS NULL THEN
      RAISE EXCEPTION 'Expected table public.% does not exist. No changes committed.', item.table_name;
    END IF;

    SELECT pg_get_constraintdef(c.oid) INTO actual_def
    FROM pg_constraint c
    WHERE c.conrelid = to_regclass(format('public.%I', item.table_name))
      AND c.conname = item.constraint_name AND c.contype = 'c';

    IF actual_def IS NULL THEN
      RAISE EXCEPTION 'Expected CHECK %.% is missing. No changes committed.',
        item.table_name, item.constraint_name;
    END IF;

    IF actual_def = original_def THEN
      -- DROP and ADD are deliberately atomic inside one transaction.
      -- Existing Ladies/Montrix values pass the replacement constraint.
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I',
        item.table_name, item.constraint_name);
      EXECUTE format(
        'ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (team IN (' ||
        quote_literal('DAG Esports') || ', ' ||
        quote_literal('DAG Inferyx') || ', ' ||
        quote_literal('DAG Ascend') || ', ' ||
        quote_literal('DAG Junior') || ', ' ||
        quote_literal('DAG Ladies') || ', ' ||
        quote_literal('DAG Montrix') || ', ' ||
        quote_literal('DAG Valkyrie') || '))',
        item.table_name, item.constraint_name
      );
      RAISE NOTICE 'Expanded %.% to seven teams', item.table_name, item.constraint_name;
    ELSIF actual_def = expanded_def THEN
      RAISE NOTICE 'Already expanded: %.%; skipping', item.table_name, item.constraint_name;
    ELSE
      RAISE EXCEPTION
        'Unexpected definition for %.%: %. No changes committed. Review manually.',
        item.table_name, item.constraint_name, actual_def;
    END IF;
  END LOOP;
END
$dag$;

COMMIT;

-- Read-only verification: both constraints should list all seven names.
SELECT cls.relname AS table_name, con.conname AS constraint_name,
       con.convalidated AS validated,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class cls ON cls.oid = con.conrelid
JOIN pg_namespace n ON n.oid = cls.relnamespace
WHERE n.nspname = 'public'
  AND ((cls.relname = 'weekly_player_kpi'
        AND con.conname = 'weekly_player_kpi_team_check')
    OR (cls.relname = 'weekly_player_reports'
        AND con.conname = 'weekly_player_reports_team_check'))
ORDER BY table_name;

-- Read-only count of existing rows; no rows were migrated or deleted.
SELECT 'weekly_player_kpi' AS table_name, count(*) AS row_count FROM public.weekly_player_kpi
UNION ALL
SELECT 'weekly_player_reports', count(*) FROM public.weekly_player_reports;
