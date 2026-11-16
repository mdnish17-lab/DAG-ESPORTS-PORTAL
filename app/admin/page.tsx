"use client";

import Link from 'next/link';
import SiteDecor from '../../lib/SiteDecor';
import { getTeamTheme, themeStyle } from '../../lib/teamTheme';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

// status: '' = not involved (no row), 'played', 'bench', 'absent'
type PlayerMatchState = {
  status: '' | 'played' | 'bench' | 'absent';
  kills: string;
  deaths: string;
  assists: string;
  macro: number;
  micro: number;
  kda_score: number;
  mentality: number;
  comment: string;       // coach feedback for played / bench
  absent_reason: string; // reason why absent
};

const ROLES = ['Coach', 'Manager', 'Midlaner', 'Jungler', 'Roamer', 'Goldlaner', 'Explaner'];
const TEAMS = ['DAG Ladies', 'DAG Montrix'];
const MATCH_TYPES = ['Scrim', 'Tournament', 'Scrim Bracket'];
const TABS = ['Guide', 'Roster', 'Matches', 'Upcoming', 'Achievements'] as const;

// "18:30:00" -> "6:30 PM"
const formatTime = (t: string) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = Number(h);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

// Age calculated from date of birth (YYYY-MM-DD)
const calcAge = (dob: string): number | null => {
  if (!dob) return null;
  const d = new Date(dob);
  if (isNaN(d.getTime())) return null;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  const m = t.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < d.getDate())) a--;
  return a >= 0 ? a : null;
};

// Throws a readable error if a Supabase call failed
function check(res: { error: any }, label: string) {
  if (res.error) throw new Error(`${label}: ${res.error.message} (${res.error.code ?? ''})`);
}

export default function AdminPage() {
  const [activeTeam, setActiveTeamState] = useState<string>('DAG Ladies');
  const [teamReady, setTeamReady] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('dag-active-team');
    if (saved && TEAMS.includes(saved)) setActiveTeamState(saved);
    setTeamReady(true);
  }, []);
  const setActiveTeam = (team: string) => { setActiveTeamState(team); localStorage.setItem('dag-active-team', team); };
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Guide');

  const [roster, setRoster] = useState<any[]>([]);
  const [allMatches, setAllMatches] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [addingPlayer, setAddingPlayer] = useState(false);

  // --- Completed Match Form State ---
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);
  const [matchDate, setMatchDate] = useState('');
  const [matchType, setMatchType] = useState('Scrim');
  const [opponentName, setOpponentName] = useState('');
  const [opponentLogo, setOpponentLogo] = useState('');
  const [dagScore, setDagScore] = useState('0');
  const [oppScore, setOppScore] = useState('0');
  const [matchReview, setMatchReview] = useState('');
  const [matchScreenshots, setMatchScreenshots] = useState(''); // one image URL per line
  const [playerMatch, setPlayerMatch] = useState<Record<number, PlayerMatchState>>({});

  // --- Upcoming Match Form State ---
  const [upDate, setUpDate] = useState('');
  const [upTime, setUpTime] = useState('');
  const [upMatchType, setUpMatchType] = useState('Scrim');
  const [upOpponent, setUpOpponent] = useState('');
  const [upLogo, setUpLogo] = useState('');

  // --- New Player Form State ---
  const [newIgn, setNewIgn] = useState('');
  const [newRole, setNewRole] = useState('Midlaner');
  const [newMainHero, setNewMainHero] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newAge, setNewAge] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newMlbbId, setNewMlbbId] = useState('');
  const [newServer, setNewServer] = useState('');
  const [newStay, setNewStay] = useState('');
  const [newAchievements, setNewAchievements] = useState('');

  // --- Achievement Form State ---
  const [achDate, setAchDate] = useState('');
  const [achPlacement, setAchPlacement] = useState('');
  const [achTournament, setAchTournament] = useState('');
  const [achVenue, setAchVenue] = useState('');
  const [achImage, setAchImage] = useState('');

  // --- Edit Player Form State ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    ign: '', role: 'Midlaner', main_hero: '', image_url: '',
    full_name: '', age: '', stay: '', achievements: '',
    date_of_birth: '', mlbb_id: '', mlbb_server: '',
  });

  useEffect(() => {
    if (teamReady) loadData();
  }, [activeTeam, teamReady]);

  function initPlayerMatch(players: any[]) {
    const init: Record<number, PlayerMatchState> = {};
    players.forEach((p: any) => {
      init[p.id] = {
        status: '', kills: '0', deaths: '0', assists: '0',
        macro: 3, micro: 3, kda_score: 3, mentality: 3,
        comment: '', absent_reason: '',
      };
    });
    return init;
  }

  async function loadData() {
    const { data: players, error: pErr } = await supabase.from('players').select('*').eq('team', activeTeam).order('id');
    if (pErr) console.error('Players error:', pErr);
    setRoster(players || []);
    setPlayerMatch(initPlayerMatch(players || []));

    const { data: matches, error: mErr } = await supabase
      .from('matches')
      .select('*')
      .eq('team', activeTeam)
      .order('match_date', { ascending: false });
    if (mErr) console.error('Matches error:', mErr);
    if (matches) {
      const today = new Date().toISOString().split('T')[0];
      const needsTransfer = matches.filter((m) => m.status === 'upcoming' && m.match_date < today);
      if (needsTransfer.length > 0) {
        for (const m of needsTransfer) {
          const { error } = await supabase.from('matches').update({ status: 'completed', result: 'DRAW' }).eq('id', m.id);
          if (error) console.error('Auto-transfer error:', error);
        }
        const { data: refreshed } = await supabase
          .from('matches')
          .select('*')
          .eq('team', activeTeam)
          .order('match_date', { ascending: false });
        setAllMatches(refreshed || []);
      } else {
        setAllMatches(matches);
      }
    } else {
      setAllMatches([]);
    }

    const { data: ach, error: aErr } = await supabase
      .from('team_achievements')
      .select('*')
      .eq('team', activeTeam)
      .order('date', { ascending: false });
    if (aErr) console.error('Achievements error:', aErr);
    setAchievements(ach || []);

  }

  const completedMatches = allMatches.filter((m) => m.status === 'completed');
  const upcomingMatchesList = allMatches.filter((m) => m.status === 'upcoming');

  const result = (() => {
    const d = Number(dagScore), o = Number(oppScore);
    if (d > o) return 'WIN';
    if (d < o) return 'LOSS';
    return 'DRAW';
  })();

  function updatePlayerMatch(id: number, field: keyof PlayerMatchState, value: any) {
    setPlayerMatch((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  }

  async function handleSaveMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!matchDate || !opponentName.trim()) { alert('Fill date and opponent.'); return; }

    const involvedPlayers = roster.filter((p) => playerMatch[p.id]?.status !== '');
    setSubmitting(true);

    try {
      const matchPayload = {
        team: activeTeam,
        status: 'completed',
        match_type: matchType,
        match_date: matchDate,
        opponent_name: opponentName.trim(),
        opponent_logo: opponentLogo.trim() || null,
        dag_score: Number(dagScore) || 0,
        opponent_score: Number(oppScore) || 0,
        result: result,
        match_review: matchReview.trim() || null,
        result_screenshots: matchScreenshots.trim() || null,
      };

      let matchId = editingMatchId;

      if (editingMatchId) {
        const upd = await supabase.from('matches').update(matchPayload).eq('id', editingMatchId).select();
        check(upd, 'Update match');
        if (!upd.data || upd.data.length === 0) throw new Error('Update blocked (no rows changed) - check RLS policies');
        check(await supabase.from('match_player_stats').delete().eq('match_id', editingMatchId), 'Delete old stats');
      } else {
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .insert(matchPayload)
          .select('id')
          .single();
        if (matchError) throw matchError;
        matchId = matchData.id;
      }

      if (involvedPlayers.length > 0) {
        const statsRows = involvedPlayers.map((p) => {
          const s = playerMatch[p.id];
          const isPlayed = s.status === 'played';
          return {
            match_id: matchId,
            ign: p.ign,
            status: s.status, // 'played' | 'bench' | 'absent'
            kills: isPlayed ? Number(s.kills) || 0 : 0,
            deaths: isPlayed ? Number(s.deaths) || 0 : 0,
            assists: isPlayed ? Number(s.assists) || 0 : 0,
            macro_score: isPlayed ? s.macro : 0,
            micro_score: isPlayed ? s.micro : 0,
            kda_score: isPlayed ? s.kda_score : 0,
            mentality_score: isPlayed ? s.mentality : 0,
            coach_comment: s.status === 'absent' ? null : s.comment.trim() || null,
            absent_reason: s.status === 'absent' ? s.absent_reason.trim() || null : null,
          };
        });
        check(await supabase.from('match_player_stats').insert(statsRows), 'Save player stats');
      }

      alert(editingMatchId ? 'Match updated successfully!' : 'Match saved successfully!');
      resetMatchForm();
      loadData();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function resetMatchForm() {
    setEditingMatchId(null);
    setMatchDate(''); setMatchType('Scrim'); setOpponentName(''); setOpponentLogo('');
    setDagScore('0'); setOppScore('0'); setMatchReview(''); setMatchScreenshots('');
    setPlayerMatch(initPlayerMatch(roster));
  }

  async function startEditMatch(m: any) {
    setEditingMatchId(m.id);
    setMatchDate(m.match_date);
    setMatchType(m.match_type || 'Scrim');
    setOpponentName(m.opponent_name);
    setOpponentLogo(m.opponent_logo || '');
    setDagScore(String(m.dag_score ?? 0));
    setOppScore(String(m.opponent_score ?? 0));
    setMatchReview(m.match_review || '');
    setMatchScreenshots(m.result_screenshots || '');

    const { data: stats, error } = await supabase.from('match_player_stats').select('*').eq('match_id', m.id);
    if (error) console.error('Load stats error:', error);
    const updatedForm = initPlayerMatch(roster);

    if (stats) {
      stats.forEach((s) => {
        const player = roster.find((p) => p.ign === s.ign);
        if (player) {
          updatedForm[player.id] = {
            status: s.status || 'played', // legacy null → played
            kills: String(s.kills ?? 0),
            deaths: String(s.deaths ?? 0),
            assists: String(s.assists ?? 0),
            macro: s.macro_score || 3,
            micro: s.micro_score || 3,
            kda_score: s.kda_score || 3,
            mentality: s.mentality_score || 3,
            comment: s.coach_comment || '',
            absent_reason: s.absent_reason || '',
          };
        }
      });
    }
    setPlayerMatch(updatedForm);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAddUpcomingMatch(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.from('matches').insert({
      team: activeTeam, status: 'upcoming', match_type: upMatchType,
      match_date: upDate, match_time: upTime || null, opponent_name: upOpponent.trim(), opponent_logo: upLogo.trim() || null,
    });
    setSubmitting(false);
    if (error) { alert('Failed to schedule match: ' + error.message); return; }
    alert('Upcoming match scheduled!');
    setUpDate(''); setUpTime(''); setUpOpponent(''); setUpLogo(''); setUpMatchType('Scrim');
    loadData();
  }

  async function handleAddAchievement(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { data, error } = await supabase.from('team_achievements').insert({
      team: activeTeam, date: achDate, placement: achPlacement, tournament: achTournament.trim(), venue: achVenue.trim() || null, image_url: achImage,
    }).select();
    setSubmitting(false);
    if (error) {
      alert('FAILED to add achievement:\n\n' + error.message + '\n\n(code: ' + (error.code || 'unknown') + ')\nTeam used: "' + activeTeam + '"');
      return;
    }
    if (!data || data.length === 0) {
      alert('Insert returned no row. Likely an RLS policy problem on team_achievements.');
      return;
    }
    alert('Achievement added successfully!');
    setAchDate(''); setAchPlacement(''); setAchTournament(''); setAchVenue(''); setAchImage('');
    loadData();
  }

  async function deleteRecord(table: string, id: number) {
    if (!confirm('Are you sure you want to delete this?')) return;
    if (table === 'matches') {
      const r = await supabase.from('match_player_stats').delete().eq('match_id', id);
      if (r.error) { alert('Delete failed: ' + r.error.message); return; }
    }
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    loadData();
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!newIgn.trim()) return;
    setAddingPlayer(true);
    const { error } = await supabase.from('players').insert({
      team: activeTeam, ign: newIgn.trim(), role: newRole,
      main_hero: newMainHero.trim() || null, image_url: newImageUrl.trim() || null,
      full_name: newFullName.trim() || null, age: newDob ? calcAge(newDob) : null,
      stay: newStay.trim() || null, achievements: newAchievements.trim() || null,
      date_of_birth: newDob || null, mlbb_id: newMlbbId.trim() || null, mlbb_server: newServer.trim() || null,
    });
    setAddingPlayer(false);
    if (!error) {
      alert('Player added!');
      setNewIgn(''); setNewRole('Midlaner'); setNewMainHero(''); setNewImageUrl('');
      setNewFullName(''); setNewAge(''); setNewStay(''); setNewAchievements('');
      setNewDob(''); setNewMlbbId(''); setNewServer('');
      loadData();
    } else {
      alert('Error: ' + error.message);
    }
  }

  async function removePlayer(id: number, ign: string) {
    if (!confirm(`Remove ${ign}?`)) return;
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) { alert('Remove failed: ' + error.message); return; }
    loadData();
  }

  function startEdit(p: any) {
    setEditingId(p.id);
    setEditForm({
      ign: p.ign || '', role: p.role || 'Midlaner', main_hero: p.main_hero || '', image_url: p.image_url || '',
      full_name: p.full_name || '', age: p.age != null ? String(p.age) : '', stay: p.stay || '', achievements: p.achievements || '',
      date_of_birth: p.date_of_birth || '', mlbb_id: p.mlbb_id || '', mlbb_server: p.mlbb_server || '',
    });
  }

  async function saveEdit(id: number) {
    const { error } = await supabase.from('players').update({
      ign: editForm.ign.trim(), role: editForm.role, main_hero: editForm.main_hero.trim() || null,
      image_url: editForm.image_url.trim() || null, full_name: editForm.full_name.trim() || null,
      age: editForm.date_of_birth ? calcAge(editForm.date_of_birth) : editForm.age ? Number(editForm.age) : null, stay: editForm.stay.trim() || null,
      achievements: editForm.achievements.trim() || null,
      date_of_birth: editForm.date_of_birth || null, mlbb_id: editForm.mlbb_id.trim() || null, mlbb_server: editForm.mlbb_server.trim() || null,
    }).eq('id', id);
    if (error) { alert('Failed to update player: ' + error.message); return; }
    setEditingId(null);
    loadData();
  }

  return (
    <main className="min-h-screen bg-[#0a0508] text-white p-6 md:p-10 relative overflow-hidden" style={themeStyle(activeTeam)}>
      <SiteDecor />
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/90 via-[#121212]/80 to-[#121212] z-10"></div>
        <img key={activeTeam} src={getTeamTheme(activeTeam).logo} alt="DAG Wallpaper" className="w-[150vw] md:w-[70vw] opacity-15 blur-[2px] grayscale-[30%] mix-blend-lighten z-0 object-contain" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Navigation & Toggle */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <Link href="/" className="bg-gray-800/80 backdrop-blur hover:bg-gray-700 px-4 py-2 rounded text-sm font-bold uppercase transition-colors">← Dashboard</Link>
          <div className="flex gap-2">
            {TEAMS.map((team) => (
              <button key={team} onClick={() => { setActiveTeam(team); resetMatchForm(); }}
                className={`px-6 py-2 rounded-full font-extrabold tracking-wider uppercase transition-colors border-2 ${
                  activeTeam === team ? 'border-accent bg-accent text-white' : 'border-gray-800 bg-black/50 backdrop-blur text-gray-400 hover:border-gray-600'}`}>
                {team}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wide bg-gradient-to-r from-accent via-pink-300 to-white bg-clip-text text-transparent">Admin Panel</h1>
          <p className="text-gray-500 text-sm mt-1 uppercase tracking-[0.3em]">{activeTeam}</p>
        </div>

        {/* Tab System */}
        <div className="flex border-b border-gray-800 mb-8 overflow-x-auto">
          {TABS.map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
                activeTab === tab ? 'text-accent border-b-2 border-accent' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab === 'Matches' ? 'Match & Evaluations' : tab}
            </button>
          ))}
        </div>

        {activeTab === 'Guide' && (
          <div className="bg-[#1a1a1a]/80 backdrop-blur p-8 rounded-xl border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-extrabold text-accent uppercase mb-4">Coach / Manager Guide</h2>
            <div className="space-y-4 text-gray-300">
              <p><strong>1. Managing the Roster:</strong> Go to the Roster tab to add players or coaches. Make sure you are in the correct team view (Ladies or Montrix) before adding them.</p>
              <p><strong>2. Upcoming Matches Auto-Transfer:</strong> Any match scheduled in "Upcoming" will automatically transfer to "Matches" once the date passes. You can then click "Edit" on it to fill in the scores and player stats.</p>
              <p><strong>3. Player Attendance:</strong> For each match, mark every player (and coach / manager) as Played, Benched, or Absent. If someone is absent, you must write a short remark (e.g., "Sick", "Injury", "Personal"). Absent members do NOT count toward attendance rate.</p>
              <p><strong>4. Player Evaluation System:</strong> For players who played, rate them 1–5 on Macro, Micro, KDA, and Mentality. This combines with attendance rate to form their Overall Evaluation.</p>
              <p><strong>5. Management Attendance:</strong> Coach and Manager are marked Present or Absent in the match form (absence needs a remark). Their attendance percentage is shown on the Evaluation page. They are not rated.</p>
              <p><strong>6. Team Achievements:</strong> Add tournament placements in the Achievements tab to display them on the Team Performance page.</p>
            </div>
          </div>
        )}

        {activeTab === 'Roster' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fadeIn">
            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 xl:col-span-1 h-fit shadow-xl">
              <h3 className="font-bold text-accent uppercase tracking-wider mb-4">Add New Member</h3>
              <form onSubmit={handleAddPlayer} className="flex flex-col gap-3">
                <input type="text" placeholder="IGN *" value={newIgn} onChange={(e) => setNewIgn(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" required />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <input type="text" placeholder="Full Name" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" />
                <div>
                  <label className="text-[10px] text-gray-500 uppercase tracking-wider">Date of Birth</label>
                  <input type="date" value={newDob} onChange={(e) => setNewDob(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none w-full mt-1" />
                  {newDob && <p className="text-xs text-gray-400 mt-1">Age: <span className="text-white font-bold">{calcAge(newDob) ?? '—'}</span> (calculated automatically)</p>}
                </div>
                <div className="flex gap-3">
                  <input type="text" inputMode="numeric" placeholder="MLBB ID" value={newMlbbId} onChange={(e) => setNewMlbbId(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none w-1/2" />
                  <input type="text" inputMode="numeric" placeholder="Server" value={newServer} onChange={(e) => setNewServer(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none w-1/2" />
                </div>
                <input type="text" placeholder="Location / Stay" value={newStay} onChange={(e) => setNewStay(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" />
                <input type="text" placeholder="Signature Hero" value={newMainHero} onChange={(e) => setNewMainHero(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" />
                <input type="text" placeholder="Image URL" value={newImageUrl} onChange={(e) => setNewImageUrl(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" />
                <textarea placeholder="Achievements (one per line)" value={newAchievements} onChange={(e) => setNewAchievements(e.target.value)} rows={2} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none resize-none" />
                <button type="submit" disabled={addingPlayer} className="bg-green-700 hover:bg-green-600 font-bold uppercase tracking-wider py-2 rounded text-sm mt-2 transition-colors">
                  {addingPlayer ? 'Adding...' : '+ Add Member'}
                </button>
              </form>
            </div>

            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 xl:col-span-2 shadow-xl">
              <h3 className="font-bold text-accent uppercase tracking-wider mb-4">Current Roster ({roster.length})</h3>
              {roster.length === 0 ? (
                <p className="text-gray-500 italic text-sm">No members in roster.</p>
              ) : (
                <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2">
                  {roster.map((p) => (
                    <div key={p.id} className="bg-[#121212] border border-gray-800 rounded-lg p-4">
                      {editingId === p.id ? (
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            <input type="text" value={editForm.ign} onChange={(e) => setEditForm({ ...editForm, ign: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs" placeholder="IGN" />
                            <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs">
                              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                            <input type="text" value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs" placeholder="Full Name" />
                            <input type="text" value={editForm.stay} onChange={(e) => setEditForm({ ...editForm, stay: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs" placeholder="Stay" />
                            <input type="text" value={editForm.main_hero} onChange={(e) => setEditForm({ ...editForm, main_hero: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs" placeholder="Signature Hero" />
                            <input type="text" value={editForm.image_url} onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs col-span-2" placeholder="Image URL" />
                            <input type="text" value={editForm.mlbb_id} onChange={(e) => setEditForm({ ...editForm, mlbb_id: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs" placeholder="MLBB ID" />
                            <input type="text" value={editForm.mlbb_server} onChange={(e) => setEditForm({ ...editForm, mlbb_server: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs" placeholder="Server" />
                            <input type="date" value={editForm.date_of_birth} onChange={(e) => setEditForm({ ...editForm, date_of_birth: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs col-span-2" title="Date of Birth" />
                            {editForm.date_of_birth && <p className="text-xs text-gray-400 col-span-2 self-center">Age: <span className="text-white font-bold">{calcAge(editForm.date_of_birth) ?? '—'}</span> (auto)</p>}
                            <textarea value={editForm.achievements} onChange={(e) => setEditForm({ ...editForm, achievements: e.target.value })} rows={2} placeholder="Achievements" className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs col-span-2 md:col-span-4 resize-none" />
                          </div>
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => setEditingId(null)} className="bg-gray-700 hover:bg-gray-600 text-white text-xs font-bold uppercase px-4 py-2 rounded transition-colors">Cancel</button>
                            <button onClick={() => saveEdit(p.id)} className="bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold uppercase px-4 py-2 rounded transition-colors">Save Details</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex justify-between items-center gap-3">
                          <div className="flex items-center gap-4">
                            {p.image_url ? (
                              <img src={p.image_url} alt={p.ign} className="w-10 h-10 rounded-full object-cover object-top border border-accent flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-accent-deep border border-accent flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold">{p.ign ? p.ign.charAt(0).toUpperCase() : '?'}</span>
                              </div>
                            )}
                            <div>
                              <p className="font-bold">{p.ign} <span className="text-accent text-xs ml-1">({p.role})</span></p>
                              <p className="text-xs text-gray-400">{p.full_name || 'No Name'} {(calcAge(p.date_of_birth) ?? p.age) ? `· ${calcAge(p.date_of_birth) ?? p.age}y` : ''} {p.stay ? `· ${p.stay}` : ''}</p>
                              {p.mlbb_id && <p className="text-[10px] text-gray-500">MLBB {p.mlbb_id}{p.mlbb_server ? ` (${p.mlbb_server})` : ''}</p>}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => startEdit(p)} className="bg-blue-900/50 hover:bg-blue-800 text-blue-300 text-xs px-3 py-1.5 rounded font-bold transition-colors">Edit</button>
                            <button onClick={() => removePlayer(p.id, p.ign)} className="bg-red-900/50 hover:bg-red-800 text-red-300 text-xs px-3 py-1.5 rounded font-bold transition-colors">Remove</button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'Upcoming' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 h-fit shadow-xl">
              <h3 className="font-bold text-accent uppercase mb-4">Schedule Upcoming Match</h3>
              <form onSubmit={handleAddUpcomingMatch} className="flex flex-col gap-3">
                <div className="flex gap-3">
                  <input type="date" value={upDate} onChange={(e) => setUpDate(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none w-1/2" required />
                  <input type="time" value={upTime} onChange={(e) => setUpTime(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none w-1/2" title="Match time" />
                </div>
                <div className="flex gap-3">
                  <select value={upMatchType} onChange={(e) => setUpMatchType(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none w-1/3 text-sm">
                    {MATCH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="text" placeholder="Opponent Name *" value={upOpponent} onChange={(e) => setUpOpponent(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none w-2/3" required />
                </div>
                <input type="text" placeholder="Opponent Logo URL" value={upLogo} onChange={(e) => setUpLogo(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" />
                <button type="submit" disabled={submitting} className="bg-blue-700 hover:bg-blue-600 font-bold uppercase py-2 rounded mt-2 text-white">Add to Schedule</button>
              </form>
            </div>

            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 shadow-xl">
              <h3 className="font-bold text-accent uppercase mb-4">Scheduled Matches</h3>
              <div className="flex flex-col gap-3">
                {upcomingMatchesList.length === 0 && <p className="text-gray-500 italic text-sm">No scheduled matches.</p>}
                {upcomingMatchesList.map((m) => (
                  <div key={m.id} className="bg-[#121212] border border-gray-800 p-4 rounded flex justify-between items-center">
                    <div>
                      <p className="text-accent text-xs font-bold">{m.match_date}{m.match_time ? ` · ${formatTime(m.match_time)}` : ''}</p>
                      <p className="font-bold">DAG vs {m.opponent_name} <span className="text-gray-500 text-xs ml-2 font-normal bg-gray-900 px-2 py-0.5 rounded">{m.match_type}</span></p>
                    </div>
                    <button onClick={() => deleteRecord('matches', m.id)} className="bg-red-900 text-red-300 text-xs px-3 py-1.5 rounded">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Achievements' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 h-fit shadow-xl">
              <h3 className="font-bold text-accent uppercase mb-4">Add Team Achievement</h3>
              <form onSubmit={handleAddAchievement} className="flex flex-col gap-3">
                <input type="date" value={achDate} onChange={(e) => setAchDate(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <input type="text" placeholder="Placement (e.g. Champion, 1st Runner Up)" value={achPlacement} onChange={(e) => setAchPlacement(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <input type="text" placeholder="Tournament Name" value={achTournament} onChange={(e) => setAchTournament(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <input type="text" placeholder="Venue (e.g. Kuala Lumpur, Online)" value={achVenue} onChange={(e) => setAchVenue(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" />
                <input type="text" placeholder="Achievement Image URL" value={achImage} onChange={(e) => setAchImage(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <button type="submit" disabled={submitting} className="bg-yellow-700 hover:bg-yellow-600 font-bold uppercase py-2 rounded mt-2 text-white">Save Achievement</button>
              </form>
            </div>

            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 shadow-xl">
              <h3 className="font-bold text-accent uppercase mb-4">Past Achievements</h3>
              <div className="flex flex-col gap-3">
                {achievements.length === 0 && <p className="text-gray-500 italic text-sm">No achievements yet.</p>}
                {achievements.map((a) => (
                  <div key={a.id} className="bg-[#121212] border border-gray-800 p-4 rounded flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <img src={a.image_url} alt="ach" className="w-12 h-12 object-cover rounded" />
                      <div>
                        <p className="text-yellow-500 font-black">{a.placement}</p>
                        <p className="text-sm font-bold">{a.tournament || a.venue}</p>
                        {a.tournament && a.venue && <p className="text-xs text-gray-400">📍 {a.venue}</p>}
                        <p className="text-xs text-gray-500">{a.date}</p>
                      </div>
                    </div>
                    <button onClick={() => deleteRecord('team_achievements', a.id)} className="bg-red-900 text-red-300 text-xs px-3 py-1.5 rounded">Delete</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Matches' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold text-accent uppercase">{editingMatchId ? 'Edit Match Record' : 'Log Completed Match'}</h3>
                {editingMatchId && <button onClick={resetMatchForm} className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600">Cancel Edit</button>}
              </div>
              <form onSubmit={handleSaveMatch} className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-1/3 outline-none" required />
                  <select value={matchType} onChange={(e) => setMatchType(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-1/3 outline-none text-sm">
                    {MATCH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="text" placeholder="Opponent *" value={opponentName} onChange={(e) => setOpponentName(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-1/3 outline-none" required />
                </div>

                <input type="text" placeholder="Opponent Logo URL" value={opponentLogo} onChange={(e) => setOpponentLogo(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-full outline-none" />

                <div className="flex gap-3">
                  <div className="w-1/2"><label className="text-xs text-gray-500 uppercase">DAG Score</label><input type="number" value={dagScore} onChange={(e) => setDagScore(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-full outline-none" /></div>
                  <div className="w-1/2"><label className="text-xs text-gray-500 uppercase">Opp Score</label><input type="number" value={oppScore} onChange={(e) => setOppScore(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-full outline-none" /></div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase mb-1 block">Full Match Review</label>
                  <textarea rows={3} placeholder="Coach match analysis..." value={matchReview} onChange={(e) => setMatchReview(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-full outline-none resize-none" />
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase mb-1 block">Match Result Screenshots (one image URL per line)</label>
                  <textarea rows={3} placeholder={"https://example.com/result1.jpg\nhttps://example.com/result2.jpg"} value={matchScreenshots} onChange={(e) => setMatchScreenshots(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-full outline-none resize-none text-xs" />
                  <p className="text-[10px] text-gray-600 mt-1">Paste multiple image URLs, one per line. They will display as a gallery on the dashboard.</p>
                </div>

                <div className="border-t border-gray-800/50 pt-4 mt-2">
                  <h4 className="text-sm font-bold text-gray-300 uppercase mb-3">Player Attendance & Evaluations (Scale 1-5)</h4>
                  <div className="max-h-[400px] overflow-y-auto flex flex-col gap-2 pr-2">
                    {roster.map((p) => {
                      const pm = playerMatch[p.id];
                      if (!pm) return null;
                      const isStaffMember = ['coach', 'manager'].includes((p.role || '').toLowerCase());
                      return (
                        <div key={p.id} className={`bg-[#121212] p-3 border rounded ${pm.status !== '' ? 'border-accent' : 'border-gray-800'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-sm">{p.ign} <span className="text-accent text-xs">({p.role})</span></span>
                            <select
                              value={pm.status}
                              onChange={(e) => updatePlayerMatch(p.id, 'status', e.target.value)}
                              className={`bg-[#1a1a1a] text-xs border rounded p-1.5 outline-none ${
                                pm.status === 'absent' ? 'border-red-700 text-red-300' :
                                pm.status === 'played' ? 'border-green-700 text-green-300' :
                                pm.status === 'bench' ? 'border-yellow-700 text-yellow-300' :
                                'border-gray-700 text-gray-400'}`}
                            >
                              <option value="">Not Involved</option>
                              <option value="played">▶ {isStaffMember ? 'Present' : 'Played'}</option>
                              {!isStaffMember && <option value="bench">🪑 Benched</option>}
                              <option value="absent">❌ Absent</option>
                            </select>
                          </div>

                          {pm.status === 'played' && !isStaffMember && (
                            <div className="mt-3 pl-2">
                              <div className="grid grid-cols-3 gap-1 mb-2">
                                <input type="number" placeholder="K" value={pm.kills} onChange={(e) => updatePlayerMatch(p.id, 'kills', e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded p-1 text-center text-xs" title="Kills" />
                                <input type="number" placeholder="D" value={pm.deaths} onChange={(e) => updatePlayerMatch(p.id, 'deaths', e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded p-1 text-center text-xs" title="Deaths" />
                                <input type="number" placeholder="A" value={pm.assists} onChange={(e) => updatePlayerMatch(p.id, 'assists', e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded p-1 text-center text-xs" title="Assists" />
                              </div>
                              <div className="grid grid-cols-4 gap-1 mb-2 text-center text-[10px] text-gray-400">
                                <div>Macro<input type="range" min="1" max="5" value={pm.macro} onChange={(e) => updatePlayerMatch(p.id, 'macro', Number(e.target.value))} className="w-full accent-accent" /><span>{pm.macro}</span></div>
                                <div>Micro<input type="range" min="1" max="5" value={pm.micro} onChange={(e) => updatePlayerMatch(p.id, 'micro', Number(e.target.value))} className="w-full accent-accent" /><span>{pm.micro}</span></div>
                                <div>KDA<input type="range" min="1" max="5" value={pm.kda_score} onChange={(e) => updatePlayerMatch(p.id, 'kda_score', Number(e.target.value))} className="w-full accent-accent" /><span>{pm.kda_score}</span></div>
                                <div>Mental<input type="range" min="1" max="5" value={pm.mentality} onChange={(e) => updatePlayerMatch(p.id, 'mentality', Number(e.target.value))} className="w-full accent-accent" /><span>{pm.mentality}</span></div>
                              </div>
                              <input type="text" placeholder="Individual feedback..." value={pm.comment} onChange={(e) => updatePlayerMatch(p.id, 'comment', e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-xs outline-none" />
                            </div>
                          )}

                          {pm.status === 'bench' && (
                            <div className="mt-3 pl-2">
                              <input type="text" placeholder="Coach note (optional)..." value={pm.comment} onChange={(e) => updatePlayerMatch(p.id, 'comment', e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-xs outline-none" />
                            </div>
                          )}

                          {pm.status === 'absent' && (
                            <div className="mt-3 pl-2">
                              <label className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Absence Remark *</label>
                              <input
                                type="text"
                                placeholder="e.g. Sick, Injury, Personal matter..."
                                value={pm.absent_reason}
                                onChange={(e) => updatePlayerMatch(p.id, 'absent_reason', e.target.value)}
                                className="w-full bg-[#1a1a1a] border border-red-800 rounded p-2 text-xs outline-none mt-1 text-red-200 placeholder-red-900"
                                required
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" disabled={submitting} className={`${editingMatchId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-accent hover:bg-accent-dark'} text-white font-extrabold uppercase py-3 rounded mt-2`}>
                  {submitting ? 'Saving...' : editingMatchId ? 'Update Match Record' : 'Publish Match Record'}
                </button>
              </form>
            </div>

            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 shadow-xl">
              <h3 className="font-bold text-accent uppercase mb-4">Matches (Click to Edit)</h3>
              <div className="flex flex-col gap-3 max-h-[700px] overflow-y-auto pr-2">
                {completedMatches.length === 0 && <p className="text-gray-500 italic text-sm">No matches recorded.</p>}
                {completedMatches.map((m) => (
                  <div key={m.id} className="bg-[#121212] border border-gray-800 p-4 rounded flex justify-between items-center group">
                    <div className="cursor-pointer flex-1" onClick={() => startEditMatch(m)}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs text-gray-500 group-hover:text-accent transition-colors">{m.match_date}</p>
                        <p className="text-[9px] bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded font-bold uppercase">{m.match_type || 'Scrim'}</p>
                      </div>
                      <p className="font-bold">DAG vs {m.opponent_name} <span className="text-gray-400">({m.dag_score}-{m.opponent_score})</span></p>
                    </div>
                    <button onClick={() => deleteRecord('matches', m.id)} className="bg-red-900 text-red-300 text-xs px-3 py-1.5 rounded">Del</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}