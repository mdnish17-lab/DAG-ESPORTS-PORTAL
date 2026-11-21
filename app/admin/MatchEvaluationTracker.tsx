'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { summarizeMatchEvaluation, type ProgressAssessment, type ProgressMatch, type ProgressPlayer } from '../../lib/matchEvaluationProgress';

type Filter = 'needs' | 'all' | 'complete';
type Props = {
  activeTeam: string;
  roster: ProgressPlayer[];
  matches: ProgressMatch[];
  onEvaluate: (id: number) => void;
  onEdit: (match: ProgressMatch) => void;
  onDelete: (id: number) => void;
};

const label = { complete: 'Completed', 'in-progress': 'In progress', 'not-started': 'Not started', 'no-players': 'No players' };
const badge = {
  complete: 'border-emerald-700 text-emerald-300',
  'in-progress': 'border-amber-700 text-amber-300',
  'not-started': 'border-gray-700 text-gray-300',
  'no-players': 'border-gray-700 text-gray-400',
};

/** Progress is derived from the existing saved match assessments; no database writes. */
export default function MatchEvaluationTracker({ activeTeam, roster, matches, onEvaluate, onEdit, onDelete }: Props) {
  const [records, setRecords] = useState<ProgressAssessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('needs');
  const [search, setSearch] = useState('');
  const [refresh, setRefresh] = useState(0);
  const idsKey = matches.map((match) => match.id).join(',');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      setRecords([]);
      try {
        const ids = idsKey.split(',').filter(Boolean).map(Number);
        const rows: ProgressAssessment[] = [];
        // Respect Supabase's per-request row limit, even with many historical matches.
        for (let i = 0; i < ids.length; i += 40) {
          let offset = 0;
          while (!cancelled) {
            const { data, error: queryError } = await supabase.from('match_player_stats')
              .select('id,match_id,ign,status,mechanics_score,macro_score,communication_score,role_execution_score,discipline_score,hero_pool_score')
              .in('match_id', ids.slice(i, i + 40)).order('id', { ascending: true })
              .range(offset, offset + 999);
            if (queryError) throw queryError;
            rows.push(...(data || []));
            if (!data || data.length < 1000) break;
            offset += 1000;
          }
          if (cancelled) return;
        }
        if (!cancelled) setRecords(rows);
      } catch (problem: unknown) {
        if (!cancelled) setError(problem instanceof Error ? problem.message : 'Could not load saved assessments.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [activeTeam, idsKey, refresh]);

  const progress = useMemo(() => {
    const byMatch = new Map<number, ProgressAssessment[]>();
    for (const record of records) {
      if (record.match_id == null) continue;
      const rows = byMatch.get(record.match_id) || [];
      rows.push(record);
      byMatch.set(record.match_id, rows);
    }
    return matches.map((match) => ({ match, summary: summarizeMatchEvaluation(roster, byMatch.get(match.id) || []) }));
  }, [records, matches, roster]);

  const completed = progress.filter(({ summary }) => summary.status === 'complete').length;
  const needs = matches.length - completed;
  const visible = progress.filter(({ match, summary }) =>
    (filter === 'all' || (filter === 'complete' ? summary.status === 'complete' : summary.status !== 'complete')) &&
    (match.opponent_name + ' ' + match.match_date).toLowerCase().includes(search.trim().toLowerCase())
  );
  const filterButton = (value: Filter, title: string) => (
    <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}
      className={'rounded-lg border px-3 py-2 text-xs font-bold ' + (filter === value ? 'border-accent bg-accent/15 text-accent' : 'border-gray-700 text-gray-400 hover:border-accent')}>
      {title}
    </button>
  );

  return (
    <section className="min-w-0 rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-5 shadow-xl md:p-6" aria-label="Match evaluation progress">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-black uppercase text-accent">Match Evaluation Progress</h3>
          <p className="mt-1 text-xs text-gray-400">Registered completed matches · current player roster</p>
        </div>
        <button type="button" disabled={loading} onClick={() => setRefresh((n) => n + 1)} className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold hover:border-accent disabled:opacity-50">Refresh</button>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2" aria-live="polite">
        <div className="rounded-xl border border-gray-700 bg-black/30 p-3 text-center"><p className="text-xl font-black">{matches.length}</p><p className="text-[10px] uppercase text-gray-400">Matches</p></div>
        <div className="rounded-xl border border-amber-900 bg-amber-950/20 p-3 text-center"><p className="text-xl font-black text-amber-300">{loading || error ? '—' : needs}</p><p className="text-[10px] uppercase text-gray-400">Need review</p></div>
        <div className="rounded-xl border border-emerald-900 bg-emerald-950/20 p-3 text-center"><p className="text-xl font-black text-emerald-300">{loading || error ? '—' : completed}</p><p className="text-[10px] uppercase text-gray-400">Completed</p></div>
      </div>
      <p className="mt-3 text-xs text-gray-500">Played needs all six KPI scores (1–5); saved Benched or Absent counts as complete. Coaches and managers are excluded. Historical counts use the current roster.</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by evaluation status">
        {filterButton('needs', 'Needs attention')}{filterButton('all', 'All matches')}{filterButton('complete', 'Completed')}
      </div>
      <label className="mt-3 block text-xs font-bold uppercase text-gray-400">Find match
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Opponent or date"
          className="mt-2 w-full rounded-lg border border-gray-700 bg-[#101010] px-3 py-2.5 text-sm font-normal text-white outline-none focus:border-accent" />
      </label>

      {error ? <p role="alert" className="mt-4 rounded-lg border border-red-800 bg-red-950/30 p-4 text-sm text-red-300">Unable to load evaluations: {error}. Check the KPI migration and RLS policies, then Refresh.</p>
        : loading ? <p role="status" className="mt-5 text-center text-sm text-gray-400">Loading match evaluations...</p>
        : matches.length === 0 ? <p className="mt-5 text-sm text-gray-400">No registered completed matches yet.</p>
        : visible.length === 0 ? <p className="mt-5 text-sm text-gray-400">No matches match this filter. Try All matches.</p>
        : <div className="mt-4 flex max-h-[780px] flex-col gap-3 overflow-y-auto pr-1">
          {visible.map(({ match, summary }) => {
            const percentage = summary.total ? Math.round(summary.completed * 100 / summary.total) : 0;
            const pending = summary.players.filter((player) => player.state !== 'complete');
            return (
              <article key={match.id} className="rounded-xl border border-gray-700 bg-[#111] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-gray-400">{match.match_date} · {match.match_type || 'Scrim'}</span>
                  <span className={'rounded-md border px-2 py-1 text-[10px] font-bold uppercase ' + badge[summary.status]}>{label[summary.status]}</span>
                </div>
                <h4 className="mt-2 text-sm font-black">DAG vs {match.opponent_name} <span className="text-gray-400">({match.dag_score ?? '—'}–{match.opponent_score ?? '—'})</span></h4>
                <div className="mt-3 flex justify-between text-xs font-semibold"><span>{summary.completed}/{summary.total} players evaluated</span><span className="text-gray-400">{percentage}%</span></div>
                <div role="progressbar" aria-label={'Evaluation progress for ' + match.opponent_name} aria-valuenow={summary.completed} aria-valuemin={0} aria-valuemax={Math.max(summary.total, 1)} className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-800">
                  <div className={'h-full rounded-full ' + (summary.status === 'complete' ? 'bg-emerald-500' : 'bg-accent')} style={{ width: percentage + '%' }} />
                </div>
                {pending.length > 0 && <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase text-amber-300">Needs attention ({pending.length})</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {pending.slice(0, 6).map((player) => <span key={player.ign} className="rounded-md border border-amber-900 bg-amber-950/20 px-2 py-1 text-[11px] text-amber-200">{player.ign}{player.state === 'needs-ratings' ? ' · Review' : ''}</span>)}
                    {pending.length > 6 && <span className="px-2 py-1 text-xs text-gray-400">+{pending.length - 6} more</span>}
                  </div>
                </div>}
                {summary.status === 'complete' && <p className="mt-3 text-xs text-emerald-300">All current players have completed assessments.</p>}
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" onClick={() => onEvaluate(match.id)} className="rounded-lg bg-accent px-3 py-2 text-xs font-black uppercase text-white hover:brightness-110">{summary.status === 'complete' ? 'View evaluations' : 'Continue evaluation'}</button>
                  <button type="button" onClick={() => onEdit(match)} className="rounded-lg border border-gray-600 px-3 py-2 text-xs font-bold hover:border-accent">Edit match</button>
                  <button type="button" onClick={() => onDelete(match.id)} className="rounded-lg border border-red-900 px-3 py-2 text-xs font-bold text-red-300 hover:bg-red-950/30">Delete</button>
                </div>
              </article>
            );
          })}
        </div>}
    </section>
  );
}
