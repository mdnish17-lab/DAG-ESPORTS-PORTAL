# Mobile Coach Player Evaluation

The existing **Admin → Player Evaluation** form is now optimized for mobile phones while keeping exactly the same six coach KPI metrics and 1–5 integer slider values.

## Changes
- On small screens, select a completed match with one compact, large tap-friendly dropdown; the original match browser remains on desktop.
- Player roster becomes a horizontally swipable carousel on phones; saved, incomplete and unsaved states are visible.
- Each KPI keeps its **native 1–5 range slider** and also has five 44px-or-larger individual number buttons. No default score is saved unless selected.
- One-column KPI cards on phones, two columns on tablets and wider layouts, large K/D/A inputs with numeric keyboards, and quick status buttons for Played / Benched / Absent.
- A fixed mobile Save and Save & Next control shows player, progress and save state; desktop keeps its standard actions.
- The app shows a live count of scored KPIs, weighted preview only once all six ratings are present, and save feedback directly beside the mobile controls.
- Edits are held as per-player drafts. Switching players retains those drafts; switching matches with unsaved changes asks for confirmation. Browser refresh/close warns when edits are not saved. Navigation to another admin tab while editing is not yet covered by that guard.

## Unchanged behaviors
- Exactly six metrics: Mechanics 20%, Macro 25%, Communication 15%, Role Execution 20%, Discipline 10%, Hero Pool 10%.
- Ratings must be integer 1–5. Played assessments must have all six ratings and non-negative integer K/D/A; absent requires a reason.
- Benched and Absent participation are recorded without fabricated coach ratings. Management/staff attendance is unscored.
- Supabase storage, server-side RLS, saved history, weekly KPI graph, improvement targets and monthly PDF/Excel exports remain unchanged.
- No new Supabase migration or API endpoint.

## Preview smoke tests
1. At roughly 320, 375 and 430 CSS px widths, choose team, match, player and Played; rate all six KPIs by touch.
2. For each KPI, verify the slider and number buttons stay synchronized and no selected rating remains unscored.
3. Save: check completion tally, saved indicator and public weekly KPI graph.
4. Save & Next: the current player saves and the following player opens, with new fields not pre-populated from the previous player.
5. Set Benched or Absent: ensure no unnecessary KPI rating is required and Absent requires a reason.
6. Edit a saved player and check unsaved indicator. Switch players and return: draft should remain. Switch matches: confirmation appears and Cancel preserves edits.
7. Toggle network offline or otherwise force a Supabase error: no false success and Save remains available for retry.
8. Test staff Present/Absent; confirm staff still have no KPI section.
9. Reopen a historical saved record on mobile and desktop; values should match original.
10. Check the desktop evaluation form still operates normally.

Do not merge until the Vercel Preview build passes and mobile touch/save workflows are checked.
