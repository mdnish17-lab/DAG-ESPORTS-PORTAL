'use client';

import Link from 'next/link';

const tabs = [
  { href: '/team-performance', label: 'Team Performance' },
  { href: '/roster', label: 'Roster' },
  { href: '/achievement', label: 'Achievement' },
  { href: '/evaluation', label: 'Evaluation' },
  { href: '/planner', label: 'Planner' },
] as const;

/** Navigation sits BELOW the team-banner artwork, not over its background. */
export default function TeamNavigation({ current }: { current: string }) {
  return (
    <nav aria-label="Team website pages"
      className="relative z-10 mb-8 w-full min-w-0 rounded-2xl border border-white/10 bg-[#100e11]/95 p-2.5 shadow-lg backdrop-blur sm:p-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
        <Link href="/" className="flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-2 py-2.5 text-center text-[11px] font-bold text-gray-200 hover:border-accent hover:text-accent sm:px-4 sm:text-xs">
          DAG Home
        </Link>
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={tab.href === current ? 'page' : undefined}
            className={`flex min-h-11 min-w-0 items-center justify-center rounded-xl border px-2 py-2.5 text-center text-[10px] font-black uppercase leading-tight tracking-wide transition-colors sm:px-3 sm:text-xs lg:px-4 ${tab.href === current
              ? 'border-accent bg-accent text-white'
              : 'border-gray-700 bg-[#1a171b] text-gray-300 hover:border-accent hover:text-accent'}`}>
            {tab.label}
          </Link>
        ))}
        <Link href="/management"
          className="col-span-2 flex min-h-11 min-w-0 items-center justify-center rounded-xl border border-pink-500/35 bg-pink-500/10 px-3 py-2.5 text-center text-xs font-black uppercase tracking-wide text-pink-200 hover:bg-pink-500/20 sm:col-span-3 lg:ml-auto">
          Management
        </Link>
      </div>
    </nav>
  );
}
