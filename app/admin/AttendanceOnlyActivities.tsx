"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';

export const ATTENDANCE_ONLY_TYPES = ['Rank', 'MLBB Rising Open (MRO)'] as const;
export type AttendanceOnlyType = (typeof ATTENDANCE_ONLY_TYPES)[number];

export function isAttendanceOnlyType(type: string): type is AttendanceOnlyType {
  return ATTENDANCE_ONLY_TYPES.some((item) => item === type);
}

type Member = { id: number; ign: string; role?: string | null };
type AttendanceStatus = 'present' | 'absent';
type AttendanceMember = {
  activity_id: number;
  member_id: number;
  ign_snapshot: string;
  status: AttendanceStatus;
};
type Activity = {
  id: number;
  team: string;
  activity_type: AttendanceOnlyType;
  activity_date: string;
  result_screenshots: string | null;
  members: AttendanceMember[];
};

type Props = {
  activeTeam: string;
  roster: Member[];
  activityType: AttendanceOnlyType;
  canDelete: boolean;
};

const fieldClass = 'mt-2 w-full rounded-lg border border-gray-700 bg-[#121212] px-3 py-3 text-white outline-none focus:border-accent';
const screenshotLinks = (value: string | null) =>
  (value || '').split('\n').map((url) => url.trim()).filter((url) => /^https?:\/\/\S+$/i.test(url));

export default function AttendanceOnlyActivities({ activeTeam, roster, activityType, canDelete }: Props) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [date, setDate] = useState('');
  const [screenshots, setScreenshots] = useState('');
  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus | ''>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      const { data: sessions, error: sessionError } = await supabase
        .from('attendance_only_activities')
        .select('id,team,activity_type,activity_date,result_screenshots')
        .eq('team', activeTeam)
        .order('activity_date', { ascending: false })
        .limit(500);
      if (cancelled) return;
      if (sessionError) {
        setError('Attendance-only activities are unavailable. Apply supabase/16_RANK_MRO_ATTENDANCE_ONLY.sql first. ' + sessionError.message);
        setActivities([]);
        setLoading(false);
        return;
      }
      const ids = (sessions || []).map((item) => item.id);
      const members: AttendanceMember[] = [];
      for (let index = 0; index < ids.length; index += 40) {
        const { data, error: memberError } = await supabase
          .from('attendance_only_activity_members')
          .select('activity_id,member_id,ign_snapshot,status')
          .in('activity_id', ids.slice(index, index + 40));
        if (cancelled) return;
        if (memberError) {
          setError('Unable to load attendance: ' + memberError.message);
          setLoading(false);
          return;
        }
        members.push(...((data || []) as AttendanceMember[]));
      }
      setActivities((sessions || []).map((activity) => ({
        ...activity,
        members: members.filter((member) => member.activity_id === activity.id),
      })) as Activity[]);
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [activeTeam, refresh]);

  const shown = useMemo(() => activities.filter((activity) => activity.activity_type === activityType),
    [activities, activityType]);
  const recorded = roster.filter((member) => attendance[member.id]).length;

  function reset() {
    setEditingId(null);
    setDate('');
    setScreenshots('');
    setAttendance({});
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!date || roster.length === 0 || recorded !== roster.length) {
      setError('Choose a date and record Present or Absent for every player and staff member.');
      return;
    }
    if (screenshots.trim() && screenshotLinks(screenshots).length !== screenshots.split('\n').filter((line) => line.trim()).length) {
      setError('Every screenshot must be a complete http:// or https:// URL, one per line.');
      return;
    }
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.rpc('save_attendance_only_activity', {
      p_activity_id: editingId,
      p_team: activeTeam,
      p_activity_type: activityType,
      p_activity_date: date,
      p_screenshots: screenshots.trim() || null,
      p_attendance: roster.map((member) => ({ member_id: member.id, status: attendance[member.id] })),
    });
    setSaving(false);
    if (saveError) {
      setError('Could not save attendance: ' + saveError.message);
      return;
    }
    reset();
    setRefresh((current) => current + 1);
  }

  function startEdit(activity: Activity) {
    setEditingId(activity.id);
    setDate(activity.activity_date);
    setScreenshots(activity.result_screenshots || '');
    setAttendance(Object.fromEntries(activity.members.map((member) => [member.member_id, member.status])));
    setError('');
  }

  async function remove(activity: Activity) {
    if (!canDelete || !window.confirm('Delete this ' + activity.activity_type + ' attendance record?')) return;
    setSaving(true);
    setError('');
    const { error: deleteError } = await supabase.rpc('remove_attendance_only_activity', {
      p_activity_id: activity.id,
      p_team: activeTeam,
    });
    setSaving(false);
    if (deleteError) {
      setError('Could not delete attendance: ' + deleteError.message);
      return;
    }
    if (editingId === activity.id) reset();
    setRefresh((current) => current + 1);
  }

  return (
    <div className="mt-5 space-y-5">
      <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-xs text-gray-200">
        {activityType} is attendance-only. Record the date, Present/Absent and optional match screenshots.
        No opponent, scores, results or KPI evaluations are created.
      </p>
      <form onSubmit={(event) => { void save(event); }} className="flex flex-col gap-4">
        <label className="text-xs font-bold text-gray-300">
          Activity date
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={fieldClass} required />
        </label>
        <label className="text-xs font-bold text-gray-300">
          Match screenshots (one URL per line, optional)
          <textarea rows={3} value={screenshots} onChange={(event) => setScreenshots(event.target.value)}
            placeholder="https://example.com/match.jpg" className={fieldClass + ' resize-y text-xs'} />
        </label>
        <div className="rounded-lg border border-gray-700 bg-[#111] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-bold text-white">Attendance</h4>
              <p className="mt-1 text-xs text-gray-400">{recorded} / {roster.length} members recorded</p>
            </div>
            <button type="button" onClick={() => setAttendance(Object.fromEntries(roster.map((member) => [member.id, 'present'])))}
              className="rounded border border-emerald-700 px-3 py-2 text-xs font-bold text-emerald-300">
              Mark all present
            </button>
          </div>
          <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
            {roster.length === 0 && <p className="text-xs text-amber-300">Add team members to the roster first.</p>}
            {roster.map((member) => (
              <label key={member.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-800 bg-black/30 p-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-white">{member.ign}</span>
                  <span className="block text-[11px] text-gray-400">{member.role || 'Member'}</span>
                </span>
                <select aria-label={'Attendance for ' + member.ign}
                  value={attendance[member.id] || ''}
                  onChange={(event) => setAttendance((old) => ({ ...old, [member.id]: event.target.value as AttendanceStatus | '' }))}
                  className="rounded-lg border border-gray-700 bg-[#121212] px-3 py-2 text-sm text-white">
                  <option value="">Select</option>
                  <option value="present">Present</option>
                  <option value="absent">Absent</option>
                </select>
              </label>
            ))}
          </div>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-800 bg-red-950/30 p-3 text-xs text-red-300">{error}</p>}
        <div className="flex gap-2">
          <button type="submit" disabled={saving || loading || roster.length === 0}
            className="flex-1 rounded-lg bg-accent px-4 py-3 text-sm font-black uppercase text-white disabled:opacity-50">
            {saving ? 'Saving...' : editingId ? 'Update attendance' : 'Save attendance'}
          </button>
          {editingId !== null && <button type="button" onClick={reset} className="rounded-lg border border-gray-600 px-3 py-2 text-xs">Cancel edit</button>}
        </div>
      </form>

      <section className="border-t border-gray-700 pt-4" aria-label={activityType + ' attendance history'}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-bold text-accent">{activityType} history</h4>
          <button type="button" disabled={loading} onClick={() => setRefresh((current) => current + 1)}
            className="rounded border border-gray-600 px-2 py-1 text-xs text-gray-300">Refresh</button>
        </div>
        {loading ? <p className="mt-3 text-xs text-gray-400">Loading attendance records...</p>
          : shown.length === 0 ? <p className="mt-3 text-xs text-gray-400">No attendance-only records for this selection yet.</p>
          : <div className="mt-3 max-h-80 space-y-3 overflow-y-auto">
            {shown.map((activity) => {
              const present = activity.members.filter((member) => member.status === 'present').length;
              return (
                <article key={activity.id} className="rounded-lg border border-gray-700 bg-black/30 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold">{activity.activity_date}</p>
                      <p className="mt-1 text-xs text-gray-400">{present} present / {activity.members.length} recorded</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => startEdit(activity)}
                        className="rounded border border-gray-600 px-2 py-1 text-xs">Edit</button>
                      {canDelete && <button type="button" disabled={saving} onClick={() => { void remove(activity); }}
                        className="rounded border border-red-900 px-2 py-1 text-xs text-red-300">Delete</button>}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    {activity.members.map((member) => member.ign_snapshot + ': ' + member.status).join(' · ')}
                  </p>
                  {screenshotLinks(activity.result_screenshots).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {screenshotLinks(activity.result_screenshots).map((url, index) => (
                        <a key={index} href={url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-accent underline">Screenshot {index + 1}</a>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>}
      </section>
    </div>
  );
}
