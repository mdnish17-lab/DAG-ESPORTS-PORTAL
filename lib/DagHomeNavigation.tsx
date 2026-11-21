import Link from 'next/link';

const baseLink = 'flex min-h-11 min-w-0 items-center justify-center rounded-xl border px-2 py-2.5 text-center text-[11px] font-bold uppercase leading-tight transition-colors sm:px-4 sm:text-xs';
const normal = 'border-gray-700 text-gray-200 hover:border-pink-400 hover:text-pink-200';
const active = 'border-pink-400 bg-pink-500/20 text-pink-100';
const manage = 'border-pink-500/50 bg-pink-500/10 font-black text-pink-200 hover:bg-pink-500/20';

/** Shared DAG organization-level navigation, distinct from team-page tabs. */
export default function DagHomeNavigation({ current = 'home' }: { current?: 'home' | 'planner' }) {
  const anchorBase = current === 'home' ? '' : '/';
  return (
    <nav aria-label="DAG Esports organization navigation"
      className="mt-4 grid w-full grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-[#130e14]/95 p-2.5 shadow-xl sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:p-3">
      <Link href={anchorBase + '#about-owner'} className={baseLink + ' ' + normal}>Meet the Owner</Link>
      <Link href={anchorBase + '#dag-teams'} className={baseLink + ' ' + normal}>Team List</Link>
      <Link href={anchorBase + '#dag-hall-of-fame'} className={baseLink + ' ' + normal}>Hall of Fame</Link>
      <Link href="/planner" aria-current={current === 'planner' ? 'page' : undefined}
        className={baseLink + ' ' + (current === 'planner' ? active : normal)}>Planner</Link>
      <Link href="/management" className={baseLink + ' col-span-2 sm:col-auto ' + manage}>Management</Link>
    </nav>
  );
}
