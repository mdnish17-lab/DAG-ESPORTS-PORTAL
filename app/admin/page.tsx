import { requireAdmin } from '../../lib/require-admin';
import AdminClient from './AdminClient';

// Only approved Supabase Auth users see the original management UI.
export default async function AdminPage() {
  await requireAdmin();
  return <AdminClient />;
}
