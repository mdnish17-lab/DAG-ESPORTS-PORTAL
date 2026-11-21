// Weekly coach assessment categories and weights follow the supplied workbook:
// CONFIG!B18:G19 and KPI PLAYER!D7:I7. A score is from 1 to 5.
export const WEEKLY_METRICS = [
  { key: 'mechanics_score', label: 'Mechanics', weight: 0.20, color: '#fb6db8' },
  { key: 'macro_score', label: 'Macro', weight: 0.25, color: '#a78bfa' },
  { key: 'communication_score', label: 'Communication', weight: 0.15, color: '#38bdf8' },
  { key: 'role_execution_score', label: 'Role Execution', weight: 0.20, color: '#fbbf24' },
  { key: 'discipline_score', label: 'Discipline', weight: 0.10, color: '#4ade80' },
  { key: 'hero_pool_score', label: 'Hero Pool', weight: 0.10, color: '#fb923c' },
] as const;

export type WeeklyMetricKey = (typeof WEEKLY_METRICS)[number]['key'];
export type WeeklyScores = Record<WeeklyMetricKey, number>;
export type WeeklyReview = WeeklyScores & {
  id: number;
  player_id: number;
  team: string;
  week_start: string;
  match_count?: number;
};

export function weightedScore(scores: WeeklyScores): number {
  return WEEKLY_METRICS.reduce((total, metric) => total + scores[metric.key] * metric.weight, 0);
}

// Normalize a chosen calendar date to its ISO Monday, independent of local time zone.
export function weekStartOf(dateInput: string): string {
  const date = new Date(`${dateInput}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

export function formatWeek(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(date);
}

// Weekly graph data is derived from completed, actually assessed match stats.
// No estimates, default ratings, or ratings for bench/absent rows are added.
export function hasSixRatings(row: Partial<Record<WeeklyMetricKey, unknown>>): row is WeeklyScores {
  return WEEKLY_METRICS.every(({ key }) =>
    typeof row[key] === 'number' && Number.isInteger(row[key]) && (row[key] as number) >= 1 && (row[key] as number) <= 5
  );
}

export function weeklyReviewsFromMatches(
  stats: Array<Partial<Record<WeeklyMetricKey, unknown>> & { status?: string | null; match_id: number }>,
  matchDates: Record<number, string>,
  playerId: number,
  team: string,
): WeeklyReview[] {
  const groups = new Map<string, WeeklyScores[]>();
  for (const stat of stats) {
    if ((stat.status && stat.status !== 'played') || !hasSixRatings(stat)) continue;
    const date = matchDates[stat.match_id];
    if (!date) continue;
    const monday = weekStartOf(date.slice(0, 10));
    if (!monday) continue;
    const ratings = groups.get(monday) || [];
    ratings.push(stat);
    groups.set(monday, ratings);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([week_start, ratings]) => {
    const averages = {} as WeeklyScores;
    WEEKLY_METRICS.forEach(({ key }) => {
      averages[key] = ratings.reduce((sum, row) => sum + row[key], 0) / ratings.length;
    });
    return {
      ...averages,
      id: Number(week_start.replace(/-/g, '')),
      player_id: playerId,
      team,
      week_start,
      match_count: ratings.length,
    };
  });
}
