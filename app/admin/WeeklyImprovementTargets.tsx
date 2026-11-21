'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatWeek, WEEKLY_METRICS, weekStartOf, weeklyReviewsFromMatches, type WeeklyMetricKey, type WeeklyReview } from '../../lib/weeklyKpi';
import { isValidTarget, nextWeekOf, progressForWeek, type ImprovementTarget } from '../../lib/improvementTargets';

type Props = {
  activeTeam: string;
  playerId: number | null;
  playerIgn: string;
  reportWeek: string;
  canManage: boolean;
};
const field = 'w-full rounded-lg border border-gray-700 bg-[#101010] px-3 py-2 text-sm text-white outline-none focus:border-accent';
const roles = ['owner', 'manager', 'coach'];

export default function WeeklyImprovementTargets({ activeTeam, playerId, playerIgn, reportWeek, canManage }: Props) {
  const [targets, setTargets] = useState<ImprovementTarget[]>([]);
  const [reviews, setReviews] = useState<WeeklyReview[]>([]);
  const [metric, setMetric] = useState<WeeklyMetricKey>('macro_score');
  const [score, setScore] = useState('4');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  const targetWeek = useMemo(() => {
    try { return reportWeek ? nextWeekOf(reportWeek) : ''; }
    catch { return ''; }
  }, [reportWeek]);

  const selected = targets.find((t) => t.metric_key === metric);
  const progress = progressForWeek(targets, reviews, targetWeek);

  useEffect(() => {
    let cancelled = false;
    setTargets([]);
    setReviews([]);
    setError('');
    setNotice('');
    async function load() {
      if (playerId == null || !targetWeek || !playerIgn) return;
      setBusy(true);
      const { data, error: targetError } = await supabase.from('weekly_player_targets')
        .select('id,player_id,team,week_start,metric_key,target_score,focus_note,created_at,updated_at')
        .eq('player_id', playerId).eq('team', activeTeam).eq('week_start', targetWeek)
        .order('metric_key', { ascending: true });
      if (cancelled) return;
      if (targetError) {
        setBusy(false);
        setError('Could not load improvement targets. Run the new Supabase migration first: ' + targetError.message);
        return;
      }
      setTargets((data || []) as ImprovementTarget[]);
      const end = new Date(targetWeek + 'T12:00:00Z');
      end.setUTCDate(end.getUTCDate() + 7);
      const endExclusive = end.toISOString().slice(0, 10);
      const { data: matches, error: matchError } = await supabase.from('matches')
        .select('id,match_date')
        .eq('team', activeTeam).eq('status', 'completed')
        .gte('match_date', targetWeek).lt('match_date', endExclusive);
      if (cancelled) return;
      if (matchError) { setError('Could not verify weekly KPI progress: ' + matchError.message); setBusy(false); return; }
      const matchDates: Record<number, string> = Object.fromEntries((matches || []).map((m) => [m.id, m.match_date]));
      const matchIds = (matches || []).map((m) => m.id);
      const assessments: Array<Record<string, unknown> & { match_id: number; id: number }> = [];
      for (let batchIndex = 0; batchIndex < matchIds.length; batchIndex += 40) {
        let offset = 0;
        while (true) {
          const { data: rows, error: statsError } = await supabase.from('public_match_player_stats')
            .select('id,match_id,ign,status,mechanics_score,macro_score,communication_score,role_execution_score,discipline_score,hero_pool_score')
            .in('match_id', matchIds.slice(batchIndex, batchIndex + 40))
            .eq('ign', playerIgn).order('id', { ascending: true }).range(offset, offset + 999);
          if (cancelled) return;
          if (statsError) { setError('Could not read KPI ratings: ' + statsError.message); setBusy(false); return; }
          assessments.push(...((rows || []) as typeof assessments));
          if (!rows || rows.length < 1000) break;
          offset += 1000;
        }
      }
      // Latest row wins if older imports accidentally duplicated a player/match.
      const latest = new Map<number, typeof assessments[number]>();
      for (const row of assessments) {
        const prior = latest.get(row.match_id);
        if (!prior || row.id > prior.id) latest.set(row.match_id, row);
      }
      const normalized = [...latest.values()].map((row) => ({ ...row, match_id: row.match_id }));
      setReviews(weeklyReviewsFromMatches(normalized as any, matchDates, playerId, activeTeam));
      setBusy(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [playerId, playerIgn, targetWeek, activeTeam, version]);

  useEffect(() => {
    setMetric('macro_score');
    setScore('4');
    setNote('');
  }, [playerId, targetWeek]);

  useEffect(() => {
    setScore(selected ? String(selected.target_score) : '4');
    setNote(selected?.focus_note || '');
  }, [selected?.id, metric, targetWeek]);

  async function save() {
    if (!canManage || !playerId || !targetWeek) return;
    const value = Number(score);
    if (!isValidTarget(value)) { setError('Choose a target between 1.0 and 5.0, in 0.1 steps.'); return; }
    if (note.length > 300) { setError('The focus note must be 300 characters or shorter.'); return; }
    setSaving(true); setError(''); setNotice('');
    const { data: role, error: roleError } = await supabase.rpc('my_management_role');
    if (roleError || !roles.includes(String(role))) {
      setError('Your account does not have permission to save targets.');
      setSaving(false);
      return;
    }
    const { error: saveError } = await supabase.from('weekly_player_targets').upsert({
      player_id: playerId, team: activeTeam, week_start: targetWeek,
      metric_key: metric, target_score: value, focus_note: note.trim() || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'player_id,week_start,metric_key' });
    setSaving(false);
    if (saveError) { setError('Save failed: ' + saveError.message); return; }
    setNotice('Weekly target saved. It will appear with the public KPI graph and coach reports.');
    setVersion((v) => v + 1);
  }

  async function remove() {
    if (!canManage || !selected || !confirm('Delete this weekly improvement target?')) return;
    setSaving(true); setError(''); setNotice('');
    const { error: deletionError } = await supabase.from('weekly_player_targets')
      .delete().eq('id', selected.id);
    setSaving(false);
    if (deletionError) { setError('Could not delete target: ' + deletionError.message); return; }
    setNotice('Weekly target deleted.');
    setVersion((v) => v + 1);
  }

  return (
    <section className="mt-7 rounded-xl border border-accent/40 bg-black/25 p-5" aria-labelledby="target-panel-title">
      <h4 id="target-panel-title" className="text-base font-black uppercase text-accent">Player Improvement Targets</h4>
      <p className="mt-2 text-xs text-gray-400">
        Connected to the report for week of {reportWeek ? formatWeek(reportWeek) : '—'}.
        Set KPI goals for <strong className="text-white">the following week, {targetWeek ? formatWeek(targetWeek) : '—'}</strong>.
        Progress comes automatically from completed match ratings, never manually entered results.
      </p>
      {!playerId ? <p className="mt-4 text-sm text-gray-400">Select a player above to set individual targets.</p> :
        busy ? <p role="status" className="mt-4 text-sm text-gray-400">Loading targets and assessed scores...</p> : <>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-gray-400">KPI to improve
              <select className={field + ' mt-2'} value={metric} onChange={(e) => setMetric(e.target.value as WeeklyMetricKey)}>
                {WEEKLY_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </label>
            <label className="text-xs font-bold text-gray-400">Target score / 5
              <input className={field + ' mt-2'} type="number" min="1" max="5" step="0.1"
                value={score} onChange={(e) => setScore(e.target.value)} />
            </label>
          </div>
          <label className="mt-3 block text-xs font-bold text-gray-400">Specific coaching action (public, optional)
            <textarea className={field + ' mt-2'} rows={2} maxLength={300}
              placeholder="e.g. Practice objective rotations and callouts every scrim."
              value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { void save(); }} disabled={saving || !canManage}
              className="rounded-lg bg-accent px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
              {saving ? 'Saving...' : selected ? 'Update KPI Target' : 'Save KPI Target'}
            </button>
            {selected && <button type="button" onClick={() => { void remove(); }} disabled={saving || !canManage}
              className="rounded-lg border border-red-700 px-4 py-2.5 text-xs font-bold text-red-300 disabled:opacity-50">Delete Target</button>}
          </div>
          {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
          {notice && <p role="status" className="mt-3 text-sm text-green-300">{notice}</p>}
          <div className="mt-5 border-t border-gray-700 pt-4">
            <p className="text-sm font-black uppercase text-white">Target progress for week of {formatWeek(targetWeek)}</p>
            <p className="mt-1 text-xs text-gray-400">{progress.achieved} achieved · {progress.below} below target · {progress.unassessed} not assessed</p>
            {progress.targets.length === 0 ? <p className="mt-3 text-sm text-gray-500">No KPI targets saved for this week.</p> :
              <div className="mt-3 space-y-2">
                {progress.targets.map((target) => <div key={target.id} className="rounded-lg border border-gray-700 bg-[#151515] px-3 py-3 text-xs">
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-bold text-white">{target.metric_label}</span>
                    <span className={target.status === 'achieved' ? 'text-green-300' : target.status === 'below-target' ? 'text-amber-300' : 'text-gray-400'}>
                      {target.status === 'achieved' ? 'Achieved' : target.status === 'below-target' ? 'Below target' : 'Not assessed'}
                    </span>
                  </div>
                  <p className="mt-1 text-gray-300">Goal {Number(target.target_score).toFixed(1)} / 5 · Actual {target.actual == null ? '—' : target.actual.toFixed(2) + ' / 5'}</p>
                  {target.focus_note && <p className="mt-2 whitespace-pre-wrap break-words text-gray-400">{target.focus_note}</p>}
                </div>)}
              </div>}
          </div>
        </>}
    </section>
  );
}
