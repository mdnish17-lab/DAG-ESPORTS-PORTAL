'use client';

import { TEAM_DIVISIONS } from './teamTheme';

type Props = { value: string; onChange: (team: string) => void; disabled?: boolean; };
/** Compact 7-team switcher shared by all existing team pages and Management. */
export default function TeamSelector({ value, onChange, disabled = false }: Props) {
  return (
    <div className="w-full max-w-sm rounded-xl border border-accent/50 bg-[#120e12]/95 p-2 sm:w-auto" style={{ minWidth: 230 }}>
      <label htmlFor="dag-active-team" className="mb-1 block text-[10px] font-black uppercase tracking-widest text-gray-400">
        Viewing team
      </label>
      <select id="dag-active-team" aria-label="Select DAG division and team"
        value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-accent/40 bg-[#19151b] px-3 py-2 text-sm font-bold text-white outline-none focus:border-accent">
        {Object.entries(TEAM_DIVISIONS).map(([division, names]) => (
          <optgroup key={division} label={division}>
            {names.map((team) => <option key={team} value={team}>{team}</option>)}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
