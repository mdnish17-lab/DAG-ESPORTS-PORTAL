import { hasSixRatings, type WeeklyMetricKey } from './weeklyKpi';

/** A match is complete for a player once participation is recorded and,
 * when they played, every coach-assessed KPI has a valid 1–5 score. */
export type ProgressPlayer = { id: number; ign: string; role?: string | null };
export type ProgressMatch = {
  id: number;
  match_date: string;
  match_type?: string | null;
  opponent_name: string;
  dag_score?: number | null;
  opponent_score?: number | null;
};
export type ProgressAssessment = Partial<Record<WeeklyMetricKey, number | null>> & {
  id?: number;
  match_id?: number;
  ign?: string;
  status?: string | null;
};
export type PlayerProgress = {
  ign: string;
  state: 'complete' | 'needs-ratings' | 'missing';
};
export type MatchProgress = {
  completed: number;
  total: number;
  recorded: number;
  status: 'complete' | 'in-progress' | 'not-started' | 'no-players';
  players: PlayerProgress[];
};

export const isStaffMember = (player: ProgressPlayer): boolean =>
  ['coach', 'manager'].includes((player.role || '').toLowerCase());

export function getAssessmentProgressState(
  assessment: ProgressAssessment | undefined,
): PlayerProgress['state'] {
  if (!assessment) return 'missing';
  if (assessment.status === 'absent' || assessment.status === 'bench') return 'complete';
  if ((!assessment.status || assessment.status === 'played') && hasSixRatings(assessment)) return 'complete';
  return 'needs-ratings';
}

/** Latest saved record wins if historical data contains multiple rows for an IGN. */
export function summarizeMatchEvaluation(
  roster: ProgressPlayer[],
  assessments: ProgressAssessment[],
): MatchProgress {
  const players = roster.filter((player) => !isStaffMember(player));
  const byIgn = new Map<string, ProgressAssessment>();
  for (const assessment of assessments) {
    const ign = assessment.ign?.trim().toLowerCase();
    if (!ign) continue;
    const previous = byIgn.get(ign);
    if (!previous || (assessment.id ?? 0) >= (previous.id ?? 0)) byIgn.set(ign, assessment);
  }
  const states = players.map((player) => ({
    ign: player.ign,
    state: getAssessmentProgressState(byIgn.get(player.ign.trim().toLowerCase())),
  }));
  const completed = states.filter((item) => item.state === 'complete').length;
  const recorded = states.filter((item) => item.state !== 'missing').length;
  const total = players.length;
  const status: MatchProgress['status'] = total === 0 ? 'no-players'
    : completed === total ? 'complete'
    : recorded > 0 ? 'in-progress' : 'not-started';
  return { completed, total, recorded, status, players: states };
}
