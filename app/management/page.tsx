import Link from 'next/link';
import Image from 'next/image';
import { requireAdmin } from '../../lib/require-admin';
import { createClient } from '../../lib/supabase-server';
import AdminLogoutButton from '../admin/AdminLogoutButton';

export default async function ManagementLanding() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: role } = await supabase.rpc('my_management_role');
  const isOwner = role === 'owner';
  return (
    <main className="min-h-screen bg-[#0b070c] px-4 py-10 text-white sm:px-6 md:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="rounded-lg border border-gray-700 px-4 py-2.5 text-xs font-black uppercase text-gray-300 hover:border-pink-400">← DAG Home</Link>
          <AdminLogoutButton />
        </div>
        <header className="mt-8 rounded-3xl border border-pink-500/30 bg-gradient-to-br from-[#29111f] to-[#120e15] p-6 text-center sm:p-10">
          <Image src="/dag-logo.jpg" width={110} height={110} alt="DAG Esports logo" className="mx-auto h-24 w-24 rounded-full object-contain" />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.25em] text-pink-300">DAG Esports</p>
          <h1 className="mt-2 text-3xl font-black uppercase sm:text-5xl">Management</h1>
          <p className="mt-3 text-sm text-gray-300">Choose your authorized workspace. Your account role: <strong className="text-white">{String(role || 'unassigned')}</strong>.</p>
        </header>

        <nav aria-label="Management sections" className="mt-4 flex flex-wrap gap-2 rounded-xl border border-gray-800 bg-[#141015] p-3">
          <Link href="/" className="rounded-lg border border-gray-700 px-4 py-2 text-sm text-gray-200 hover:border-pink-400">DAG Home</Link>
          <Link href="/management/account" className="rounded-lg border border-pink-700/60 px-4 py-2 text-sm font-bold text-pink-200 hover:bg-pink-500/10">Account Settings</Link>
        </nav>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {isOwner && (
            <Link href="/management/admin" className="group rounded-3xl border border-pink-500/35 bg-[#1b101a] p-7 hover:border-pink-300 hover:bg-[#271525]">
              <span className="text-3xl">✦</span>
              <h2 className="mt-4 text-2xl font-black uppercase text-pink-300">Admin</h2>
              <p className="mt-2 text-sm leading-6 text-gray-300">Edit DAG website introduction, team introductions, owner profile, and featured Hall of Fame achievements.</p>
              <p className="mt-5 text-xs font-black uppercase tracking-widest text-pink-300">Owner only →</p>
            </Link>
          )}
          <Link href="/management/coaches" className="group rounded-3xl border border-gray-700 bg-[#171417] p-7 hover:border-pink-400 hover:bg-[#211920]">
            <span className="text-3xl">◈</span>
            <h2 className="mt-4 text-2xl font-black uppercase">Coaches / Manager</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">Existing Coach Dashboard, roster, matches, player evaluations, weekly goals, monthly PDF/Excel reports, planner and achievements.</p>
            <p className="mt-5 text-xs font-black uppercase tracking-widest text-pink-300">Open workspace →</p>
          </Link>
          <Link href="/management/account" className="group rounded-3xl border border-gray-700 bg-[#171417] p-7 hover:border-pink-400 hover:bg-[#211920]">
            <span className="text-3xl">⚙</span>
            <h2 className="mt-4 text-2xl font-black uppercase">Account Settings</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">Every approved management user can update their own login password.</p>
            <p className="mt-5 text-xs font-black uppercase tracking-widest text-pink-300">Update password →</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
