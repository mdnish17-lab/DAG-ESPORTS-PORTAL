"use client";

import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '../../lib/supabase';

const MIN_PASSWORD_LENGTH = 6;

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: 'current-password' | 'new-password';
  minLength?: number;
};

function PasswordField({ id, label, value, onChange, autoComplete, minLength }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-bold text-gray-200">{label}</label>
      <div className="relative mt-2">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="block w-full rounded-xl border border-gray-700 bg-[#121212] px-4 py-3 pr-20 text-white outline-none focus:border-pink-400"
        />
        <button
          type="button"
          aria-label={`${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-sm font-bold text-pink-300 hover:bg-pink-500/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-400"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}

export default function AdminPasswordChange() {
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [passwordFieldVersion, setPasswordFieldVersion] = useState(0);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (active) setEmail(user?.email || '');
    });
    return () => { active = false; };
  }, []);

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setMessage('');
    setSuccess(false);
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setMessage(`Use at least ${MIN_PASSWORD_LENGTH} characters for your new password.`);
      return;
    }
    if (newPassword === currentPassword) {
      setMessage('Your new password must differ from your current password.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage('New passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user?.email) throw new Error('Your session has expired. Please sign in again.');
      const { data: approved, error: approvalError } = await supabase.rpc('is_approved_admin');
      if (approvalError || approved !== true) throw new Error('This account is not approved for DAG management.');
      // Supabase validates current_password. Passwords are never saved in app tables.
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
        current_password: currentPassword,
      });
      if (error) throw error;
      setSuccess(true);
      setMessage('Password updated successfully. Use the new password next time you sign in.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFieldVersion((version) => version + 1); // Hide all fields again after success.
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Password update failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl border border-pink-500/25 bg-[#1a1a1a]/90 p-6 shadow-xl md:p-8">
      <h2 className="text-2xl font-black uppercase tracking-wide text-pink-400">Management Account</h2>
      <p className="mt-2 text-sm text-gray-400">Change the password for your currently signed-in approved management account only.</p>
      <div className="mt-5 rounded-lg border border-gray-700 bg-black/35 p-3 text-sm">
        <span className="text-gray-400">Signed in as:</span> <span className="font-bold text-white">{email || 'Loading account...'}</span>
      </div>
      <form key={passwordFieldVersion} onSubmit={changePassword} className="mt-6 space-y-4">
        <PasswordField id="current-password" label="Current password" value={currentPassword}
          onChange={setCurrentPassword} autoComplete="current-password" />
        <PasswordField id="new-password" label="New password (at least 6 characters)" value={newPassword}
          onChange={setNewPassword} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} />
        <PasswordField id="confirm-password" label="Confirm new password" value={confirmPassword}
          onChange={setConfirmPassword} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} />
        <p className="text-xs text-gray-400">Six characters is the form minimum. A longer, unique password (12+ characters) is much safer. Supabase may enforce stricter rules.</p>
        {message && <p role="status" className={`rounded-lg border px-4 py-3 text-sm ${success ? 'border-green-700/50 bg-green-950/25 text-green-300' : 'border-red-800/50 bg-red-950/25 text-red-300'}`}>{message}</p>}
        <button type="submit" disabled={busy || !email} className="w-full rounded-xl bg-pink-500 px-5 py-3 font-black uppercase text-black hover:bg-pink-400 disabled:opacity-60">
          {busy ? 'Updating password...' : 'Change my password'}
        </button>
      </form>
      <p className="mt-5 text-xs text-gray-500">For forgotten passwords, an authorized Supabase project administrator can assist with account recovery. Never share your password with another manager.</p>
    </section>
  );
}
