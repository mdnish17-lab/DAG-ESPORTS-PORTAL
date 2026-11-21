import { isStaffMember, type ProgressPlayer } from './matchEvaluationProgress';
import { hasSixRatings, weightedScore, WEEKLY_METRICS, type WeeklyMetricKey } from './weeklyKpi';

export type MonthlyMatch = {
  id: number;
  match_date: string;
  opponent_name: string;
  match_type?: string | null;
  dag_score?: number | null;
  opponent_score?: number | null;
  result?: string | null;
  status?: string | null;
};
export type MonthlyPlayer = ProgressPlayer & { full_name?: string | null };
export type MonthlyAssessment = {
  id: number;
  match_id: number;
  ign: string;
  status?: string | null;
} & Partial<Record<WeeklyMetricKey, number | null>>;
export type MonthlyWeeklyReport = {
  id: number;
  player_id: number;
  week_start: string;
  coach_comment: string | null;
  improvements: string | null;
};
export type MonthlyPlayerRow = {
  id: number;
  ign: string;
  fullName: string;
  role: string;
  played: number;
  benched: number;
  absent: number;
  unrecorded: number;
  attended: number;
  attendancePct: number | null;
  rated: number;
  coachAvg: number | null;
  overall: number | null;
  metrics: Record<WeeklyMetricKey, number | null>;
};
export type MonthlyMatchRow = MonthlyMatch & { ratedPlayers: number; averageKpi: number | null };
export type MonthlyReport = {
  team: string;
  month: string;
  label: string;
  start: string;
  endExclusive: string;
  generatedAt: string;
  matches: MonthlyMatchRow[];
  players: MonthlyPlayerRow[];
  weeklyReports: Array<MonthlyWeeklyReport & { ign: string }>;
  totals: {
    completed: number;
    wins: number;
    losses: number;
    draws: number;
    players: number;
    assessments: number;
    coachAvg: number | null;
    avgAttendancePct: number | null;
    overall: number | null;
  };
};

export function validMonth(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  return year >= 2000 && year <= 2100;
}

export function monthWindow(value: string) {
  if (!validMonth(value)) throw new Error('Choose a valid reporting month.');
  const [year, month] = value.split('-').map(Number);
  const start = value + '-01';
  const endExclusive = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const label = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(start + 'T12:00:00Z'));
  return { start, endExclusive, label };
}

export function previousMonthMalaysia(now: Date = new Date()): string {
  const dateMY = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const monthStartUTC = new Date(Date.UTC(dateMY.getUTCFullYear(), dateMY.getUTCMonth() - 1, 1));
  return monthStartUTC.toISOString().slice(0, 7);
}

const norm = (s: string) => s.trim().toLocaleLowerCase('en-US');
const avg = (items: number[]): number | null =>
  items.length ? items.reduce((sum, n) => sum + n, 0) / items.length : null;

/** Completed matches only. A missing or partially scored evaluation is never given a fabricated KPI. */
export function buildMonthlyReport(input: {
  team: string;
  month: string;
  roster: MonthlyPlayer[];
  matches: MonthlyMatch[];
  assessments: MonthlyAssessment[];
  weeklyReports: MonthlyWeeklyReport[];
  generatedAt?: string;
}): MonthlyReport {
  const { start, endExclusive, label } = monthWindow(input.month);
  const matches = input.matches.filter((m) =>
    m.status === 'completed' && m.match_date.slice(0, 10) >= start && m.match_date.slice(0, 10) < endExclusive
  ).sort((a, b) => a.match_date.localeCompare(b.match_date) || a.id - b.id);
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const roster = input.roster.filter((player) => !isStaffMember(player));
  const rosterByIgn = new Map(roster.map((player) => [norm(player.ign), player]));

  // Older imports may contain duplicates; keep only the latest assessment (highest id).
  const latest = new Map<string, MonthlyAssessment>();
  for (const item of input.assessments) {
    if (!matchById.has(item.match_id) || !rosterByIgn.has(norm(item.ign))) continue;
    const key = item.match_id + '|' + norm(item.ign);
    const previous = latest.get(key);
    if (!previous || item.id > previous.id) latest.set(key, item);
  }
  const unique = [...latest.values()];
  const rated = unique.filter((row) =>
    (!row.status || row.status === 'played') && hasSixRatings(row)
  );
  const playerRows: MonthlyPlayerRow[] = roster.map((player) => {
    const mine = unique.filter((row) => norm(row.ign) === norm(player.ign));
    const valid = mine.filter((row) =>
      (!row.status || row.status === 'played') && hasSixRatings(row)
    );
    const played = mine.filter((row) => !row.status || row.status === 'played').length;
    const benched = mine.filter((row) => row.status === 'bench').length;
    const absent = mine.filter((row) => row.status === 'absent').length;
    const attended = played + benched;
    const attendancePct = matches.length ? attended / matches.length * 100 : null;
    const coachAvg = avg(valid.map((row) => weightedScore(row as Record<WeeklyMetricKey, number>)));
    const overall = coachAvg !== null && attendancePct !== null
      ? coachAvg * 0.7 + (1 + 4 * attendancePct / 100) * 0.3 : null;
    const metrics = {} as MonthlyPlayerRow['metrics'];
    for (const metric of WEEKLY_METRICS) {
      metrics[metric.key] = avg(valid.map((row) => Number(row[metric.key])));
    }
    return {
      id: player.id,
      ign: player.ign,
      fullName: player.full_name || '',
      role: player.role || '',
      played, benched, absent,
      unrecorded: Math.max(0, matches.length - mine.length),
      attended,
      attendancePct,
      rated: valid.length,
      coachAvg,
      overall,
      metrics,
    };
  }).sort((a, b) => a.ign.localeCompare(b.ign));
  const matchRows: MonthlyMatchRow[] = matches.map((match) => {
    const scores = rated.filter((row) => row.match_id === match.id)
      .map((row) => weightedScore(row as Record<WeeklyMetricKey, number>));
    return { ...match, ratedPlayers: scores.length, averageKpi: avg(scores) };
  });
  const weeklies = input.weeklyReports.filter((row) =>
    row.week_start >= start && row.week_start < endExclusive &&
    roster.some((player) => player.id === row.player_id)
  ).map((row) => ({
    ...row,
    ign: roster.find((player) => player.id === row.player_id)?.ign || '',
  })).sort((a, b) => a.week_start.localeCompare(b.week_start) || a.ign.localeCompare(b.ign));
  const coachAvg = avg(rated.map((row) => weightedScore(row as Record<WeeklyMetricKey, number>)));
  const playerAttendances = playerRows.flatMap((player) => player.attendancePct === null ? [] : [player.attendancePct]);
  const overallScores = playerRows.flatMap((player) => player.overall === null ? [] : [player.overall]);
  return {
    team: input.team,
    month: input.month,
    label,
    start,
    endExclusive,
    generatedAt: input.generatedAt || new Date().toISOString(),
    matches: matchRows,
    players: playerRows,
    weeklyReports: weeklies,
    totals: {
      completed: matches.length,
      wins: matches.filter((m) => m.result === 'WIN').length,
      losses: matches.filter((m) => m.result === 'LOSS').length,
      draws: matches.filter((m) => m.result === 'DRAW').length,
      players: roster.length,
      assessments: rated.length,
      coachAvg,
      avgAttendancePct: avg(playerAttendances),
      overall: avg(overallScores),
    },
  };
}
