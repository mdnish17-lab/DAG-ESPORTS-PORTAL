"use client";

import Image from 'next/image';
import Link from 'next/link';
import TeamNavigation from '../../lib/TeamNavigation';
import { getTeamTheme, themeStyle } from '../../lib/teamTheme';
import { supabase } from '../../lib/supabase';
import { useEffect, useRef, useState } from 'react';
import WeeklyPerformanceChart from './WeeklyPerformanceChart';
import { type ImprovementTarget } from '../../lib/improvementTargets';
import { WEEKLY_METRICS, hasSixRatings, weightedScore, weeklyReviewsFromMatches, formatWeek, type WeeklyReview } from '../../lib/weeklyKpi';

const TEAMS = ['DAG Ladies', 'DAG Montrix'];
const CURRENT = '/evaluation';

// ===== WEIGHTS for Overall Evaluation (must sum to 1) =====
const COACH_RATING_WEIGHT = 0.7;
const ATTENDANCE_WEIGHT = 0.3;

const isStaffRole = (p: any) => ['coach', 'manager'].includes((p.role || '').toLowerCase());

const rateColor = (rate: number) => (rate >= 80 ? '#4ade80' : rate >= 50 ? '#facc15' : '#f87171');

function Ring({ value, size = 112, color }: { value: number; size?: number; color?: string }) {
  const c = color || rateColor(value);
  const inner = size - 24;
  return (
    <div
      className="rounded-full flex items-center justify-center shadow-lg"
      style={{ width: size, height: size, background: `conic-gradient(${c} ${Math.min(value, 100) * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
    >
      <div className="rounded-full bg-[#121212] flex items-center justify-center" style={{ width: inner, height: inner }}>
        <span className="font-black text-2xl" style={{ color: c }}>{value}%</span>
      </div>
    </div>
  );
}

export default function EvaluationPage() {
  const [activeTeam, setActiveTeamState] = useState<string>('DAG Ladies');
  const [teamReady, setTeamReady] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('dag-active-team');
    if (saved && TEAMS.includes(saved)) setActiveTeamState(saved);
    setTeamReady(true);
  }, []);
  const setActiveTeam = (team: string) => { setActiveTeamState(team); localStorage.setItem('dag-active-team', team); };

  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerMatches, setPlayerMatches] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [totalTeamMatches, setTotalTeamMatches] = useState(0);
  const [matchIds, setMatchIds] = useState<number[]>([]);
  const [matchDates, setMatchDates] = useState<Record<number, string>>({});
  const [loadingStats, setLoadingStats] = useState(false);
  const selectionRequest = useRef(0);
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [coachWeeklyReports, setCoachWeeklyReports] = useState<Array<{ id: number; week_start: string; coach_comment: string; improvements: string }>>([]);
  const [improvementTargets, setImprovementTargets] = useState<ImprovementTarget[]>([]);
  const [staffAttendance, setStaffAttendance] = useState<Record<string, { attended: number; absent: number; rate: number; lastReason: string }>>({});

  useEffect(() => {
    if (!teamReady) return;
    let cancelled = false;

    async function fetchAll() {
      setLoading(true);
      const { data: rosterData, error: rErr } = await supabase.from('public_player_profiles').select('*').eq('team', activeTeam).order('id');
      if (rErr) console.error('Roster error:', rErr);

      const { data: matchRows, error: mErr } = await supabase
        .from('matches').select('id,match_date').eq('team', activeTeam).eq('status', 'completed');
      if (mErr) console.error('Matches error:', mErr);
      const ids = (matchRows || []).map((m: any) => m.id);

      // Management attendance (coach / manager) — one query for all staff
      const staffMembers = (rosterData || []).filter(isStaffRole);
      const att: Record<string, { attended: number; absent: number; rate: number; lastReason: string }> = {};
      if (staffMembers.length > 0 && ids.length > 0) {
        const { data: rows, error: aErr } = await supabase
          .from('public_match_player_stats')
          .select('ign, status, match_id')
          .in('match_id', ids)
          .in('ign', staffMembers.map((s: any) => s.ign))
          .order('id', { ascending: false });
        if (aErr) console.error('Staff attendance error:', aErr);
        staffMembers.forEach((s: any) => {
          const mine = (rows || []).filter((r: any) => r.ign === s.ign);
          const attended = mine.filter((r: any) => !r.status || r.status === 'played' || r.status === 'bench').length;
          const absentRows = mine.filter((r: any) => r.status === 'absent');
          att[s.ign] = {
            attended,
            absent: absentRows.length,
            rate: Math.round((attended / ids.length) * 100),
            lastReason: '',
          };
        });
      }

      if (cancelled) return;
      setRoster(rosterData || []);
      setMatchIds(ids);
      setMatchDates(Object.fromEntries((matchRows || []).map((m: any) => [m.id, m.match_date])));
      setTotalTeamMatches(ids.length);
      setStaffAttendance(att);
      setLoading(false);
    }

    selectionRequest.current += 1;
    setSelectedPlayer(null);
    setPlayerMatches([]);
    setWeeklyReviews([]);
    setCoachWeeklyReports([]);
    setImprovementTargets([]);
    setSummary(null);
    fetchAll();
    return () => { cancelled = true; };
  }, [activeTeam, teamReady]);

  // There is no separate weekly evaluation form. Match assessments are the
  // single source of truth and are averaged by their real match dates below.

  const getEvaluationStatus = (score: number) => {
    if (score >= 4.0)
      return { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-900/50 border-green-700', glow: 'from-green-500/30 via-green-900/10' };
    if (score >= 2.5)
      return { label: 'Average', color: 'text-yellow-400', bg: 'bg-yellow-900/50 border-yellow-700', glow: 'from-yellow-500/30 via-yellow-900/10' };
    return { label: 'Needs Improvement', color: 'text-red-500', bg: 'bg-red-900/50 border-red-700', glow: 'from-red-500/30 via-red-900/10' };
  };

  const handlePlayerClick = async (player: any) => {
    const request = ++selectionRequest.current;
    if (selectedPlayer?.id === player.id) { setSelectedPlayer(null); setPlayerMatches([]); setWeeklyReviews([]); setCoachWeeklyReports([]); setImprovementTargets([]); setSummary(null); setLoadingStats(false); return; }
    setSelectedPlayer(player);
    setSummary(null);
    setWeeklyReviews([]);
    setCoachWeeklyReports([]);
    setImprovementTargets([]);
    setLoadingStats(true);

    // Weekly narrative reports are separate from the automatic numeric KPI graph.
    // Anonymous visitors can read coach-approved reports for this player only.
    void supabase.from('weekly_player_reports')
      .select('id,week_start,coach_comment,improvements')
      .eq('player_id', player.id).eq('team', activeTeam)
      .order('week_start', { ascending: false }).limit(12)
      .then(({ data, error }) => {
        if (request !== selectionRequest.current) return;
        if (error && !['PGRST205', '42P01'].includes(error.code || '')) console.warn('Coach reports unavailable:', error.message);
        setCoachWeeklyReports(data || []);
      });

    // Goals are deliberately published alongside weekly comments and the KPI chart.
    // The public view exposes only approved target scores and non-sensitive focus notes.
    void supabase.from('weekly_player_targets')
      .select('id,player_id,team,week_start,metric_key,target_score,focus_note')
      .eq('player_id', player.id).eq('team', activeTeam)
      .order('week_start', { ascending: false }).limit(100)
      .then(({ data, error }) => {
        if (request !== selectionRequest.current) return;
        if (error) console.warn('Improvement targets unavailable:', error.message);
        setImprovementTargets((data || []) as ImprovementTarget[]);
      });

    let allStats: any[] = [];
    if (matchIds.length > 0) {
      const { data, error } = await supabase
        .from('public_match_player_stats')
        .select('*')
        .eq('ign', player.ign)
        .in('match_id', matchIds)
        .order('id', { ascending: false });
      if (error) console.error('Stats error:', error);
      allStats = data || [];
    }
    if (request !== selectionRequest.current) return;

    setWeeklyReviews(weeklyReviewsFromMatches(allStats, matchDates, Number(player.id), activeTeam));

    if (allStats.length > 0) {
      // Legacy rows (status = null) → treat as 'played'
      const playedRows = allStats.filter((s) => !s.status || s.status === 'played');
      // Attendance = played + bench ONLY (absent does NOT count)
      const attendedRows = allStats.filter((s) => !s.status || s.status === 'played' || s.status === 'bench');
      const absentRows = allStats.filter((s) => s.status === 'absent');

      const assessedRows = playedRows.filter(hasSixRatings);
      const coachAvg = assessedRows.length > 0
        ? assessedRows.reduce((total, row) => total + weightedScore(row), 0) / assessedRows.length
        : null;

      const attended = attendedRows.length;
      const attendanceRate = totalTeamMatches > 0 ? Math.round((attended / totalTeamMatches) * 100) : 0;
      const attendanceScore = 1 + (attendanceRate / 100) * 4;
      const overallEvaluation = coachAvg === null ? null : coachAvg * COACH_RATING_WEIGHT + attendanceScore * ATTENDANCE_WEIGHT;

      setSummary({
        played: playedRows.length,
        attended,
        attendanceRate,
        benched: attendedRows.filter((s) => s.status === 'bench').length,
        absent: absentRows.length,
        coachAvg,
        assessed: assessedRows.length,
        attendanceScore,
        overallEvaluation,
        totalKills: playedRows.reduce((a, s) => a + (s.kills || 0), 0),
        totalDeaths: playedRows.reduce((a, s) => a + (s.deaths || 0), 0),
        totalAssists: playedRows.reduce((a, s) => a + (s.assists || 0), 0),
      });

      const last5 = allStats.slice(0, 5);
      const { data: matchesData, error: mErr } = await supabase.from('matches').select('*').in('id', last5.map((s) => s.match_id));
      if (mErr) console.error('Matches error:', mErr);
      if (request !== selectionRequest.current) return;

      setPlayerMatches(last5.map((stat) => {
        const m = matchesData?.find((m) => m.id === stat.match_id);
        const matchAvg = (!stat.status || stat.status === 'played') && hasSixRatings(stat) ? weightedScore(stat) : null;
        return { ...stat, match: m || null, matchEvaluation: matchAvg };
      }));
    } else {
      setSummary({
        played: 0, attended: 0, attendanceRate: 0, benched: 0, absent: 0,
        coachAvg: null, assessed: 0, attendanceScore: 1, overallEvaluation: null,
        totalKills: 0, totalDeaths: 0, totalAssists: 0,
      });
      setPlayerMatches([]);
    }
    setLoadingStats(false);
  };

  const playersOnly = roster.filter((p) => !isStaffRole(p));
  const staffOnly = roster.filter(isStaffRole);

  let currentGlow = 'from-transparent via-transparent';
  if (selectedPlayer && summary?.overallEvaluation !== null && summary?.overallEvaluation !== undefined) currentGlow = getEvaluationStatus(summary.overallEvaluation).glow;
  else if (selectedPlayer && loadingStats) currentGlow = 'from-accent/20 via-accent/5 animate-pulse';

  return (
    <main className="min-h-screen bg-[#0a0508] text-white flex flex-col items-center pt-10 md:pt-16 p-6 md:p-10 pb-20 relative overflow-hidden" style={themeStyle(activeTeam)}>
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/90 via-[#121212]/80 to-[#121212] z-10 transition-colors duration-1000"></div>
        <img key={activeTeam} src={getTeamTheme(activeTeam).logo} alt="DAG Wallpaper" className="w-[150vw] md:w-[70vw] opacity-15 blur-[2px] grayscale-[30%] mix-blend-lighten z-0 object-contain" />
        <div className={`absolute inset-0 z-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] to-transparent transition-all duration-1000 ease-in-out opacity-80 ${currentGlow}`}></div>
      </div>

      <div className="relative z-30 w-full max-w-5xl flex flex-col items-center">
        {/* Team switch */}
        <div className="flex gap-3 mb-6 p-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur">
          {TEAMS.map((team) => (
            <button key={team} onClick={() => setActiveTeam(team)}
              className={`px-7 py-2 rounded-full font-extrabold tracking-widest uppercase text-sm transition-all ${
                activeTeam === team ? 'bg-accent text-white shadow-[0_0_20px_var(--accent-glow)]' : 'text-gray-500 hover:text-white'}`}>
              {team}
            </button>
          ))}
        </div>

        {/* Header */}
        <div className="relative bg-accent-deep/80 backdrop-blur-md p-8 md:p-10 rounded-2xl border border-accent/30 shadow-[0_10px_50px_var(--accent-glow-soft)] w-full flex flex-col md:flex-row justify-between items-center gap-8 mb-12 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none"></div>
          <div className="relative">
            <p className="text-xs tracking-[0.4em] text-gray-400 uppercase mb-2">De Ant Gaming</p>
            <h1 className="text-4xl md:text-6xl font-black uppercase leading-tight bg-gradient-to-r from-accent via-pink-300 to-white bg-clip-text text-transparent drop-shadow-lg">{activeTeam}</h1>
            <p className="text-gray-300 font-semibold tracking-widest uppercase text-sm mt-2">Evaluation</p>

          </div>
          <Image key={activeTeam} src={getTeamTheme(activeTeam).logo} alt="DAG Logo" width={190} height={190} className="object-contain drop-shadow-2xl relative animate-fadeIn" />
        </div>

        <TeamNavigation current={CURRENT} />

        {/* Player selection */}
        <div className="w-full">
          <h2 className="text-2xl font-bold mb-1 text-gray-100 uppercase tracking-wider">Player Evaluation</h2>
          <p className="text-xs text-gray-500 mb-5 border-b border-gray-800/50 pb-3">Select a player to view attendance, ratings, weekly KPI graphs, and match breakdown.</p>
          {loading ? (
            <p className="text-gray-500 italic py-10 text-center animate-pulse">Loading roster...</p>
          ) : playersOnly.length === 0 ? (
            <p className="text-gray-500 italic py-10 text-center">No active players found for {activeTeam}.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {playersOnly.map((player) => (
                <div key={player.id} onClick={() => handlePlayerClick(player)}
                  className={`bg-[#1a1a1a]/80 backdrop-blur p-5 rounded-xl border transition-all flex flex-col items-center text-center cursor-pointer group shadow-lg hover:-translate-y-1.5 ${
                    selectedPlayer?.id === player.id ? 'border-accent ring-2 ring-accent/50 shadow-[0_0_25px_var(--accent-glow)]' : 'border-gray-800 hover:border-accent/60 hover:shadow-[0_0_20px_var(--accent-glow-soft)]'}`}>
                  {player.image_url ? (
                    <img src={player.image_url} className="w-16 h-16 rounded-full object-cover object-top mb-4 border-2 border-accent shadow-lg group-hover:scale-110 transition-transform" />
                  ) : (
                    <div className="w-16 h-16 bg-accent-deep rounded-full flex items-center justify-center mb-4 border-2 border-accent shadow-lg">
                      <span className="font-bold text-xl text-white">{player.ign?.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-accent transition-colors">{player.ign}</h3>
                  <p className="text-accent text-xs font-bold uppercase tracking-wider">{player.role}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Player detail */}
        {selectedPlayer !== null && (() => {
          const overallStatus = summary?.overallEvaluation == null ? null : getEvaluationStatus(summary.overallEvaluation);
          return (
            <div className="w-full mt-10 bg-[#1a1a1a]/90 backdrop-blur-xl p-6 md:p-8 rounded-2xl border-t-4 border-accent shadow-2xl animate-fadeIn relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-gray-800/50 pb-6 gap-4 relative z-10">
                <div className="flex items-center gap-5">
                  {selectedPlayer.image_url ? (
                    <img src={selectedPlayer.image_url} className="w-20 h-20 rounded-full object-cover object-top border-2 border-accent shadow-lg" />
                  ) : (
                    <div className="w-20 h-20 bg-accent-deep rounded-full flex items-center justify-center border-2 border-accent shadow-lg">
                      <span className="font-bold text-3xl text-white">{selectedPlayer.ign?.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-3xl font-extrabold uppercase drop-shadow-md">{selectedPlayer.ign}</h3>
                    <p className="text-accent text-xs font-bold uppercase tracking-widest mt-1">{selectedPlayer.role}</p>
                    <p className="text-gray-300 text-sm mt-1">Signature Hero: <span className="text-white font-bold">{selectedPlayer.main_hero || '—'}</span></p>
                  </div>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="bg-gray-800/80 hover:bg-gray-700 px-4 py-2 rounded-full text-xs font-bold uppercase text-white transition-colors">Close ✕</button>
              </div>

              {loadingStats ? (
                <p className="text-center text-accent py-16 font-bold animate-pulse tracking-widest uppercase">Calculating metrics...</p>
              ) : summary ? (
                <div className="relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    <div className="bg-[#121212]/80 backdrop-blur p-6 rounded-xl border border-gray-800 flex flex-col justify-center items-center text-center shadow-lg">
                      <h4 className="text-gray-400 text-xs font-bold mb-3 uppercase tracking-widest">Attendance</h4>
                      <Ring value={summary.attendanceRate} />
                      <p className="text-xs text-gray-500 mt-3">{summary.attended} / {totalTeamMatches} matches</p>
                    </div>

                    <div className="bg-[#121212]/80 backdrop-blur p-6 rounded-xl border border-gray-800 flex flex-col justify-center items-center text-center shadow-lg">
                      <h4 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-widest">Matches Played</h4>
                      <p className="text-6xl font-black text-white drop-shadow-md">{summary.played}</p>
                      <div className="flex gap-2 mt-3 text-[10px] font-bold uppercase">
                        <span className="px-2 py-0.5 rounded bg-yellow-900/40 text-yellow-400">{summary.benched} benched</span>
                        <span className="px-2 py-0.5 rounded bg-red-900/40 text-red-400">{summary.absent} absent</span>
                      </div>
                    </div>

                    <div className={`p-6 rounded-xl border flex flex-col items-center justify-center text-center shadow-lg backdrop-blur ${overallStatus?.bg || 'border-gray-700 bg-gray-900/40'}`}>
                      <h4 className="text-gray-300 text-xs font-bold mb-2 uppercase tracking-widest">Overall Evaluation</h4>
                      {overallStatus ? (
                        <>
                          <p className={`text-5xl font-black drop-shadow-md ${overallStatus.color}`}>
                            {summary.overallEvaluation.toFixed(1)} <span className="text-xl text-white/50">/ 5.0</span>
                          </p>
                          <p className={`mt-2 font-black uppercase tracking-wider px-3 py-1 rounded-full bg-black/40 text-xs ${overallStatus.color}`}>{overallStatus.label}</p>
                          <p className="text-[10px] text-gray-400 mt-2 leading-tight">
                            Coach {summary.coachAvg.toFixed(1)} ({Math.round(COACH_RATING_WEIGHT * 100)}%) · Attendance {summary.attendanceRate}% ({Math.round(ATTENDANCE_WEIGHT * 100)}%)
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xl font-black text-gray-300">Not rated yet</p>
                          <p className="mt-2 text-xs text-gray-400">A coach must score all six categories in a completed match.</p>
                        </>
                      )}
                    </div>

                    <div className="bg-[#121212]/80 backdrop-blur p-6 rounded-xl border border-gray-800 flex flex-col justify-center items-center shadow-lg">
                      <h4 className="text-gray-400 text-xs font-bold mb-3 uppercase tracking-widest text-center">Total K / D / A</h4>
                      <div className="flex gap-4 text-center">
                        <div><p className="text-3xl font-black text-green-400">{summary.totalKills}</p><p className="text-[10px] text-gray-500 font-bold">KILLS</p></div>
                        <div><p className="text-3xl font-black text-red-400">{summary.totalDeaths}</p><p className="text-[10px] text-gray-500 font-bold">DEATHS</p></div>
                        <div><p className="text-3xl font-black text-blue-400">{summary.totalAssists}</p><p className="text-[10px] text-gray-500 font-bold">ASSISTS</p></div>
                      </div>
                    </div>
                  </div>

                  <WeeklyPerformanceChart
                    playerName={selectedPlayer.ign}
                    reviews={weeklyReviews}
                    targets={improvementTargets}
                    loading={loadingStats}
                    error={''}
                  />

                  <section className="mt-9 rounded-2xl border border-accent/30 bg-[#131013]/90 p-5 md:p-7">
                    <div className="mb-5 flex flex-col justify-between gap-2 border-b border-gray-800 pb-4 sm:flex-row sm:items-end">
                      <div>
                        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-accent">Written by approved coaches</p>
                        <h4 className="mt-1 text-xl font-black uppercase">Weekly Coach Reports</h4>
                      </div>
                      <span className="text-xs text-gray-500">Feedback &amp; next-week priorities</span>
                    </div>
                    {coachWeeklyReports.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-gray-700 p-5 text-sm text-gray-400">No weekly coach reports have been published for this player yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {coachWeeklyReports.map((report) => (
                          <article key={report.id} className="rounded-xl border border-gray-700 bg-[#1b1b1b] p-5 md:p-6">
                            <h5 className="mb-4 text-sm font-black uppercase tracking-wider text-accent">Week of {formatWeek(report.week_start)}</h5>
                            {(() => {
                              const targetMonday = new Date(report.week_start + 'T12:00:00Z');
                              targetMonday.setUTCDate(targetMonday.getUTCDate() + 7);
                              const nextWeek = targetMonday.toISOString().slice(0, 10);
                              const linked = improvementTargets.filter((target) => target.week_start === nextWeek);
                              return linked.length ? (
                                <div className="mb-4 rounded-lg border border-amber-900/50 bg-amber-950/15 p-3">
                                  <p className="text-xs font-black uppercase text-amber-300">Next-week improvement goals · {formatWeek(nextWeek)}</p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {linked.map((target) => (
                                      <span key={target.id} className="rounded-full border border-amber-900/60 px-3 py-1 text-xs text-gray-200">
                                        {WEEKLY_METRICS.find((m) => m.key === target.metric_key)?.label || target.metric_key}: {Number(target.target_score).toFixed(1)}/5
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null;
                            })()}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <div className="rounded-lg border border-gray-800 bg-[#101010] p-4">
                                <p className="mb-2 text-xs font-black uppercase tracking-wider text-green-400">Coach Comments</p>
                                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-200">{report.coach_comment}</p>
                              </div>
                              <div className="rounded-lg border border-gray-800 bg-[#101010] p-4">
                                <p className="mb-2 text-xs font-black uppercase tracking-wider text-yellow-400">What to Improve</p>
                                <p className="whitespace-pre-wrap break-words text-sm leading-6 text-gray-200">{report.improvements}</p>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </section>

                  <div className="mt-8">
                    <h4 className="text-xl font-black mb-4 uppercase border-b border-gray-800/50 pb-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 tracking-widest">Match-by-Match Breakdown</h4>
                    <div className="flex flex-col gap-4">
                      {playerMatches.map((log) => {
                        const matchStatus = log.matchEvaluation === null ? null : getEvaluationStatus(log.matchEvaluation);
                        const isAbsent = log.status === 'absent';
                        const isBench = log.status === 'bench';
                        return (
                          <div key={log.id} className={`bg-[#121212]/60 backdrop-blur p-5 rounded-xl border shadow-lg ${isAbsent ? 'border-red-900/60' : 'border-gray-800'}`}>
                            <div className="flex justify-between items-center border-b border-gray-800/50 pb-3 mb-3 gap-2 flex-wrap">
                              <span className="font-bold text-lg">
                                DAG vs {log.match?.opponent_name}{' '}
                                <span className="text-xs font-normal text-gray-500 bg-black/50 px-2 py-0.5 rounded ml-2">{log.match?.match_type || 'Scrim'}</span>
                              </span>
                              <div className="flex items-center gap-2">
                                {isAbsent && <span className="px-3 py-1 text-xs font-black tracking-widest uppercase rounded shadow bg-red-900 text-red-300">Absent</span>}
                                {isBench && <span className="px-3 py-1 text-xs font-black tracking-widest uppercase rounded shadow bg-yellow-900 text-yellow-300">Benched</span>}
                                <span className={`px-3 py-1 text-xs font-black tracking-widest uppercase rounded shadow ${
                                  log.match?.result === 'WIN' ? 'bg-green-900 text-green-400' : log.match?.result === 'DRAW' ? 'bg-yellow-900 text-yellow-400' : 'bg-red-900 text-red-400'}`}>
                                  {log.match?.result}
                                </span>
                              </div>
                            </div>

                            {isAbsent ? (
                              <div className="bg-red-900/20 border border-red-900/50 p-4 rounded">
                                <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest mb-1">Attendance</p>
                                <p className="text-red-200 text-sm italic">Absent (reason available to authorized management only)</p>
                              </div>
                            ) : isBench ? (
                              <p className="text-yellow-500 font-bold text-sm bg-yellow-900/20 p-2 rounded inline-block border border-yellow-900/50">Benched (did not play)</p>
                            ) : (
                              <div className="flex flex-col md:flex-row gap-6">
                                <div className="flex-1">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-800 pb-1">Coach Ratings</p>
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-bold bg-black/30 p-3 rounded border border-gray-800/50">
                                    {WEEKLY_METRICS.map((metric) => (
                                      <div key={metric.key} className="flex justify-between items-center gap-2 text-gray-300">
                                        <span>{metric.label}:</span>
                                        <span className="text-white text-base bg-gray-900 px-2 rounded">
                                          {typeof log[metric.key] === 'number' && log[metric.key] >= 1 && log[metric.key] <= 5 ? `${log[metric.key]}/5` : '—'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-xs text-gray-400 mt-3 font-bold tracking-wider">Game KDA: <span className="text-green-400 text-base">{log.kills}/{log.deaths}/{log.assists}</span></p>
                                </div>
                                <div className={`flex-shrink-0 flex flex-col justify-center items-center w-36 border-l-4 p-4 shadow-inner rounded ${matchStatus ? matchStatus.bg.split(' ')[1] : 'border-gray-700'} bg-black/40`}>
                                  <span className="text-[10px] uppercase text-gray-400 font-bold tracking-widest mb-1">Match Eval</span>
                                  {matchStatus ? (
                                    <>
                                      <span className={`text-4xl font-black drop-shadow ${matchStatus.color}`}>{log.matchEvaluation.toFixed(2)}</span>
                                      <span className={`text-[10px] font-black uppercase mt-2 text-center tracking-wider ${matchStatus.color}`}>{matchStatus.label}</span>
                                    </>
                                  ) : <span className="text-xs text-gray-400 text-center">Not rated (legacy match)</span>}
                                </div>
                              </div>
                            )}

                            
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })()}

        {/* Management attendance only */}
        {!loading && staffOnly.length > 0 && (
          <div className="w-full mt-14">
            <h2 className="text-2xl font-bold mb-1 text-yellow-400 uppercase tracking-wider">★ Management Attendance</h2>
            <p className="text-xs text-gray-500 mb-5 border-b border-yellow-900/40 pb-3">Coach and Manager attendance across {totalTeamMatches} completed match{totalTeamMatches === 1 ? '' : 'es'}.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {staffOnly.map((s) => {
                const a = staffAttendance[s.ign] || { attended: 0, absent: 0, rate: 0, lastReason: '' };
                return (
                  <div key={s.id} className="bg-[#1a1a1a]/80 backdrop-blur p-5 rounded-xl border border-yellow-900/50 hover:border-yellow-600/70 transition-all shadow-lg hover:shadow-[0_0_20px_rgba(234,179,8,0.15)] flex items-center gap-5">
                    <Ring value={a.rate} size={96} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {s.image_url ? (
                          <img src={s.image_url} className="w-8 h-8 rounded-full object-cover object-top border border-yellow-500" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-yellow-900/30 border border-yellow-500 flex items-center justify-center text-xs font-bold">{s.ign?.charAt(0).toUpperCase()}</div>
                        )}
                        <h3 className="font-bold truncate">{s.ign}</h3>
                      </div>
                      <p className="text-yellow-400 text-xs font-bold uppercase tracking-wider">{s.role}</p>
                      <p className="text-xs text-gray-400 mt-1">{a.attended} / {totalTeamMatches} matches{a.absent > 0 ? ` · ${a.absent} absent` : ''}</p>
                      {a.lastReason && <p className="text-[10px] text-gray-600 italic mt-1 truncate">Last absence: {a.lastReason}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}