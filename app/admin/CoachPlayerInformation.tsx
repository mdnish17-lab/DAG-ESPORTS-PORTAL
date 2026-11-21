'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

type PlayerInfo = {
  id: number;
  ign: string;
  team: string;
  role?: string | null;
  full_name?: string | null;
  age?: number | null;
  stay?: string | null;
  main_hero?: string | null;
  image_url?: string | null;
  achievements?: string | null;
  date_of_birth?: string | null;
  mlbb_id?: string | null;
  mlbb_server?: string | null;
};
type Props = {
  activeTeam: string;
  managementRole: string;
};

const isManager = (role: string) => role === 'owner' || role === 'manager';

/**
 * Player directory within Coach Dashboard.
 * Everyone with an approved admin login can see public profile fields.
 * Managers/owners alone receive private roster fields, protected by RLS.
 */
export default function CoachPlayerInformation({ activeTeam, managementRole }: Props) {
  const privateAllowed = isManager(managementRole);
  const [rows, setRows] = useState<PlayerInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadRoster() {
      setLoading(true);
      setError('');
      setRows([]);
      const source = privateAllowed ? 'players' : 'public_player_profiles';
      const columns = privateAllowed
        ? 'id,team,ign,role,full_name,age,stay,main_hero,image_url,achievements,date_of_birth,mlbb_id,mlbb_server'
        : 'id,team,ign,role,full_name,age,stay,main_hero,image_url,achievements';
      const { data, error: readError } = await supabase.from(source)
        .select(columns).eq('team', activeTeam).order('id', { ascending: true });
      if (cancelled) return;
      if (readError) setError(readError.message);
      else setRows((data || []) as unknown as PlayerInfo[]);
      setExpandedId(null);
      setLoading(false);
    }
    void loadRoster();
    return () => { cancelled = true; };
  }, [activeTeam, privateAllowed, refresh]);

  const filtered = useMemo(() => rows.filter((player) =>
    (player.ign + ' ' + (player.full_name || '') + ' ' + (player.role || ''))
      .toLowerCase().includes(search.trim().toLowerCase())
  ), [rows, search]);

  return (
    <section className="rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-5 md:p-6" aria-labelledby="coach-players-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id="coach-players-title" className="text-lg font-black uppercase text-accent">Player & Staff Information</h3>
          <p className="mt-1 text-xs text-gray-400">
            {activeTeam} · {rows.length} roster members · {privateAllowed ? 'Manager / owner details' : 'Public profile details'}
          </p>
        </div>
        <button type="button" onClick={() => setRefresh((v) => v + 1)} disabled={loading}
          className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold hover:border-accent disabled:opacity-50">Refresh roster</button>
      </div>
      <p className="mt-2 text-xs text-gray-400">
        All management roles can view name, age, general location, role, signature hero and public achievements.
        {privateAllowed ? ' Your role also permits date of birth and MLBB account information.' : ' Date of birth and MLBB account details are limited to managers and owners.'}
      </p>
      <label className="mt-4 block text-xs font-bold uppercase text-gray-400">Find player or staff
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search IGN, name or role" className="mt-2 w-full rounded-lg border border-gray-700 bg-[#101010] px-3 py-3 text-sm font-normal text-white outline-none focus:border-accent" />
      </label>
      {loading ? <p role="status" className="mt-5 text-sm text-gray-400">Loading roster information...</p> :
        error ? <p role="alert" className="mt-5 rounded-lg border border-red-800 p-4 text-sm text-red-300">Roster unavailable: {error}. Check Supabase role permissions.</p> :
        filtered.length === 0 ? <p className="mt-5 text-sm text-gray-400">No matching players or staff members.</p> :
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((player) => {
            const expanded = expandedId === player.id;
            return <article key={player.id} className="min-w-0 self-start overflow-hidden rounded-xl border border-gray-700 bg-[#111]">
              <button type="button" aria-expanded={expanded} onClick={() => setExpandedId(expanded ? null : player.id)}
                className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/5">
                {player.image_url ?
                  <img src={player.image_url} alt="" className="h-12 w-12 shrink-0 rounded-full border border-accent object-cover" /> :
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-accent bg-accent/15 font-black">{player.ign.charAt(0).toUpperCase()}</span>}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-black text-white">{player.ign}</span>
                  <span className="block truncate text-xs text-gray-400">{player.full_name || 'No full name set'}</span>
                  <span className="block truncate text-[11px] text-accent">{player.role || 'Player'}</span>
                </span>
                <span className="text-sm text-gray-400" aria-hidden="true">{expanded ? '−' : '+'}</span>
              </button>
              {expanded && <div className="space-y-2 border-t border-gray-700 p-4 text-xs">
                {([
                  ['Full name', player.full_name],
                  ['Age', player.age == null ? null : String(player.age) + ' years'],
                  ['Location', player.stay],
                  ['Role', player.role],
                  ['Signature hero', player.main_hero],
                ] as [string, string | null | undefined][]).map(([label, value]) =>
                  <div key={label} className="flex justify-between gap-3">
                    <span className="shrink-0 text-gray-400">{label}</span>
                    <span className="break-words text-right text-white">{value || '—'}</span>
                  </div>
                )}
                {privateAllowed && <>
                  <div className="mt-3 border-t border-gray-700 pt-3 text-[10px] font-black uppercase tracking-wider text-amber-300">Private management information</div>
                  {([
                    ['Date of birth', player.date_of_birth],
                    ['MLBB ID', player.mlbb_id],
                    ['MLBB Server', player.mlbb_server],
                  ] as [string, string | null | undefined][]).map(([label, value]) =>
                    <div key={label} className="flex justify-between gap-3">
                      <span className="shrink-0 text-gray-400">{label}</span>
                      <span className="break-all text-right text-white">{value || '—'}</span>
                    </div>
                  )}
                </>}
                <div className="mt-3 border-t border-gray-700 pt-3 text-[10px] font-black uppercase tracking-wider text-accent">Achievements</div>
                <p className="whitespace-pre-line break-words text-gray-200">{player.achievements || 'No achievements listed'}</p>
              </div>}
            </article>;
          })}
        </div>}
    </section>
  );
}
