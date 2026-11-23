import Link from 'next/link';
import { requireAdmin } from '../../../lib/require-admin';
import AdminPasswordChange from '../../admin/AdminPasswordChange';

export default async function ManagementAccountSettings() {
  await requireAdmin();
  return (
    <main className="min-h-screen bg-[#090808] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/management" className="mb-6 inline-block rounded-lg border border-gray-700 px-4 py-2 text-sm font-bold text-gray-200 hover:border-red-400">← Management</Link>
        <AdminPasswordChange />
      </div>
    </main>
  );
}
