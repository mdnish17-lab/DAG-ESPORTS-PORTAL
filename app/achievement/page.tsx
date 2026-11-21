"use client";

import Image from 'next/image';
import Link from 'next/link';
import TeamNavigation from '../../lib/TeamNavigation';
import { getTeamTheme, themeStyle } from '../../lib/teamTheme';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

const TEAMS = ['DAG Ladies', 'DAG Montrix'];
const CURRENT = '/achievement';

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function AchievementsPage() {
  const [activeTeam, setActiveTeamState] = useState<string>('DAG Ladies');
  const [teamReady, setTeamReady] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('dag-active-team');
    if (saved && TEAMS.includes(saved)) setActiveTeamState(saved);
    setTeamReady(true);
  }, []);
  const setActiveTeam = (team: string) => { setActiveTeamState(team); localStorage.setItem('dag-active-team', team); };

  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!teamReady) return;
    let cancelled = false;
    async function fetchAchievements() {
      setLoading(true);
      const { data, error } = await supabase
        .from('team_achievements').select('*').eq('team', activeTeam).order('date', { ascending: false });
      if (error) console.error('Achievements error:', error);
      if (cancelled) return;
      setAchievements(data || []);
      setLoading(false);
    }
    fetchAchievements();
    return () => { cancelled = true; };
  }, [activeTeam, teamReady]);

  const champions = achievements.filter((a) => {
    const p = (a.placement || '').toLowerCase();
    return p.includes('champion') && !p.includes('runner');
  }).length;

  return (
    <main className="min-h-screen bg-[#0a0508] text-white flex flex-col items-center pt-10 md:pt-16 p-6 md:p-10 pb-20 relative overflow-hidden" style={themeStyle(activeTeam)}>
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

        <div className="relative bg-accent-deep/80 backdrop-blur-md p-8 md:p-10 rounded-2xl border border-accent/30 shadow-[0_10px_50px_var(--accent-glow-soft)] w-full flex flex-col md:flex-row justify-between items-center gap-8 mb-12 overflow-hidden">
          <div className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-accent/20 blur-3xl pointer-events-none"></div>
          <div className="relative">
            <p className="text-xs tracking-[0.4em] text-gray-400 uppercase mb-2">De Ant Gaming</p>
            <h1 className="text-4xl md:text-6xl font-black uppercase leading-tight bg-gradient-to-r from-accent via-pink-300 to-white bg-clip-text text-transparent drop-shadow-lg">{activeTeam}</h1>
            <p className="text-gray-300 font-semibold tracking-widest uppercase text-sm mt-2">Achievement</p>

          </div>
          <Image key={activeTeam} src={getTeamTheme(activeTeam).logo} alt="DAG Logo" width={190} height={190} className="object-contain drop-shadow-2xl relative animate-fadeIn" />
        </div>

        <TeamNavigation current={CURRENT} />

        <div className="w-full">
          <h2 className="text-3xl md:text-4xl font-black mb-6 text-center uppercase tracking-[0.25em] text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-accent to-yellow-400 drop-shadow-lg">
            🏆 Hall of Fame 🏆
          </h2>

          {!loading && achievements.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-8 max-w-xl mx-auto">
              <div className="bg-[#1a1a1a]/80 border border-yellow-900/40 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-yellow-400">{achievements.length}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Trophies</p>
              </div>
              <div className="bg-[#1a1a1a]/80 border border-yellow-900/40 rounded-xl p-4 text-center">
                <p className="text-3xl font-black text-yellow-400">{champions}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Championships</p>
              </div>
              <div className="bg-[#1a1a1a]/80 border border-yellow-900/40 rounded-xl p-4 text-center">
                <p className="text-sm font-black text-yellow-400 leading-9">{formatDate(achievements[0].date)}</p>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Latest</p>
              </div>
            </div>
          )}

          {loading ? (
            <p className="text-gray-500 italic py-16 text-center animate-pulse">Loading achievements...</p>
          ) : achievements.length === 0 ? (
            <p className="text-gray-500 italic py-16 text-center">The legacy of {activeTeam} begins here. No achievements listed yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {achievements.map((ach) => (
                <div key={ach.id}
                  className="bg-[#1a1a1a]/90 backdrop-blur border border-yellow-900/40 rounded-2xl overflow-hidden shadow-2xl hover:border-yellow-500/60 hover:shadow-[0_0_30px_rgba(234,179,8,0.2)] transition-all hover:-translate-y-1.5 group">
                  {ach.image_url ? (
                    <div className="h-48 overflow-hidden bg-black relative">
                      <img src={ach.image_url} alt={ach.placement} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] via-transparent to-transparent"></div>
                    </div>
                  ) : (
                    <div className="h-48 bg-gradient-to-br from-accent-deep to-[#121212] flex items-center justify-center">
                      <span className="text-6xl">🏆</span>
                    </div>
                  )}
                  <div className="p-5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-yellow-500 bg-yellow-900/30 border border-yellow-700/40 px-2 py-1 rounded-full">
                      {formatDate(ach.date)}
                    </span>
                    <h3 className="text-xl font-black uppercase text-white mt-3 mb-1 drop-shadow">{ach.placement}</h3>
                    <p className="text-gray-300 text-sm font-semibold">{ach.tournament || ach.venue || '—'}</p>
                    {ach.tournament && ach.venue && <p className="text-gray-500 text-xs mt-1">📍 {ach.venue}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}