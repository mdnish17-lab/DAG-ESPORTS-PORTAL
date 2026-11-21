"use client";

import Image from 'next/image';
import Link from 'next/link';
import SiteDecor from '../lib/SiteDecor';
import { getTeamTheme, themeStyle } from '../lib/teamTheme';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

const TEAMS = ['DAG Ladies', 'DAG Montrix'];
const NAV = [
  { href: '/', label: 'Dashboard' },
  { href: '/roster', label: 'Roster' },
  { href: '/achievement', label: 'Achievement' },
  { href: '/evaluation', label: 'Evaluation' },
  { href: '/planner', label: 'Planner' },
];
const CURRENT = '/';

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// "18:30:00" -> "6:30 PM"
const formatTime = (t: string) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

export default function Home() {
  const [activeTeam, setActiveTeamState] = useState<string>('DAG Ladies');
  const [teamReady, setTeamReady] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('dag-active-team');
    if (saved && TEAMS.includes(saved)) setActiveTeamState(saved);
    setTeamReady(true);
  }, []);
  const setActiveTeam = (team: string) => { setActiveTeamState(team); localStorage.setItem('dag-active-team', team); };

  const [playerCount, setPlayerCount] = useState(0);
  const [matches, setMatches] = useState<any[]>([]);
  const [expandedReview, setExpandedReview] = useState<number | null>(null);
  const [expandedScreenshots, setExpandedScreenshots] = useState<number | null>(null);

  useEffect(() => {
    if (!teamReady) return;
    let cancelled = false;
    async function fetchDashboardData() {
      const { data: pData, error: pErr } = await supabase.from('players').select('id').eq('team', activeTeam);
      if (pErr) console.error('Players error:', pErr);
      const { data: matchData, error: mErr } = await supabase
        .from('matches')
        .select('*')
        .eq('team', activeTeam)
        .order('match_date', { ascending: false });
      if (mErr) console.error('Matches error:', mErr);
      if (cancelled) return;
      setPlayerCount(pData ? pData.length : 0);
      setMatches(matchData || []);
    }
    fetchDashboardData();
    return () => { cancelled = true; };
  }, [activeTeam, teamReady]);

  const completedMatches = matches.filter((m) => m.status === 'completed');
  const upcomingMatches = matches.filter((m) => m.status === 'upcoming' || m.status === 'awaiting_result');

  const matchesPlayed = completedMatches.length;
  const totalWins = completedMatches.filter((m) => m.result === 'WIN').length;
  const totalLosses = completedMatches.filter((m) => m.result === 'LOSS').length;
  const winRate = matchesPlayed > 0 ? Math.round((totalWins / matchesPlayed) * 100) : 0;
  const recentForm = completedMatches.slice(0, 5);

  const getScreenshots = (match: any) => {
    if (!match.result_screenshots) return [];
    return match.result_screenshots.split('\n').map((s: string) => s.trim()).filter((s: string) => s.length > 0);
  };

  return (
    <main className="min-h-screen bg-[#0a0508] text-white flex flex-col items-center pt-10 md:pt-16 p-6 md:p-10 pb-20 relative overflow-hidden" style={themeStyle(activeTeam)}>
      <SiteDecor />
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/90 via-[#121212]/80 to-[#121212] z-10"></div>
        <img key={activeTeam} src={getTeamTheme(activeTeam).logo} alt="DAG Wallpaper" className="w-[150vw] md:w-[70vw] opacity-15 blur-[2px] grayscale-[30%] mix-blend-lighten z-0 object-contain" />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
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
        <div className="relative bg-accent-deep/80 backdrop-blur-md p-8 md:p-10 rounded-2xl border border-accent/30 shadow-[0_10px_50px_var(--accent-glow-soft)] w-full flex flex-col md:flex-row justify-between items-center gap-8 mb-8 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none"></div>
          <div className="relative">
            <p className="text-xs tracking-[0.4em] text-gray-400 uppercase mb-2">De Ant Gaming</p>
            <h1 className="text-4xl md:text-6xl font-black uppercase leading-tight bg-gradient-to-r from-accent via-pink-300 to-white bg-clip-text text-transparent drop-shadow-lg">{activeTeam}</h1>
            <p className="text-gray-300 font-semibold tracking-widest uppercase text-sm mt-2">Dashboard</p>
            <nav className="flex gap-2 flex-wrap items-center mt-6">
              {NAV.map((n) =>
                n.href === CURRENT ? (
                  <span key={n.href} className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-accent text-white shadow-[0_0_15px_var(--accent-glow)]">{n.label}</span>
                ) : (
                  <Link key={n.href} href={n.href} className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider text-gray-300 border border-white/15 hover:border-accent hover:text-accent transition-colors">{n.label}</Link>
                )
              )}
              <Link href="/admin" className="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider bg-white/10 hover:bg-white/20 text-white border border-white/10 transition-colors ml-1">Admin</Link>
            </nav>
          </div>
          <Image key={activeTeam} src={getTeamTheme(activeTeam).logo} alt="DAG Logo" width={190} height={190} className="object-contain drop-shadow-2xl relative animate-fadeIn" />
        </div>

        {/* Stats */}
        <div className="w-full grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[#1e1e1e]/80 backdrop-blur p-6 rounded-xl border border-gray-800 text-center shadow-lg hover:border-gray-600 transition-colors">
            <h3 className="text-gray-400 text-[10px] font-bold mb-1 uppercase tracking-widest">Active Roster</h3>
            <p className="text-4xl font-black">{playerCount}</p>
          </div>
          <div className="bg-[#1e1e1e]/80 backdrop-blur p-6 rounded-xl border border-gray-800 text-center shadow-lg hover:border-gray-600 transition-colors">
            <h3 className="text-gray-400 text-[10px] font-bold mb-1 uppercase tracking-widest">Matches Played</h3>
            <p className="text-4xl font-black">{matchesPlayed}</p>
          </div>
          <div className="bg-[#1e1e1e]/80 backdrop-blur p-6 rounded-xl border border-green-900/50 text-center shadow-lg hover:border-green-600/60 transition-colors">
            <h3 className="text-green-500 text-[10px] font-bold mb-1 uppercase tracking-widest">Total Wins</h3>
            <p className="text-4xl font-black text-green-400">{totalWins}</p>
          </div>
          <div className="bg-[#1e1e1e]/80 backdrop-blur p-6 rounded-xl border border-red-900/50 text-center shadow-lg hover:border-red-600/60 transition-colors">
            <h3 className="text-red-500 text-[10px] font-bold mb-1 uppercase tracking-widest">Total Losses</h3>
            <p className="text-4xl font-black text-red-500">{totalLosses}</p>
          </div>
          <div className="col-span-2 md:col-span-1 bg-[#1a0a10]/90 backdrop-blur p-4 rounded-xl border-2 border-accent text-center shadow-[0_0_25px_var(--accent-glow-soft)] flex flex-col items-center justify-center">
            <h3 className="text-accent text-[10px] font-bold mb-2 uppercase tracking-widest">Win Rate</h3>
            <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: `conic-gradient(var(--accent-color) ${winRate * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}>
              <div className="w-[62px] h-[62px] rounded-full bg-[#1a0a10] flex items-center justify-center">
                <span className="text-xl font-black text-accent">{winRate}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent form */}
        {recentForm.length > 0 && (
          <div className="w-full mt-4 bg-[#1a1a1a]/70 backdrop-blur rounded-xl border border-gray-800 px-5 py-3 flex items-center gap-4 flex-wrap">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Recent Form</span>
            <div className="flex gap-2">
              {recentForm.map((m) => (
                <span key={m.id} title={`${m.opponent_name} (${m.dag_score}-${m.opponent_score})`}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shadow ${
                    m.result === 'WIN' ? 'bg-green-600 text-white' : m.result === 'LOSS' ? 'bg-red-600 text-white' : 'bg-yellow-600 text-white'}`}>
                  {m.result === 'WIN' ? 'W' : m.result === 'LOSS' ? 'L' : 'D'}
                </span>
              ))}
            </div>
            <span className="text-[10px] text-gray-600 ml-auto">Latest first</span>
          </div>
        )}

        <div className="w-full mt-14 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upcoming */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold mb-6 tracking-widest text-gray-200 border-b border-gray-800/50 pb-3 uppercase">Scheduled / Awaiting Result</h2>
            <div className="flex flex-col gap-4">
              {upcomingMatches.length === 0 ? (
                <p className="text-gray-500 italic text-sm bg-black/40 p-4 rounded-xl backdrop-blur border border-gray-900">No scheduled matches.</p>
              ) : (
                upcomingMatches.map((match) => (
                  <div key={match.id} className="bg-[#1a1a1a]/80 backdrop-blur border border-gray-800 p-5 rounded-xl flex gap-4 items-center shadow-lg hover:border-accent/60 hover:-translate-y-0.5 transition-all">
                    <div className="flex flex-col items-center justify-center bg-[#121212] w-16 h-16 rounded-lg border border-accent/40 flex-shrink-0">
                      <span className="text-[10px] text-accent font-bold uppercase">{new Date(match.match_date).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-2xl font-black leading-none">{new Date(match.match_date).getDate()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-0.5">
                        <span className="bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded mr-2">{match.match_type || 'Scrim'}</span>
                        VS Match
                      </p>
                      <p className="font-extrabold text-lg truncate drop-shadow">{match.opponent_name}</p>
                      {match.match_time && (
                        <p className="text-xs text-gray-400 font-semibold mt-0.5">🕒 {formatTime(match.match_time)}</p>
                      )}
                      {match.status === 'awaiting_result' && <p className="mt-1 text-xs font-semibold text-amber-300">Awaiting official result</p>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Match history */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-6 tracking-widest text-gray-200 border-b border-gray-800/50 pb-3 uppercase">Match History</h2>
            <div className="flex flex-col gap-4">
              {completedMatches.length === 0 ? (
                <p className="text-gray-500 italic text-sm bg-black/40 p-4 rounded-xl backdrop-blur border border-gray-900">No match history available.</p>
              ) : (
                completedMatches.map((match) => {
                  const screenshots = getScreenshots(match);
                  return (
                    <div key={match.id}
                      className={`bg-[#1a1a1a]/80 backdrop-blur rounded-xl border-l-4 p-5 flex flex-col shadow-lg transition-all hover:bg-[#1f1f1f]/90 ${
                        match.result === 'WIN' ? 'border-green-500' : match.result === 'LOSS' ? 'border-red-500' : 'border-yellow-500'}`}>
                      <div className="flex justify-between items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-gray-400 text-[10px] font-bold tracking-widest uppercase">{formatDate(match.match_date)}</span>
                            <span className="bg-gray-800 text-gray-300 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">{match.match_type || 'Scrim'}</span>
                          </div>
                          <h3 className="font-black text-xl uppercase drop-shadow truncate">DAG VS {match.opponent_name}</h3>
                        </div>
                        <div className="flex flex-col items-end">
                          <div className="flex items-center gap-3 text-3xl font-black drop-shadow-md">
                            <span className={match.result === 'WIN' ? 'text-green-400' : 'text-white'}>{match.dag_score}</span>
                            <span className="text-gray-600 text-xl">-</span>
                            <span className={match.result === 'LOSS' ? 'text-red-400' : 'text-white'}>{match.opponent_score}</span>
                          </div>
                          <span className={`text-[10px] font-black tracking-widest uppercase mt-1 ${
                            match.result === 'WIN' ? 'text-green-400' : match.result === 'LOSS' ? 'text-red-400' : 'text-yellow-400'}`}>{match.result}</span>
                        </div>
                      </div>

                      {match.match_review && (
                        <div className="mt-4 border-t border-gray-800/50 pt-4">
                          <button onClick={() => setExpandedReview(expandedReview === match.id ? null : match.id)}
                            className="text-accent text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors">
                            {expandedReview === match.id ? 'Hide Coach Review ▲' : 'Read Coach Review ▼'}
                          </button>
                          {expandedReview === match.id && (
                            <div className="mt-3 p-4 bg-[#121212]/80 rounded-lg border border-gray-800 text-sm text-gray-300 leading-relaxed animate-fadeIn backdrop-blur whitespace-pre-line">
                              {match.match_review}
                            </div>
                          )}
                        </div>
                      )}

                      {screenshots.length > 0 && (
                        <div className="mt-3 border-t border-gray-800/50 pt-3">
                          <button onClick={() => setExpandedScreenshots(expandedScreenshots === match.id ? null : match.id)}
                            className="text-blue-400 text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:text-blue-300 transition-colors">
                            {expandedScreenshots === match.id ? `Hide Screenshots (${screenshots.length}) ▲` : `View Match Screenshots (${screenshots.length}) ▼`}
                          </button>
                          {expandedScreenshots === match.id && (
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 animate-fadeIn">
                              {screenshots.map((url: string, i: number) => (
                                <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                  className="block overflow-hidden rounded-lg border border-gray-700 hover:border-accent transition-colors">
                                  <img src={url} alt={`Match result screenshot ${i + 1}`} className="w-full h-auto object-cover hover:scale-105 transition-transform duration-300" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}