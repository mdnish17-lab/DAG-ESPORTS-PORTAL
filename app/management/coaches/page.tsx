import { requireAdmin } from '../../../lib/require-admin';
import AdminClient from '../../admin/AdminClient';

export default async function CoachesManagerWorkspace() {
  await requireAdmin();
  return <AdminClient />;
}
