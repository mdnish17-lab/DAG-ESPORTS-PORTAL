'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import SiteDecor from '../lib/SiteDecor';
import { getTeamTheme } from '../lib/teamTheme';

type SiteProfile = {
  intro_title: string; intro_body: string;
  ladies_intro: string; montrix_intro: string;
  owner_name: string; owner_title: string; owner_bio: string; owner_photo_url: string;
};
type Achievement = {
  id: number; team: string; date: string; placement: string;
  tournament: string; venue?: string | null; image_url?: string | null;
};
type Featured = { achievement_id: number; featured_order: number };

const fallback: SiteProfile = {
  intro_title: 'Welcome to DAG Esports',
  intro_body: 'De Ant Gaming brings together DAG Ladies and DAG Montrix. Discover the players, matches, growth and achievements behind our organization.',
  ladies_intro: 'Meet DAG Ladies and follow their esports journey.',
  montrix_intro: 'Meet DAG Montrix and follow their esports journey.',
  owner_name: '', owner_title: 'Founder & Owner', owner_bio: '', owner_photo_url: '',
};
const teams = [
  { name: 'DAG Ladies', description: 'ladies_intro' as const },
  { name: 'DAG Montrix', description: 'montrix_intro' as const },
];
const displayDate = (value: string) => {
  const d = new Date(value + 'T12:00:00Z');
  return isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export default function DagEsportsHome() {
  const [profile, setProfile] = useState<SiteProfile>(fallback);
  const [featured, setFeatured] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [site, selections, achievements] = await Promise.all([
        supabase.from('dag_site_profile').select('intro_title,intro_body,ladies_intro,montrix_intro,owner_name,owner_title,owner_bio,owner_photo_url').eq('id', 1).maybeSingle(),
        supabase.from('dag_hall_of_fame').select('achievement_id,featured_order').order('featured_order').order('achievement_id'),
        supabase.from('team_achievements').select('id,team,date,placement,tournament,venue,image_url'),
      ]);
      if (cancelled) return;
      if (site.data) setProfile({ ...fallback, ...site.data });
      const selectionsOk = !selections.error && !achievements.error;
      if (selectionsOk) {
        const achievementMap = new Map(((achievements.data || []) as Achievement[]).map((item) => [item.id, item]));
        setFeatured(((selections.data || []) as Featured[]).map((row) => achievementMap.get(row.achievement_id)).filter((row): row is Achievement => !!row));
      } else {
        // Before SQL 13 is installed, the public landing remains usable.
        setNotice('Featured achievements will appear once DAG site setup is complete.');
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  function chooseTeam(team: string) {
    localStorage.setItem('dag-active-team', team);
    window.location.assign('/team-performance');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#09060b] text-white">
      <SiteDecor />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[760px] bg-[radial-gradient(ellipse_at_top,rgba(200,25,107,0.23),transparent_63%)]" />
      <div className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 md:pt-16">
        <section aria-labelledby="dag-title" className="relative overflow-hidden rounded-[2rem] border border-pink-500/30 bg-gradient-to-b from-[#2a1021] via-[#171018] to-[#0e0b10] px-5 py-10 text-center shadow-[0_28px_100px_rgba(0,0,0,0.4)] sm:px-10 md:py-16">
          <div className="pointer-events-none absolute -right-16 -top-20 h-80 w-80 rounded-full bg-pink-600/10 blur-[95px]" />
          <div className="relative mx-auto mb-6 flex h-32 w-32 items-center justify-center rounded-full border border-pink-300/30 bg-black/30 p-3 shadow-[0_0_60px_rgba(217,70,139,0.2)] sm:h-40 sm:w-40">
            <Image src="/dag-logo.jpg" alt="DAG Esports official logo" width={180} height={180}
              className="h-full w-full rounded-full object-contain" priority />
          </div>
          <p className="text-xs font-black uppercase tracking-[0.45em] text-pink-300">De Ant Gaming</p>
          <h1 id="dag-title" className="mt-3 text-4xl font-black uppercase tracking-tight sm:text-6xl md:text-7xl">DAG <span className="text-pink-400">Esports</span></h1>
          <h2 className="mt-5 text-xl font-black text-white sm:text-2xl">{profile.intro_title}</h2>
          <p className="mx-auto mt-3 max-w-3xl whitespace-pre-line text-sm leading-7 text-gray-300 sm:text-base">{profile.intro_body}</p>
          <div className="mt-7 flex flex-wrap justify-center gap-2 text-[11px] font-black uppercase tracking-widest text-gray-400">
            <span className="rounded-full border border-white/15 px-4 py-2">Two Teams</span>
            <span className="rounded-full border border-white/15 px-4 py-2">One Organization</span>
          </div>
        </section>

        <nav aria-label="DAG Esports home navigation" className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#130e14]/95 p-3 shadow-xl">
          <a href="#about-owner" className="rounded-xl border border-gray-700 px-4 py-2.5 text-xs font-bold uppercase text-gray-200 hover:border-pink-400">Meet the Owner</a>
          <a href="#dag-teams" className="rounded-xl border border-gray-700 px-4 py-2.5 text-xs font-bold uppercase text-gray-200 hover:border-pink-400">Choose a Team</a>
          <a href="#dag-hall-of-fame" className="rounded-xl border border-gray-700 px-4 py-2.5 text-xs font-bold uppercase text-gray-200 hover:border-pink-400">Hall of Fame</a>
          <Link href="/management" className="rounded-xl border border-pink-500/50 bg-pink-500/10 px-4 py-2.5 text-xs font-black uppercase text-pink-200 hover:bg-pink-500/20">Management</Link>
        </nav>

        <section id="about-owner" className="mt-12 scroll-mt-6 rounded-3xl border border-gray-800 bg-[#171218]/90 p-5 sm:p-8">
          <p className="text-xs font-black uppercase tracking-[0.25em] text-pink-400">Meet the leadership</p>
          <h2 className="mt-2 text-2xl font-black uppercase sm:text-3xl">Meet the Owner</h2>
          <div className="mt-6 flex flex-col items-center gap-6 md:flex-row md:items-start">
            <div className="flex h-48 w-44 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-pink-500/30 bg-gradient-to-br from-pink-950/70 to-black/60">
              {profile.owner_photo_url
                ? <Image src={profile.owner_photo_url} width={200} height={220} unoptimized alt={profile.owner_name ? profile.owner_name + ' — DAG Esports owner' : 'DAG Esports owner'}
                    className="h-full w-full object-cover" />
                : <span className="text-center text-5xl text-pink-300/65" aria-label="Owner portrait pending">✦</span>}
            </div>
            <div className="min-w-0 flex-1 text-center md:text-left">
              <h3 className="text-2xl font-black text-white">{profile.owner_name || 'Owner profile coming soon'}</h3>
              <p className="mt-1 text-sm font-bold uppercase tracking-wider text-pink-300">{profile.owner_title}</p>
              <p className="mt-4 whitespace-pre-line text-sm leading-7 text-gray-300">{profile.owner_bio || 'The owner’s introduction and biography can be published from Management → Admin.'}</p>
            </div>
          </div>
        </section>

        <section id="dag-teams" className="mt-14 scroll-mt-6">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-pink-400">Explore our divisions</p>
            <h2 className="mt-2 text-3xl font-black uppercase sm:text-4xl">Choose Your Team</h2>
            <p className="mt-3 text-sm text-gray-400">Explore each team's performance, roster, achievements, evaluations and strategy planner.</p>
          </div>
          <div className="mt-7 grid gap-5 sm:grid-cols-2">
            {teams.map((team) => (
              <button key={team.name} type="button" onClick={() => chooseTeam(team.name)}
                className="group flex min-h-80 flex-col items-center rounded-3xl border border-pink-500/25 bg-gradient-to-b from-[#26131f] to-[#120e13] p-6 text-center transition-all hover:-translate-y-1 hover:border-pink-400 hover:shadow-[0_20px_65px_rgba(200,25,107,0.12)]">
                <div className="flex h-36 w-36 items-center justify-center rounded-full bg-black/35 p-3">
                  <Image src={getTeamTheme(team.name).logo} width={150} height={150}
                    alt={team.name + ' logo'} className="h-full w-full object-contain" />
                </div>
                <h3 className="mt-5 text-2xl font-black uppercase text-white">{team.name}</h3>
                <p className="mt-3 max-w-md whitespace-pre-line text-sm leading-6 text-gray-300">{profile[team.description]}</p>
                <span className="mt-auto pt-5 text-xs font-black uppercase tracking-widest text-pink-300 group-hover:text-white">Explore Team →</span>
              </button>
            ))}
          </div>
        </section>

        <section id="dag-hall-of-fame" className="mt-16 scroll-mt-6">
          <div className="text-center">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-amber-300">Our Legacy</p>
            <h2 className="mt-2 text-3xl font-black uppercase sm:text-4xl">🏆 DAG Hall of Fame</h2>
            <p className="mt-3 text-sm text-gray-400">Honoring standout moments from DAG Ladies and DAG Montrix.</p>
          </div>
          {loading ? <p role="status" className="mt-8 text-center text-sm text-gray-400">Loading featured achievements...</p>
            : featured.length === 0 ? (
              <div className="mt-8 rounded-2xl border border-dashed border-amber-700/40 bg-black/25 p-8 text-center text-sm text-gray-400">
                Featured achievements will appear here when selected by the organization owner.
                {notice && <p className="mt-3 text-xs text-gray-500">{notice}</p>}
              </div>
            ) : (
              <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {featured.map((achievement) => (
                  <article key={achievement.id} className="overflow-hidden rounded-2xl border border-amber-600/30 bg-[#171317]">
                    {achievement.image_url &&
                      <Image src={achievement.image_url} alt={achievement.tournament + ' achievement photo'} unoptimized
                        width={500} height={240} className="h-44 w-full object-cover" />}
                    <div className="p-5">
                      <p className="text-[11px] font-black uppercase tracking-widest text-amber-300">{achievement.placement}</p>
                      <h3 className="mt-2 text-lg font-black">{achievement.tournament}</h3>
                      <p className="mt-2 text-xs text-gray-400">{achievement.team} · {displayDate(achievement.date)}</p>
                      {achievement.venue && <p className="mt-1 text-xs text-gray-500">{achievement.venue}</p>}
                    </div>
                  </article>
                ))}
              </div>
            )}
        </section>

        <footer className="mt-16 border-t border-gray-800 pt-7 text-center text-xs text-gray-500">
          <p>© {new Date().getFullYear()} DAG Esports · De Ant Gaming</p>
          <Link href="/management" className="mt-3 inline-block text-pink-300 hover:underline">Management access</Link>
        </footer>
      </div>
    </main>
  );
}
