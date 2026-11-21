import { redirect } from 'next/navigation';
import { requireAdmin } from '../../lib/require-admin';

// Preserve legacy /admin links while sending approved users to Management.
export default async function LegacyAdminRoute() {
  await requireAdmin();
  redirect('/management');
}
