# DAG Esports — Monthly Archives and 3-month Data Retention Plan

Status: **Implementation specification only.** No database deletion job is enabled by this document.

## Confirmed requirements

1. Public Weekly Performance: Monday–Sunday weeks in **Asia/Kuala_Lumpur**. The current week's KPI card resets to **Awaiting this week's evaluation** at Monday 00:00 MYT, without deleting the previous week's rating. Graph uses the **last 12 calendar weeks**, displaying gaps for weeks without assessed matches (never zero).
2. Monthly Performance Reports remain in the Coach Dashboard. Extend PDF and Excel exports to include completed-match images, detailed match data, KPI assessments and stable player snapshots.
3. Automatically generate and store monthly **immutable** archives accessible to authorized management by team and report month. Archive must be saved outside the rows scheduled for deletion, with embedded or durable copied images (not URL-only references).
4. **Three-month retention applies to BOTH completed matches and associated match-based player KPI/evaluation data.** This includes the six assessment-category values, attendance/participation records and other per-match stats held in `match_player_stats`. Do not remove current player profiles.
5. KPI-specific historic data in optional `weekly_player_kpi` table, if used in production, must be reviewed and archived before deletion too. Weekly goal/coach-report retention must be explicitly reconciled with archived KPI dependencies; do not assume those rows are safe to delete merely because their week is old.
6. The 3-month timer uses the original match date, not the date of report generation. Use a documented calendar-month cutoff in Malaysia time and verify the public 12-week window remains consistent with that cutoff.

## Safe workflow (implementation prerequisites)

1. Confirm the live Supabase schema, foreign keys/cascade rules, existing `weekly_player_kpi`, screenshot storage and existing monthly-report download behavior.
2. Capture all month data BEFORE cleanup, including players who may have since left the roster, all assessment stats needed for a faithful record, and every result screenshot.
3. Create versioned PDF, XLSX and a structured immutable data snapshot / manifest for recovery and audit. Archive content must be written to durable storage separate from active match/KPI rows.
4. Verify archive readability, match/assessment counts, screenshots, file integrity, permission scope and successful storage upload.
5. Keep job in **dry-run** mode until tested and manually approved. Avoid deleting any record whose verified archive is missing, incomplete or failed.
6. Once enabled, a server-side privileged job deletes only eligible, verified old completed-match KPI rows and their related completed matches in a single transaction (dependent rows first where needed). Never delete unfinished matches, active player profiles, unarchived rows or unrelated records. Use idempotent batches, run logs and explicit failure alerts.
7. The public graph must not depend on deleted data. Any currently visible 12-week KPI must be protected by a retention boundary that does not truncate visible weeks; a calendar 3-month cutoff can overlap the earliest of the last 12 calendar weeks. Implement a **protect-the-visible-window** rule or preserve a non-sensitive weekly summary through that window.
8. Test month boundaries, Monday rollover at MYT, empty/unassessed weeks, match-without-screenshots, partial archive failure, historical roster changes, failed deletion and re-run behavior before enabling jobs.

## Current implementation in this branch

- Public KPI week helper and rolling calendar-week graph change.
- **Not implemented yet:** permanent archived file storage, complete embedded screenshots, scheduled archive jobs, or any match/KPI deletion.
- Existing on-demand monthly report exports must stay functional throughout the upgrade.

## Note on data minimization

A monthly PDF or XLSX alone may not be a complete recovery backup of detailed match/KPI data. Use a structured snapshot as well, verify it, and retain access policies for reports containing player information.
