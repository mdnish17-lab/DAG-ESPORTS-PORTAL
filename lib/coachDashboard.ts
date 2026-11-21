import { isStaffMember, summarizeMatchEvaluation, type ProgressAssessment, type ProgressMatch, type ProgressPlayer } from './matchEvaluationProgress';
import { hasSixRatings, weightedScore, weekStartOf, type WeeklyMetricKey } from './weeklyKpi';

export type CoachAssessmentRow = ProgressAssessment & {
  match_id: number;
  ign: string;
  id: number;
  status?: string | null;
};
export type CoachReportRow = { player_id: number; week_start: string };
export type WeeklyTeamPoint = { week_start: string; score: number | null; assessments: number };
export type PlayerTrend = { id: number; ign: string; role?: string | null; score: number | null; previous: number | null; week_start?: string };

/** The last completed Monday-Sunday week, based on Malaysia local dates (UTC+08). */
export function lastCompletedWeekStart(now: Date = new Date()): string {
  const malaysianDate = new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const monday = weekStartOf(malaysianDate);
  const previousMonday = new Date(`${monday}T12:00:00Z`);
  previousMonday.setUTCDate(previousMonday.getUTCDate() - 7);
  return previousMonday.toISOString().slice(0, 10);
}

function weekOffsets(lastWeekStart: string, offsets: number[]): string[] {
  return offsets.map((offset) => {
    const monday = new Date(`${lastWeekStart}T12:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() + offset * 7);
    return monday.toISOString().slice(0, 10);
  });
}

/** Read-only summary from existing match assessments and weekly reports. */
export function makeCoachDashboardSummary(
  roster: ProgressPlayer[],
  matches: ProgressMatch[],
  assessmentRows: CoachAssessmentRow[],
  reportRows: CoachReportRow[],
  lastWeekStart: string,
) {
  const players = roster.filter((player) => !isStaffMember(player));
  const byMatch = new Map<number, CoachAssessmentRow[]>();
  const matchById = new Map(matches.map((match) => [match.id, match]));

  // If legacy duplicate rows exist, only the newest saved assessment per match / player is counted.
  const newestByMatchAndIgn = new Map<string, CoachAssessmentRow>();
  for (const row of assessmentRows) {
    if (!matchById.has(row.match_id)) continue;
    const key = `${row.match_id}::${row.ign.trim().toLowerCase()}`;
    const old = newestByMatchAndIgn.get(key);
    if (!old || row.id >= old.id) newestByMatchAndIgn.set(key, row);
  }
  for (const row of newestByMatchAndIgn.values()) {
    const current = byMatch.get(row.match_id) || [];
    current.push(row);
    byMatch.set(row.match_id, current);
  }

  const matchProgress = matches.map((match) => ({
    match,
    progress: summarizeMatchEvaluation(players, byMatch.get(match.id) || []),
  }));
  const pendingMatches = matchProgress
    .filter(({ progress }) => progress.status !== 'complete' && progress.status !== 'no-players')
    .sort((a, b) => b.match.match_date.localeCompare(a.match.match_date) || b.match.id - a.match.id);

  const reported = new Set(reportRows.filter((report) => report.week_start === lastWeekStart).map((report) => report.player_id));
  const missingReports = players.filter((player) => !reported.has(player.id));

  // Eight calendar weeks, ending in the current week. Weeks without ratings remain null.
  const currentMonday = weekOffsets(lastWeekStart, [1])[0];
  const weeks = weekOffsets(currentMonday, [-7, -6, -5, -4, -3, -2, -1, 0]);
  const weekSet = new Set(weeks);
  const scoreGroups = new Map<string, number[]>();
  const playerScoreGroups = new Map<string, Map<string, number[]>>();
  let ratedAssessments = 0;
  const playersByIgn = new Map(players.map((player) => [player.ign.trim().toLowerCase(), player]));
  for (const row of newestByMatchAndIgn.values()) {
    if (row.status && row.status !== 'played') continue;
    if (!hasSixRatings(row)) continue;
    const match = matchById.get(row.match_id);
    const player = playersByIgn.get(row.ign.trim().toLowerCase());
    if (!match || !player) continue;
    const week = weekStartOf(match.match_date.slice(0, 10));
    if (!weekSet.has(week)) continue;
    const score = weightedScore(row as Record<WeeklyMetricKey, number>);
    const group = scoreGroups.get(week) || [];
    group.push(score);
    scoreGroups.set(week, group);
    const playerWeeks = playerScoreGroups.get(String(player.id)) || new Map<string, number[]>();
    const playerGroup = playerWeeks.get(week) || [];
    playerGroup.push(score);
    playerWeeks.set(week, playerGroup);
    playerScoreGroups.set(String(player.id), playerWeeks);
    ratedAssessments += 1;
  }
  const weeklyTeam: WeeklyTeamPoint[] = weeks.map((week_start) => {
    const scores = scoreGroups.get(week_start) || [];
    return { week_start, score: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null, assessments: scores.length };
  });
  const playerTrends: PlayerTrend[] = players.map((player) => {
    const groups = playerScoreGroups.get(String(player.id));
    const points = weeks.filter((week) => groups?.has(week)).map((week) => ({
      week, score: (groups?.get(week) || []).reduce((a, b) => a + b, 0) / (groups?.get(week)?.length || 1),
    }));
    const latest = points[points.length - 1];
    const previous = points[points.length - 2];
    return { id: player.id, ign: player.ign, role: player.role, score: latest?.score ?? null, previous: previous?.score ?? null, week_start: latest?.week };
  }).sort((a, b) => (a.score === null ? 1 : b.score === null ? -1 : a.score - b.score));

  return {
    playerCount: players.length,
    matchCount: matches.length,
    pendingMatches,
    completedMatches: matchProgress.filter(({ progress }) => progress.status === 'complete').length,
    missingReports,
    lastWeekStart,
    weeklyTeam,
    playerTrends,
    ratedAssessments,
  };
}
