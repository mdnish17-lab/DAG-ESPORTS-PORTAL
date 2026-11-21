'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { buildMonthlyReport, monthWindow, previousMonthMalaysia,
  type MonthlyAssessment, type MonthlyMatch, type MonthlyPlayer, type MonthlyWeeklyReport } from '../../lib/monthlyPerformance';
import { monthlyReportPdf } from '../../lib/monthlyReportPdf';
import { monthlyReportExcel } from '../../lib/monthlyReportExcel';
import type { ImprovementTarget } from '../../lib/improvementTargets';

type Props = { activeTeam: string; managementRole: string };
const editableRoles = ['owner', 'manager', 'coach'];
const number = (value: number | null, decimals = 2) => value == null ? '—' : value.toFixed(decimals);
const download = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    document.body.append(a);
    a.click();
    a.remove();
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  }
};

export default function MonthlyPerformanceReports({ activeTeam, managementRole }: Props) {
  const [month, setMonth] = useState(() => previousMonthMalaysia());
  const [report, setReport] = useState<ReturnType<typeof buildMonthlyReport> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedFor, setGeneratedFor] = useState('');
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  const allowed = editableRoles.includes(managementRole);
  const currentMonthMY = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);

  useEffect(() => {
    // Never offer a downloaded report for the wrong team or selected month.
    setReport(null);
    setGeneratedFor('');
    setError('');
  }, [activeTeam, month, managementRole]);

  const summary = useMemo(() => report?.totals, [report]);

  async function fetchAll<T>(
    table: string,
    columns: string,
    query: (q: any) => any,
    orderBy = 'id',
  ): Promise<T[]> {
    const rows: T[] = [];
    let from = 0;
    while (true) {
      const { data, error: fetchError } = await query(supabase.from(table).select(columns))
        .order(orderBy, { ascending: true }).range(from, from + 999);
      if (fetchError) throw new Error(table + ': ' + fetchError.message);
      rows.push(...((data || []) as T[]));
      if (!data || data.length < 1000) return rows;
      from += 1000;
    }
  }

  async function generate() {
    setError('');
    setReport(null);
    setGeneratedFor('');
    if (!allowed) {
      setError('Only approved Owner, Manager or Coach accounts can create downloadable performance reports.');
      return;
    }
    let window: ReturnType<typeof monthWindow>;
    try { window = monthWindow(month); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Invalid month.'); return; }
    setLoading(true);
    const requestTeam = activeTeam;
    const requestMonth = month;
    try {
      // Confirm current management role server-side for every export.
      const { data: role, error: roleError } = await supabase.rpc('my_management_role');
      if (roleError || !editableRoles.includes(String(role))) throw new Error('Management permission could not be confirmed.');
      const [roster, matches, targets] = await Promise.all([
        fetchAll<MonthlyPlayer>('public_player_profiles',
          'id,team,ign,role,full_name', (q) => q.eq('team', requestTeam)),
        fetchAll<MonthlyMatch>('matches',
          'id,team,status,match_date,opponent_name,match_type,dag_score,opponent_score,result',
          (q) => q.eq('team', requestTeam).eq('status', 'completed')
            .gte('match_date', window.start).lt('match_date', window.endExclusive)),
        fetchAll<ImprovementTarget>('weekly_player_targets',
          'id,player_id,team,week_start,metric_key,target_score,focus_note',
          (q) => q.eq('team', requestTeam).gte('week_start', window.start)
            .lt('week_start', window.endExclusive)),
      ]);
      // For targets beginning on the month's last Monday, include assessed
      // matches through Sunday even if that Sunday is in the next month.
      // Monthly completed-match totals still use only selected-month matches.
      const boundaryWeeks = [...new Set(targets.map((t) => t.week_start))].sort();
      let extraMatches: MonthlyMatch[] = [];
      if (boundaryWeeks.length) {
        const nextMonday = new Date(boundaryWeeks[boundaryWeeks.length - 1] + 'T12:00:00Z');
        nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
        const endOfTargetWeeks = nextMonday.toISOString().slice(0, 10);
        if (endOfTargetWeeks > window.endExclusive) {
          extraMatches = await fetchAll<MonthlyMatch>('matches',
            'id,team,status,match_date,opponent_name,match_type,dag_score,opponent_score,result',
            (q) => q.eq('team', requestTeam).eq('status', 'completed')
              .gte('match_date', window.endExclusive).lt('match_date', endOfTargetWeeks));
        }
      }
      const matchingMatches = [...matches, ...extraMatches];
      const matchIds = matchingMatches.map((match) => match.id);
      const assessments: MonthlyAssessment[] = [];
      for (let i = 0; i < matchIds.length; i += 40) {
        const ids = matchIds.slice(i, i + 40);
        const batch = await fetchAll<MonthlyAssessment>('public_match_player_stats',
          'id,match_id,ign,status,mechanics_score,macro_score,communication_score,role_execution_score,discipline_score,hero_pool_score',
          (q) => q.in('match_id', ids));
        assessments.push(...batch);
      }
      // We keep reports whose Monday start date is IN this calendar month.
      // Rows include only the publicly published weekly coach narratives.
      const reports = await fetchAll<MonthlyWeeklyReport>('weekly_player_reports',
        'id,player_id,week_start,coach_comment,improvements',
        (q) => q.eq('team', requestTeam).gte('week_start', window.start)
          .lt('week_start', window.endExclusive));
      const completed = buildMonthlyReport({
        team: requestTeam, month: requestMonth, roster, matches: matchingMatches,
        assessments, weeklyReports: reports, targets,
      });
      setReport(completed);
      setGeneratedFor(requestTeam + ':' + requestMonth);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Unable to load monthly reporting data.');
    } finally {
      setLoading(false);
    }
  }

  async function exportReport(kind: 'pdf' | 'excel') {
    if (!report || generatedFor !== activeTeam + ':' + month || !allowed) return;
    setExporting(kind);
    setError('');
    try {
      // Check access again at download time.
      const { data: role, error: roleError } = await supabase.rpc('my_management_role');
      if (roleError || !editableRoles.includes(String(role))) throw new Error('Your management role is not authorized to export.');
      const fileName = 'DAG_' + report.team.replace(/[^a-z0-9]+/gi, '_') +
        '_Monthly_Performance_' + report.month + '.' + (kind === 'pdf' ? 'pdf' : 'xlsx');
      const file = kind === 'pdf' ? monthlyReportPdf(report) : monthlyReportExcel(report);
      download(file, fileName);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not create file.');
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-5 md:p-6" aria-labelledby="monthly-performance-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="monthly-performance-title" className="text-lg font-black uppercase text-accent">Monthly Performance Reports</h3>
          <p className="mt-1 text-xs text-gray-400">Export PDF or Excel for {activeTeam} · matches, KPI ratings, attendance, weekly coaching notes and improvement goal outcomes.</p>
        </div>
        <span className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-accent">Management only</span>
      </div>

      {!allowed ? (
        <div className="mt-5 rounded-xl border border-gray-700 bg-black/30 p-4 text-sm text-gray-300">
          Owner, Manager or Coach access is required to generate performance downloads.
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-end gap-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400">Report month
              <input type="month" value={month} max={currentMonthMY} onChange={(e) => setMonth(e.target.value)}
                className="mt-2 block rounded-lg border border-gray-600 bg-[#101010] px-4 py-3 text-sm font-normal text-white outline-none focus:border-accent"/>
            </label>
            <button type="button" disabled={loading || !!exporting || !month || month > currentMonthMY} onClick={() => { void generate(); }}
              className="rounded-lg bg-accent px-5 py-3 text-sm font-black text-white hover:brightness-110 disabled:opacity-50">
              {loading ? 'Loading report…' : 'Generate monthly report'}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-500">Default: last completed calendar month in Malaysia. This month can also be selected for a report-to-date.</p>
          {error && <p role="alert" className="mt-4 rounded-lg border border-red-800 bg-red-950/20 px-4 py-3 text-sm text-red-300">{error}</p>}
          {report && generatedFor === activeTeam + ':' + month && <div className="mt-5 rounded-xl border border-gray-700 bg-black/30 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase text-white">{report.team} · {report.label}</p>
                <p className="mt-1 text-xs text-gray-400">{report.totals.completed} completed matches · {report.totals.players} roster players · {report.totals.assessments} rated player assessments</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled={!!exporting} onClick={() => { void exportReport('pdf'); }}
                  className="rounded-lg border border-pink-500 bg-pink-950/40 px-4 py-2.5 text-xs font-black text-pink-200 hover:bg-pink-950/70 disabled:opacity-50">
                  {exporting === 'pdf' ? 'Preparing PDF…' : 'Download PDF'}
                </button>
                <button type="button" disabled={!!exporting} onClick={() => { void exportReport('excel'); }}
                  className="rounded-lg border border-emerald-700 bg-emerald-950/30 px-4 py-2.5 text-xs font-black text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50">
                  {exporting === 'excel' ? 'Preparing Excel…' : 'Download Excel'}
                </button>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
              <div className="rounded-lg bg-[#161016] p-3"><p className="text-[10px] uppercase text-gray-500">Wins / Losses</p><p className="mt-1 font-black">{summary?.wins} / {summary?.losses}</p></div>
              <div className="rounded-lg bg-[#161016] p-3"><p className="text-[10px] uppercase text-gray-500">Draws</p><p className="mt-1 font-black">{summary?.draws}</p></div>
              <div className="rounded-lg bg-[#161016] p-3"><p className="text-[10px] uppercase text-gray-500">Coach KPI</p><p className="mt-1 font-black">{number(summary?.coachAvg ?? null)} / 5</p></div>
              <div className="rounded-lg bg-[#161016] p-3"><p className="text-[10px] uppercase text-gray-500">Avg attendance</p><p className="mt-1 font-black">{summary?.avgAttendancePct == null ? '—' : summary.avgAttendancePct.toFixed(1) + '%'}</p></div>
            </div>
            <div className="mt-4 rounded-lg border border-amber-900/40 bg-[#1b1712] p-3">
              <p className="text-xs font-black uppercase tracking-wider text-amber-300">Weekly Improvement Targets</p>
              <p className="mt-2 text-sm text-gray-200">
                {report.totals.goalProgress.total} targets ·
                {' '}{report.totals.goalProgress.achieved} achieved ·
                {' '}{report.totals.goalProgress.below} below target ·
                {' '}{report.totals.goalProgress.notAssessed} not assessed
              </p>
              <p className="mt-2 text-xs text-gray-400">Detailed weekly targets, actual KPI values, status and coach focus notes appear in both downloads. Goals are grouped by their Monday week-start date; the full week is assessed even when it crosses a calendar month.</p>
            </div>
            <p className="mt-3 text-xs text-gray-500">Scores are based on completed matches with six valid KPI ratings. Unassessed players remain explicitly unscored. Reports omit DOB, MLBB IDs, locations and private absence reasons.</p>
          </div>}
        </>
      )}
    </section>
  );
}
