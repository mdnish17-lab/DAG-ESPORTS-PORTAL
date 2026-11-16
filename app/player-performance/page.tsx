"use client";

import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

const TEAMS = ['DAG Ladies', 'DAG Montrix'];

export default function PlayerPerformancePage() {
  const [activeTeam, setActiveTeam] = useState('DAG Ladies');
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
  const [playerMatches, setPlayerMatches] = useState<any[]>([]); 
  const [summary, setSummary] = useState<any>(null);
  const [totalTeamMatches, setTotalTeamMatches] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    async function fetchRosterAndMatches() {
      setLoading(true);
      const { data: rosterData } = await supabase.from('players').select('*').eq('team', activeTeam).order('id');
      if (rosterData) setRoster(rosterData);

      const { count: matchCount } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('team', activeTeam).eq('status', 'completed');
      if (matchCount !== null) setTotalTeamMatches(matchCount);
      setLoading(false);
    }
    setSelectedPlayer(null); setPlayerMatches([]); setSummary(null);
    fetchRosterAndMatches();
  }, [activeTeam]);

  const getEvaluationStatus = (score: number) => {
    if (score >= 4.0) return { label: 'Excellent', color: 'text-green-400', bg: 'bg-green-900/50 border-green-700', glow: 'from-green-500/30 via-green-900/10' };
    if (score >= 2.5) return { label: 'Average', color: 'text-yellow-400', bg: 'bg-yellow-900/50 border-yellow-700', glow: 'from-yellow-500/30 via-yellow-900/10' };
    return { label: 'Needs Improvement', color: 'text-red-500', bg: 'bg-red-900/50 border-red-700', glow: 'from-red-500/30 via-red-900/10' };
  };

  const handlePlayerClick = async (player: any) => {
    if (selectedPlayer?.id === player.id) { setSelectedPlayer(null); setPlayerMatches([]); setSummary(null); return; }
    setSelectedPlayer(player); setSummary(null); setLoadingStats(true);

    const { data: allStats } = await supabase.from('match_player_stats').select('*').eq('ign', player.ign).order('id', { ascending: false });

    if (allStats && allStats.length > 0) {
      const playedRows = allStats.filter((s) => !s.status || s.status === 'played');
      
      let totalEval = 0;
      playedRows.forEach(s => {
        const matchAvg = ((s.macro_score || 3) + (s.micro_score || 3) + (s.kda_score || 3) + (s.mentality_score || 3)) / 4;
        totalEval += matchAvg;
      });
      const overallEvalAvg = playedRows.length > 0 ? (totalEval / playedRows.length) : 0;

      setSummary({
        played: playedRows.length,
        totalKills: playedRows.reduce((a, s) => a + (s.kills || 0), 0),
        totalDeaths: playedRows.reduce((a, s) => a + (s.deaths || 0), 0),
        totalAssists: playedRows.reduce((a, s) => a + (s.assists || 0), 0),
        overallEvaluation: overallEvalAvg
      });

      const last5 = allStats.slice(0, 5);
      const { data: matchesData } = await supabase.from('matches').select('*').in('id', last5.map(s => s.match_id));

      const logs = last5.map((stat) => {
        const m = matchesData?.find((m) => m.id === stat.match_id);
        const matchAvg = ((stat.macro_score || 3) + (stat.micro_score || 3) + (stat.kda_score || 3) + (stat.mentality_score || 3)) / 4;
        return { ...stat, match: m || null, matchEvaluation: matchAvg };
      });
      setPlayerMatches(logs);
    } else {
      setSummary({ played: 0, totalKills: 0, totalDeaths: 0, totalAssists: 0, overallEvaluation: 0 });
      setPlayerMatches([]);
    }
    setLoadingStats(false);
  };

  // Determine the dynamic glow class based on the player's summary
  let currentGlow = 'from-transparent via-transparent';
  if (selectedPlayer && summary) {
    currentGlow = getEvaluationStatus(summary.overallEvaluation).glow;
  } else if (selectedPlayer && loadingStats) {
    // Pulse a neutral pink while calculating
    currentGlow = 'from-[#ec2b7a]/20 via-[#ec2b7a]/5 animate-pulse'; 
  }

  return (
    <main className="min-h-screen bg-[#0a0508] text-white flex flex-col items-center pt-10 md:pt-20 p-6 md:p-10 pb-20 relative overflow-hidden">
      
      {/* --- BACKGROUND WALLPAPER & DYNAMIC GLOW RING --- */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        {/* Base Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/90 via-[#121212]/80 to-[#121212] z-10 transition-colors duration-1000"></div>
        
        {/* Wallpaper Image */}
        <img src="/dag-logo.jpg" alt="DAG Wallpaper" className="w-[150vw] md:w-[70vw] opacity-15 blur-[2px] grayscale-[30%] mix-blend-lighten z-0 object-contain" />
        
        {/* The Magic Dynamic Performance Light Ring */}
        <div className={`absolute inset-0 z-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] to-transparent transition-all duration-1000 ease-in-out opacity-80 ${currentGlow}`}></div>
      </div>

      {/* Main Content Wrapper */}
      <div className="relative z-30 w-full max-w-5xl flex flex-col items-center">
        
        <div className="flex gap-4 mb-6">
          {TEAMS.map(team => (
            <button key={team} onClick={() => setActiveTeam(team)} className={`px-8 py-2 rounded-full font-extrabold tracking-widest uppercase transition-colors border-2 ${activeTeam === team ? 'border-[#ec2b7a] bg-[#ec2b7a] text-white shadow-[0_0_15px_rgba(236,43,122,0.4)]' : 'border-gray-800/80 bg-black/50 text-gray-500 backdrop-blur-sm hover:border-gray-600'}`}>{team}</button>
          ))}
        </div>
        
        <div className="bg-[#2a0a18]/90 backdrop-blur-md p-8 md:p-10 rounded-xl border-l-8 border-[#ec2b7a] shadow-[0_10px_40px_rgba(236,43,122,0.2)] w-full flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-2 uppercase drop-shadow-lg">De Ant Gaming</h1>
            <h2 className="text-2xl md:text-3xl text-[#ec2b7a] font-bold uppercase drop-shadow-md">{activeTeam.replace('DAG ', '')} Division</h2>
            
            <div className="flex gap-4 text-xs md:text-sm font-semibold text-gray-300 tracking-wider items-center flex-wrap mt-6">
              <Link href="/" className="hover:text-[#ec2b7a] transition-colors">DASHBOARD</Link> |
              <Link href="/roster" className="hover:text-[#ec2b7a] transition-colors">ROSTER</Link> |
              <Link href="/team-performance" className="hover:text-[#ec2b7a] transition-colors">TEAM PERFORMANCE</Link> |
              <span className="text-[#ec2b7a] font-bold cursor-default shadow-[#ec2b7a]">PLAYER PERFORMANCE</span> |
              <Link href="/admin" className="bg-[#ec2b7a] hover:bg-[#c92468] text-white px-4 py-1.5 rounded-md transition-colors shadow-lg ml-2">ADMIN</Link>
            </div>
          </div>
          <Image src="/dag-logo.jpg" alt="DAG Logo" width={200} height={200} className="object-contain drop-shadow-2xl" />
        </div>

        <div className="w-full">
          <h2 className="text-2xl font-bold mb-6 text-gray-200 border-b border-gray-800/50 pb-3 uppercase drop-shadow-md">Select Player to View Evaluation</h2>
          
          {loading ? (
            <p className="text-gray-500 italic py-10 text-center">Loading Roster...</p>
          ) : roster.filter(p => p.role.toLowerCase() !== 'coach').length === 0 ? (
            <p className="text-gray-500 italic py-10 text-center">No active players found for {activeTeam}.</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {roster.filter(p => p.role.toLowerCase() !== 'coach').map((player) => (
                <div key={player.id} onClick={() => handlePlayerClick(player)} className={`bg-[#1a1a1a]/80 backdrop-blur p-5 rounded-lg border transition-all flex flex-col items-center text-center cursor-pointer group shadow-lg hover:-translate-y-1 ${selectedPlayer?.id === player.id ? 'border-[#ec2b7a] ring-2 ring-[#ec2b7a]/50 shadow-[0_0_20px_rgba(236,43,122,0.3)]' : 'border-gray-800 hover:border-[#ec2b7a]/50 hover:shadow-[0_0_15px_rgba(236,43,122,0.1)]'}`}>
                  {player.image_url ? (
                    <img src={player.image_url} className="w-16 h-16 rounded-full object-cover mb-4 border-2 border-[#ec2b7a] shadow-lg" />
                  ) : (
                    <div className="w-16 h-16 bg-[#2a0a18] rounded-full flex items-center justify-center mb-4 border-2 border-[#ec2b7a] shadow-lg">
                      <span className="font-bold text-xl text-white">{player.ign?.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-[#ec2b7a] transition-colors">{player.ign}</h3>
                  <p className="text-[#ec2b7a] text-sm font-semibold">{player.role}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evaluation Drawer */}
        {selectedPlayer !== null && (() => {
          const overallStatus = getEvaluationStatus(summary?.overallEvaluation || 0);

          return (
            <div className="w-full mt-10 bg-[#1a1a1a]/90 backdrop-blur-xl p-8 rounded-xl border-t-4 border-[#ec2b7a] shadow-2xl animate-fadeIn relative overflow-hidden">
              <div className="flex justify-between items-start border-b border-gray-800/50 pb-6 gap-4 relative z-10">
                <div className="flex items-center gap-5">
                  {selectedPlayer.image_url ? (
                    <img src={selectedPlayer.image_url} className="w-20 h-20 rounded-full object-cover border-2 border-[#ec2b7a] shadow-lg" />
                  ) : (
                    <div className="w-20 h-20 bg-[#2a0a18] rounded-full flex items-center justify-center border-2 border-[#ec2b7a] shadow-lg">
                      <span className="font-bold text-3xl text-white">{selectedPlayer.ign?.charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                  <div>
                    <h3 className="text-3xl font-extrabold uppercase drop-shadow-md">{selectedPlayer.ign}</h3>
                    <p className="text-gray-300 text-sm mt-1">Signature Hero: <span className="text-white font-bold">{selectedPlayer.main_hero}</span></p>
                  </div>
                </div>
                <button onClick={() => setSelectedPlayer(null)} className="bg-gray-800/80 hover:bg-gray-700 px-4 py-2 rounded text-xs font-bold uppercase text-white transition-colors">Close [X]</button>
              </div>

              {loadingStats ? (
                <p className="text-center text-[#ec2b7a] py-16 font-bold animate-pulse tracking-widest uppercase">Calculating Metrics...</p>
              ) : summary ? (
                <div className="relative z-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className={`p-6 rounded-lg border flex flex-col items-center justify-center text-center shadow-lg backdrop-blur ${overallStatus.bg}`}>
                      <h4 className="text-gray-300 text-xs font-bold mb-2 uppercase tracking-widest">Overall Coach Evaluation</h4>
                      <p className={`text-5xl font-extrabold drop-shadow-md ${overallStatus.color}`}>{summary.overallEvaluation.toFixed(1)} <span className="text-2xl text-white/50">/ 5.0</span></p>
                      <p className={`mt-3 font-black uppercase tracking-wider px-4 py-1 rounded bg-black/40 ${overallStatus.color}`}>{overallStatus.label}</p>
                    </div>
                    <div className="bg-[#121212]/80 backdrop-blur p-6 rounded-lg border border-gray-800 flex flex-col justify-center items-center shadow-lg">
                      <h4 className="text-gray-400 text-xs font-bold mb-2 uppercase tracking-widest">Total Match Impact (Played: {summary.played})</h4>
                      <p className="text-4xl font-bold text-white drop-shadow-md tracking-wider">
                        {summary.totalKills} <span className="text-green-500 text-2xl">K</span> / {summary.totalDeaths} <span className="text-red-500 text-2xl">D</span> / {summary.totalAssists} <span className="text-blue-500 text-2xl">A</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h4 className="text-xl font-black mb-4 uppercase border-b border-gray-800/50 pb-2 text-transparent bg-clip-text bg-gradient-to-r from-gray-100 to-gray-400 tracking-widest">Match-by-Match Breakdown</h4>
                    <div className="flex flex-col gap-4">
                      {playerMatches.map((log) => {
                        const matchStatus = getEvaluationStatus(log.matchEvaluation);
                        return (
                          <div key={log.id} className="bg-[#121212]/60 backdrop-blur p-5 rounded-lg border border-gray-800 shadow-lg">
                            <div className="flex justify-between items-center border-b border-gray-800/50 pb-3 mb-3">
                              <span className="font-bold text-lg">DAG vs {log.match?.opponent_name} <span className="text-xs font-normal text-gray-500 bg-black/50 px-2 py-0.5 rounded ml-2">{log.match?.match_type || 'Scrim'}</span></span>
                              <span className={`px-3 py-1 text-xs font-black tracking-widest uppercase rounded shadow ${log.match?.result === 'WIN' ? 'bg-green-900 text-green-400' : 'bg-red-900 text-red-400'}`}>{log.match?.result}</span>
                            </div>
                            
                            {log.status === 'played' ? (
                              <div className="flex flex-col md:flex-row gap-6">
                                <div className="flex-1">
                                  <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-2 border-b border-gray-800 pb-1">Coach Ratings</p>
                                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm font-bold bg-black/30 p-3 rounded border border-gray-800/50">
                                    <div className="flex justify-between items-center text-gray-300"><span>Macro:</span> <span className="text-white text-base bg-gray-900 px-2 rounded">{log.macro_score}<span className="text-xs text-gray-500">/5</span></span></div>
                                    <div className="flex justify-between items-center text-gray-300"><span>Micro:</span> <span className="text-white text-base bg-gray-900 px-2 rounded">{log.micro_score}<span className="text-xs text-gray-500">/5</span></span></div>
                                    <div className="flex justify-between items-center text-gray-300"><span>KDA:</span> <span className="text-white text-base bg-gray-900 px-2 rounded">{log.kda_score}<span className="text-xs text-gray-500">/5</span></span></div>
                                    <div className="flex justify-between items-center text-gray-300"><span>Mental:</span> <span className="text-white text-base bg-gray-900 px-2 rounded">{log.mentality_score}<span className="text-xs text-gray-500">/5</span></span></div>
                                  </div>
                                  <p className="text-xs text-gray-400 mt-3 font-bold tracking-wider">Game KDA: <span className="text-green-400 text-base">{log.kills}/{log.deaths}/{log.assists}</span></p>
                                </div>
                                <div className={`flex-shrink-0 flex flex-col justify-center items-center w-36 border-l-4 p-4 shadow-inner rounded ${matchStatus.bg.split(' ')[1]} bg-black/40`}>
                                  <span className="text-[10px] uppercase text-gray-400 font-bold tracking-widest mb-1">Match Eval</span>
                                  <span className={`text-4xl font-black drop-shadow ${matchStatus.color}`}>{log.matchEvaluation.toFixed(1)}</span>
                                  <span className={`text-[10px] font-black uppercase mt-2 text-center tracking-wider ${matchStatus.color}`}>{matchStatus.label}</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-yellow-500 font-bold text-sm bg-yellow-900/20 p-2 rounded inline-block border border-yellow-900/50">Benched (Did Not Play)</p>
                            )}
                            <div className="mt-4 bg-black/40 p-4 rounded border-l-4 border-[#ec2b7a] text-sm text-gray-200 italic shadow-inner">
                              "{log.coach_comment || 'No specific feedback left for this match.'}"
                            </div>
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
      </div>
    </main>
  );
}