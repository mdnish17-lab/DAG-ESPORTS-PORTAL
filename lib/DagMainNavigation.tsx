'use client';

import Link from 'next/link';

/**
 * Organization-level navigation, displayed below the DAG homepage and
 * Strategy Planner banners. Planner is not a team-page tab.
 */
export default function DagMainNavigation({ plannerActive = false }: { plannerActive?: boolean }) {
  const linkStyle = 'flex min-h-11 min-w-0 items-center justify-center rounded-xl border px-2 py-2.5 text-center text-[11px] font-bold uppercase leading-tight transition-colors sm:px-4 sm:text-xs';
  const regularStyle = linkStyle + ' border-gray-700 text-gray-200 hover:border-pink-400 hover:text-pink-200';
  return (
    <nav aria-label="DAG Esports main navigation"
      className="mt-4 mb-8 grid w-full grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#130e14]/95 p-2.5 shadow-xl sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:p-3">
      <Link href={plannerActive ? '/#about-owner' : '#about-owner'} className={regularStyle}>Meet the Owner</Link>
      <Link href={plannerActive ? '/#dag-teams' : '#dag-teams'} className={regularStyle}>Team List</Link>
      <Link href={plannerActive ? '/#dag-hall-of-fame' : '#dag-hall-of-fame'} className={regularStyle}>Hall of Fame</Link>
      <Link href="/planner" aria-current={plannerActive ? 'page' : undefined}
        className={linkStyle + (plannerActive
          ? ' border-pink-400 bg-pink-500/25 font-black text-pink-100'
          : ' border-gray-700 text-gray-200 hover:border-pink-400 hover:text-pink-200')}>
        Planner
      </Link>
      <Link href="/management"
        className={linkStyle + ' col-span-2 border-pink-500/50 bg-pink-500/10 font-black text-pink-200 hover:bg-pink-500/20 sm:col-span-1'}>
        Management
      </Link>
    </nav>
  );
}
