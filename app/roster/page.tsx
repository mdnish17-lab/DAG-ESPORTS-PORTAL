"use client";

import Image from 'next/image';
import Link from 'next/link';
import SiteDecor from '../../lib/SiteDecor';
import TeamNavigation from '../../lib/TeamNavigation';
import { getTeamTheme, themeStyle } from '../../lib/teamTheme';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

const TEAMS = ['DAG Ladies', 'DAG Montrix'];
const CURRENT = '/roster';

const isStaff = (role: string) => {
  const r = (role || '').toLowerCase();
  return r === 'coach' || r === 'manager';
};

export default function RosterPage() {
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
  const [expandedId, setExpandedId] = useState<number | null>(null);

  useEffect(() => {
    if (!teamReady) return;
    let cancelled = false;
    async function fetchRoster() {
      setLoading(true);
      const { data, error } = await supabase.from('public_player_profiles').select('id,team,ign,role,main_hero,image_url,achievements,full_name,stay,age').eq('team', activeTeam).order('id');
      if (error) console.error('Roster error:', error);
      if (cancelled) return;
      setRoster(data || []);
      setExpandedId(null);
      setLoading(false);
    }
    fetchRoster();
    return () => { cancelled = true; };
  }, [activeTeam, teamReady]);

  const toggleExpand = (id: number) => setExpandedId((prev) => (prev === id ? null : id));

  const players = roster.filter((p) => !isStaff(p.role));
  const staff = roster.filter((p) => isStaff(p.role));

  const renderCard = (player: any) => {
    const expanded = expandedId === player.id;
    const isStaffCard = isStaff(player.role);
    return (
      <div key={player.id} onClick={() => toggleExpand(player.id)}
        className={`bg-[#1e1e1e]/90 backdrop-blur p-5 rounded-xl border transition-all cursor-pointer group hover:-translate-y-1 ${
          expanded
            ? isStaffCard ? 'border-yellow-500 ring-2 ring-yellow-500/30 shadow-[0_0_25px_rgba(234,179,8,0.2)]' : 'border-accent ring-2 ring-accent/30 shadow-[0_0_25px_var(--accent-glow-soft)]'
            : isStaffCard ? 'border-yellow-900/60 hover:border-yellow-600' : 'border-gray-800 hover:border-accent'}`}>
        <div className="flex flex-col items-center text-center">
          {player.image_url ? (
            <img src={player.image_url} alt={player.ign}
              className={`w-24 h-24 rounded-full object-cover object-top mb-4 border-2 group-hover:scale-105 transition-transform ${isStaffCard ? 'border-yellow-500' : 'border-accent'}`} />
          ) : (
            <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-4 border-2 ${isStaffCard ? 'bg-yellow-900/30 border-yellow-500' : 'bg-accent-deep border-accent'}`}>
              <span className="font-bold text-3xl text-white">{player.ign ? player.ign.charAt(0).toUpperCase() : '?'}</span>
            </div>
          )}
          <h3 className="text-xl font-bold text-white mb-1 group-hover:text-accent transition-colors">{player.ign}</h3>
          <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full mb-2 border ${
            isStaffCard ? 'text-yellow-400 bg-yellow-600/20 border-yellow-600/50' : 'text-accent bg-accent/10 border-accent/40'}`}>
            {isStaffCard ? '★ ' : ''}{player.role}
          </span>
          {!isStaffCard && (
            <p className="text-gray-400 text-xs mb-3">Signature: <span className="text-gray-200 font-semibold">{player.main_hero || '—'}</span></p>
          )}
          <span className={`text-[10px] font-bold uppercase tracking-wider ${expanded ? (isStaffCard ? 'text-yellow-400' : 'text-accent') : 'text-gray-500'}`}>
            {expanded ? '▲ Hide details' : '▼ Show details'}
          </span>
        </div>

        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-800 flex flex-col gap-2 text-sm animate-fadeIn">
            <div className="flex justify-between gap-4"><span className="font-semibold text-gray-400">Full Name</span><span className="text-right text-white">{player.full_name || '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="font-semibold text-gray-400">Age</span><span className="text-right text-white">{player.age != null ? `${player.age} years old` : '—'}</span></div>
            <div className="flex justify-between gap-4"><span className="font-semibold text-gray-400">Location</span><span className="text-right text-white">{player.stay || '—'}</span></div>
            <div className="mt-2">
              <span className="text-gray-400 font-semibold text-xs uppercase tracking-wider">Achievements</span>
              {player.achievements ? (
                <ul className="mt-1 list-disc list-inside text-gray-200 text-xs space-y-1">
                  {player.achievements.split('\n').filter((a: string) => a.trim()).map((a: string, i: number) => (<li key={i}>{a.trim()}</li>))}
                </ul>
              ) : (
                <p className="text-gray-500 italic text-xs mt-1">No achievements listed.</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#0a0508] text-white flex flex-col items-center pt-10 md:pt-16 p-6 md:p-10 pb-20 relative overflow-hidden" style={themeStyle(activeTeam)}>
      <SiteDecor />
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/90 via-[#121212]/80 to-[#121212] z-10"></div>
        <img key={activeTeam} src={getTeamTheme(activeTeam).logo} alt="DAG Wallpaper" className="w-[150vw] md:w-[70vw] opacity-15 blur-[2px] grayscale-[30%] mix-blend-lighten z-0 object-contain" />
      </div>

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        <div className="flex gap-3 mb-6 p-1.5 rounded-full bg-black/50 border border-white/10 backdrop-blur">
          {TEAMS.map((team) => (
            <button key={team} type="button" onClick={() => setActiveTeam(team)}
              className={`px-7 py-2 rounded-full font-extrabold tracking-widest uppercase text-sm transition-all ${
                activeTeam === team ? 'bg-accent text-white shadow-[0_0_20px_var(--accent-glow)]' : 'text-gray-500 hover:text-white'}`}>
              {team}
            </button>
          ))}
        </div>

        <div className="relative bg-accent-deep/80 backdrop-blur-md p-8 md:p-10 rounded-2xl border border-accent/30 shadow-[0_10px_50px_var(--accent-glow-soft)] w-full flex flex-col md:flex-row justify-between items-center gap-8 mb-10 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none"></div>
          <div className="relative">
            <p className="text-xs tracking-[0.4em] text-gray-400 uppercase mb-2">De Ant Gaming</p>
            <h1 className="text-4xl md:text-6xl font-black uppercase leading-tight bg-gradient-to-r from-accent via-pink-300 to-white bg-clip-text text-transparent drop-shadow-lg">{activeTeam}</h1>
            <p className="text-gray-300 font-semibold tracking-widest uppercase text-sm mt-2">Roster</p>

          </div>
          <Image key={activeTeam} src={getTeamTheme(activeTeam).logo} alt="DAG Logo" width={190} height={190} className="object-contain drop-shadow-2xl relative animate-fadeIn" />
        </div>

        <TeamNavigation current={CURRENT} />

        {loading ? (
          <p className="text-gray-500 italic py-16 animate-pulse">Loading roster...</p>
        ) : (
          <>
            <div className="w-full mt-4">
              <h2 className="text-2xl font-bold mb-1 tracking-widest text-gray-200 uppercase">Active Players ({players.length})</h2>
              <p className="text-xs text-gray-500 mb-5 border-b border-gray-800 pb-3">Click a card to view full name, age, general location and player achievements. Sensitive account information remains private.</p>
              {players.length === 0 ? (
                <p className="text-gray-500 italic py-10 text-center">No players for {activeTeam} yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{players.map(renderCard)}</div>
              )}
            </div>

            {staff.length > 0 && (
              <div className="w-full mt-12">
                <h2 className="text-2xl font-bold mb-1 tracking-widest text-yellow-400 uppercase">★ Coaching & Management ({staff.length})</h2>
                <p className="text-xs text-gray-500 mb-5 border-b border-yellow-900/50 pb-3">Team staff. Their attendance is shown on the Evaluation page.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{staff.map(renderCard)}</div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}