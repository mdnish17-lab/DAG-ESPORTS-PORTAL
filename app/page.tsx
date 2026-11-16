"use client";

import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { useEffect, useState } from 'react';

const TEAMS = ['DAG Ladies', 'DAG Montrix'];

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function Home() {
  const [activeTeam, setActiveTeam] = useState('DAG Ladies');
  const [playerCount, setPlayerCount] = useState(0);
  const [matches, setMatches] = useState<any[]>([]);
  const [expandedReview, setExpandedReview] = useState<number | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      const { data: pData } = await supabase.from('players').select('id').eq('team', activeTeam);
      if (pData) setPlayerCount(pData.length);

      const { data: matchData } = await supabase.from('matches').select('*').eq('team', activeTeam).order('match_date', { ascending: false });
      if (matchData) setMatches(matchData);
    }
    fetchDashboardData();
  }, [activeTeam]);

  const completedMatches = matches.filter(m => m.status === 'completed');
  const upcomingMatches = matches.filter(m => m.status === 'upcoming');

  const matchesPlayed = completedMatches.length;
  const totalWins = completedMatches.filter(m => m.result === 'WIN').length;
  const totalLosses = completedMatches.filter(m => m.result === 'LOSS').length;
  const winRate = matchesPlayed > 0 ? Math.round((totalWins / matchesPlayed) * 100) : 0;

  return (
    <main className="min-h-screen bg-[#0a0508] text-white flex flex-col items-center pt-10 md:pt-20 p-6 md:p-10 pb-20 relative overflow-hidden">
      
      {/* --- COOL DAG LOGO WALLPAPER BACKGROUND --- */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        {/* Gradient overlay to ensure text stays readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/90 via-[#121212]/80 to-[#121212] z-10"></div>
        <img 
          src="/dag-logo.jpg" 
          alt="DAG Wallpaper" 
          className="w-[150vw] md:w-[70vw] opacity-15 blur-[2px] grayscale-[30%] mix-blend-lighten z-0 object-contain"
        />
      </div>

      {/* Main Content Wrapper (z-10 puts it above the background) */}
      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        
        {/* Team Toggle */}
        <div className="flex gap-4 mb-6">
          {TEAMS.map(team => (
            <button key={team} onClick={() => setActiveTeam(team)}
              className={`px-8 py-2 rounded-full font-extrabold tracking-widest uppercase transition-colors border-2 ${
                activeTeam === team ? 'border-[#ec2b7a] bg-[#ec2b7a] text-white shadow-[0_0_15px_rgba(236,43,122,0.4)]' : 'border-gray-800/80 bg-black/50 text-gray-500 backdrop-blur-sm hover:border-gray-600'
              }`}>
              {team}
            </button>
          ))}
        </div>

        <div className="bg-[#2a0a18]/90 backdrop-blur-md p-8 md:p-10 rounded-xl border-t-4 border-[#ec2b7a] shadow-[0_10px_40px_rgba(236,43,122,0.2)] w-full flex flex-col md:flex-row justify-between items-center gap-8 mb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-2 tracking-wide uppercase drop-shadow-lg">De Ant Gaming</h1>
            <h2 className="text-2xl md:text-3xl text-[#ec2b7a] font-bold tracking-widest mb-8 uppercase drop-shadow-md">{activeTeam.replace('DAG ', '')} Division</h2>
            
            <div className="flex gap-4 text-xs md:text-sm font-semibold text-gray-300 tracking-wider items-center flex-wrap">
              <span className="text-[#ec2b7a] font-bold cursor-default shadow-[#ec2b7a]">DASHBOARD</span> |
              <Link href="/roster" className="hover:text-[#ec2b7a] transition-colors">ROSTER</Link> |
              <Link href="/team-performance" className="hover:text-[#ec2b7a] transition-colors">TEAM PERFORMANCE</Link> |
              <Link href="/player-performance" className="hover:text-[#ec2b7a] transition-colors">PLAYER PERFORMANCE</Link> |
              <Link href="/admin" className="bg-[#ec2b7a] hover:bg-[#c92468] text-white px-4 py-1.5 rounded-md transition-colors shadow-lg ml-2">ADMIN</Link>
            </div>
          </div>
          <Image src="/dag-logo.jpg" alt="DAG Logo" width={200} height={200} className="object-contain drop-shadow-2xl" />
        </div>

        <div className="w-full grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-[#1e1e1e]/80 backdrop-blur p-6 rounded-lg border border-gray-800 text-center shadow-lg">
            <h3 className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Active Roster</h3>
            <p className="text-3xl font-bold">{playerCount}</p>
          </div>
          <div className="bg-[#1e1e1e]/80 backdrop-blur p-6 rounded-lg border border-gray-800 text-center shadow-lg">
            <h3 className="text-gray-400 text-[10px] font-bold mb-1 uppercase">Matches Played</h3>
            <p className="text-3xl font-bold">{matchesPlayed}</p>
          </div>
          <div className="bg-[#1e1e1e]/80 backdrop-blur p-6 rounded-lg border border-green-900/50 text-center shadow-lg">
            <h3 className="text-green-500 text-[10px] font-bold mb-1 uppercase">Total Wins</h3>
            <p className="text-3xl font-bold text-green-400">{totalWins}</p>
          </div>
          <div className="bg-[#1e1e1e]/80 backdrop-blur p-6 rounded-lg border border-red-900/50 text-center shadow-lg">
            <h3 className="text-red-500 text-[10px] font-bold mb-1 uppercase">Total Losses</h3>
            <p className="text-3xl font-bold text-red-500">{totalLosses}</p>
          </div>
          <div className="bg-[#1a0a10]/90 backdrop-blur p-6 rounded-lg border-2 border-[#ec2b7a] text-center shadow-[0_0_20px_rgba(236,43,122,0.15)]">
            <h3 className="text-[#ec2b7a] text-[10px] font-bold mb-1 uppercase">Win Rate</h3>
            <p className="text-4xl font-extrabold text-[#ec2b7a]">{winRate}%</p>
          </div>
        </div>

        <div className="w-full mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Upcoming Matches */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-bold mb-6 tracking-widest text-gray-200 border-b border-gray-800/50 pb-3 uppercase">Upcoming</h2>
            <div className="flex flex-col gap-4">
              {upcomingMatches.length === 0 ? (
                <p className="text-gray-500 italic text-sm bg-black/40 p-4 rounded backdrop-blur border border-gray-900">No scheduled matches.</p>
              ) : (
                upcomingMatches.map(match => (
                  <div key={match.id} className="bg-[#1a1a1a]/80 backdrop-blur border border-gray-800 p-5 rounded-lg flex gap-4 items-center shadow-lg hover:border-gray-600 transition-colors">
                    <div className="flex flex-col items-center justify-center bg-[#121212] w-16 h-16 rounded border border-gray-800 flex-shrink-0">
                      <span className="text-[10px] text-[#ec2b7a] font-bold uppercase">{new Date(match.match_date).toLocaleString('default', { month: 'short' })}</span>
                      <span className="text-xl font-black">{new Date(match.match_date).getDate()}</span>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold tracking-widest uppercase mb-0.5">
                        <span className="bg-blue-900/50 text-blue-300 px-1.5 py-0.5 rounded mr-2">{match.match_type || 'Scrim'}</span>
                        VS Match
                      </p>
                      <p className="font-extrabold text-lg truncate drop-shadow">{match.opponent_name}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Right Column: Completed Match History */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-bold mb-6 tracking-widest text-gray-200 border-b border-gray-800/50 pb-3 uppercase">Match History</h2>
            <div className="flex flex-col gap-4">
              {completedMatches.length === 0 ? (
                <p className="text-gray-500 italic text-sm bg-black/40 p-4 rounded backdrop-blur border border-gray-900">No match history available.</p>
              ) : (
                completedMatches.map(match => (
                  <div key={match.id} className={`bg-[#1a1a1a]/80 backdrop-blur rounded-lg border-l-4 p-5 flex flex-col shadow-lg transition-all hover:bg-[#1f1f1f]/90 ${match.result === 'WIN' ? 'border-green-500' : match.result === 'LOSS' ? 'border-red-500' : 'border-yellow-500'}`}>
                    
                    <div className="flex justify-between items-center gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-400 text-[10px] font-bold tracking-widest uppercase">{formatDate(match.match_date)}</span>
                          <span className="bg-gray-800 text-gray-300 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider">{match.match_type || 'Scrim'}</span>
                        </div>
                        <h3 className="font-black text-xl uppercase drop-shadow">DAG VS {match.opponent_name}</h3>
                      </div>
                      
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-3 text-3xl font-black drop-shadow-md">
                          <span className={match.result === 'WIN' ? 'text-green-400' : 'text-white'}>{match.dag_score}</span>
                          <span className="text-gray-600 text-xl">-</span>
                          <span className={match.result === 'LOSS' ? 'text-red-400' : 'text-white'}>{match.opponent_score}</span>
                        </div>
                      </div>
                    </div>

                    {match.match_review && (
                      <div className="mt-4 border-t border-gray-800/50 pt-4">
                        <button onClick={() => setExpandedReview(expandedReview === match.id ? null : match.id)} className="text-[#ec2b7a] text-xs font-bold uppercase tracking-widest flex items-center gap-2 hover:text-white transition-colors">
                          {expandedReview === match.id ? 'Hide Coach Review ▲' : 'Read Coach Review ▼'}
                        </button>
                        
                        {expandedReview === match.id && (
                          <div className="mt-3 p-4 bg-[#121212]/80 rounded border border-gray-800 text-sm text-gray-300 leading-relaxed animate-fadeIn backdrop-blur">
                            {match.match_review}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}