'use client';

import { useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function AdminLogoutButton() {
  const [busy, setBusy] = useState(false);

  async function logOut() {
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    if (error) {
      alert('Could not log out: ' + error.message);
      setBusy(false);
      return;
    }
    window.location.replace('/admin/login');
  }

  return (
    <button
      type="button"
      onClick={logOut}
      disabled={busy}
      className="rounded-lg border border-pink-300/40 bg-pink-500 px-4 py-2 text-sm font-extrabold text-black transition hover:bg-pink-400 disabled:opacity-60"
    >
      {busy ? 'SIGNING OUT...' : 'LOG OUT'}
    </button>
  );
}
