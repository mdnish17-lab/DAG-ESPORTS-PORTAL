"use client";

import { useEffect, useMemo, useState } from 'react';
import {
  WEEKLY_METRICS,
  formatWeek,
  currentMalaysiaWeekStart,
  weightedScore,
  type WeeklyMetricKey,
  type WeeklyReview,
} from '../../lib/weeklyKpi';
import { targetProgress, type ImprovementTarget } from '../../lib/improvementTargets';

type SeriesKey = 'overall' | WeeklyMetricKey;
type Props = {
  playerName: string;
  reviews: WeeklyReview[];
  loading: boolean;
  error: string;
  targets?: ImprovementTarget[];
};

const WIDTH = 820;
const HEIGHT = 295;
const LEFT = 48;
const RIGHT = 30;
const TOP = 22;
const BOTTOM = 60;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;

export default function WeeklyPerformanceChart({ playerName, reviews, loading, error, targets = [] }: Props) {
  const [metric, setMetric] = useState<SeriesKey>('overall');
  const [currentWeek, setCurrentWeek] = useState(() => currentMalaysiaWeekStart());
  useEffect(() => {
    // Schedule the next Monday at 00:00 MYT. Refresh on focus if a
    // background tab was suspended across the week boundary.
    const start = currentMalaysiaWeekStart();
    const nextMondayUtc = Date.parse(start + 'T00:00:00Z') + 7 * 86_400_000 - 8 * 3_600_000;
    const timeout = window.setTimeout(
      () => setCurrentWeek(currentMalaysiaWeekStart()),
      Math.max(500, nextMondayUtc - Date.now() + 250),
    );
    const onFocus = () => setCurrentWeek(currentMalaysiaWeekStart());
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener('focus', onFocus);
    };
  }, [currentWeek]);

  // Always plot the last 12 calendar weeks, including unassessed weeks.
  const calendarWeeks = useMemo(() => {
    const monday = new Date(currentWeek + 'T12:00:00Z');
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(monday);
      date.setUTCDate(monday.getUTCDate() - (11 - index) * 7);
      return date.toISOString().slice(0, 10);
    });
  }, [currentWeek]);
  const reviewsByWeek = useMemo(
    () => new Map(reviews.map((review) => [review.week_start, review])),
    [reviews],
  );
  const points = calendarWeeks.map((week) => reviewsByWeek.get(week) ?? null);
  const selected = WEEKLY_METRICS.find((item) => item.key === metric);
  const color = selected?.color || '#ff61b1';
  const label = selected?.label || 'Overall KPI';
  const values = points.map((review) => review === null ? null :
    metric === 'overall' ? weightedScore(review) : review[metric]);
  const latest = values[11]; // Current week ONLY; never carry the old score forward.
  const previous = values[10];
  const improvement = latest !== null && previous !== null ? latest - previous : null;
  const xOf = (index: number) => LEFT + index * PLOT_WIDTH / 11;
  const yOf = (value: number) => TOP + ((5 - value) / 4) * PLOT_HEIGHT;
  const metricTargets = targets
    .filter((target) => metric !== 'overall' && target.metric_key === metric &&
      calendarWeeks.includes(target.week_start))
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
  const goalOutcomes = metricTargets.map((target) => targetProgress(target, reviews));
  const goalByWeek = new Map(metricTargets.map((target) => [target.week_start, target]));
  // Split the line at missing weeks rather than drawing across missing ratings.
  const segments: Array<Array<{ index: number; value: number }>> = [];
  values.forEach((value, index) => {
    if (value === null) return;
    if (index === 0 || values[index - 1] === null) segments.push([]);
    segments[segments.length - 1].push({ index, value });
  });

  return (
    <section className="mt-8 rounded-2xl border border-pink-500/30 bg-[#110d15]/85 p-5 md:p-7 shadow-[0_0_30px_rgba(255,82,170,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="text-xl md:text-2xl font-black uppercase tracking-wide text-pink-400">Weekly Performance</h4>
          <p className="mt-1 text-xs text-gray-400">{playerName} · Average of evaluated matches each Monday–Sunday week (1–5)</p>
        </div>
        <div className="rounded-xl border border-pink-400/25 bg-black/50 px-5 py-3 text-right" aria-live="polite">
          <p className="text-[10px] uppercase tracking-widest text-gray-400">This week's {label}</p>
          <p className="text-3xl font-black" style={{ color: latest === null ? '#a1a1aa' : color }}>
            {latest === null ? '—' : latest.toFixed(2)} <span className="text-sm text-gray-500">/ 5</span>
          </p>
          <p className="mt-1 text-[11px] text-gray-400">Week of {formatWeek(currentWeek)} · Malaysia</p>
          {latest === null ? (
            <p className="text-xs text-gray-400">Awaiting this week's evaluation</p>
          ) : improvement !== null ? (
            <p className={`text-xs font-bold ${improvement > 0 ? 'text-green-400' : improvement < 0 ? 'text-red-400' : 'text-gray-400'}`}>
              {improvement > 0 ? '+' : ''}{improvement.toFixed(2)} from previous week
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="group" aria-label="Choose weekly performance metric">
        <button type="button" aria-pressed={metric === 'overall'} onClick={() => setMetric('overall')}
          className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${metric === 'overall' ? 'border-pink-400 bg-pink-500 text-black' : 'border-gray-700 bg-black/40 text-gray-300 hover:border-pink-500'}`}>
          Overall KPI
        </button>
        {WEEKLY_METRICS.map((item) => (
          <button key={item.key} type="button" aria-pressed={metric === item.key} onClick={() => setMetric(item.key)}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold transition-colors ${metric === item.key ? 'border-pink-400 bg-pink-500 text-black' : 'border-gray-700 bg-black/40 text-gray-300 hover:border-pink-500'}`}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-14 text-center text-sm text-pink-400 animate-pulse">Loading weekly reviews...</p>
      ) : error ? (
        <p role="alert" className="mt-6 rounded-lg border border-amber-700/50 bg-amber-950/30 px-4 py-5 text-sm text-amber-200">
          Weekly reviews are not available yet. {error}
        </p>
      ) : !points.some(Boolean) ? (
        <div className="mt-5 rounded-xl border border-dashed border-pink-500/20 bg-black/30 px-5 py-12 text-center">
          <p className="font-bold text-gray-200">No assessments in the last 12 calendar weeks.</p>
          <p className="mt-2 text-sm text-gray-400">Coaches record the six KPI ratings when saving completed matches in Admin → Match &amp; Evaluations. Weeks are calculated automatically from real match dates; older matches without all six ratings are not counted.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black/35 p-2 md:p-4">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${label} scores for ${playerName} over the last 12 calendar weeks`}>
            {[1, 2, 3, 4, 5].map((tick) => (
              <g key={tick}>
                <line x1={LEFT} x2={WIDTH - RIGHT} y1={yOf(tick)} y2={yOf(tick)} stroke="#4b4052" strokeDasharray="4 7" strokeOpacity="0.6" />
                <text x={LEFT - 18} y={yOf(tick) + 5} textAnchor="middle" fontSize="13" fill="#c5b6c9">{tick}</text>
              </g>
            ))}
            {segments.map((segment, index) => segment.length > 1 && (
              <polyline key={index} points={segment.map(({ index: i, value }) => `${xOf(i)},${yOf(value)}`).join(' ')}
                fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {points.map((review, index) => review && values[index] !== null && (
              <g key={review.id}>
                {goalByWeek.get(review.week_start) && (
                  <g>
                    <line x1={xOf(index) - 19} x2={xOf(index) + 19}
                      y1={yOf(Number(goalByWeek.get(review.week_start)!.target_score))}
                      y2={yOf(Number(goalByWeek.get(review.week_start)!.target_score))}
                      stroke="#facc15" strokeWidth="3" strokeDasharray="5 4" />
                    <title>{'Target ' + Number(goalByWeek.get(review.week_start)!.target_score).toFixed(1) + '/5 · week of ' + formatWeek(review.week_start)}</title>
                  </g>
                )}
                <circle cx={xOf(index)} cy={yOf(values[index]!)} r="7" fill={color} stroke="#150d18" strokeWidth="3">
                  <title>{`Week ${formatWeek(review.week_start)}: ${label} ${values[index]!.toFixed(2)}/5 (${review.match_count || 1} rated match${(review.match_count || 1) === 1 ? '' : 'es'})`}</title>
                </circle>
              </g>
            ))}
            {calendarWeeks.map((week, index) => (index % 2 === 0 || index === 11) && (
              <text key={week} x={xOf(index)} y={HEIGHT - 28} textAnchor="middle" fontSize="12" fill="#d4c1d2">
                {formatWeek(week)}
              </text>
            ))}
          </svg>
          <p className="mt-1 text-center text-[11px] text-gray-500">Last 12 calendar weeks · New public KPI week starts Monday at midnight (Malaysia) · Unassessed weeks are empty, not zero</p>
          {metric !== 'overall' && metricTargets.some((goal) => points.some((p) => p.week_start === goal.week_start)) &&
            <p className="mt-2 text-center text-xs text-amber-300">Yellow dashed marker = coach's weekly target</p>}
        </div>
      )}
      {metric === 'overall' ? (
        targets.length > 0 && <p className="mt-4 text-xs text-gray-400">Select one of the six KPI categories above to compare that metric against the coach's weekly improvement targets.</p>
      ) : (
        <div className="mt-4 space-y-2" aria-label="Weekly improvement target results">
          <h5 className="text-xs font-black uppercase tracking-wider text-amber-300">{label} improvement targets</h5>
          {goalOutcomes.length === 0 ? <p className="text-xs text-gray-400">No improvement target for this KPI yet.</p> :
            goalOutcomes.slice(-12).map((goal) => (
              <div key={goal.id} className="rounded-lg border border-amber-900/40 bg-black/25 px-3 py-2 text-xs">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="font-bold text-white">Week of {formatWeek(goal.week_start)} · Goal {Number(goal.target_score).toFixed(1)}/5</span>
                  <span className={goal.status === 'achieved' ? 'text-green-300' : goal.status === 'below-target' ? 'text-amber-300' : 'text-gray-400'}>
                    {goal.status === 'not-assessed' ? 'Not assessed' : goal.status === 'achieved' ? 'Achieved' : 'Below target'}
                  </span>
                </div>
                <p className="mt-1 text-gray-400">Actual KPI: {goal.actual == null ? '—' : goal.actual.toFixed(2) + '/5'}{goal.focus_note ? ' · ' + goal.focus_note : ''}</p>
              </div>
            ))}
        </div>
      )}
      <p className="mt-4 text-xs text-gray-500">
        Overall KPI weights follow the supplied Excel workbook: Mechanics 20%, Macro 25%, Communication 15%, Role Execution 20%, Discipline 10%, Hero Pool 10%.
      </p>
    </section>
  );
}
