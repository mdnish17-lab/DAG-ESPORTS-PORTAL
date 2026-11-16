"use client";

import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

const TEAMS = ['DAG Ladies', 'DAG Montrix'];

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function TeamPerformancePage() {
  const [activeTeam, setActiveTeam] = useState('DAG Ladies');
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAchievements() {
      setLoading(true);
      const { data } = await supabase
        .from('team_achievements')
        .select('*')
        .eq('team', activeTeam)
        .order('date', { ascending: false });
        
      if (data) setAchievements(data);
      setLoading(false);
    }
    fetchAchievements();
  }, [activeTeam]);

  return (
    <main className="min-h-screen bg-[#121212] text-white relative overflow-hidden flex flex-col items-center pt-10 md:pt-20 p-6 md:p-10 pb-20">
      
      {/* Sparkling Background Magic - Tinted Pink */}
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-pink-900/10 via-[#121212] to-[#121212] pointer-events-none" />
      <div className="absolute inset-0 z-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-30 animate-pulse pointer-events-none mix-blend-screen" />

      <div className="relative z-10 w-full max-w-5xl flex flex-col items-center">
        
        <div className="flex gap-4 mb-6">
          {TEAMS.map(team => (
            <button key={team} onClick={() => setActiveTeam(team)} className={`px-8 py-2 rounded-full font-extrabold tracking-widest uppercase transition-colors border-2 ${activeTeam === team ? 'border-[#ec2b7a] bg-[#ec2b7a] text-white shadow-[0_0_20px_rgba(236,43,122,0.5)]' : 'border-gray-800 text-gray-500 hover:border-gray-600 backdrop-blur-sm'}`}>{team}</button>
          ))}
        </div>

        <div className="bg-[#1a0a10]/80 backdrop-blur-md p-8 md:p-10 rounded-xl border-t-4 border-[#ec2b7a] shadow-[0_10px_40px_rgba(236,43,122,0.2)] w-full flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold mb-2 uppercase drop-shadow-lg">De Ant Gaming</h1>
            <h2 className="text-2xl md:text-3xl text-[#ec2b7a] font-bold uppercase drop-shadow-md">{activeTeam.replace('DAG ', '')} Division</h2>
            
            {/* FIXED UNIFIED NAVIGATION */}
            <div className="flex gap-4 text-xs md:text-sm font-semibold text-gray-300 tracking-wider items-center flex-wrap mt-6">
              <Link href="/" className="hover:text-[#ec2b7a] transition-colors">DASHBOARD</Link> | 
              <Link href="/roster" className="hover:text-[#ec2b7a] transition-colors">ROSTER</Link> |
              <span className="text-[#ec2b7a] font-bold cursor-default shadow-[#ec2b7a]">TEAM PERFORMANCE</span> | 
              <Link href="/player-performance" className="hover:text-[#ec2b7a] transition-colors">PLAYER PERFORMANCE</Link> |
              <Link href="/admin" className="bg-[#ec2b7a] hover:bg-[#c92468] text-white px-4 py-1.5 rounded-md transition-colors shadow-lg ml-2">ADMIN</Link>
            </div>
          </div>
          <Image src="/dag-logo.jpg" alt="DAG Logo" width={200} height={200} className="object-contain drop-shadow-2xl" />
        </div>

        <h2 className="text-3xl font-black mb-8 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-[#ec2b7a] tracking-widest uppercase text-center w-full border-b border-gray-800/50 pb-4">
          Hall of Fame
        </h2>

        {loading ? (
          <p className="text-[#ec2b7a] font-bold animate-pulse py-10">Accessing Trophy Room...</p>
        ) : achievements.length === 0 ? (
          <p className="text-gray-500 italic py-10">The legacy of {activeTeam} begins here. No achievements listed yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
            {achievements.map((ach) => (
              <div key={ach.id} className="group relative bg-[#1a1a1a]/60 backdrop-blur-sm border border-gray-800 rounded-xl overflow-hidden shadow-2xl hover:border-[#ec2b7a]/50 hover:shadow-[0_0_30px_rgba(236,43,122,0.15)] transition-all duration-300">
                <div className="h-64 w-full overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a1a] to-transparent z-10" />
                  <img src={ach.image_url} alt={ach.placement} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute bottom-4 left-4 z-20">
                    <p className="text-xs font-bold text-gray-300 bg-black/60 px-2 py-1 rounded backdrop-blur inline-block mb-2">
                      {formatDate(ach.date)}
                    </p>
                    <h3 className="text-3xl font-black text-white drop-shadow-lg leading-tight uppercase">{ach.placement}</h3>
                  </div>
                </div>
                <div className="p-6 relative z-20">
                  <p className="text-sm font-bold text-[#ec2b7a] uppercase tracking-widest mb-1">Tournament / Venue</p>
                  <p className="text-lg text-gray-200">{ach.venue}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}