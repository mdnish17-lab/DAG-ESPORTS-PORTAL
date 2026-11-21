import { requireDagOwner } from '../../../lib/require-dag-owner';
import DagSiteAdminEditor from './DagSiteAdminEditor';

export default async function DagSiteAdminPage() {
  await requireDagOwner();
  return <main className="min-h-screen bg-[#09070b] px-4 py-8 text-white sm:px-6 md:py-12"><div className="mx-auto max-w-6xl"><DagSiteAdminEditor /></div></main>;
}
