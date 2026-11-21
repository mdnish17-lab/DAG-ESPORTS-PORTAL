'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatWeek } from '../../lib/weeklyKpi';
import { lastCompletedWeekStart, makeCoachDashboardSummary, type CoachAssessmentRow, type CoachReportRow } from '../../lib/coachDashboard';
import type { ProgressMatch, ProgressPlayer } from '../../lib/matchEvaluationProgress';

type Props = {
  activeTeam: string;
  roster: ProgressPlayer[];
  matches: ProgressMatch[];
  onEvaluateMatch: (matchId: number) => void;
  onOpenMatchLog: () => void;
  onOpenReport: (playerId: number, weekStart: string) => void;
  onOpenReports: () => void;
  canEdit?: boolean;
};
const card = 'rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-5 md:p-6';

export default function CoachDashboard({ activeTeam, roster, matches, onEvaluateMatch, onOpenMatchLog, onOpenReport, onOpenReports, canEdit = true }: Props) {
  const [assessmentRows, setAssessmentRows] = useState<CoachAssessmentRow[]>([]);
  const [reportRows, setReportRows] = useState<CoachReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [lastWeek, setLastWeek] = useState(() => lastCompletedWeekStart());
  const idsKey = matches.map((match) => match.id).join(',');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setAssessmentRows([]);
      setReportRows([]);
      const previousWeek = lastCompletedWeekStart();
      setLastWeek(previousWeek);
      try {
        const ids = idsKey.split(',').filter(Boolean).map(Number);
        const allAssessments: CoachAssessmentRow[] = [];
        // Read every page instead of assuming the default 1000-row Supabase limit.
        for (let i = 0; i < ids.length; i += 40) {
          let offset = 0;
          while (!cancelled) {
            const { data, error: queryError } = await supabase.from('public_match_player_stats')
              .select('id,match_id,ign,status,mechanics_score,macro_score,communication_score,role_execution_score,discipline_score,hero_pool_score')
              .in('match_id', ids.slice(i, i + 40)).order('id', { ascending: true }).range(offset, offset + 999);
            if (queryError) throw queryError;
            allAssessments.push(...((data || []) as CoachAssessmentRow[]));
            if (!data || data.length < 1000) break;
            offset += 1000;
          }
          if (cancelled) return;
        }
        const { data: reports, error: reportError } = await supabase.from('weekly_player_reports')
          .select('player_id,week_start').eq('team', activeTeam).eq('week_start', previousWeek);
        if (reportError) throw reportError;
        if (cancelled) return;
        setAssessmentRows(allAssessments);
        setReportRows((reports || []) as CoachReportRow[]);
      } catch (problem: unknown) {
        if (!cancelled) setError(problem instanceof Error ? problem.message : 'Could not load dashboard data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [activeTeam, idsKey, refreshVersion]);

  const dashboard = useMemo(() => makeCoachDashboardSummary(roster, matches, assessmentRows, reportRows, lastWeek),
    [roster, matches, assessmentRows, reportRows, lastWeek]);
  const totalEvaluated = dashboard.completedMatches;
  const latestPoint = [...dashboard.weeklyTeam].reverse().find((point) => point.score != null);

  return (
    <div className="animate-fadeIn space-y-6">
      <header className="rounded-2xl border border-accent/40 bg-gradient-to-r from-[#24101c] to-[#151014] p-6 md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.23em] text-accent">Management workspace · {activeTeam}</p>
            <h2 className="mt-2 text-2xl font-black uppercase md:text-3xl">Coach Dashboard</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">Track evaluations, weekly player reports and team KPI trends in one place.</p>
          </div>
          <button type="button" disabled={loading} onClick={() => setRefreshVersion((version) => version + 1)}
            className="rounded-lg border border-gray-600 px-4 py-2 text-xs font-black uppercase text-gray-200 hover:border-accent disabled:opacity-50">Refresh data</button>
        </div>
      </header>

      {loading ? <div role="status" className={card + ' text-sm text-gray-400'}>Loading coaching overview...</div>
      : error ? <div role="alert" className="rounded-xl border border-red-800 bg-red-950/25 p-5 text-sm text-red-300">
        Could not load coaching overview: {error}. Check Supabase access and refresh. No data was changed.
      </div> : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <div className={card}><p className="text-xs font-bold uppercase text-gray-400">Completed matches</p><p className="mt-2 text-3xl font-black">{dashboard.matchCount}</p><p className="mt-1 text-xs text-gray-500">Registered in Match Log</p></div>
            <div className={card}><p className="text-xs font-bold uppercase text-gray-400">Need evaluation</p><p className="mt-2 text-3xl font-black text-amber-300">{dashboard.pendingMatches.length}</p><p className="mt-1 text-xs text-gray-500">{totalEvaluated} fully evaluated</p></div>
            <div className={card}><p className="text-xs font-bold uppercase text-gray-400">Weekly reports missing</p><p className="mt-2 text-3xl font-black text-accent">{dashboard.missingReports.length}</p><p className="mt-1 text-xs text-gray-500">Week of {formatWeek(lastWeek)} · last completed week</p></div>
            <div className={card}><p className="text-xs font-bold uppercase text-gray-400">Latest weekly KPI</p><p className="mt-2 text-3xl font-black text-emerald-300">{latestPoint?.score == null ? '—' : latestPoint.score.toFixed(2)}</p><p className="mt-1 text-xs text-gray-500">{latestPoint ? formatWeek(latestPoint.week_start) + ' · ' + latestPoint.assessments + ' ratings' : 'No scored matches in last 8 weeks'}</p></div>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <section className={card} aria-labelledby="pending-evaluations-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id="pending-evaluations-title" className="text-lg font-black uppercase text-accent">Evaluations to finish</h3>
                <button type="button" onClick={onOpenMatchLog} className="text-xs font-bold text-gray-300 underline underline-offset-4 hover:text-accent">Open Match Log</button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Played needs all six KPI ratings; Benched or Absent needs saved participation.</p>
              {dashboard.pendingMatches.length === 0 ? (
                <p className="mt-5 rounded-xl border border-emerald-900 bg-emerald-950/15 p-4 text-sm text-emerald-300">{dashboard.matchCount === 0 ? 'No completed matches yet. Register a match to start.' : 'All registered completed matches have evaluations for current players.'}</p>
              ) : <div className="mt-4 space-y-3">
                {dashboard.pendingMatches.slice(0, 5).map(({ match, progress }) => {
                  const percentage = progress.total ? Math.round(progress.completed * 100 / progress.total) : 0;
                  const missing = progress.players.filter((player) => player.state !== 'complete');
                  return <div key={match.id} className="rounded-xl border border-gray-700 bg-black/30 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0"><p className="truncate font-bold">DAG vs {match.opponent_name}</p><p className="mt-1 text-xs text-gray-500">{match.match_date} · {progress.completed}/{progress.total} players complete</p></div>
                      {canEdit && <button type="button" onClick={() => onEvaluateMatch(match.id)} className="shrink-0 rounded-lg bg-accent px-3 py-2 text-xs font-black text-white hover:brightness-110">Continue</button>}
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-800">
                      <div className="h-full rounded-full bg-accent" style={{ width: String(percentage) + '%' }} />
                    </div>
                    <p className="mt-2 text-xs text-amber-200">{missing.slice(0, 4).map((player) => player.ign + (player.state === 'needs-ratings' ? ' (review)' : '')).join(', ')}{missing.length > 4 ? ' +' + (missing.length - 4) + ' more' : ''}</p>
                  </div>;
                })}
                {dashboard.pendingMatches.length > 5 && <button type="button" onClick={onOpenMatchLog} className="text-xs font-bold text-accent underline underline-offset-4">View all {dashboard.pendingMatches.length} matches requiring attention</button>}
              </div>}
            </section>

            <section className={card} aria-labelledby="weekly-reports-title">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id="weekly-reports-title" className="text-lg font-black uppercase text-accent">Weekly report checklist</h3>
                <button type="button" onClick={onOpenReports} className="text-xs font-bold text-gray-300 underline underline-offset-4 hover:text-accent">Open Weekly Reports</button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Reports for the last completed week · beginning {formatWeek(lastWeek)}. Missing reports are reminders only.</p>
              {dashboard.playerCount === 0 ? <p className="mt-5 text-sm text-gray-400">No players in this roster.</p>
                : dashboard.missingReports.length === 0 ? <p className="mt-5 rounded-xl border border-emerald-900 bg-emerald-950/15 p-4 text-sm text-emerald-300">Weekly reports are recorded for all {dashboard.playerCount} current players.</p>
                : <div className="mt-4 max-h-[430px] space-y-2 overflow-y-auto pr-1">
                  {dashboard.missingReports.map((player) => <div key={player.id} className="flex items-center justify-between gap-3 rounded-xl border border-gray-700 bg-black/30 px-4 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-bold">{player.ign}</p><p className="text-[11px] text-gray-500">{player.role || 'Player'} · No report for this week</p></div>
                    {canEdit && <button type="button" onClick={() => onOpenReport(player.id, lastWeek)} className="shrink-0 rounded-lg border border-accent/60 px-3 py-2 text-xs font-bold text-accent hover:bg-accent/10">Write report</button>}
                  </div>)}
                </div>}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <section className={card} aria-labelledby="team-trend-title">
              <h3 id="team-trend-title" className="text-lg font-black uppercase text-accent">Team KPI trend</h3>
              <p className="mt-1 text-xs text-gray-400">Eight calendar weeks · average of actual six-category match assessments (1–5). Empty weeks are not scored as zero.</p>
              {dashboard.weeklyTeam.every((point) => point.score == null) ? <p className="mt-7 rounded-xl border border-dashed border-gray-700 p-6 text-sm text-gray-400">No scored player evaluations in the last eight weeks.</p>
                : <div className="mt-6">
                  <div className="grid h-48 grid-cols-8 items-end gap-2 border-b border-gray-700 pb-1" role="img" aria-label="Weekly average team KPI chart on a zero to five scale">
                    {dashboard.weeklyTeam.map((point) => <div key={point.week_start} className="flex h-full min-w-0 flex-col items-center justify-end gap-1" title={formatWeek(point.week_start) + ': ' + (point.score == null ? 'No assessments' : point.score.toFixed(2) + ' out of 5 (' + point.assessments + ' assessments)')}>
                      <span className="text-[10px] font-bold text-gray-300">{point.score == null ? '—' : point.score.toFixed(1)}</span>
                      {point.score == null ? <div className="h-1 w-full max-w-10 rounded bg-gray-700/80" /> :
                        <div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-accent/50 to-accent" style={{ height: String(point.score / 5 * 90) + '%' }} />}
                    </div>)}
                  </div>
                  <div className="mt-2 grid grid-cols-8 gap-1 text-center text-[10px] text-gray-500">
                    {dashboard.weeklyTeam.map((point) => <span key={point.week_start}>{formatWeek(point.week_start)}</span>)}
                  </div>
                  <p className="mt-3 text-xs text-gray-500">{dashboard.ratedAssessments} saved player assessments in this eight-week window.</p>
                </div>}
            </section>
            <section className={card} aria-labelledby="player-trends-title">
              <h3 id="player-trends-title" className="text-lg font-black uppercase text-accent">Player KPI snapshot</h3>
              <p className="mt-1 text-xs text-gray-400">Latest scored week vs previous scored week · lowest scores first</p>
              <div className="mt-4 max-h-[390px] space-y-2 overflow-y-auto pr-1">
                {dashboard.playerTrends.length === 0 && <p className="text-sm text-gray-400">No players to display.</p>}
                {dashboard.playerTrends.map((player) => {
                  const change = player.score != null && player.previous != null ? player.score - player.previous : null;
                  return <div key={player.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-700 bg-black/30 px-4 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-bold">{player.ign}</p><p className="text-[11px] text-gray-500">{player.week_start ? 'Week of ' + formatWeek(player.week_start) : 'No scored matches in eight weeks'}</p></div>
                    <div className="text-right"><p className="text-sm font-black text-white">{player.score == null ? '—' : player.score.toFixed(2) + ' / 5'}</p>
                      <p className={'text-[11px] ' + (change == null ? 'text-gray-500' : change > 0 ? 'text-emerald-400' : change < 0 ? 'text-amber-300' : 'text-gray-400')}>
                        {change == null ? 'No comparison yet' : (change > 0 ? '+' : '') + change.toFixed(2) + ' from prior scored week'}</p></div>
                  </div>;
                })}
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
