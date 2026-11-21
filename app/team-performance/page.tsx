// Keep old bookmarks working after the page is renamed to Achievements.
import { permanentRedirect } from 'next/navigation';

export default function LegacyTeamPerformance() {
  permanentRedirect('/achievement');
}
