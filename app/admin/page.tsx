"use client";

import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { useEffect, useState } from 'react';

type PlayerMatchState = {
  attended: boolean;
  status: 'played' | 'bench';
  kills: string;
  deaths: string;
  assists: string;
  macro: number;
  micro: number;
  kda_score: number;
  mentality: number;
  comment: string;
};

const ROLES = ['Coach', 'Midlaner', 'Jungler', 'Roamer', 'Goldlaner', 'Explaner'];
const TEAMS = ['DAG Ladies', 'DAG Montrix'];
const MATCH_TYPES = ['Scrim', 'Tournament', 'Scrim Bracket'];

export default function AdminPage() {
  const [activeTeam, setActiveTeam] = useState('DAG Ladies');
  const [activeTab, setActiveTab] = useState<'Guide' | 'Roster' | 'Matches' | 'Upcoming' | 'Achievements'>('Guide');

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
  const [playerMatch, setPlayerMatch] = useState<Record<number, PlayerMatchState>>({});

  // --- Upcoming Match Form State ---
  const [upDate, setUpDate] = useState('');
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
  const [newStay, setNewStay] = useState('');
  const [newAchievements, setNewAchievements] = useState('');
  
  // --- Achievement Form State ---
  const [achDate, setAchDate] = useState('');
  const [achPlacement, setAchPlacement] = useState('');
  const [achVenue, setAchVenue] = useState('');
  const [achImage, setAchImage] = useState('');

  // --- Edit Player Form State ---
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    ign: '', role: 'Midlaner', main_hero: '', image_url: '',
    full_name: '', age: '', stay: '', achievements: '',
  });

  useEffect(() => {
    loadData();
  }, [activeTeam]);

  async function loadData() {
    const { data: players } = await supabase.from('players').select('*').eq('team', activeTeam).order('id');
    if (players) {
      setRoster(players);
      const init: Record<number, PlayerMatchState> = {};
      players.forEach((p: any) => {
        init[p.id] = { attended: false, status: 'played', kills: '0', deaths: '0', assists: '0', macro: 3, micro: 3, kda_score: 3, mentality: 3, comment: '' };
      });
      setPlayerMatch(init);
    }

    const { data: matches } = await supabase.from('matches').select('*').eq('team', activeTeam).order('match_date', { ascending: false });
    if (matches) {
      const today = new Date().toISOString().split('T')[0];
      const needsTransfer = matches.filter(m => m.status === 'upcoming' && m.match_date < today);
      
      if (needsTransfer.length > 0) {
        for (const m of needsTransfer) {
          await supabase.from('matches').update({ status: 'completed', result: 'DRAW' }).eq('id', m.id);
        }
        const { data: refreshedMatches } = await supabase.from('matches').select('*').eq('team', activeTeam).order('match_date', { ascending: false });
        setAllMatches(refreshedMatches || []);
      } else {
        setAllMatches(matches);
      }
    }

    const { data: ach } = await supabase.from('team_achievements').select('*').eq('team', activeTeam).order('date', { ascending: false });
    if (ach) setAchievements(ach);
  }

  const completedMatches = allMatches.filter(m => m.status === 'completed');
  const upcomingMatchesList = allMatches.filter(m => m.status === 'upcoming');

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
    
    const attendedPlayers = roster.filter((p) => playerMatch[p.id]?.attended);
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
        match_review: matchReview.trim() || null
      };

      let matchId = editingMatchId;

      if (editingMatchId) {
        await supabase.from('matches').update(matchPayload).eq('id', editingMatchId);
        await supabase.from('match_player_stats').delete().eq('match_id', editingMatchId); 
      } else {
        const { data: matchData, error: matchError } = await supabase.from('matches').insert(matchPayload).select('id').single();
        if (matchError) throw matchError;
        matchId = matchData.id;
      }

      if (attendedPlayers.length > 0) {
        const statsRows = attendedPlayers.map((p) => {
          const s = playerMatch[p.id];
          const isPlayed = s.status === 'played';
          return {
            match_id: matchId,
            ign: p.ign,
            status: s.status,
            kills: isPlayed ? Number(s.kills) || 0 : 0,
            deaths: isPlayed ? Number(s.deaths) || 0 : 0,
            assists: isPlayed ? Number(s.assists) || 0 : 0,
            macro_score: isPlayed ? s.macro : 0,
            micro_score: isPlayed ? s.micro : 0,
            kda_score: isPlayed ? s.kda_score : 0,
            mentality_score: isPlayed ? s.mentality : 0,
            coach_comment: s.comment.trim() || null,
          };
        });
        await supabase.from('match_player_stats').insert(statsRows);
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
    setMatchDate(''); setMatchType('Scrim'); setOpponentName(''); setOpponentLogo(''); setDagScore('0'); setOppScore('0'); setMatchReview('');
    const init: Record<number, PlayerMatchState> = {};
    roster.forEach((p: any) => {
      init[p.id] = { attended: false, status: 'played', kills: '0', deaths: '0', assists: '0', macro: 3, micro: 3, kda_score: 3, mentality: 3, comment: '' };
    });
    setPlayerMatch(init);
  }

  async function startEditMatch(m: any) {
    setEditingMatchId(m.id);
    setMatchDate(m.match_date);
    setMatchType(m.match_type || 'Scrim');
    setOpponentName(m.opponent_name);
    setOpponentLogo(m.opponent_logo || '');
    setDagScore(String(m.dag_score));
    setOppScore(String(m.opponent_score));
    setMatchReview(m.match_review || '');

    const { data: stats } = await supabase.from('match_player_stats').select('*').eq('match_id', m.id);
    const updatedForm = { ...playerMatch };
    
    if (stats) {
      stats.forEach(s => {
        const player = roster.find(p => p.ign === s.ign);
        if (player) {
          updatedForm[player.id] = {
            attended: true,
            status: s.status,
            kills: String(s.kills), deaths: String(s.deaths), assists: String(s.assists),
            macro: s.macro_score || 3, micro: s.micro_score || 3, kda_score: s.kda_score || 3, mentality: s.mentality_score || 3,
            comment: s.coach_comment || ''
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
    await supabase.from('matches').insert({
      team: activeTeam, status: 'upcoming', match_type: upMatchType, match_date: upDate, opponent_name: upOpponent.trim(), opponent_logo: upLogo.trim() || null,
    });
    setSubmitting(false);
    alert('Upcoming match scheduled!');
    setUpDate(''); setUpOpponent(''); setUpLogo(''); setUpMatchType('Scrim');
    loadData();
  }

  async function handleAddAchievement(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await supabase.from('team_achievements').insert({
      team: activeTeam, date: achDate, placement: achPlacement, venue: achVenue, image_url: achImage
    });
    setSubmitting(false);
    alert('Achievement added!');
    setAchDate(''); setAchPlacement(''); setAchVenue(''); setAchImage('');
    loadData();
  }

  async function deleteRecord(table: string, id: number) {
    if (!confirm('Are you sure you want to delete this?')) return;
    if (table === 'matches') await supabase.from('match_player_stats').delete().eq('match_id', id);
    await supabase.from(table).delete().eq('id', id);
    loadData();
  }

  async function handleAddPlayer(e: React.FormEvent) {
    e.preventDefault();
    if (!newIgn.trim()) return;
    setAddingPlayer(true);
    const { error } = await supabase.from('players').insert({
      team: activeTeam, ign: newIgn.trim(), role: newRole, main_hero: newMainHero.trim() || null, image_url: newImageUrl.trim() || null,
      full_name: newFullName.trim() || null, age: newAge ? Number(newAge) : null, stay: newStay.trim() || null, achievements: newAchievements.trim() || null,
    });
    setAddingPlayer(false);
    if (!error) {
      alert('Player added!');
      setNewIgn(''); setNewRole('Midlaner'); setNewMainHero(''); setNewImageUrl(''); setNewFullName(''); setNewAge(''); setNewStay(''); setNewAchievements('');
      loadData();
    } else {
      alert('Error: ' + error.message);
    }
  }

  async function removePlayer(id: number, ign: string) {
    if (!confirm(`Remove ${ign}?`)) return;
    await supabase.from('players').delete().eq('id', id);
    loadData();
  }

  function startEdit(p: any) {
    setEditingId(p.id);
    setEditForm({
      ign: p.ign || '', role: p.role || 'Midlaner', main_hero: p.main_hero || '', image_url: p.image_url || '',
      full_name: p.full_name || '', age: p.age != null ? String(p.age) : '', stay: p.stay || '', achievements: p.achievements || '',
    });
  }

  async function saveEdit(id: number) {
    const { error } = await supabase.from('players').update({
      ign: editForm.ign.trim(), role: editForm.role, main_hero: editForm.main_hero.trim() || null, image_url: editForm.image_url.trim() || null,
      full_name: editForm.full_name.trim() || null, age: editForm.age ? Number(editForm.age) : null, stay: editForm.stay.trim() || null, achievements: editForm.achievements.trim() || null,
    }).eq('id', id);
    if (error) { alert('Failed to update player: ' + error.message); return; }
    setEditingId(null);
    loadData();
  }

  return (
    <main className="min-h-screen bg-[#0a0508] text-white p-6 md:p-10 relative overflow-hidden">
      
      {/* BACKGROUND WALLPAPER */}
      <div className="fixed inset-0 z-0 pointer-events-none flex items-center justify-center">
        <div className="absolute inset-0 bg-gradient-to-b from-[#121212]/90 via-[#121212]/80 to-[#121212] z-10"></div>
        <img src="/dag-logo.jpg" alt="DAG Wallpaper" className="w-[150vw] md:w-[70vw] opacity-15 blur-[2px] grayscale-[30%] mix-blend-lighten z-0 object-contain" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        
        {/* Navigation & Toggle */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-8">
          <Link href="/" className="bg-gray-800/80 backdrop-blur hover:bg-gray-700 px-4 py-2 rounded text-sm font-bold uppercase transition-colors">← Dashboard</Link>
          <div className="flex gap-2">
            {TEAMS.map(team => (
              <button key={team} onClick={() => { setActiveTeam(team); resetMatchForm(); }}
                className={`px-6 py-2 rounded-full font-extrabold tracking-wider uppercase transition-colors border-2 ${activeTeam === team ? 'border-[#ec2b7a] bg-[#ec2b7a] text-white' : 'border-gray-800 bg-black/50 backdrop-blur text-gray-400 hover:border-gray-600'}`}>
                {team}
              </button>
            ))}
          </div>
        </div>

        {/* Tab System */}
        <div className="flex border-b border-gray-800 mb-8 overflow-x-auto">
          {['Guide', 'Roster', 'Matches', 'Upcoming', 'Achievements'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 font-bold uppercase tracking-widest transition-colors whitespace-nowrap ${activeTab === tab ? 'text-[#ec2b7a] border-b-2 border-[#ec2b7a]' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab === 'Matches' ? 'Match & Evaluations' : tab}
            </button>
          ))}
        </div>

        {activeTab === 'Guide' && (
          <div className="bg-[#1a1a1a]/80 backdrop-blur p-8 rounded-xl border border-gray-800 shadow-xl">
            <h2 className="text-2xl font-extrabold text-[#ec2b7a] uppercase mb-4">Coach / Manager Guide</h2>
            <div className="space-y-4 text-gray-300">
              <p><strong>1. Managing the Roster:</strong> Go to the Roster tab to add players or coaches. Make sure you are in the correct team view (Ladies or Montrix) before adding them.</p>
              <p><strong>2. Upcoming Matches Auto-Transfer:</strong> Any match scheduled in "Upcoming" will automatically transfer to "Matches" once the date passes. You can then click "Edit" on it to fill in the scores and player stats!</p>
              <p><strong>3. Player Evaluation System:</strong> When logging a match, rate your active players from 1 to 5 on Macro, Micro, KDA, and Mentality. This calculates if they are Excellent (Green), Average (Yellow), or Bad (Red) in the performance tab.</p>
              <p><strong>4. Team Achievements:</strong> Add offline/online tournament placements in the Achievements tab to display them on the new Team Performance page.</p>
            </div>
          </div>
        )}

        {activeTab === 'Roster' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-fadeIn">
            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 xl:col-span-1 h-fit shadow-xl">
              <h3 className="font-bold text-[#ec2b7a] uppercase tracking-wider mb-4">Add New Member</h3>
              <form onSubmit={handleAddPlayer} className="flex flex-col gap-3">
                <input type="text" placeholder="IGN *" value={newIgn} onChange={(e) => setNewIgn(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" required />
                <select value={newRole} onChange={(e) => setNewRole(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none">
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <input type="text" placeholder="Full Name" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" />
                <input type="number" placeholder="Age" value={newAge} onChange={(e) => setNewAge(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" />
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
              <h3 className="font-bold text-[#ec2b7a] uppercase tracking-wider mb-4">Current Roster ({roster.length})</h3>
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
                            <input type="number" value={editForm.age} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs" placeholder="Age" />
                            <input type="text" value={editForm.stay} onChange={(e) => setEditForm({ ...editForm, stay: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs" placeholder="Stay" />
                            <input type="text" value={editForm.main_hero} onChange={(e) => setEditForm({ ...editForm, main_hero: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs" placeholder="Signature Hero" />
                            <input type="text" value={editForm.image_url} onChange={(e) => setEditForm({ ...editForm, image_url: e.target.value })} className="bg-[#1a1a1a] border border-gray-700 rounded px-2 py-2 text-white text-xs col-span-2" placeholder="Image URL" />
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
                              <img src={p.image_url} alt={p.ign} className="w-10 h-10 rounded-full object-cover object-top border border-[#ec2b7a] flex-shrink-0" />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#2a0a18] border border-[#ec2b7a] flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-bold">{p.ign ? p.ign.charAt(0).toUpperCase() : '?'}</span>
                              </div>
                            )}
                            <div>
                              <p className="font-bold">{p.ign} <span className="text-[#ec2b7a] text-xs ml-1">({p.role})</span></p>
                              <p className="text-xs text-gray-400">
                                {p.full_name || 'No Name'} {p.age ? `· ${p.age}y` : ''} {p.stay ? `· ${p.stay}` : ''}
                              </p>
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
              <h3 className="font-bold text-[#ec2b7a] uppercase mb-4">Schedule Upcoming Match</h3>
              <form onSubmit={handleAddUpcomingMatch} className="flex flex-col gap-3">
                <input type="date" value={upDate} onChange={e => setUpDate(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <div className="flex gap-3">
                  <select value={upMatchType} onChange={e => setUpMatchType(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none w-1/3 text-sm">
                    {MATCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="text" placeholder="Opponent Name *" value={upOpponent} onChange={e => setUpOpponent(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none w-2/3" required />
                </div>
                <input type="text" placeholder="Opponent Logo URL" value={upLogo} onChange={e => setUpLogo(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" />
                <button type="submit" disabled={submitting} className="bg-blue-700 hover:bg-blue-600 font-bold uppercase py-2 rounded mt-2 text-white">Add to Schedule</button>
              </form>
            </div>

            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 shadow-xl">
              <h3 className="font-bold text-[#ec2b7a] uppercase mb-4">Scheduled Matches</h3>
              <div className="flex flex-col gap-3">
                {upcomingMatchesList.map(m => (
                  <div key={m.id} className="bg-[#121212] border border-gray-800 p-4 rounded flex justify-between items-center">
                    <div>
                      <p className="text-[#ec2b7a] text-xs font-bold">{m.match_date}</p>
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
              <h3 className="font-bold text-[#ec2b7a] uppercase mb-4">Add Team Achievement</h3>
              <form onSubmit={handleAddAchievement} className="flex flex-col gap-3">
                <input type="date" value={achDate} onChange={e => setAchDate(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <input type="text" placeholder="Placement (e.g. Champion, 1st Runner Up)" value={achPlacement} onChange={e => setAchPlacement(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <input type="text" placeholder="Tournament Name / Venue" value={achVenue} onChange={e => setAchVenue(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <input type="text" placeholder="Achievement Image URL" value={achImage} onChange={e => setAchImage(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 outline-none" required />
                <button type="submit" disabled={submitting} className="bg-yellow-700 hover:bg-yellow-600 font-bold uppercase py-2 rounded mt-2 text-white">Save Achievement</button>
              </form>
            </div>

            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 shadow-xl">
              <h3 className="font-bold text-[#ec2b7a] uppercase mb-4">Past Achievements</h3>
              <div className="flex flex-col gap-3">
                {achievements.map(a => (
                  <div key={a.id} className="bg-[#121212] border border-gray-800 p-4 rounded flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <img src={a.image_url} alt="ach" className="w-12 h-12 object-cover rounded" />
                      <div>
                        <p className="text-yellow-500 font-black">{a.placement}</p>
                        <p className="text-sm font-bold">{a.venue}</p>
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
                <h3 className="font-bold text-[#ec2b7a] uppercase">{editingMatchId ? 'Edit Match Record' : 'Log Completed Match'}</h3>
                {editingMatchId && <button onClick={resetMatchForm} className="text-xs bg-gray-700 px-2 py-1 rounded hover:bg-gray-600">Cancel Edit</button>}
              </div>
              <form onSubmit={handleSaveMatch} className="flex flex-col gap-4">
                <div className="flex gap-3">
                  <input type="date" value={matchDate} onChange={e => setMatchDate(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-1/3 outline-none" required />
                  <select value={matchType} onChange={e => setMatchType(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-1/3 outline-none text-sm">
                    {MATCH_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <input type="text" placeholder="Opponent *" value={opponentName} onChange={e => setOpponentName(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-1/3 outline-none" required />
                </div>
                
                <input type="text" placeholder="Opponent Logo URL" value={opponentLogo} onChange={e => setOpponentLogo(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-full outline-none" />

                <div className="flex gap-3">
                  <div className="w-1/2"><label className="text-xs text-gray-500 uppercase">DAG Score</label><input type="number" value={dagScore} onChange={e => setDagScore(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-full outline-none" /></div>
                  <div className="w-1/2"><label className="text-xs text-gray-500 uppercase">Opp Score</label><input type="number" value={oppScore} onChange={e => setOppScore(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-full outline-none" /></div>
                </div>

                <div>
                  <label className="text-xs text-gray-500 uppercase mb-1 block">Full Match Review</label>
                  <textarea rows={3} placeholder="Coach match analysis..." value={matchReview} onChange={e => setMatchReview(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 w-full outline-none resize-none" />
                </div>

                <div className="border-t border-gray-800/50 pt-4 mt-2">
                  <h4 className="text-sm font-bold text-gray-300 uppercase mb-3">Player Attendance & Evaluations (Scale 1-5)</h4>
                  <div className="max-h-[400px] overflow-y-auto flex flex-col gap-2 pr-2">
                    {roster.map(p => {
                      const pm = playerMatch[p.id];
                      if (!pm) return null;
                      return (
                        <div key={p.id} className={`bg-[#121212] p-3 border rounded ${pm.attended ? 'border-[#ec2b7a]' : 'border-gray-800'}`}>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={pm.attended} onChange={e => updatePlayerMatch(p.id, 'attended', e.target.checked)} className="accent-[#ec2b7a]" />
                            <span className="font-bold text-sm">{p.ign} <span className="text-[#ec2b7a] text-xs">({p.role})</span></span>
                          </label>
                          {pm.attended && (
                            <div className="mt-3 pl-6">
                              <select value={pm.status} onChange={e => updatePlayerMatch(p.id, 'status', e.target.value)} className="bg-[#1a1a1a] text-xs border border-gray-700 rounded p-1 mb-2">
                                <option value="played">Played Match</option>
                                <option value="bench">Benched</option>
                              </select>
                              {pm.status === 'played' && p.role.toLowerCase() !== 'coach' && (
                                <>
                                  <div className="grid grid-cols-3 gap-1 mb-2">
                                    <input type="number" placeholder="K" value={pm.kills} onChange={e => updatePlayerMatch(p.id, 'kills', e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded p-1 text-center text-xs" title="Kills" />
                                    <input type="number" placeholder="D" value={pm.deaths} onChange={e => updatePlayerMatch(p.id, 'deaths', e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded p-1 text-center text-xs" title="Deaths" />
                                    <input type="number" placeholder="A" value={pm.assists} onChange={e => updatePlayerMatch(p.id, 'assists', e.target.value)} className="bg-[#1a1a1a] border border-gray-700 rounded p-1 text-center text-xs" title="Assists" />
                                  </div>
                                  <div className="grid grid-cols-4 gap-1 mb-2 text-center text-[10px] text-gray-400">
                                    <div>Macro<input type="range" min="1" max="5" value={pm.macro} onChange={e => updatePlayerMatch(p.id, 'macro', Number(e.target.value))} className="w-full accent-[#ec2b7a]" /><span>{pm.macro}</span></div>
                                    <div>Micro<input type="range" min="1" max="5" value={pm.micro} onChange={e => updatePlayerMatch(p.id, 'micro', Number(e.target.value))} className="w-full accent-[#ec2b7a]" /><span>{pm.micro}</span></div>
                                    <div>KDA<input type="range" min="1" max="5" value={pm.kda_score} onChange={e => updatePlayerMatch(p.id, 'kda_score', Number(e.target.value))} className="w-full accent-[#ec2b7a]" /><span>{pm.kda_score}</span></div>
                                    <div>Mental<input type="range" min="1" max="5" value={pm.mentality} onChange={e => updatePlayerMatch(p.id, 'mentality', Number(e.target.value))} className="w-full accent-[#ec2b7a]" /><span>{pm.mentality}</span></div>
                                  </div>
                                </>
                              )}
                              <input type="text" placeholder="Individual feedback..." value={pm.comment} onChange={e => updatePlayerMatch(p.id, 'comment', e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-700 rounded p-2 text-xs outline-none" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button type="submit" disabled={submitting} className={`${editingMatchId ? 'bg-blue-600 hover:bg-blue-500' : 'bg-[#ec2b7a] hover:bg-[#c92468]'} text-white font-extrabold uppercase py-3 rounded mt-2`}>
                  {submitting ? 'Saving...' : editingMatchId ? 'Update Match Record' : 'Publish Match Record'}
                </button>
              </form>
            </div>

            <div className="bg-[#1a1a1a]/80 backdrop-blur p-6 rounded-xl border border-gray-800 shadow-xl">
              <h3 className="font-bold text-[#ec2b7a] uppercase mb-4">Matches (Click to Edit)</h3>
              <div className="flex flex-col gap-3 max-h-[700px] overflow-y-auto pr-2">
                {completedMatches.map(m => (
                  <div key={m.id} className="bg-[#121212] border border-gray-800 p-4 rounded flex justify-between items-center group">
                    <div className="cursor-pointer flex-1" onClick={() => startEditMatch(m)}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-xs text-gray-500 group-hover:text-[#ec2b7a] transition-colors">{m.match_date}</p>
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