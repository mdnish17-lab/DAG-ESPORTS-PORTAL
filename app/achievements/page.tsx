// Plural URL alias for convenience.
import { permanentRedirect } from 'next/navigation';

export default function AchievementsAlias() {
  permanentRedirect('/achievement');
}
