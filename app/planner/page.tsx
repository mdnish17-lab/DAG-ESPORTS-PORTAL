"use client";

import Image from 'next/image';
import Link from 'next/link';
import DagHomeNavigation from '../../lib/DagHomeNavigation';
import { supabase } from '../../lib/supabase';
import { DEFAULT_TEAM, TEAMS } from '../../lib/teamTheme';
import { useEffect, useRef, useState } from 'react';


type Tool = 'move' | 'draw' | 'erase';
type Token = { id: string; team: 'blue' | 'red'; label: string; role: string; x: number; y: number; visible: boolean };
type Stroke = { id: number; color: string; width: number; points: [number, number][] };

const ROLES = [
  { label: 'E', role: 'Exp', bx: 60, by: 600 },
  { label: 'G', role: 'Gold', bx: 420, by: 945 },
  { label: 'R', role: 'Roam', bx: 200, by: 800 },
  { label: 'J', role: 'Jungle', bx: 200, by: 500 },
  { label: 'M', role: 'Mid', bx: 300, by: 700 },
];
const TEAM_COLOR = { blue: '#2563eb', red: '#dc2626' };
const PALETTE = ['#ffffff', '#facc15', '#22d3ee', '#4ade80', '#f87171', '#c084fc'];
const BRUSHES = [4, 8, 14];

const makeTokens = (): Token[] => [
  ...ROLES.map((r) => ({ id: `blue-${r.role}`, team: 'blue' as const, label: r.label, role: r.role, x: r.bx, y: r.by, visible: true })),
  ...ROLES.map((r) => ({ id: `red-${r.role}`, team: 'red' as const, label: r.label, role: r.role, x: 1000 - r.bx, y: 1000 - r.by, visible: true })),
];

export default function PlannerPage() {
  const [activeTeam, setActiveTeamState] = useState<string>(DEFAULT_TEAM);
  const [teamReady, setTeamReady] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem('dag-active-team');
    if (saved && TEAMS.includes(saved)) setActiveTeamState(saved);
    setTeamReady(true);
  }, []);

  const [tool, setTool] = useState<Tool>('move');
  const [color, setColor] = useState(PALETTE[1]);
  const [brush, setBrush] = useState(BRUSHES[1]);
  const [tokens, setTokens] = useState<Token[]>(makeTokens());
  const [strokes, setStrokes] = useState<Stroke[]>([]);

  const [planName, setPlanName] = useState('');
  const [opponent, setOpponent] = useState('');
  const [notes, setNotes] = useState('');
  const [loadedId, setLoadedId] = useState<number | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [canManage, setCanManage] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkManagement() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (active) setCanManage(false); return; }
      const { data, error } = await supabase.rpc('my_management_role');
      if (active) setCanManage(!error && (data === 'owner' || data === 'manager'));
    }
    void checkManagement();
    return () => { active = false; };
  }, []);

  const svgRef = useRef<SVGSVGElement>(null);
  const dragId = useRef<string | null>(null);
  const drawId = useRef<number | null>(null);
  const erasing = useRef(false);

  useEffect(() => {
    if (!teamReady) return;
    loadPlans();
    newPlan();
  }, [activeTeam, teamReady]);

  async function loadPlans() {
    const { data, error } = await supabase
      .from('planner_plans').select('*').eq('team', activeTeam).order('created_at', { ascending: false });
    if (error) console.error('Plans error:', error);
    setPlans(data || []);
  }

  function newPlan() {
    setTokens(makeTokens());
    setStrokes([]);
    setPlanName(''); setOpponent(''); setNotes('');
    setLoadedId(null);
  }

  const toSvg = (e: React.PointerEvent): [number, number] => {
    const r = svgRef.current!.getBoundingClientRect();
    return [((e.clientX - r.left) * 1000) / r.width, ((e.clientY - r.top) * 1000) / r.height];
  };

  const eraseAt = (p: [number, number]) =>
    setStrokes((prev) => prev.filter((s) => !s.points.some((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 24)));

  const onSvgDown = (e: React.PointerEvent) => {
    const p = toSvg(e);
    if (tool === 'draw') {
      svgRef.current!.setPointerCapture(e.pointerId);
      const id = Date.now();
      drawId.current = id;
      setStrokes((prev) => [...prev, { id, color, width: brush, points: [p] }]);
    } else if (tool === 'erase') {
      svgRef.current!.setPointerCapture(e.pointerId);
      erasing.current = true;
      eraseAt(p);
    }
  };

  const onTokenDown = (e: React.PointerEvent, id: string) => {
    if (tool !== 'move') return;
    e.stopPropagation();
    svgRef.current!.setPointerCapture(e.pointerId);
    dragId.current = id;
  };

  const onMove = (e: React.PointerEvent) => {
    const p = toSvg(e);
    if (dragId.current) {
      const id = dragId.current;
      const x = Math.min(980, Math.max(20, p[0]));
      const y = Math.min(980, Math.max(20, p[1]));
      setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, x, y } : t)));
    } else if (drawId.current) {
      const id = drawId.current;
      setStrokes((prev) => prev.map((s) => (s.id === id ? { ...s, points: [...s.points, p] } : s)));
    } else if (erasing.current) {
      eraseAt(p);
    }
  };

  const onUp = (e: React.PointerEvent) => {
    dragId.current = null;
    drawId.current = null;
    erasing.current = false;
    try { svgRef.current!.releasePointerCapture(e.pointerId); } catch {}
  };

  const toggleToken = (id: string) => setTokens((prev) => prev.map((t) => (t.id === id ? { ...t, visible: !t.visible } : t)));
  const setTeamVisible = (team: 'blue' | 'red', v: boolean) => setTokens((prev) => prev.map((t) => (t.team === team ? { ...t, visible: v } : t)));

  async function savePlan(asNew: boolean) {
    if (!canManage) { alert('Only approved managers can save plans.'); return; }
    if (!planName.trim()) { alert('Give the plan a name first.'); return; }
    setSaving(true);
    const payload = {
      team: activeTeam,
      name: planName.trim(),
      opponent: opponent.trim() || null,
      notes: notes.trim() || null,
      data: { tokens, strokes },
    };
    const res = loadedId && !asNew
      ? await supabase.from('planner_plans').update(payload).eq('id', loadedId).select()
      : await supabase.from('planner_plans').insert(payload).select();
    setSaving(false);
    if (res.error) { alert('Failed to save plan: ' + res.error.message); return; }
    if (!res.data || res.data.length === 0) { alert('Nothing was saved. Check the planner_plans policies in Supabase.'); return; }
    setLoadedId(res.data[0].id);
    alert(loadedId && !asNew ? 'Plan updated!' : 'Plan saved!');
    loadPlans();
  }

  function openPlan(p: any) {
    setTokens(p.data?.tokens?.length ? p.data.tokens : makeTokens());
    setStrokes(p.data?.strokes || []);
    setPlanName(p.name || '');
    setOpponent(p.opponent || '');
    setNotes(p.notes || '');
    setLoadedId(p.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deletePlan(id: number) {
    if (!canManage) { alert('Only approved managers can delete plans.'); return; }
    if (!confirm('Delete this plan?')) return;
    const { error } = await supabase.from('planner_plans').delete().eq('id', id);
    if (error) { alert('Delete failed: ' + error.message); return; }
    if (loadedId === id) setLoadedId(null);
    loadPlans();
  }

  const toolBtn = (active: boolean) =>
    `w-12 h-12 rounded-xl border text-xl flex items-center justify-center transition-all ${
      active ? 'bg-accent border-accent text-white shadow-[0_0_15px_var(--accent-glow)]' : 'bg-[#1a1a1a]/90 border-gray-800 text-gray-300 hover:border-accent hover:text-white'}`;

  const renderTeamPanel = (team: 'blue' | 'red') => {
    const list = tokens.filter((t) => t.team === team);
    const allVisible = list.every((t) => t.visible);
    return (
      <div className="bg-[#1a1a1a]/80 backdrop-blur p-4 rounded-xl border border-gray-800 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className={`font-black uppercase tracking-wider ${team === 'blue' ? 'text-blue-400' : 'text-red-400'}`}>{team} team</h3>
          <button onClick={() => setTeamVisible(team, !allVisible)} className="text-xs text-gray-400 hover:text-white" title="Show / hide all">
            {allVisible ? '👁 Hide all' : '🚫 Show all'}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {list.map((t) => (
            <button key={t.id} onClick={() => toggleToken(t.id)}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg border text-left transition-all ${t.visible ? 'border-gray-700 bg-black/30' : 'border-gray-800 bg-black/10 opacity-50'}`}>
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-black text-white" style={{ background: TEAM_COLOR[team] }}>{t.label}</span>
              <span className="text-sm font-semibold flex-1">{t.role}</span>
              <span className="text-xs">{t.visible ? '👁' : '🚫'}</span>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#090a0d] text-white flex flex-col items-center pt-10 md:pt-16 p-4 md:p-10 pb-20 relative overflow-hidden">
      <div className="relative z-10 w-full max-w-6xl flex flex-col items-center">
        <div className="relative w-full rounded-2xl border border-gray-700 bg-[#14171d] p-5 shadow-lg sm:p-8">
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <Image src="/dag-logo.jpg" alt="DAG Esports logo" width={104} height={104}
              className="h-20 w-20 rounded-full object-contain sm:h-24 sm:w-24" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.35em] text-gray-400">De Ant Gaming</p>
              <h1 className="mt-2 text-3xl font-black uppercase tracking-wide text-white sm:text-5xl">Strategy Planner</h1>
              <p className="mt-2 text-sm text-gray-300">A distraction-free workspace for positioning, rotations and tactical drawings.</p>
              <p className="mt-2 text-xs text-gray-400">Existing plans remain saved under their original team context: <strong className="text-gray-200">{activeTeam}</strong>.</p>
            </div>
          </div>
        </div>

        <DagHomeNavigation current="planner" />

        <div className="w-full grid grid-cols-1 lg:grid-cols-[64px_minmax(0,1fr)_320px] gap-4">
          {/* Toolbar */}
          <div className="flex lg:flex-col gap-2 flex-wrap justify-center lg:justify-start">
            <button className={toolBtn(tool === 'move')} onClick={() => setTool('move')} title="Move players">✥</button>
            <button className={toolBtn(tool === 'draw')} onClick={() => setTool('draw')} title="Draw">✏️</button>
            <button className={toolBtn(tool === 'erase')} onClick={() => setTool('erase')} title="Eraser">🧽</button>
            <button className={toolBtn(false)} onClick={() => setStrokes((p) => p.slice(0, -1))} title="Undo last stroke">↶</button>
            <button className={toolBtn(false)} onClick={() => setStrokes([])} title="Clear drawings">🗑</button>
            <button className={toolBtn(false)} onClick={() => setTokens(makeTokens())} title="Reset player positions">⟲</button>
          </div>

          {/* Map */}
          <div className="flex flex-col items-center gap-3 min-w-0">
            <div className="w-full max-w-[760px] flex items-center justify-between gap-3 flex-wrap bg-[#1a1a1a]/80 border border-gray-800 rounded-xl px-4 py-2">
              <div className="flex items-center gap-2">
                {PALETTE.map((c) => (
                  <button key={c} onClick={() => { setColor(c); setTool('draw'); }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-125' : 'border-transparent'}`} style={{ background: c }} title="Brush color" />
                ))}
              </div>
              <div className="flex items-center gap-2">
                {BRUSHES.map((b) => (
                  <button key={b} onClick={() => { setBrush(b); setTool('draw'); }}
                    className={`w-8 h-8 rounded-lg border flex items-center justify-center ${brush === b ? 'border-accent bg-accent/20' : 'border-gray-700'}`} title="Brush size">
                    <span className="rounded-full bg-white" style={{ width: b + 2, height: b + 2 }}></span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] uppercase tracking-widest text-gray-500">
                {tool === 'move' ? 'Drag players' : tool === 'draw' ? 'Draw on map' : 'Drag to erase'}
              </p>
            </div>

            <svg ref={svgRef} viewBox="0 0 1000 1000"
              className="w-full max-w-[760px] aspect-square rounded-3xl shadow-2xl border border-gray-600 select-none bg-[#0e1a1f]"
              style={{ touchAction: 'none', cursor: tool === 'move' ? 'default' : tool === 'draw' ? 'crosshair' : 'cell' }}
              onPointerDown={onSvgDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
              <image href="/planner-map.webp" x="0" y="0" width="1000" height="1000" preserveAspectRatio="xMidYMid meet" style={{ pointerEvents: 'none' }} />
              {strokes.map((s) => (
                <polyline key={s.id}
                  points={(s.points.length === 1 ? [s.points[0], s.points[0]] : s.points).map((p) => p.join(',')).join(' ')}
                  fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {tokens.filter((t) => t.visible).map((t) => (
                <g key={t.id} transform={`translate(${t.x} ${t.y})`} onPointerDown={(e) => onTokenDown(e, t.id)} style={{ cursor: tool === 'move' ? 'grab' : 'inherit' }}>
                  <circle r="26" fill={TEAM_COLOR[t.team]} stroke="#ffffff" strokeWidth="4" />
                  <text textAnchor="middle" dominantBaseline="central" fontSize="26" fontWeight="800" fill="#ffffff" style={{ pointerEvents: 'none' }}>{t.label}</text>
                </g>
              ))}
            </svg>
            <p className="text-[10px] text-gray-500 text-center max-w-[760px]">
              Map artwork © Moonton. Fan-made planning tool, not affiliated with or endorsed by Moonton.
            </p>
          </div>

          {/* Right panel */}
          <div className="flex flex-col gap-4">
            {renderTeamPanel('blue')}
            {renderTeamPanel('red')}

            <div className="bg-[#1a1a1a]/80 backdrop-blur p-4 rounded-xl border border-gray-800 shadow-lg">
              <h3 className="font-black uppercase tracking-wider text-accent mb-3">{loadedId ? 'Editing Plan' : 'Save Plan'}</h3>
              <div className="flex flex-col gap-2">
                <input type="text" placeholder="Plan name *" value={planName} onChange={(e) => setPlanName(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" />
                <input type="text" placeholder="Opponent (optional)" value={opponent} onChange={(e) => setOpponent(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none" />
                <textarea rows={4} placeholder="Notes: rotations, objective timings..." value={notes} onChange={(e) => setNotes(e.target.value)} className="bg-[#121212] border border-gray-700 rounded px-3 py-2 text-sm outline-none resize-none" />
                {canManage ? (
                  <div className="flex gap-2">
                    <button onClick={() => savePlan(false)} disabled={saving} className="flex-1 bg-accent hover:bg-accent-dark font-bold uppercase text-sm py-2 rounded transition-colors">
                      {saving ? 'Saving...' : loadedId ? 'Update' : 'Save'}
                    </button>
                    {loadedId && (
                      <button onClick={() => savePlan(true)} disabled={saving} className="flex-1 bg-gray-700 hover:bg-gray-600 font-bold uppercase text-sm py-2 rounded transition-colors">Save as new</button>
                    )}
                  </div>
                ) : (
                  <p className="rounded-lg border border-pink-400/30 bg-pink-400/10 p-2 text-xs text-gray-200">Public preview: edit the map here, but only approved managers can save plans. <Link href="/admin/login" className="text-pink-300 underline">Management login</Link></p>
                )}
                <button onClick={newPlan} className="text-xs text-gray-400 hover:text-white mt-1">+ Start a blank plan</button>
              </div>
            </div>

            <div className="bg-[#1a1a1a]/80 backdrop-blur p-4 rounded-xl border border-gray-800 shadow-lg">
              <h3 className="font-black uppercase tracking-wider text-accent mb-3">Saved Plans ({plans.length})</h3>
              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                {plans.length === 0 && <p className="text-gray-500 italic text-sm">No saved plans yet.</p>}
                {plans.map((p) => (
                  <div key={p.id} className={`bg-[#121212] border rounded-lg p-3 flex items-center justify-between gap-2 ${loadedId === p.id ? 'border-accent' : 'border-gray-800'}`}>
                    <button onClick={() => openPlan(p)} className="text-left min-w-0 flex-1">
                      <p className="font-bold text-sm truncate">{p.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{p.opponent ? `vs ${p.opponent} · ` : ''}{new Date(p.created_at).toLocaleDateString('en-GB')}</p>
                    </button>
                    {canManage && <button onClick={() => deletePlan(p.id)} className="bg-red-900/60 hover:bg-red-800 text-red-300 text-xs px-2 py-1 rounded">Del</button>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}