"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { WEEKLY_METRICS, hasSixRatings, weightedScore, type WeeklyMetricKey } from '../../lib/weeklyKpi';
import { getAssessmentProgressState, isStaffMember } from '../../lib/matchEvaluationProgress';
import MobileKpiRating from './MobileKpiRating';

type Attendance = '' | 'played' | 'bench' | 'absent';
type ScoreField = WeeklyMetricKey;
type PlayerAssessment = {
  id?: number;
  status: Attendance;
  kills: string;
  deaths: string;
  assists: string;
  mechanics_score: number | null;
  macro_score: number | null;
  communication_score: number | null;
  role_execution_score: number | null;
  discipline_score: number | null;
  hero_pool_score: number | null;
  comment: string;
  absent_reason: string;
};

type RosterPlayer = { id: number; ign: string; role?: string };
type RegisteredMatch = {
  id: number; match_date: string; match_type?: string;
  opponent_name: string; dag_score?: number; opponent_score?: number; result?: string;
};
type Props = {
  activeTeam: string;
  roster: RosterPlayer[];
  matches: RegisteredMatch[];
  initialMatchId?: number | null;
};

const isStaff = isStaffMember;
const emptyAssessment = (): PlayerAssessment => ({
  status: '', kills: '0', deaths: '0', assists: '0',
  mechanics_score: null, macro_score: null, communication_score: null,
  role_execution_score: null, discipline_score: null, hero_pool_score: null,
  comment: '', absent_reason: '',
});
const inputClass = 'w-full rounded-lg border border-gray-700 bg-[#121212] px-4 py-3 text-white outline-none focus:border-accent';

export default function PlayerEvaluationPanel({ activeTeam, roster, matches, initialMatchId }: Props) {
  const [matchId, setMatchId] = useState<number | null>(initialMatchId ?? null);
  const [playerId, setPlayerId] = useState<number | null>(null);
  const [assessments, setAssessments] = useState<Record<number, PlayerAssessment>>({});
  const [loading, setLoading] = useState(initialMatchId != null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const loadVersion = useRef(0);
  const [savedAssessments, setSavedAssessments] = useState<Record<number, PlayerAssessment>>({});
  const feedbackRef = useRef<HTMLDivElement>(null);
  const formTopRef = useRef<HTMLDivElement>(null);

  const selectedMatch = matches.find((match) => match.id === matchId);
  const selectedPlayer = roster.find((player) => player.id === playerId);
  const assessment = selectedPlayer ? (assessments[selectedPlayer.id] || emptyAssessment()) : null;
  const trackedPlayers = roster.filter((player) => !isStaff(player));
  const dirtyPlayers = roster.filter((player) => JSON.stringify(assessments[player.id] || emptyAssessment()) !== JSON.stringify(savedAssessments[player.id] || emptyAssessment()));
  const hasUnsaved = dirtyPlayers.length > 0;
  const currentDirty = selectedPlayer ? dirtyPlayers.some((player) => player.id === selectedPlayer.id) : false;
  const validKpis = assessment ? WEEKLY_METRICS.filter((metric) => assessment[metric.key] != null).length : 0;
  const nextPlayer = trackedPlayers.find((player, index) => {
    const currentIndex = trackedPlayers.findIndex((item) => item.id === playerId);
    return index === currentIndex + 1;
  });
  const evaluatedCount = trackedPlayers.filter((player) =>
    assessments[player.id]?.id && getAssessmentProgressState(assessments[player.id]) === 'complete'
  ).length;

  const loadAssessments = useCallback(async (id: number) => {
    const request = ++loadVersion.current;
    const { data, error: loadError } = await supabase
      .from('match_player_stats').select('*').eq('match_id', id).order('id');
    if (request !== loadVersion.current) return;
    if (loadError) {
      setError('Could not load saved player assessments: ' + loadError.message);
      setLoading(false);
      return;
    }
    const states: Record<number, PlayerAssessment> = {};
    for (const row of data || []) {
      const member = roster.find((p) => p.ign === row.ign);
      if (!member) continue;
      const score = (field: ScoreField) => typeof row[field] === 'number' && row[field] >= 1 && row[field] <= 5 ? row[field] : null;
      states[member.id] = {
        id: row.id,
        status: row.status || 'played', // keep old attendance records legible
        kills: String(row.kills ?? 0),
        deaths: String(row.deaths ?? 0),
        assists: String(row.assists ?? 0),
        mechanics_score: score('mechanics_score'),
        macro_score: score('macro_score'),
        communication_score: score('communication_score'),
        role_execution_score: score('role_execution_score'),
        discipline_score: score('discipline_score'),
        hero_pool_score: score('hero_pool_score'),
        comment: row.coach_comment || '',
        absent_reason: row.absent_reason || '',
      };
    }
    setAssessments(states);
    setSavedAssessments(structuredClone(states));
    setLoading(false);
  }, [roster]);

  useEffect(() => {
    // Start the async read after commit; don't synchronously set state from an effect.
    if (matchId !== null) void Promise.resolve().then(() => loadAssessments(matchId));
  }, [matchId, loadAssessments]);

  function selectMatch(id: number) {
    if (saving || id === matchId) return;
    if (hasUnsaved && !window.confirm('You have unsaved player ratings for this match. Switch matches and discard them?')) return;
    setMatchId(id);
    setPlayerId(null);
    setAssessments({});
    setSavedAssessments({});
    setLoading(true);
    setNotice('');
    setError('');
  }

  function update(field: keyof PlayerAssessment, value: string | number | null) {
    if (!selectedPlayer || saving) return;
    setAssessments((previous) => ({
      ...previous,
      [selectedPlayer.id]: { ...(previous[selectedPlayer.id] || emptyAssessment()), [field]: value },
    }));
    setNotice('');
  }

  async function savePlayerAssessment(advance = false) {
    if (!selectedMatch || !selectedPlayer || !assessment) return;
    setError('');
    setNotice('');
    if (!assessment.status) { setError('Choose Played, Benched or Absent before saving.'); return; }
    if (assessment.status === 'absent' && !assessment.absent_reason.trim()) {
      setError('Please enter a reason when the player is absent.'); return;
    }
    if (assessment.status === 'played' && !isStaff(selectedPlayer) && !hasSixRatings(assessment)) {
      setError('Set all six coach-assessed ratings from 1 to 5 for this player.'); return;
    }
    const kdaRaw = [assessment.kills, assessment.deaths, assessment.assists];
    const kda = kdaRaw.map(Number);
    if (assessment.status === 'played' && !isStaff(selectedPlayer) &&
      (kdaRaw.some((v) => !v.trim()) || kda.some((n) => !Number.isInteger(n) || n < 0))) {
      setError('Kills, deaths and assists must be non-negative whole numbers.'); return;
    }
    setSaving(true);
    try {
      const schemaCheck = await supabase.from('match_player_stats')
        .select('mechanics_score,communication_score,role_execution_score,discipline_score,hero_pool_score')
        .limit(0);
      if (schemaCheck.error) throw new Error('Run the existing 05 match-KPI migration first: ' + schemaCheck.error.message);

      const playedAndRated = assessment.status === 'played' && !isStaff(selectedPlayer);
      const payload = {
        match_id: selectedMatch.id,
        ign: selectedPlayer.ign,
        status: assessment.status,
        kills: playedAndRated ? kda[0] : 0,
        deaths: playedAndRated ? kda[1] : 0,
        assists: playedAndRated ? kda[2] : 0,
        mechanics_score: playedAndRated ? assessment.mechanics_score : null,
        macro_score: playedAndRated ? assessment.macro_score : 0, // legacy schema may require non-null macro
        communication_score: playedAndRated ? assessment.communication_score : null,
        role_execution_score: playedAndRated ? assessment.role_execution_score : null,
        discipline_score: playedAndRated ? assessment.discipline_score : null,
        hero_pool_score: playedAndRated ? assessment.hero_pool_score : null,
        coach_comment: assessment.status === 'absent' ? null : assessment.comment.trim() || null,
        absent_reason: assessment.status === 'absent' ? assessment.absent_reason.trim() : null,
      };
      let savedId = assessment.id;
      if (assessment.id != null) {
        const { data, error: updateError } = await supabase
          .from('match_player_stats').update(payload).eq('id', assessment.id).select('id');
        if (updateError) throw updateError;
        if (!data?.length) throw new Error('No rows updated. Verify the approved account and RLS rules.');
      } else {
        // Legacy required columns are inserted only on NEW rows; old KPI history is never overwritten.
        const { data, error: insertError } = await supabase.from('match_player_stats')
          .insert({ ...payload, micro_score: 0, kda_score: 0, mentality_score: 0 })
          .select('id').single();
        if (insertError) throw insertError;
        savedId = data.id;
        setAssessments((prev) => ({ ...prev, [selectedPlayer.id]: { ...assessment, id: data.id } }));
      }
      setSavedAssessments((prev) => ({ ...prev, [selectedPlayer.id]: { ...assessment, id: savedId } }));
      setNotice(`${selectedPlayer.ign} saved for ${selectedMatch.opponent_name}. The public weekly chart will reflect the assessment.`);
      if (advance && nextPlayer) {
        setPlayerId(nextPlayer.id);
        formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save player evaluation.');
    } finally { setSaving(false); }
  }

  async function removeAssessment() {
    if (!selectedPlayer || !assessment?.id || saving) return;
    if (!confirm(`Remove ${selectedPlayer.ign}'s participation record for this match?`)) return;
    setSaving(true);
    const { error: deleteError } = await supabase.from('match_player_stats').delete().eq('id', assessment.id);
    setSaving(false);
    if (deleteError) { setError(deleteError.message); return; }
    setAssessments((prev) => ({ ...prev, [selectedPlayer.id]: emptyAssessment() }));
    setSavedAssessments((prev) => ({ ...prev, [selectedPlayer.id]: emptyAssessment() }));
    setNotice('Participation record removed.');
  }

  // Native navigation guards protect against accidental browser refresh or tab close.
  // Switching matches also asks for confirmation when unsaved edits exist.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!hasUnsaved) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsaved]);

  return (
    <div className="animate-fadeIn space-y-4 pb-24 sm:space-y-7 sm:pb-2">
      <div className="rounded-2xl border border-accent/40 bg-gradient-to-r from-[#24101c] to-[#151014] p-6 md:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Coach workspace · {activeTeam}</p>
        <h2 className="mt-2 text-2xl md:text-3xl font-black uppercase">Player Evaluation</h2>
        <p className="mt-2 max-w-3xl text-sm text-gray-300">Choose a completed match and player, then rate the six 1–5 KPIs. Large tap controls, progress indicators and Save &amp; Next make evaluations easier on your phone. Only saved match evaluations contribute to the weekly graph.</p>
        {hasUnsaved && <p role="status" className="mt-3 rounded-lg border border-amber-800 bg-amber-950/30 px-3 py-2 text-xs font-bold text-amber-200">{dirtyPlayers.length} player draft{dirtyPlayers.length === 1 ? '' : 's'} not saved. Save each edited player before leaving this match.</p>}
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:gap-6">
        <div className="rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-4 xl:hidden">
          <label htmlFor="mobile-evaluation-match" className="block text-xs font-black uppercase tracking-wide text-accent">1. Select completed match</label>
          <select id="mobile-evaluation-match" value={matchId ?? ''} disabled={saving}
            onChange={(e) => { if (e.target.value) selectMatch(Number(e.target.value)); }}
            className={inputClass + ' mt-2 min-h-12 text-base'}>
            <option value="">Choose a completed match</option>
            {matches.map((m) => <option key={m.id} value={m.id}>{m.match_date} · DAG vs {m.opponent_name}</option>)}
          </select>
          {selectedMatch && <p className="mt-2 text-xs text-gray-400">{selectedMatch.match_type || 'Scrim'} · DAG {selectedMatch.dag_score}–{selectedMatch.opponent_score} · {selectedMatch.result}</p>}
        </div>
        <aside className="hidden h-fit rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-5 xl:block">
          <h3 className="mb-1 text-sm font-black uppercase tracking-wider text-accent">1. Registered matches</h3>
          <p className="mb-4 text-xs text-gray-500">Only matches saved in Match Log are eligible.</p>
          <div className="flex max-h-[580px] flex-col gap-2 overflow-y-auto pr-1">
            {matches.length === 0 && <p className="rounded-lg border border-dashed border-gray-700 p-4 text-sm text-gray-400">No completed matches yet. Register a completed match in Match Log first.</p>}
            {matches.map((match) => (
              <button type="button" key={match.id} onClick={() => selectMatch(match.id)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${matchId === match.id ? 'border-accent bg-accent/10' : 'border-gray-800 bg-[#111] hover:border-gray-500'}`}>
                <span className="text-xs text-gray-400">{match.match_date} · {match.match_type || 'Scrim'}</span>
                <span className="mt-1 block font-bold">DAG vs {match.opponent_name}</span>
                <span className="mt-1 block text-xs text-gray-400">{match.dag_score}–{match.opponent_score} · {match.result}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          {!selectedMatch ? (
            <div className="flex min-h-[350px] items-center justify-center rounded-2xl border border-dashed border-gray-700 bg-[#141414]/80 p-10 text-center text-gray-400">Select a completed match on the left to open its player evaluations.</div>
          ) : (
            <>
              <div ref={formTopRef} className="scroll-mt-5 rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-4 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-accent">2. Select player</p>
                <h3 className="mt-1 text-xl font-black">DAG vs {selectedMatch.opponent_name}</h3>
                <p className="mt-1 text-sm text-gray-400">{selectedMatch.match_date} · {selectedMatch.match_type || 'Scrim'}</p>
                {!loading && trackedPlayers.length > 0 && (
                  <div className="mt-4 rounded-xl border border-gray-700 bg-black/25 p-3" role="status">
                    <div className="flex items-center justify-between gap-3 text-sm font-bold">
                      <span>Evaluation progress</span>
                      <span className={evaluatedCount === trackedPlayers.length ? 'text-emerald-300' : 'text-accent'}>{evaluatedCount}/{trackedPlayers.length} players</span>
                    </div>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-gray-800" aria-label="Match evaluation progress">
                      <div className={`h-full rounded-full ${evaluatedCount === trackedPlayers.length ? 'bg-emerald-500' : 'bg-accent'}`}
                        style={{ width: `${Math.round(evaluatedCount / trackedPlayers.length * 100)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-gray-400">Played = all six ratings saved. Benched / Absent = participation saved. Staff attendance is not included in this count.</p>
                  </div>
                )}
                <p className="mt-4 text-xs text-gray-400 sm:hidden">Swipe sideways to choose the next player.</p>
                <div className="mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 sm:mt-4 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0 lg:grid-cols-4">
                  {roster.map((player) => {
                    const savedRecord = assessments[player.id];
                    const saved = Boolean(savedRecord?.id);
                    const complete = saved && (isStaff(player) || getAssessmentProgressState(savedRecord) === 'complete');
                    return <button type="button" key={player.id} onClick={() => { setPlayerId(player.id); setNotice(''); setError(''); }}
                      disabled={saving} aria-pressed={playerId === player.id}
                      className={`min-h-16 w-40 shrink-0 snap-start rounded-xl border px-3 py-3 text-left transition-colors disabled:opacity-50 sm:w-auto sm:shrink ${playerId === player.id ? 'border-accent bg-accent/15' : 'border-gray-700 bg-[#101010] hover:border-gray-500'}`}>
                      <span className="block truncate text-sm font-bold">{player.ign}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-gray-400">{player.role}</span>
                      <span className={`mt-1 block text-[11px] ${complete ? 'text-emerald-400' : saved ? 'text-amber-300' : 'text-gray-500'}`}>
                        {dirtyPlayers.some((p) => p.id === player.id) ? '● Unsaved' : complete ? '● Complete' : saved ? '◐ Needs review' : '○ Not recorded'}
                      </span>
                    </button>;
                  })}
                </div>
              </div>

              {loading ? <div className="rounded-2xl border border-gray-700 p-8 text-center text-gray-400">Loading existing evaluations...</div> : !selectedPlayer || !assessment ? (
                <div className="rounded-2xl border border-dashed border-gray-700 p-8 text-center text-gray-400">Choose a player above to show the spacious evaluation form.</div>
              ) : (
                <div className="min-w-0 rounded-2xl border border-accent/50 bg-[#19141a] p-4 shadow-xl sm:p-6 lg:p-8">
                  <div className="mb-5 flex flex-col justify-between gap-4 border-b border-gray-700 pb-4 sm:flex-row sm:items-start">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-accent">3. Rate this player</p>
                      <h3 className="mt-1 text-2xl font-black">{selectedPlayer.ign} <span className="text-base font-medium text-accent">({selectedPlayer.role})</span></h3>
                      <p className="mt-1 text-xs text-gray-400">{assessment.id ? 'Edit saved assessment' : 'New match assessment'} · {currentDirty ? 'Unsaved changes' : assessment.id ? 'Saved' : 'Not saved'}</p>
                      {assessment.status === 'played' && !isStaff(selectedPlayer) && <p className="mt-2 text-xs font-bold text-accent">{validKpis}/6 KPI ratings selected</p>}
                    </div>
                    <label className="block min-w-[175px] text-xs font-bold text-gray-300">Attendance status
                      <select value={assessment.status} disabled={saving} onChange={(e) => update('status', e.target.value)} className={`${inputClass} mt-2 min-h-12 text-base`}>
                        <option value="">Select status</option>
                        <option value="played">{isStaff(selectedPlayer) ? 'Present' : 'Played'}</option>
                        {!isStaff(selectedPlayer) && <option value="bench">Benched</option>}
                        <option value="absent">Absent</option>
                      </select>
                    </label>
                  </div>

                  {assessment.status === 'played' && !isStaff(selectedPlayer) && (
                    <div className="space-y-6">
                      <div>
                        <p className="mb-3 text-sm font-black uppercase tracking-wider text-gray-200">Match K / D / A</p>
                        <div className="grid grid-cols-3 gap-3">
                          {(['kills', 'deaths', 'assists'] as const).map((field) => (
                            <label key={field} className="text-xs font-bold uppercase tracking-wider text-gray-400">{field}
                              <input type="number" min="0" step="1" value={assessment[field]} onChange={(e) => update(field, e.target.value)} disabled={saving} inputMode="numeric" className={`${inputClass} mt-2 min-h-12 text-center text-lg font-bold`} />
                            </label>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                          <div><h4 className="text-lg font-black uppercase">Six Coach-Assessed KPIs</h4><p className="text-xs text-gray-400">Move the sliders or tap a numbered rating. Every metric must be scored intentionally.</p></div>
                          <span aria-live="polite" className="rounded-lg bg-accent/10 px-3 py-2 text-sm font-bold text-accent">{hasSixRatings(assessment) ? `Weighted: ${weightedScore(assessment).toFixed(2)} / 5` : `${validKpis} of 6 rated`}</span>
                        </div>
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4">
                          {WEEKLY_METRICS.map((metric, index) => (
                            <MobileKpiRating key={metric.key}
                              id={`slider-${selectedMatch.id}-${selectedPlayer.id}-${metric.key}`}
                              label={metric.label} field={metric.key} weight={metric.weight}
                              index={index + 1} score={assessment[metric.key]}
                              onScore={update} disabled={saving} />
                          ))}
                        </div>
                      </div>
                      <label className="block text-sm font-bold text-gray-300">Match-specific coach feedback (optional)
                        <textarea value={assessment.comment} onChange={(e) => update('comment', e.target.value)} rows={3} placeholder="How did the player perform in this particular match?" disabled={saving} className={`${inputClass} mt-2 min-h-24 resize-y`} />
                      </label>
                    </div>
                  )}

                  {assessment.status === 'bench' && <label className="block text-sm font-bold text-gray-300">Bench notes (optional)
                    <textarea rows={3} value={assessment.comment} onChange={(e) => update('comment', e.target.value)} disabled={saving} className={`${inputClass} mt-2 min-h-24`} placeholder="Why was this player benched?" />
                  </label>}
                  {assessment.status === 'absent' && <label className="block text-sm font-bold text-red-300">Absence reason *
                    <textarea rows={3} value={assessment.absent_reason} onChange={(e) => update('absent_reason', e.target.value)} disabled={saving} className={`${inputClass} mt-2 min-h-24 border-red-800`} placeholder="Reason for absence" />
                  </label>}
                  {assessment.status === 'played' && isStaff(selectedPlayer) && <p className="rounded-lg border border-yellow-900 bg-yellow-950/20 p-4 text-sm text-yellow-200">Coach / manager attendance is recorded as Present. Staff are not given player KPI scores.</p>}
                  {!assessment.status && <p className="text-sm text-gray-400">Select an attendance status above to begin.</p>}

                  <div ref={feedbackRef}>
                    {error && <p role="alert" className="mt-5 rounded-lg border border-red-700 bg-red-950/30 p-3 text-sm text-red-300">{error}</p>}
                    {notice && <p role="status" className="mt-5 rounded-lg border border-green-700 bg-green-950/30 p-3 text-sm text-green-300">{notice}</p>}
                  </div>
                  <div className="mt-6 hidden flex-wrap gap-3 sm:flex">
                    <button type="button" onClick={() => { void savePlayerAssessment(); }} disabled={saving || loading || !currentDirty}
                      className="min-h-12 rounded-xl bg-accent px-7 py-3 font-black uppercase text-white hover:brightness-110 disabled:opacity-50">{saving ? 'Saving...' : assessment.id ? 'Update Player Evaluation' : 'Save Player Evaluation'}</button>
                    {nextPlayer && <button type="button" onClick={() => { void savePlayerAssessment(true); }} disabled={saving || loading}
                      className="min-h-12 rounded-xl border border-accent/70 px-5 py-3 text-sm font-black text-accent hover:bg-accent/10 disabled:opacity-50">Save &amp; Next Player</button>}
                    {assessment.id && <button type="button" onClick={removeAssessment} disabled={saving} className="rounded-xl border border-red-800 px-5 py-3 text-sm font-bold text-red-300 hover:bg-red-950/30">Remove participation record</button>}
                  </div>
                  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-accent/40 bg-[#130d13]/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_28px_rgba(0,0,0,0.5)] backdrop-blur sm:hidden">
                    <div className="mx-auto flex max-w-lg items-center gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-white">{selectedPlayer.ign}</p>
                        <p className="text-[11px] text-gray-400">{assessment.status === 'played' && !isStaff(selectedPlayer) ? `${validKpis}/6 KPIs` : assessment.status || 'Select status'} · {currentDirty ? 'Unsaved' : 'Saved'}</p>
                      </div>
                      <button type="button" disabled={saving || loading || !currentDirty} onClick={() => { void savePlayerAssessment(); }}
                        className="min-h-12 rounded-xl bg-accent px-4 text-xs font-black uppercase text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
                      {nextPlayer && <button type="button" disabled={saving || loading} onClick={() => { void savePlayerAssessment(true); }}
                        className="min-h-12 rounded-xl border border-accent/60 px-3 text-xs font-black text-accent disabled:opacity-50">Save &amp; Next</button>}
                    </div>
                  </div>
                </div>
              )}
              {error && (!selectedPlayer || !assessment) && <p role="alert" className="text-sm text-red-300">{error}</p>}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
