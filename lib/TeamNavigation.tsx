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
      className="relative z-10 mb-8 w-full rounded-2xl border border-white/10 bg-[#100e11]/95 p-3 shadow-lg backdrop-blur sm:p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/" className="rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-xs font-bold text-gray-200 hover:border-accent hover:text-accent">
          DAG Home
        </Link>
        {tabs.map((tab) => (
          <Link key={tab.href} href={tab.href} aria-current={tab.href === current ? 'page' : undefined}
            className={`rounded-xl border px-4 py-2.5 text-xs font-black uppercase tracking-wide transition-colors ${tab.href === current
              ? 'border-accent bg-accent text-white'
              : 'border-gray-700 bg-[#1a171b] text-gray-300 hover:border-accent hover:text-accent'}`}>
            {tab.label}
          </Link>
        ))}
        <Link href="/management"
          className="ml-auto rounded-xl border border-pink-500/35 bg-pink-500/10 px-4 py-2.5 text-xs font-black uppercase tracking-wide text-pink-200 hover:bg-pink-500/20">
          Management
        </Link>
      </div>
    </nav>
  );
}
