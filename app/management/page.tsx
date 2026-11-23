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
    <main className="min-h-screen bg-[#0b0909] px-4 py-10 text-white sm:px-6 md:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="rounded-lg border border-gray-700 px-4 py-2.5 text-xs font-black uppercase text-gray-300 hover:border-red-400">← DAG Home</Link>
          <AdminLogoutButton />
        </div>
        <header className="mt-8 rounded-3xl border border-red-500/30 bg-gradient-to-br from-[#29110f] to-[#120e0e] p-6 text-center sm:p-10">
          <Image src="/team-logos/dag-esports.webp" width={110} height={110} alt="DAG Esports logo" className="mx-auto h-24 w-24 rounded-full object-contain" />
          <p className="mt-5 text-xs font-black uppercase tracking-[0.25em] text-red-300">DAG Esports</p>
          <h1 className="mt-2 text-3xl font-black uppercase sm:text-5xl">Management</h1>
          <p className="mt-3 text-sm text-gray-300">Choose your authorized workspace. Your account role: <strong className="text-white">{String(role || 'unassigned')}</strong>.</p>
        </header>

        <div className="mt-7 grid gap-5 md:grid-cols-2">
          {isOwner && (
            <Link href="/management/admin" className="group rounded-3xl border border-red-500/35 bg-[#1b100f] p-7 hover:border-red-300 hover:bg-[#271512]">
              <span className="text-3xl">✦</span>
              <h2 className="mt-4 text-2xl font-black uppercase text-red-300">Admin</h2>
              <p className="mt-2 text-sm leading-6 text-gray-300">Edit DAG website introduction, team introductions, owner profile, and featured Hall of Fame achievements.</p>
              <p className="mt-5 text-xs font-black uppercase tracking-widest text-red-300">Owner only →</p>
            </Link>
          )}
          <Link href="/management/coaches" className="group rounded-3xl border border-gray-700 bg-[#171313] p-7 hover:border-red-400 hover:bg-[#211717]">
            <span className="text-3xl">◈</span>
            <h2 className="mt-4 text-2xl font-black uppercase">Coaches / Manager</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">Existing Coach Dashboard, roster, matches, player evaluations, weekly goals, monthly PDF/Excel reports and achievements.</p>
            <p className="mt-5 text-xs font-black uppercase tracking-widest text-red-300">Open workspace →</p>
          </Link>
          <Link href="/management/account" className="group rounded-3xl border border-gray-700 bg-[#171313] p-7 hover:border-red-400 hover:bg-[#211717]">
            <span className="text-3xl">⚙</span>
            <h2 className="mt-4 text-2xl font-black uppercase">Account Settings</h2>
            <p className="mt-2 text-sm leading-6 text-gray-300">Every approved management user can update their own login password.</p>
            <p className="mt-5 text-xs font-black uppercase tracking-widest text-red-300">Update password →</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
