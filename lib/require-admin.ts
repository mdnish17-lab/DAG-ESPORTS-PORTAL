import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase-server';

export async function requireAdmin() {
  const supabase = await createClient();
  // getUser() validates the session with Supabase Auth, not just a decoded cookie.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) redirect('/admin/login');

  // Matching a real Supabase UUID in admin_users is required even after login.
  const { data: approved, error: approvalError } =
    await supabase.rpc('is_approved_admin');
  if (approvalError || approved !== true) redirect('/admin/unauthorized');
  return user;
}
