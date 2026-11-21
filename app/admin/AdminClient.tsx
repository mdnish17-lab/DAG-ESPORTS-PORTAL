"use client";

import Link from 'next/link';
import AdminLogoutButton from './AdminLogoutButton';
import PlayerEvaluationPanel from './PlayerEvaluationPanel';
import MatchEvaluationTracker from './MatchEvaluationTracker';
import CoachDashboard from './CoachDashboard';
import WeeklyReportPanel from './WeeklyReportPanel';
import { getTeamTheme, themeStyle } from '../../lib/teamTheme';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

const ROLES = ['Coach', 'Manager', 'Midlaner', 'Jungler', 'Roamer', 'Goldlaner', 'Explaner'];
const TEAMS = ['DAG Ladies', 'DAG Montrix'];
const MATCH_TYPES = ['Scrim', 'Tournament', 'Scrim Bracket'];
const TABS = ['Coach Dashboard', 'Guide', 'Roster', 'Match Log', 'Player Evaluation', 'Weekly Report', 'Upcoming', 'Achievements'] as const;

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
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>('Coach Dashboard');
  const [managementRole, setManagementRole] = useState('none');
  const canRoster = managementRole === 'owner' || managementRole === 'manager';
  const canMatches = canRoster || managementRole === 'coach';
  const canDeleteMatches = canRoster;
  const canEvaluate = canMatches;
  const canReports = canMatches;
  const canAchievements = canRoster;
  useEffect(() => {
    let cancelled = false;
    void supabase.rpc('my_management_role').then(({ data, error }) => {
      if (!cancelled) setManagementRole(error ? 'none' : String(data || 'none'));
    });
    return () => { cancelled = true; };
  }, []);


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
  const [focusEvalMatchId, setFocusEvalMatchId] = useState<number | null>(null);
  const [evalOpenVersion, setEvalOpenVersion] = useState(0);
  const [reportFocus, setReportFocus] = useState<{ playerId: number; weekStart: string } | null>(null);

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
  const [achPlacement, setAchPlacement] = useState('Champion');
  const [customPlacement, setCustomPlacement] = useState('');
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
  }, [activeTeam, teamReady, managementRole]);

  async function loadData() {
    const playerSource = canRoster ? 'players' : 'public_player_profiles';
    const { data: players, error: pErr } = await supabase.from(playerSource).select('*').eq('team', activeTeam).order('id');
    if (pErr) console.error('Players error:', pErr);
    setRoster(players || []);

    const { data: matches, error: mErr } = await supabase
      .from('matches')
      .select('*')
      .eq('team', activeTeam)
      .order('match_date', { ascending: false });
    if (mErr) console.error('Matches error:', mErr);
    // Never fabricate a score or DRAW because a scheduled date has passed.
    // An overdue match remains scheduled until management explicitly confirms a result.
    setAllMatches(matches || []);

    const { data: ach, error: aErr } = await supabase
      .from('team_achievements')
      .select('*')
      .eq('team', activeTeam)
      .order('date', { ascending: false });
    if (aErr) console.error('Achievements error:', aErr);
    setAchievements(ach || []);
  }

  const completedMatches = allMatches.filter((m) => m.status === 'completed');
  const upcomingMatchesList = allMatches.filter((m) => ['upcoming', 'awaiting_result', 'cancelled'].includes(m.status));
  const todayMY = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const result = (() => {
    const d = Number(dagScore), o = Number(oppScore);
    if (d > o) return 'WIN';
    if (d < o) return 'LOSS';
    return 'DRAW';
  })();

  // Match Log only handles match metadata. Existing player evaluations are
  // never deleted, reset or overwritten when a coach edits the match log.
  async function handleSaveMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!canMatches) { alert('Only an authorized coach or manager can edit matches.'); return; }
    if (!matchDate || !opponentName.trim()) { alert('Fill in the date and opponent.'); return; }
    if (dagScore.trim() === '' || oppScore.trim() === '') { alert('Enter both confirmed match scores. No default DRAW result will be used.'); return; }
    const ourScore = Number(dagScore), theirScore = Number(oppScore);
    if (![ourScore, theirScore].every((value) => Number.isInteger(value) && value >= 0)) {
      alert('Both match scores must be non-negative whole numbers.');
      return;
    }
    setSubmitting(true);
    try {
      const matchPayload = {
        team: activeTeam,
        status: 'completed',
        match_type: matchType,
        match_date: matchDate,
        opponent_name: opponentName.trim(),
        opponent_logo: opponentLogo.trim() || null,
        dag_score: ourScore,
        opponent_score: theirScore,
        result,
        match_review: matchReview.trim() || null,
        result_screenshots: matchScreenshots.trim() || null,
      };
      if (editingMatchId != null) {
        const { data, error } = await supabase.from('matches')
          .update(matchPayload).eq('id', editingMatchId).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('Match not updated. Check authorization and RLS.');
      } else {
        const { error } = await supabase.from('matches').insert(matchPayload).select('id').single();
        if (error) throw error;
      }
      alert(editingMatchId ? 'Match Log updated. Existing player evaluations are preserved.' : 'Match registered! Now open Player Evaluation to rate the players in this match.');
      resetMatchForm();
      void loadData();
    } catch (err: any) {
      alert('Match Log error: ' + (err?.message || 'Unknown error'));
    } finally { setSubmitting(false); }
  }

  function resetMatchForm() {
    setEditingMatchId(null);
    setMatchDate(''); setMatchType('Scrim'); setOpponentName(''); setOpponentLogo('');
    setDagScore('0'); setOppScore('0'); setMatchReview(''); setMatchScreenshots('');
  }

  async function changeScheduledStatus(m: any, newStatus: 'awaiting_result' | 'cancelled' | 'upcoming') {
    if (!canMatches) return;
    const action = newStatus === 'cancelled' ? 'cancel' : newStatus === 'upcoming' ? 'restore' : 'mark as awaiting result';
    if (!confirm(`Do you want to ${action} DAG vs ${m.opponent_name}?`)) return;
    const { error } = await supabase.from('matches')
      .update({ status: newStatus, result: 'PENDING' }).eq('id', m.id);
    if (error) { alert('Could not update scheduled match: ' + error.message); return; }
    void loadData();
  }

  // Called explicitly by management, never by the calendar or an automatic job.
  async function finishScheduledMatch(m: any) {
    if (!canMatches) { alert('You do not have permission to record match results.'); return; }
    if (!confirm(`Record the actual result for DAG vs ${m.opponent_name}? Enter both scores in Match Log before saving.`)) return;
    setEditingMatchId(m.id);
    setMatchDate(m.match_date);
    setMatchType(m.match_type || 'Scrim');
    setOpponentName(m.opponent_name);
    setOpponentLogo(m.opponent_logo || '');
    setDagScore('');
    setOppScore('');
    setMatchReview(m.match_review || '');
    setMatchScreenshots(m.result_screenshots || '');
    setActiveTab('Match Log');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startEditMatch(m: any) {
    if (!canMatches) return;
    setActiveTab('Match Log');
    setEditingMatchId(m.id);
    setMatchDate(m.match_date);
    setMatchType(m.match_type || 'Scrim');
    setOpponentName(m.opponent_name);
    setOpponentLogo(m.opponent_logo || '');
    setDagScore(String(m.dag_score ?? 0));
    setOppScore(String(m.opponent_score ?? 0));
    setMatchReview(m.match_review || '');
    setMatchScreenshots(m.result_screenshots || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openDashboardWeeklyReport(playerId: number, weekStart: string) {
    setReportFocus({ playerId, weekStart });
    setActiveTab('Weekly Report');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openMatchForEvaluation(id: number) {
    setFocusEvalMatchId(id);
    setEvalOpenVersion((n) => n + 1);
    setActiveTab('Player Evaluation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAddUpcomingMatch(e: React.FormEvent) {
    e.preventDefault();
    if (!canMatches) { alert('Only approved coaches and management can schedule matches.'); return; }
    setSubmitting(true);
    const { error } = await supabase.from('matches').insert({
      team: activeTeam,
      status: 'upcoming',
      match_type: upMatchType,
      match_date: upDate,
      match_time: upTime || null,
      opponent_name: upOpponent.trim(),
      opponent_logo: upLogo.trim() || null,
      dag_score: 0,
      opponent_score: 0,
      result: 'PENDING'
    });
    setSubmitting(false);
    if (error) { alert('Failed to schedule match: ' + error.message); return; }
    alert('Upcoming match scheduled!');
    setUpDate(''); setUpTime(''); setUpOpponent(''); setUpLogo(''); setUpMatchType('Scrim');
    loadData();
  }

  async function handleAddAchievement(e: React.FormEvent) {
    e.preventDefault();
    if (!canAchievements) { alert('Only a manager or owner can manage achievements.'); return; }

    // Determine which placement text to send to the database
    const finalPlacement = achPlacement === 'Others' ? customPlacement.trim() : achPlacement;
    if (!finalPlacement) {
      alert('Please specify the placement.');
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.from('team_achievements').insert({
      team: activeTeam,
      date: achDate,
      placement: finalPlacement,
      tournament: achTournament.trim(),
      venue: achVenue.trim() || null,
      image_url: achImage.trim() || null,
    }).select();
    setSubmitting(false);

    if (error) {
      alert('FAILED to add achievement:\n\n' + error.message);
      return;
    }
    if (!data || data.length === 0) {
      alert('Insert returned no row. Likely an RLS policy problem on team_achievements.');
      return;
    }
    alert('Achievement added successfully!');
    setAchDate(''); setAchPlacement('Champion'); setCustomPlacement(''); setAchTournament(''); setAchVenue(''); setAchImage('');
    loadData();
  }

  async function deleteRecord(table: string, id: number) {
    if (table === 'matches' && !canDeleteMatches) { alert('Only a manager or owner can delete matches.'); return; }
    if (table === 'team_achievements' && !canAchievements) { alert('Only a manager or owner can delete achievements.'); return; }
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
    if (!canRoster) { alert('Only a manager or owner can update the roster.'); return; }
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
    if (!canRoster) return;
    if (!confirm(`Remove ${ign}?`)) return;
    const { error } = await supabase.from('players').delete().eq('id', id);
    if (error) { alert('Remove failed: ' + error.message); return; }
    loadData();
  }

  function startEdit(p: any) {
    if (!canRoster) return;
    setEditingId(p.id);
    setEditForm({
      ign: p.ign || '', role: p.role || 'Midlaner', main_hero: p.main_hero || '', image_url: p.image_url || '',
      full_name: p.full_name || '', age: p.age != null ? String(p.age) : '', stay: p.stay || '', achievements: p.achievements || '',
      date_of_birth: p.date_of_birth || '', mlbb_id: p.mlbb_id || '', mlbb_server: p.mlbb_server || '',
    });
  }

  async function saveEdit(id: number) {
    if (!canRoster) return;
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
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/90 via-[#121212]/80 to-[#121212] z-10"></div>
        <img key={activeTeam} src={getTeamTheme(activeTeam).logo} alt="DAG Wallpaper" className="w-[150vw] md:w-[70vw] opacity-15 blur-[2px] grayscale-[30%] mix-blend-lighten z-0 object-contain" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Navigation is separate from the wallpaper/hero visual. */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8 rounded-2xl border border-gray-800 bg-[#151015]/95 p-4 shadow-xl">
          <div className="flex items-center flex-wrap gap-3">
            <Link href="/management" className="bg-gray-800/80 backdrop-blur hover:bg-gray-700 px-4 py-2 rounded text-sm font-bold uppercase transition-colors">← Management</Link>
            <AdminLogoutButton />
          </div>
          <div className="flex gap-2">
            {TEAMS.map((team) => (
              <button key={team} onClick={() => { setActiveTeam(team); resetMatchForm(); setFocusEvalMatchId(null); setEvalOpenVersion((n) => n + 1); }}
                className={`px-6 py-2 rounded-full font-extrabold tracking-wider uppercase transition-colors border-2 ${
                  activeTeam === team ? 'border-accent bg-accent text-white' : 'border-gray-800 bg-black/50 backdrop-blur text-gray-400 hover:border-gray-600'}`}>
                {team}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-wide bg-gradient-to-r from-accent via-pink-300 to-white bg-clip-text text-transparent">Coaches / Manager</h1>
          <p className="text-gray-500 text-sm mt-1 uppercase tracking-[0.3em]">{activeTeam} · {managementRole === 'none' ? 'Verifying role' : managementRole + ' access'}</p>
        </div>

        {/* Tab System */}
        <div className="flex border-b border-gray-800 mb-8 overflow-x-auto rounded-xl bg-[#151015]/95 p-2">
          {TABS.filter((tab) => tab !== 'Player Evaluation' || canEvaluate).map((tab) => (
            <button key={tab} onClick={() => { if (tab === 'Player Evaluation') { setFocusEvalMatchId(null); setEvalOpenVersion((n) => n + 1); } if (tab === 'Weekly Report') setReportFocus(null); setActiveTab(tab); }}
              className={`px-6 py-3 font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${
                activeTab === tab ? 'text-accent border-b-2 border-accent' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'Coach Dashboard' && (
          <CoachDashboard activeTeam={activeTeam} roster={roster} matches={completedMatches}
            managementRole={managementRole} canEdit={canMatches} onEvaluateMatch={openMatchForEvaluation} onOpenMatchLog={() => setActiveTab('Match Log')}
            onOpenReport={openDashboardWeeklyReport} onOpenReports={() => { setReportFocus(null); setActiveTab('Weekly Report'); }} />
        )}

        {activeTab === 'Guide' && (
          <div className="bg-[#1a1a1a]/80 backdrop-blur p-8 rounded-xl border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-extrabold text-accent uppercase mb-4">Coach / Manager Guide</h2>
            <div className="space-y-4 text-gray-300">
              <p><strong>Management Permissions:</strong> Owner and Manager control roster, achievements, and deletes; Coach can register matches and evaluate players; Viewer has read-only access. Authorized roles are enforced by Supabase policies.</p>
              <p><strong>1. Managing the Roster:</strong> Go to Roster to add players or coaches. Make sure you are in the correct team view (Ladies or Montrix) before adding them.</p>
              <p><strong>2. Match Result Confirmation:</strong> Scheduled matches never become draws automatically. After a match, select Enter result, verify both scores and save to Match Log. Then evaluate participating players.</p>
              <p><strong>3. Player Attendance:</strong> In Player Evaluation, select an already registered match and mark each player (and coach / manager) as Played, Benched, or Absent. If someone is absent, you must write a short remark (e.g., "Sick", "Injury", "Personal"). Absent members do NOT count toward attendance rate.</p>
              <p><strong>Evaluation Progress Tracker:</strong> In Match Log, check which matches still need player assessments. Select Continue evaluation to rate missing players. Benched and Absent statuses count as recorded; Played needs all six KPI scores.</p>
              <p><strong>4. Player Evaluation System:</strong> Choose a registered match and a player, then use the large 1–5 rating scales for all six coach-assessed KPIs: Mechanics, Macro, Communication, Role Execution, Discipline and Hero Pool. Ratings are weighted using the Excel workbook and combined with attendance for Overall Evaluation.</p>
              <p><strong>5. Management Attendance:</strong> Coach and Manager are marked Present or Absent in Player Evaluation (absence needs a remark). Their attendance percentage is shown on the Evaluation page. They are not rated.</p>
              <p><strong>6. Automatic Weekly Performance:</strong> Register each completed match first, then save each player evaluation in the separate tab. The public Evaluation graph automatically averages assessed matches by Monday–Sunday week. No separate Weekly KPI entry is needed. Existing historical reviews are kept as an archive.</p>
              <p><strong>7. Weekly Coach Reports:</strong> Approved coaches can write a weekly comment and next-week improvement goals for each player in Weekly Report. These notes appear on the public Evaluation page. Coach access must be enabled individually in Supabase.</p>
              <p><strong>8. Team Achievements:</strong> Add tournament placements in the Achievements tab to display them on the Achievement page.</p>
              <p><strong>9. Account Settings:</strong> Manage your password from Management → Account Settings, outside the coaching workspace.</p>
            </div>
          </div>
        )}


        {activeTab === 'Roster' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fadeIn">
            {canRoster && <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 xl:col-span-1 h-fit shadow-xl">
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
            </div>}

            <div className={`bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 shadow-xl ${canRoster ? 'xl:col-span-2' : 'xl:col-span-3'}`}>
              <h3 className="font-bold text-accent uppercase tracking-wider mb-4">Current Roster ({roster.length})</h3>
              {roster.length === 0 ? (
                <p className="text-gray-500 italic text-sm">No members in roster.</p>
              ) : (
                <div className="flex flex-col gap-3 max-h-[600px] overflow-y-auto pr-2">
                  {roster.map((p) => (
                    <div key={p.id} className="bg-[#121212] border border-gray-800 rounded-lg p-4">
                      {canRoster && editingId === p.id ? (
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
                          {canRoster && <div className="flex gap-2">
                            <button onClick={() => startEdit(p)} className="bg-blue-900/50 hover:bg-blue-800 text-blue-300 text-xs px-3 py-1.5 rounded font-bold transition-colors">Edit</button>
                            <button onClick={() => removePlayer(p.id, p.ign)} className="bg-red-900/50 hover:bg-red-800 text-red-300 text-xs px-3 py-1.5 rounded font-bold transition-colors">Remove</button>
                          </div>}
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
            {canMatches && <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 h-fit shadow-xl">
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
            </div>}

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
                    <div className="flex flex-col items-end gap-2">
                      <span className={`rounded border px-2 py-1 text-[10px] font-bold ${m.status === 'cancelled' ? 'border-gray-700 text-gray-400' : m.status === 'awaiting_result' || m.match_date <= todayMY ? 'border-amber-800 bg-amber-950/25 text-amber-300' : 'border-blue-800 text-blue-300'}`}>
                        {m.status === 'cancelled' ? 'Cancelled' : m.status === 'awaiting_result' || m.match_date <= todayMY ? 'Awaiting confirmed result' : 'Scheduled'}
                      </span>
                      {canMatches && m.status !== 'cancelled' && <button type="button" onClick={() => { void finishScheduledMatch(m); }}
                        className="rounded bg-accent px-3 py-1.5 text-xs font-bold text-white hover:brightness-110">
                        Enter result
                      </button>}
                      {canMatches && m.status === 'upcoming' && <button type="button" onClick={() => { void changeScheduledStatus(m, 'awaiting_result'); }}
                        className="rounded border border-amber-800 px-3 py-1.5 text-xs font-bold text-amber-300">Mark awaiting result</button>}
                      {canMatches && m.status !== 'cancelled' && <button type="button" onClick={() => { void changeScheduledStatus(m, 'cancelled'); }}
                        className="rounded border border-gray-700 px-3 py-1.5 text-xs text-gray-300">Cancel match</button>}
                      {canMatches && m.status === 'cancelled' && <button type="button" onClick={() => { void changeScheduledStatus(m, 'upcoming'); }}
                        className="rounded border border-blue-800 px-3 py-1.5 text-xs text-blue-300">Restore</button>}
                      {canDeleteMatches && <button onClick={() => deleteRecord('matches', m.id)} className="bg-red-900 text-red-300 text-xs px-3 py-1.5 rounded">Delete</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Achievements' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
            {canAchievements && <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 h-fit shadow-xl">
              <h3 className="font-bold text-accent uppercase mb-4">Add Team Achievement</h3>
              <form onSubmit={handleAddAchievement} className="flex flex-col gap-3">
                <input type="date" value={achDate} onChange={(e) => setAchDate(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />

                <div className="flex gap-3">
                  <select value={achPlacement} onChange={(e) => setAchPlacement(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none flex-1 text-sm">
                    <option value="Champion">Champion</option>
                    <option value="2nd Place">2nd Place</option>
                    <option value="3rd Place">3rd Place</option>
                    <option value="4th Place">4th Place</option>
                    <option value="Others">Others (Type your own)...</option>
                  </select>
                  {achPlacement === 'Others' && (
                    <input type="text" placeholder="Type placement *" value={customPlacement} onChange={(e) => setCustomPlacement(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none flex-1 text-sm" required />
                  )}
                </div>

                <input type="text" placeholder="Tournament Name" value={achTournament} onChange={(e) => setAchTournament(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <input type="text" placeholder="Venue (e.g. Kuala Lumpur, Online)" value={achVenue} onChange={(e) => setAchVenue(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" />
                <input type="text" placeholder="Achievement Image URL (Optional)" value={achImage} onChange={(e) => setAchImage(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" />
                <button type="submit" disabled={submitting} className="bg-yellow-700 hover:bg-yellow-600 font-bold uppercase py-2 rounded mt-2 text-white">Save Achievement</button>
              </form>
            </div>}

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
                    {canAchievements && <button onClick={() => deleteRecord('team_achievements', a.id)} className="bg-red-900 text-red-300 text-xs px-3 py-1.5 rounded">Delete</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Match Log' && (
          <div className="animate-fadeIn space-y-7">
            <div className="rounded-2xl border border-accent/40 bg-gradient-to-r from-[#24101c] to-[#151014] p-6 md:p-8">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent">Step 1 · Register the match</p>
              <h2 className="mt-2 text-2xl md:text-3xl font-black uppercase">Match Log</h2>
              <p className="mt-2 text-sm text-gray-300">Keep scores, screenshots and match reviews here. Player ratings are entered separately in Player Evaluation, after the match is registered.</p>
            </div>
            <div className="grid grid-cols-1 gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
              <div className="h-fit rounded-2xl border border-gray-800 bg-[#1a1a1a]/90 p-6 shadow-xl md:p-8">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <h3 className="font-black uppercase text-accent">{editingMatchId ? 'Edit Match Record' : 'Log Completed Match'}</h3>
                  {editingMatchId && <button type="button" onClick={resetMatchForm} className="rounded bg-gray-700 px-3 py-2 text-xs hover:bg-gray-600">Cancel Edit</button>}
                </div>
                {canMatches ? <form onSubmit={handleSaveMatch} className="flex flex-col gap-5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <label className="text-xs font-bold text-gray-400">Match date<input type="date" value={matchDate} onChange={(e) => setMatchDate(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-700 bg-[#121212] px-3 py-3 text-white outline-none focus:border-accent" required /></label>
                    <label className="text-xs font-bold text-gray-400">Type<select value={matchType} onChange={(e) => setMatchType(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-700 bg-[#121212] px-3 py-3 text-white outline-none focus:border-accent">
                      {MATCH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select></label>
                    <label className="text-xs font-bold text-gray-400">Opponent<input type="text" value={opponentName} placeholder="Opponent team" onChange={(e) => setOpponentName(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-700 bg-[#121212] px-3 py-3 text-white outline-none focus:border-accent" required /></label>
                  </div>
                  <label className="text-xs font-bold text-gray-400">Opponent logo URL (optional)
                    <input type="text" value={opponentLogo} onChange={(e) => setOpponentLogo(e.target.value)} placeholder="https://..." className="mt-2 w-full rounded-lg border border-gray-700 bg-[#121212] px-3 py-3 text-white outline-none focus:border-accent" />
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="text-xs font-bold text-gray-400">DAG score<input type="number" min="0" step="1" value={dagScore} onChange={(e) => setDagScore(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-700 bg-[#121212] px-3 py-3 text-white outline-none focus:border-accent" /></label>
                    <label className="text-xs font-bold text-gray-400">Opponent score<input type="number" min="0" step="1" value={oppScore} onChange={(e) => setOppScore(e.target.value)} className="mt-2 w-full rounded-lg border border-gray-700 bg-[#121212] px-3 py-3 text-white outline-none focus:border-accent" /></label>
                  </div>
                  <label className="text-sm font-bold text-gray-300">Full Match Review
                    <textarea rows={4} value={matchReview} onChange={(e) => setMatchReview(e.target.value)} placeholder="Team-level match analysis..." className="mt-2 w-full resize-y rounded-lg border border-gray-700 bg-[#121212] px-4 py-3 text-white outline-none focus:border-accent" />
                  </label>
                  <label className="text-sm font-bold text-gray-300">Match Result Screenshots (one URL per line)
                    <textarea rows={3} value={matchScreenshots} onChange={(e) => setMatchScreenshots(e.target.value)} placeholder="https://example.com/result.jpg" className="mt-2 w-full resize-y rounded-lg border border-gray-700 bg-[#121212] px-4 py-3 text-xs text-white outline-none focus:border-accent" />
                  </label>
                  <button type="submit" disabled={submitting} className="rounded-xl bg-accent px-6 py-4 font-black uppercase text-white hover:brightness-110 disabled:opacity-50">
                    {submitting ? 'Saving...' : editingMatchId ? 'Update Match Log' : 'Register Completed Match'}
                  </button>
                </form> : <p className="text-sm text-gray-400">Read-only match history. Contact a Coach or Manager to update results.</p>}
              </div>
              <MatchEvaluationTracker activeTeam={activeTeam} roster={roster} matches={completedMatches}
                onEvaluate={openMatchForEvaluation} onEdit={startEditMatch}
                canEdit={canMatches} canDelete={canDeleteMatches}
                onDelete={(id) => { void deleteRecord('matches', id); }} />
            </div>
          </div>
        )}

        {activeTab === 'Player Evaluation' && (
          <PlayerEvaluationPanel key={`${activeTeam}-${evalOpenVersion}`} activeTeam={activeTeam} roster={roster}
            matches={completedMatches} initialMatchId={focusEvalMatchId} />
        )}

        {activeTab === 'Weekly Report' && (
          <WeeklyReportPanel key={`${activeTeam}-${reportFocus?.playerId ?? 'all'}-${reportFocus?.weekStart ?? 'latest'}`}
            activeTeam={activeTeam} roster={roster} initialPlayerId={reportFocus?.playerId}
            initialWeekStart={reportFocus?.weekStart} />
        )}
      </div>
    </main>
  );
}
