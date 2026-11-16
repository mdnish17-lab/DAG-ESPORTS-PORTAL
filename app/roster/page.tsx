"use client";

import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

const TEAMS = ['DAG Ladies', 'DAG Montrix'];

export default function RosterPage() {
  const [activeTeam, setActiveTeam] = useState('DAG Ladies');
  const [roster, setRoster] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    async function fetchRoster() {
      setLoading(true);
      const { data } = await supabase.from('players').select('*').eq('team', activeTeam).order('id');
      if (data) setRoster(data);
      setLoading(false);
    }
    fetchRoster();
    setExpandedId(null);
  }, [activeTeam]);

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <main className="min-h-screen bg-[#0a0508] text-white flex flex-col items-center pt-10 md:pt-20 p-6 md:p-10 pb-20 relative overflow-hidden">
      
      {/* --- COOL DAG LOGO WALLPAPER BACKGROUND --- */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/90 via-[#121212]/80 to-[#121212] z-10"></div>
        <img src="/dag-logo.jpg" alt="DAG Wallpaper" className="w-[150vw] md:w-[70vw] opacity-15 blur-[2px] grayscale-[30%] mix-blend-lighten z-0 object-contain" />
      </div>

      {/* Main Content Wrapper (z-10 keeps it above the wallpaper) */}
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

        {/* Header Banner */}
        <div className="bg-[#2a0a18]/90 backdrop-blur-md p-8 md:p-10 rounded-xl border-l-8 border-[#ec2b7a] shadow-[0_10px_40px_rgba(236,43,122,0.2)] w-full flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-2 tracking-wide uppercase drop-shadow-lg">De Ant Gaming</h1>
            <h2 className="text-2xl md:text-3xl text-[#ec2b7a] font-bold tracking-widest mb-8 uppercase drop-shadow-md">{activeTeam.replace('DAG ', '')} Division</h2>
            
            <div className="flex gap-4 text-xs md:text-sm font-semibold text-gray-300 tracking-wider items-center flex-wrap mt-6">
              <Link href="/" className="hover:text-[#ec2b7a] transition-colors">DASHBOARD</Link> |
              <span className="text-[#ec2b7a] font-bold cursor-default shadow-[#ec2b7a]">ROSTER</span> |
              <Link href="/team-performance" className="hover:text-[#ec2b7a] transition-colors">TEAM PERFORMANCE</Link> |
              <Link href="/player-performance" className="hover:text-[#ec2b7a] transition-colors">PLAYER PERFORMANCE</Link> |
              <Link href="/admin" className="bg-[#ec2b7a] hover:bg-[#c92468] text-white px-4 py-1.5 rounded-md transition-colors shadow-lg ml-2">ADMIN</Link>
            </div>
          </div>
          <div className="flex-shrink-0 ml-0 md:ml-8">
            <Image src="/dag-logo.jpg" alt="DAG Esports Logo" width={200} height={200} className="object-contain drop-shadow-2xl" />
          </div>
        </div>

        {/* Roster Grid */}
        <div className="w-full">
          <h2 className="text-2xl font-bold mb-2 tracking-widest text-gray-200 border-b border-gray-800/50 pb-3 uppercase drop-shadow-md">
            Active Roster
          </h2>
          <p className="text-xs text-gray-500 mb-6 -mt-4 drop-shadow">Click a card to show / hide player details.</p>

          {loading ? (
             <p className="text-gray-500 italic py-10 text-center">Loading Roster...</p>
          ) : roster.length === 0 ? (
             <p className="text-gray-500 italic py-10 text-center">No members found for {activeTeam}.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {roster.map((player) => {
                const expanded = expandedId === player.id;
                const isCoach = player.role.toLowerCase() === 'coach';
                
                return (
                  <div key={player.id} onClick={() => toggleExpand(player.id)} className={`bg-[#1a1a1a]/80 backdrop-blur p-5 rounded-lg border transition-all cursor-pointer group relative overflow-hidden shadow-lg hover:-translate-y-1 ${expanded ? 'border-[#ec2b7a] ring-2 ring-[#ec2b7a]/50 shadow-[0_0_20px_rgba(236,43,122,0.3)]' : 'border-gray-800 hover:border-[#ec2b7a]/50 hover:shadow-[0_0_15px_rgba(236,43,122,0.1)]'}`}>
                    {isCoach && (
                      <div className="absolute top-0 right-0 bg-[#ec2b7a] text-white text-[10px] font-bold px-3 py-1 uppercase tracking-widest rounded-bl-lg">Staff</div>
                    )}

                    <div className="flex flex-col items-center text-center mt-2">
                      {player.image_url ? (
                        <img src={player.image_url} alt={player.ign} className={`w-20 h-20 rounded-full object-cover object-top mb-4 border-2 group-hover:scale-105 transition-transform shadow-lg ${isCoach ? 'border-blue-500' : 'border-[#ec2b7a]'}`} />
                      ) : (
                        <div className={`w-20 h-20 bg-[#2a0a18] rounded-full flex items-center justify-center mb-4 border-2 shadow-lg ${isCoach ? 'border-blue-500' : 'border-[#ec2b7a]'}`}>
                          <span className="font-bold text-2xl text-white">{player.ign ? player.ign.charAt(0).toUpperCase() : '?'}</span>
                        </div>
                      )}
                      <h3 className="text-xl font-bold text-white mb-1 group-hover:text-[#ec2b7a] transition-colors">{player.ign}</h3>
                      <p className={`${isCoach ? 'text-blue-400' : 'text-[#ec2b7a]'} text-sm font-semibold mb-1`}>{player.role}</p>
                      {!isCoach && (
                        <p className="text-gray-400 text-xs mb-3">Signature: <span className="text-gray-200">{player.main_hero || '—'}</span></p>
                      )}
                      <span className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${expanded ? 'text-[#ec2b7a]' : 'text-gray-500'}`}>{expanded ? '▲ Hide Details' : '▼ Show Details'}</span>
                    </div>

                    {expanded && (
                      <div className="mt-4 pt-4 border-t border-gray-800/50 flex flex-col gap-2 text-sm animate-fadeIn">
                        <div className="flex justify-between"><span className="text-gray-400 font-semibold">Full Name</span><span className="text-white font-medium">{player.full_name || '—'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400 font-semibold">Age</span><span className="text-white font-medium">{player.age ? player.age + ' years old' : '—'}</span></div>
                        <div className="flex justify-between"><span className="text-gray-400 font-semibold">Location</span><span className="text-white font-medium text-right">{player.stay || '—'}</span></div>
                        <div className="mt-2">
                          <span className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Achievements / Bio</span>
                          {player.achievements ? (
                            <ul className="mt-1 list-disc list-inside text-gray-200 text-xs space-y-1">
                              {player.achievements.split('\n').filter((a: string) => a.trim()).map((a: string, i: number) => <li key={i}>{a.trim()}</li>)}
                            </ul>
                          ) : <p className="text-gray-500 italic text-xs mt-1">No details listed.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}