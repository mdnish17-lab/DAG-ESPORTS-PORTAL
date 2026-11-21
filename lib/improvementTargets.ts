import { WEEKLY_METRICS, weekStartOf, type WeeklyMetricKey, type WeeklyReview } from './weeklyKpi';

export type ImprovementTarget = {
  id: number;
  player_id: number;
  team: string;
  week_start: string;
  metric_key: WeeklyMetricKey;
  target_score: number;
  focus_note: string | null;
  created_at?: string;
  updated_at?: string;
};
export type TargetStatus = 'achieved' | 'below-target' | 'not-assessed';
export type TargetProgress = ImprovementTarget & {
  metric_label: string;
  actual: number | null;
  status: TargetStatus;
  difference: number | null;
};

export function isMetricKey(value: string): value is WeeklyMetricKey {
  return WEEKLY_METRICS.some(({ key }) => key === value);
}

export function nextWeekOf(week: string): string {
  const monday = weekStartOf(week);
  if (!monday) throw new Error('Invalid report date.');
  const date = new Date(monday + 'T12:00:00Z');
  date.setUTCDate(date.getUTCDate() + 7);
  return date.toISOString().slice(0, 10);
}

export function isValidTarget(value: number): boolean {
  return Number.isFinite(value) && value >= 1 && value <= 5 && Math.round(value * 10) === value * 10;
}

/** Actual score is computed exclusively from complete KPI assessments.
 * Missing assessed weeks never count as a zero or as a failed target. */
export function targetProgress(target: ImprovementTarget, reviews: WeeklyReview[]): TargetProgress {
  const found = reviews.find((review) => review.week_start === target.week_start);
  const score = found?.[target.metric_key];
  const actual = typeof score === 'number' && Number.isFinite(score) ? score : null;
  const status: TargetStatus = actual == null
    ? 'not-assessed'
    : actual >= target.target_score - 1e-8 ? 'achieved' : 'below-target';
  const difference = actual == null ? null : actual - target.target_score;
  return {
    ...target,
    metric_label: WEEKLY_METRICS.find(({ key }) => key === target.metric_key)?.label || target.metric_key,
    actual,
    status,
    difference,
  };
}

export function progressForWeek(targets: ImprovementTarget[], reviews: WeeklyReview[], monday: string) {
  const included = targets.filter((target) => target.week_start === monday)
    .map((target) => targetProgress(target, reviews));
  return {
    targets: included,
    achieved: included.filter((target) => target.status === 'achieved').length,
    below: included.filter((target) => target.status === 'below-target').length,
    unassessed: included.filter((target) => target.status === 'not-assessed').length,
  };
}
