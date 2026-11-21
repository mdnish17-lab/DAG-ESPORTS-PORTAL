"use client";

import Link from 'next/link';
import Image from 'next/image';
import { useState, type FormEvent } from 'react';
import { supabase } from '../../../lib/supabase';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (loginError) {
        setMessage('Invalid email or password.');
        return;
      }

      const { data: approved, error: approvalError } =
        await supabase.rpc('is_approved_admin');

      if (approvalError || approved !== true) {
        await supabase.auth.signOut();
        setMessage('This management account is not approved.');
        return;
      }

      window.location.replace('/admin');
    } catch {
      setMessage('Unable to connect. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#080509] p-5 text-white">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-pink-600/20 blur-[100px]" />
      <form onSubmit={onSubmit} className="relative z-10 w-full max-w-md space-y-5 rounded-3xl border border-pink-500/25 bg-[#161018]/95 p-7 shadow-[0_25px_90px_rgba(0,0,0,0.6)] sm:p-10">
        <div className="text-center">
          <div className="mx-auto mb-4 grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-pink-400/40 bg-pink-500/10 p-2 shadow-[0_0_30px_rgba(236,72,153,0.16)]"><Image src="/dag-logo.jpg" width={88} height={88} alt="DAG Esports logo" className="h-full w-full rounded-full object-contain" priority /></div>
          <p className="text-xs font-bold tracking-[0.35em] text-pink-300">DE ANT GAMING</p>
          <h1 className="mt-2 text-3xl font-black uppercase tracking-wider text-pink-400">DAG Esports</h1>
          <h2 className="mt-2 text-lg font-bold tracking-wider">MANAGEMENT LOGIN</h2>
          <p className="mt-2 text-sm text-gray-400">Approved management accounts only</p>
        </div>

        <div>
          <label htmlFor="admin-email" className="mb-2 block text-sm font-semibold">Management email</label>
          <input id="admin-email" type="email" required autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="manager@example.com" className="w-full rounded-xl border border-pink-400/30 bg-[#251b27] px-4 py-3 text-white outline-none focus:border-pink-400" />
        </div>
        <div>
          <label htmlFor="admin-password" className="mb-2 block text-sm font-semibold">Password</label>
          <div className="flex overflow-hidden rounded-xl border border-pink-400/30 bg-[#251b27] focus-within:border-pink-400">
            <input id="admin-password" type={showPassword ? 'text' : 'password'} required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className="min-w-0 flex-1 bg-transparent px-4 py-3 text-white outline-none" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="px-4 text-sm font-bold text-pink-300" aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? 'HIDE' : 'SHOW'}</button>
          </div>
        </div>

        {message && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">{message}</p>}

        <button type="submit" disabled={busy} className="w-full rounded-xl bg-pink-500 px-4 py-3 font-black tracking-wide text-black transition hover:bg-pink-400 disabled:cursor-wait disabled:opacity-60">{busy ? 'CHECKING ACCOUNT...' : 'ACCESS ADMIN PANEL'}</button>
        <Link href="/" className="block text-center text-sm font-semibold text-gray-400 hover:text-pink-300">← Back to Dashboard</Link>
      </form>
    </main>
  );
}
