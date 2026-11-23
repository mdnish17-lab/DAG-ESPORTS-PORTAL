'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { TEAM_DIVISIONS } from '../../../lib/teamTheme';

type Profile = {
  id: number;
  intro_title: string; intro_body: string;
  ladies_intro: string; montrix_intro: string;
  owner_name: string; owner_title: string; owner_bio: string;
  owner_photo_url: string;
};
type Achievement = {
  id: number; team: string; tournament: string; placement: string;
  date: string; image_url?: string | null;
};
type Featured = { achievement_id: number; featured_order: number };
const initial: Profile = {
  id: 1, intro_title: 'Welcome to DAG Esports',
  intro_body: 'De Ant Gaming brings together DAG Ladies and DAG Montrix.',
  ladies_intro: 'Meet DAG Ladies and follow their esports journey.',
  montrix_intro: 'Meet DAG Montrix and follow their esports journey.',
  owner_name: '', owner_title: 'Founder & Owner', owner_bio: '', owner_photo_url: '',
};
const EXTRA_TEAMS = Object.values(TEAM_DIVISIONS).flat().filter((name) => name !== 'DAG Ladies' && name !== 'DAG Montrix');
const textField = 'mt-2 w-full rounded-xl border border-gray-700 bg-[#0e0b0b] px-4 py-3 text-base text-white outline-none focus:border-red-400';
const fields: Array<{ key: keyof Omit<Profile, 'id'>; label: string; description: string; multiline?: boolean; max: number }> = [
  { key: 'intro_title', label: 'Website heading', description: 'Headline beneath the DAG logo', max: 100 },
  { key: 'intro_body', label: 'DAG Esports introduction', description: 'A welcome message about De Ant Gaming', multiline: true, max: 2000 },
  { key: 'ladies_intro', label: 'DAG Ladies introduction', description: 'Shown under the Ladies team card', multiline: true, max: 1200 },
  { key: 'montrix_intro', label: 'DAG Montrix introduction', description: 'Shown under the Montrix team card', multiline: true, max: 1200 },
  { key: 'owner_name', label: 'Owner full name', description: 'Public display name', max: 160 },
  { key: 'owner_title', label: 'Owner title', description: 'Public position, e.g. Founder & Owner', max: 160 },
  { key: 'owner_bio', label: 'Owner biography', description: 'Short public biodata and vision', multiline: true, max: 1600 },
  { key: 'owner_photo_url', label: 'Owner photo URL', description: 'Public HTTPS image link, e.g. Supabase Storage public photo URL', max: 1200 },
];

export default function DagSiteAdminEditor() {
  const [profile, setProfile] = useState<Profile>(initial);
  const [teamIntros, setTeamIntros] = useState<Record<string, string>>({});
  const [savingIntros, setSavingIntros] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [orders, setOrders] = useState<Record<number, number>>({});
  const [loaded, setLoaded] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingFame, setSavingFame] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: role, error: roleError } = await supabase.rpc('my_management_role');
      if (cancelled) return;
      if (roleError || role !== 'owner') { setError('Owner permissions required to edit DAG website content.'); setLoaded(true); return; }
      const [site, achievementsResult, featuredResult, introsResult] = await Promise.all([
        supabase.from('dag_site_profile').select('*').eq('id', 1).maybeSingle(),
        supabase.from('team_achievements').select('id,team,tournament,placement,date,image_url').order('date', { ascending: false }),
        supabase.from('dag_hall_of_fame').select('achievement_id,featured_order'),
        supabase.from('dag_team_introductions').select('team,intro'),
      ]);
      if (cancelled) return;
      if (site.error || achievementsResult.error || featuredResult.error) {
        setError('Could not load website settings. SQL 13 must be installed first. ' +
          (site.error?.message || achievementsResult.error?.message || featuredResult.error?.message || ''));
      } else {
        if (site.data) setProfile({ ...initial, ...site.data });
        if (!introsResult.error) setTeamIntros(Object.fromEntries((introsResult.data || []).map(({ team, intro }) => [team, intro])));
        setAchievements((achievementsResult.data || []) as Achievement[]);
        const selectedMap: Record<number, boolean> = {};
        const orderMap: Record<number, number> = {};
        ((featuredResult.data || []) as Featured[]).forEach((f) => { selectedMap[f.achievement_id] = true; orderMap[f.achievement_id] = f.featured_order; });
        setSelected(selectedMap);
        setOrders(orderMap);
      }
      setLoaded(true);
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  async function verifyOwner() {
    const [role, approved] = await Promise.all([supabase.rpc('my_management_role'), supabase.rpc('is_approved_admin')]);
    if (role.error || approved.error || role.data !== 'owner' || approved.data !== true) throw new Error('Owner authorization could not be verified.');
  }

  async function saveProfile() {
    setError(''); setNotice('');
    setSavingProfile(true);
    try {
      await verifyOwner();
      const url = profile.owner_photo_url.trim();
      if (url && (!/^https:\/\//i.test(url) || url.length > 1200)) throw new Error('Owner photo must be an HTTPS image URL.');
      const payload = Object.fromEntries(fields.map((f) => [f.key, profile[f.key].trim()]));
      const { data, error: updateError } = await supabase.from('dag_site_profile')
        .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', 1).select('id').single();
      if (updateError || !data) throw new Error(updateError?.message || 'No site profile updated.');
      setNotice('DAG Esports website introduction and owner profile saved. Refresh the public homepage to view changes.');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not save profile.'); }
    finally { setSavingProfile(false); }
  }

  async function saveIntros() {
    setError(''); setNotice('');
    setSavingIntros(true);
    try {
      await verifyOwner();
      const payload = EXTRA_TEAMS.map((team) => ({
        team, intro: (teamIntros[team] || '').trim(),
        updated_at: new Date().toISOString(),
      }));
      const { error: writeError } = await supabase.from('dag_team_introductions').upsert(payload, { onConflict: 'team' });
      if (writeError) throw writeError;
      setNotice('All five new team introductions saved. Refresh the homepage to view changes.');
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : 'Could not save team introductions.');
    } finally {
      setSavingIntros(false);
    }
  }

  async function saveFame() {
    setError(''); setNotice('');
    setSavingFame(true);
    try {
      await verifyOwner();
      // Only feature existing achievements: never create separate award records.
      const featured = achievements.filter((item) => selected[item.id]);
      if (featured.length > 30) throw new Error('Feature up to 30 achievements to keep the homepage quick to browse.');
      for (const item of featured) {
        if (!Number.isInteger(orders[item.id] ?? 0) || (orders[item.id] ?? 0) < 0 || (orders[item.id] ?? 0) > 100000) {
          throw new Error('Display order must be a whole number between 0 and 100000.');
        }
      }
      const { data: existing, error: readError } = await supabase.from('dag_hall_of_fame').select('achievement_id');
      if (readError) throw readError;
      const existingIds = new Set((existing || []).map((item) => item.achievement_id));
      const keepIds = new Set(featured.map((a) => a.id));
      const removeIds = [...existingIds].filter((id) => !keepIds.has(id));
      if (removeIds.length) {
        const { error: deleteError } = await supabase.from('dag_hall_of_fame').delete().in('achievement_id', removeIds);
        if (deleteError) throw deleteError;
      }
      if (featured.length) {
        const { error: writeError } = await supabase.from('dag_hall_of_fame').upsert(
          featured.map((item) => ({ achievement_id: item.id, featured_order: orders[item.id] ?? 0 })),
          { onConflict: 'achievement_id' });
        if (writeError) throw writeError;
      }
      setNotice('Featured Hall of Fame selections saved. The homepage now uses this curated list.');
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not save featured achievements.'); }
    finally { setSavingFame(false); }
  }

  return (
    <div className="space-y-7">
      <header className="rounded-3xl border border-red-500/30 bg-gradient-to-br from-[#26100f] to-[#0e0b0b] p-6 md:p-9">
        <p className="text-xs font-black uppercase tracking-wider text-red-300">Owner-only website editor</p>
        <h1 className="mt-3 text-3xl font-black uppercase md:text-4xl">DAG Esports Admin</h1>
        <p className="mt-2 text-sm leading-6 text-gray-300">Manage the official homepage content and choose which existing team achievements appear in the DAG-wide Hall of Fame.</p>
      </header>
      {error && <div role="alert" className="rounded-xl border border-red-800 bg-red-950/20 p-4 text-sm text-red-200">{error}</div>}
      {notice && <div role="status" className="rounded-xl border border-green-800 bg-green-950/20 p-4 text-sm text-green-200">{notice}</div>}
      {!loaded ? <p role="status" className="text-sm text-gray-400">Loading website settings...</p> : !error || achievements.length > 0 ? (
        <>
          <section className="rounded-2xl border border-gray-800 bg-[#171217] p-5 md:p-8">
            <h2 className="text-xl font-black uppercase text-red-300">Website Introduction &amp; Owner Profile</h2>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {fields.map((f) => (
                <label key={f.key} className={'block text-sm font-bold text-gray-200 ' + (f.multiline ? 'md:col-span-2' : '')}>
                  {f.label}
                  {f.multiline ? (
                    <textarea rows={4} maxLength={f.max} value={profile[f.key]} onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))}
                      className={textField + ' resize-y'} />
                  ) : <input maxLength={f.max} type={f.key === 'owner_photo_url' ? 'url' : 'text'} value={profile[f.key]}
                    onChange={(e) => setProfile((p) => ({ ...p, [f.key]: e.target.value }))} className={textField} />}
                  <span className="mt-1 block text-xs font-normal text-gray-500">{f.description}</span>
                </label>
              ))}
            </div>
            <button type="button" onClick={() => { void saveProfile(); }} disabled={savingProfile}
              className="mt-6 min-h-12 rounded-xl bg-red-500 px-6 py-3 text-sm font-black uppercase text-black hover:bg-red-400 disabled:opacity-50">
              {savingProfile ? 'Saving...' : 'Save Website & Owner Profile'}
            </button>
          </section>

          <section className="rounded-2xl border border-gray-800 bg-[#171217] p-5 md:p-8">
            <h2 className="text-xl font-black uppercase text-red-300">New Team Introductions</h2>
            <p className="mt-2 text-sm text-gray-400">
              The existing DAG Ladies and DAG Montrix introductions remain editable above.
              Set the homepage descriptions for the five new teams here.
            </p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {EXTRA_TEAMS.map((team) => (
                <label key={team} className="block text-sm font-bold text-gray-200">
                  {team}
                  <textarea rows={3} maxLength={1200} className={textField + ' resize-y'}
                    value={teamIntros[team] || ''}
                    onChange={(event) => setTeamIntros((previous) => ({ ...previous, [team]: event.target.value }))} />
                </label>
              ))}
            </div>
            <button type="button" onClick={() => { void saveIntros(); }} disabled={savingIntros}
              className="mt-6 min-h-12 rounded-xl bg-red-500 px-6 py-3 text-sm font-black uppercase text-black hover:bg-red-400 disabled:opacity-50">
              {savingIntros ? 'Saving...' : 'Save New Team Introductions'}
            </button>
          </section>

          <section className="rounded-2xl border border-amber-700/30 bg-[#171217] p-5 md:p-8">
            <h2 className="text-xl font-black uppercase text-amber-300">DAG Esports Hall of Fame</h2>
            <p className="mt-2 text-sm leading-6 text-gray-400">Choose achievements already created by any DAG Esports team. Select featured entries and adjust their display order (smaller number first). To add new achievements, use Coaches / Manager → Achievements.</p>
            {achievements.length === 0 ? <p className="mt-5 rounded-xl border border-dashed border-gray-700 p-5 text-sm text-gray-400">No existing team achievements to feature yet.</p> :
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {achievements.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-700 bg-[#0e0b0b] p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input type="checkbox" checked={!!selected[item.id]}
                        onChange={(e) => setSelected((prev) => ({ ...prev, [item.id]: e.target.checked }))}
                        className="mt-1 h-5 w-5 accent-red-500" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold">{item.tournament}</span>
                        <span className="mt-1 block text-xs text-gray-400">{item.team} · {item.placement} · {item.date}</span>
                      </span>
                    </label>
                    {selected[item.id] && <label className="mt-3 block text-xs font-bold text-amber-300">Display order
                      <input type="number" min={0} max={100000} step={1} value={orders[item.id] ?? 0}
                        onChange={(e) => setOrders((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                        className={textField + ' max-w-40'} />
                    </label>}
                  </div>
                ))}
              </div>
            }
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-gray-400">{achievements.filter((item) => selected[item.id]).length} selected for the homepage · Maximum 30</p>
              <button type="button" onClick={() => { void saveFame(); }} disabled={savingFame}
                className="min-h-12 rounded-xl bg-amber-500 px-6 py-3 text-sm font-black uppercase text-black hover:bg-amber-400 disabled:opacity-50">
                {savingFame ? 'Saving...' : 'Save Featured Hall of Fame'}
              </button>
            </div>
          </section>
        </>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Link href="/management" className="rounded-xl border border-gray-700 px-4 py-3 text-xs font-black uppercase text-gray-200 hover:border-red-400">← Management</Link>
        <Link href="/" className="rounded-xl border border-gray-700 px-4 py-3 text-xs font-black uppercase text-gray-200 hover:border-red-400">View Public Homepage</Link>
      </div>
    </div>
  );
}
