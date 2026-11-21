import Link from 'next/link';

export default function AdminUnauthorizedPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#080509] p-6 text-white">
      <div className="w-full max-w-md rounded-2xl border border-pink-500/30 bg-[#171119] p-8 text-center">
        <h1 className="text-3xl font-black text-pink-400">Access denied</h1>
        <p className="mt-4 text-gray-300">Your account is signed in but has not been approved for DAG management.</p>
        <Link href="/admin/login" className="mt-6 inline-block rounded-lg bg-pink-500 px-5 py-3 font-bold text-black">Return to login</Link>
        <Link href="/" className="mt-4 block text-gray-400 underline">Back to Dashboard</Link>
      </div>
    </main>
  );
}
