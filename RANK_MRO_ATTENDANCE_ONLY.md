# Rank / MLBB Rising Open (MRO) — Attendance-only Match Log

## Setup

Run **supabase/16_RANK_MRO_ATTENDANCE_ONLY.sql** in Supabase SQL Editor *before* trying the new Match Log selections. This additive migration creates separate activity and attendance tables and role-checked transactional functions. It does **not** alter existing matches, scores or evaluations.

## Coach workflow

1. Open **Management → Coach Dashboard → Match Log** and choose **Rank** or **MLBB Rising Open (MRO)** from the Match Log type selector.
2. Choose the date; add screenshot image links (one full HTTP(S) URL per line) if available.
3. Mark each current team member (including coaches/managers) **Present** or **Absent**. All members require a selection.
4. Save. Owner/Manager/Coach can edit records; only Owner/Manager can delete.
5. Rank/MRO history appears under its own type in Match Log, with attendance and screenshot links.

## Important semantics

- These are **attendance-only activities**, stored in `attendance_only_activities` and `attendance_only_activity_members`, not fake completed match rows.
- **No opponent, score, result, kills/deaths/assists, six KPI ratings or player evaluations** are generated.
- Existing Scrim/Tournament/Scrim Bracket flows remain unchanged, including completed-match evaluation tracker, public match win rate and KPI graph.
- Rank/MRO attendance is stored as a separate attendance history and **does not change the existing public Evaluation attendance percentage**, which is currently calculated only from completed evaluated matches. Integrating the two attendance metrics requires a separate explicitly reviewed change.
- Screenshots are saved as URLs, not uploads; the original URLs must remain reachable. Embed/copy the images during the planned monthly archive work.
- The currently planned monthly PDF/Excel archive and 3-month deletion must explicitly include these new tables before any deletion job is activated. This change introduces **no auto-delete job**.

## Suggested checks

- Run migration once, reload Supabase API schema cache and verify management role/RLS.
- As a Coach: create Rank record with absent/present members and screenshots, edit it, then create MRO record.
- As Owner: delete an attendance record and verify child attendance rows cascade.
- As Viewer or anonymous: verify no read/write access to attendance tables.
- Confirm no Rank/MRO entries appear in MatchEvaluationTracker, Player Evaluation match picker, public win/loss count or KPI data.
- Verify existing tournament/scrim save and edit still work.
