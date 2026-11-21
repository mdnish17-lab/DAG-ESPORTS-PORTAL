# Monthly Performance Exports

A new **Monthly Performance Reports** panel appears at the top of Admin → Coach Dashboard.

## Usage
1. Log in to an approved DAG management account (Owner, Manager or Coach).
2. Select DAG Ladies or DAG Montrix at the top of the Admin Panel.
3. Choose the reporting month (defaults to the previous completed calendar month in Malaysia).
4. Click **Generate monthly report**.
5. Click **Download PDF** for a paginated print-friendly report or **Download Excel** for a four-sheet `.xlsx` workbook.

## Contents
- Overview: completed match counts, wins, losses, draws, weighted team coach KPI, player count, assessed records, average attendance, player overall rating.
- Players: IGN, full name, role, played / bench / absent / unrecorded counts, attendance percentage, six KPI category averages, coach and overall performance scores.
- Matches: completed match date, opponent, type, confirmed result, scores, number of fully rated players, match KPI.
- Weekly Reports: published comments and improvement goals whose *Monday week-start* belongs to the chosen calendar month.

## Definitions
- Date windows are calendar month start inclusive, next month's start exclusive; matches use `match_date`, not evaluation creation time.
- Only matches with `status = completed` are counted. Awaiting Result, Upcoming and Cancelled are excluded.
- Participation count: Played + Benched. Absent and unrecorded are not attendance.
- Missing participation remains **unrecorded**, not **absent**. No matches in the month yields N/A for attendance.
- KPI scores use all six 1–5 categories, with weights Mechanics 20%, Macro 25%, Communication 15%, Role Execution 20%, Discipline 10%, Hero Pool 10%. Played assessments lacking any valid rating are explicitly unassessed.
- Overall rating uses the existing public Evaluation formula: 70% weighted coach KPI + 30% attendance score, where attendance score = 1 + 4 × attendance fraction.
- Historical duplicate records: the largest assessment ID for a match/IGN is counted only once.
- The player list reflects the **current roster**, so removed former players are not included. This limitation is stated in the PDF.
- Generated on demand from read-only queries. No report table, SQL migration, database write or external reporting service.

## Security
- The panel is visible only to Owner / Manager / Coach roles, which are verified again through Supabase `my_management_role` before report assembly and download.
- Exports use the public-safe `public_player_profiles` and `public_match_player_stats` views, plus the existing published `weekly_player_reports` table. These contain only intentionally public data. Exporting private information would require a distinct permission design and review.
- PDF and Excel blobs are assembled in the browser; there are no third-party reporting requests.
- No exact DOB, MLBB ID/server, location/stay, absent reason or private match-specific coach comment is included.
- The previous public policy for `weekly_player_reports` is unchanged; published weekly report text is already public through the Evaluation page.
- Important: A user could independently recreate a report from public-safe views; only the in-app download actions are management gated. The generated reports are not a new private-data boundary.

## Smoke tests
- Both teams, a past month with scored and unscored completed matches.
- A month containing only Scheduled or Awaiting Result matches (must show zero completed).
- A month with zero matches (no divide-by-zero; attendance N/A; ratings unassessed).
- Multiple scores in a month and a duplicate historical assessment (latest ID only).
- A player benched and absent in different matches, plus one match without a participation record.
- Weekly comments with long text and special characters; PDF paginates and Excel wraps as needed in Excel.
- Viewer account: report controls inaccessible.
- Manager/Coach account: report generation works for both teams.
- Open XLSX in Excel or LibreOffice and confirm all four tabs display; open multi-page PDF and confirm content is legible.

## No database changes
No new Supabase SQL is required; relies on the existing public-safe views and management-role RPCs established during the previous security upgrade.
