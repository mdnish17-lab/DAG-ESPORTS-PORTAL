import 'server-only';
import { redirect } from 'next/navigation';
import { createClient } from './supabase-server';
import { requireAdmin } from './require-admin';

/** Require both approval and explicit Owner role on protected site editing routes.
 * Database policies still enforce the identical boundary on all writes. */
export async function requireDagOwner() {
  const user = await requireAdmin();
  const supabase = await createClient();
  const { data: role, error } = await supabase.rpc('my_management_role');
  if (error || role !== 'owner') redirect('/management');
  return user;
}
