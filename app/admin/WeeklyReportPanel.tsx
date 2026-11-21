"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatWeek, weekStartOf } from '../../lib/weeklyKpi';

type PlayerSummary = { id: number; ign: string; role?: string };
type Props = { activeTeam: string; roster: PlayerSummary[] };
type Report = { id: number; player_id: number; team: string; week_start: string; coach_comment: string; improvements: string; updated_at?: string };
const fieldClass = 'w-full rounded-xl border border-gray-700 bg-[#121212] px-4 py-3 text-white outline-none focus:border-accent';

export default function WeeklyReportPanel({ activeTeam, roster }: Props) {
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [isManager, setIsManager] = useState(false);
  const [accessError, setAccessError] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [playerId, setPlayerId] = useState('');
  const [weekStart, setWeekStart] = useState(() => {
    // The DAG teams operate on Malaysian calendar dates (UTC+08, no DST).
    const localDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    return weekStartOf(localDate);
  });
  const [coachComment, setCoachComment] = useState('');
  const [improvements, setImprovements] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const players = useMemo(() => roster.filter((player) => !['coach', 'manager'].includes(String(player.role || '').toLowerCase())), [roster]);
  const currentReport = reports.find((report) => String(report.player_id) === playerId && report.week_start === weekStart);

  useEffect(() => {
    let ignore = false;
    async function loadManagementAccess() {
      const { data, error: authError } = await supabase.rpc('is_approved_admin');
      if (ignore) return;
      setIsManager(!authError && data === true);
      if (authError) setAccessError('Management access check unavailable. Verify your Admin Login and Supabase permissions, then refresh.');
      else if (!data) setAccessError('Only approved DAG management accounts can write weekly reports.');
      else setAccessError('');
      setCheckingAccess(false);
    }
    void loadManagementAccess();
    return () => { ignore = true; };
  }, [activeTeam]);

  useEffect(() => {
    if (!isManager) return;
    let ignore = false;
    async function loadReports() {
      const { data, error: queryError } = await supabase.from('weekly_player_reports')
        .select('id,player_id,team,week_start,coach_comment,improvements,updated_at')
        .eq('team', activeTeam).order('week_start', { ascending: false });
      if (ignore) return;
      if (queryError) setError('Could not load weekly reports: ' + queryError.message);
      else { setReports((data || []) as Report[]); setError(''); }
    }
    void loadReports();
    return () => { ignore = true; };
  }, [isManager, activeTeam]);

  function selectReport(nextPlayerId: string, nextWeekStart: string) {
    const matching = reports.find((report) => String(report.player_id) === nextPlayerId && report.week_start === nextWeekStart);
    setPlayerId(nextPlayerId);
    setWeekStart(nextWeekStart);
    setCoachComment(matching?.coach_comment || '');
    setImprovements(matching?.improvements || '');
    setError('');
    setNotice('');
  }

  async function saveReport() {
    setError(''); setNotice('');
    if (!isManager) { setError('Management approval is required.'); return; }
    if (!playerId) { setError('Select a player first.'); return; }
    if (!coachComment.trim() || !improvements.trim()) {
      setError('Fill both Coach Comments and What to Improve before saving.'); return;
    }
    const monday = weekStartOf(weekStart);
    if (!monday) { setError('Choose a valid week.'); return; }
    setSaving(true);
    const payload = {
      player_id: Number(playerId), team: activeTeam, week_start: monday,
      coach_comment: coachComment.trim(), improvements: improvements.trim(), updated_at: new Date().toISOString(),
    };
    const { data, error: saveError } = await supabase.from('weekly_player_reports')
      .upsert(payload, { onConflict: 'player_id,week_start' }).select('id,player_id,team,week_start,coach_comment,improvements,updated_at').single();
    setSaving(false);
    if (saveError) { setError('Save failed: ' + saveError.message); return; }
    setReports((prev) => [data as Report, ...prev.filter((r) => r.id !== data.id)].sort((a, b) => b.week_start.localeCompare(a.week_start)));
    setNotice('Weekly coach report saved. It now appears for this player on the public Evaluation page.');
  }

  async function deleteReport() {
    if (!currentReport || !isManager) return;
    if (!confirm('Delete this weekly report? The public Evaluation page will no longer show it.')) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from('weekly_player_reports').delete().eq('id', currentReport.id);
    setSaving(false);
    if (deleteError) { setError('Delete failed: ' + deleteError.message); return; }
    setReports((prev) => prev.filter((r) => r.id !== currentReport.id));
    setNotice('Weekly report deleted.');
  }

  return (
    <div className="animate-fadeIn space-y-6">
      <div className="rounded-2xl border border-accent/40 bg-gradient-to-r from-[#24101c] to-[#151014] p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Approved management accounts</p>
        <h2 className="mt-2 text-2xl md:text-3xl font-black uppercase">Weekly Player Report</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-300">All approved management accounts can write a weekly review for each player: what they did well, your coaching feedback, and exactly what to improve next week. Reports are displayed on each player&apos;s public Evaluation profile. Numeric performance scores still come automatically from evaluated matches.</p>
      </div>
      {checkingAccess ? (
        <div className="rounded-xl border border-gray-800 bg-[#1a1a1a] p-8 text-center text-gray-400">Verifying management access...</div>
      ) : !isManager ? (
        <div className="rounded-xl border border-yellow-800 bg-yellow-950/20 p-7">
          <h3 className="font-black text-yellow-300">Management access required</h3>
          <p className="mt-2 text-sm text-gray-300">{accessError}</p>
          <p className="mt-3 text-xs text-gray-400">This is enforced by Supabase RLS, not just by hiding the form. Your existing Admin Login is unchanged.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,310px)]">
          <div className="rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-6 md:p-8">
            <h3 className="mb-5 text-lg font-black uppercase text-accent">Write or Edit a Report</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Player
                <select value={playerId} onChange={(e) => selectReport(e.target.value, weekStart)} className={`${fieldClass} mt-2`}>
                  <option value="">Choose a player</option>
                  {players.map((player) => <option value={player.id} key={player.id}>{player.ign} — {player.role}</option>)}
                </select>
              </label>
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">Week beginning (Monday)
                <input type="date" value={weekStart} onChange={(e) => selectReport(playerId, weekStartOf(e.target.value))} className={`${fieldClass} mt-2`} />
              </label>
            </div>
            {playerId && <p className="mt-3 text-xs text-gray-400">Report for week of <strong className="text-white">{formatWeek(weekStart)}</strong> · {currentReport ? 'Editing an existing report' : 'New report'}</p>}
            <label className="mt-7 block text-sm font-bold text-gray-200">Coach Comments — Performance and Strengths
              <textarea rows={6} value={coachComment} onChange={(e) => setCoachComment(e.target.value)}
                placeholder="Describe what the player did well, recent development, teamwork and overall training observations..."
                className={`${fieldClass} mt-2 resize-y`} />
            </label>
            <label className="mt-6 block text-sm font-bold text-gray-200">What to Improve — Next Week&apos;s Focus
              <textarea rows={6} value={improvements} onChange={(e) => setImprovements(e.target.value)}
                placeholder="Give specific goals or action points: rotations, hero choices, communication, mechanics, consistency..."
                className={`${fieldClass} mt-2 resize-y`} />
            </label>
            <p className="mt-3 text-xs text-yellow-200/80">These comments will be visible on the public Evaluation page. Avoid private or sensitive personal details.</p>
            {error && <p role="alert" className="mt-4 rounded-lg border border-red-800 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
            {notice && <p role="status" className="mt-4 rounded-lg border border-green-800 bg-green-950/30 p-3 text-sm text-green-300">{notice}</p>}
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" disabled={saving} onClick={saveReport} className="rounded-xl bg-accent px-7 py-3 font-black uppercase text-white hover:brightness-110 disabled:opacity-50">{saving ? 'Saving...' : currentReport ? 'Update Weekly Report' : 'Publish Weekly Report'}</button>
              {currentReport && <button type="button" disabled={saving} onClick={deleteReport} className="rounded-xl border border-red-800 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-950/30">Delete report</button>}
            </div>
          </div>

          <aside className="h-fit rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-5">
            <h3 className="font-black uppercase text-accent">Recent Weekly Reports</h3>
            <p className="mb-4 mt-1 text-xs text-gray-500">Click one to edit its notes.</p>
            <div className="flex max-h-[660px] flex-col gap-2 overflow-y-auto">
              {reports.length === 0 && <p className="rounded-lg border border-dashed border-gray-700 p-4 text-sm text-gray-500">No weekly reports for this team yet.</p>}
              {reports.map((report) => {
                const player = players.find((p) => p.id === report.player_id);
                return <button key={report.id} type="button" onClick={() => selectReport(String(report.player_id), report.week_start)}
                  className={`rounded-xl border p-4 text-left ${currentReport?.id === report.id ? 'border-accent bg-accent/10' : 'border-gray-800 bg-[#111] hover:border-gray-600'}`}>
                  <span className="block text-sm font-bold">{player?.ign || `Player #${report.player_id}`}</span>
                  <span className="mt-1 block text-xs text-gray-400">Week of {formatWeek(report.week_start)}</span>
                  <span className="mt-2 block line-clamp-2 text-xs text-gray-300">{report.improvements}</span>
                </button>;
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
