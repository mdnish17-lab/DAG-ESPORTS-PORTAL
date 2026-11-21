"use client";

import { useMemo, useState } from 'react';
import {
  WEEKLY_METRICS,
  formatWeek,
  weightedScore,
  type WeeklyMetricKey,
  type WeeklyReview,
} from '../../lib/weeklyKpi';

type SeriesKey = 'overall' | WeeklyMetricKey;
type Props = {
  playerName: string;
  reviews: WeeklyReview[];
  loading: boolean;
  error: string;
};

const WIDTH = 820;
const HEIGHT = 295;
const LEFT = 48;
const RIGHT = 30;
const TOP = 22;
const BOTTOM = 60;
const PLOT_WIDTH = WIDTH - LEFT - RIGHT;
const PLOT_HEIGHT = HEIGHT - TOP - BOTTOM;

export default function WeeklyPerformanceChart({ playerName, reviews, loading, error }: Props) {
  const [metric, setMetric] = useState<SeriesKey>('overall');
  const points = useMemo(() => [...reviews].sort((a, b) => a.week_start.localeCompare(b.week_start)).slice(-12), [reviews]);
  const selected = WEEKLY_METRICS.find((item) => item.key === metric);
  const color = selected?.color || '#ff61b1';
  const label = selected?.label || 'Overall KPI';
  const values = points.map((review) => metric === 'overall' ? weightedScore(review) : review[metric]);
  const latest = values.length ? values[values.length - 1] : null;
  const previous = values.length > 1 ? values[values.length - 2] : null;
  const improvement = latest !== null && previous !== null ? latest - previous : null;
  const xOf = (index: number) => LEFT + (points.length === 1 ? PLOT_WIDTH / 2 : index * PLOT_WIDTH / (points.length - 1));
  const yOf = (value: number) => TOP + ((5 - value) / 4) * PLOT_HEIGHT;
  const coordinates = values.map((value, index) => `${xOf(index)},${yOf(value)}`).join(' ');
  const area = values.length ? `M ${xOf(0)},${TOP + PLOT_HEIGHT} L ${values.map((value, i) => `${xOf(i)},${yOf(value)}`).join(' L ')} L ${xOf(values.length - 1)},${TOP + PLOT_HEIGHT} Z` : '';

  return (
    <section className="mt-8 rounded-2xl border border-pink-500/30 bg-[#110d15]/85 p-5 md:p-7 shadow-[0_0_30px_rgba(255,82,170,0.07)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h4 className="text-xl md:text-2xl font-black uppercase tracking-wide text-pink-400">Weekly Performance</h4>
          <p className="mt-1 text-xs text-gray-400">{playerName} · Average of evaluated matches each Monday–Sunday week (1–5)</p>
        </div>
        {latest !== null && (
          <div className="rounded-xl border border-pink-400/25 bg-black/50 px-5 py-3 text-right">
            <p className="text-[10px] uppercase tracking-widest text-gray-400">Latest {label}</p>
            <p className="text-3xl font-black" style={{ color }}>{latest.toFixed(2)} <span className="text-sm text-gray-500">/ 5</span></p>
            {improvement !== null && (
              <p className={`text-xs font-bold ${improvement > 0 ? 'text-green-400' : improvement < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                {improvement > 0 ? '+' : ''}{improvement.toFixed(2)} from previous review
              </p>
            )}
          </div>
        )}
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
      ) : points.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-pink-500/20 bg-black/30 px-5 py-12 text-center">
          <p className="font-bold text-gray-200">No weekly assessments recorded yet.</p>
          <p className="mt-2 text-sm text-gray-400">Coaches record the six KPI ratings when saving completed matches in Admin → Match &amp; Evaluations. Weeks are calculated automatically from real match dates; older matches without all six ratings are not counted.</p>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-black/35 p-2 md:p-4">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label={`${label} scores for ${playerName} across ${points.length} recorded weeks`}>
            <defs>
              <linearGradient id="dag-weekly-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.24" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </linearGradient>
            </defs>
            {[1, 2, 3, 4, 5].map((tick) => (
              <g key={tick}>
                <line x1={LEFT} x2={WIDTH - RIGHT} y1={yOf(tick)} y2={yOf(tick)} stroke="#4b4052" strokeDasharray="4 7" strokeOpacity="0.6" />
                <text x={LEFT - 18} y={yOf(tick) + 5} textAnchor="middle" fontSize="13" fill="#c5b6c9">{tick}</text>
              </g>
            ))}
            <path d={area} fill="url(#dag-weekly-area)" />
            <polyline points={coordinates} fill="none" stroke={color} strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((review, index) => (
              <g key={review.id}>
                <circle cx={xOf(index)} cy={yOf(values[index])} r="7" fill={color} stroke="#150d18" strokeWidth="3">
                  <title>{`Week ${formatWeek(review.week_start)}: ${label} ${values[index].toFixed(2)}/5 (${review.match_count || 1} rated match${(review.match_count || 1) === 1 ? '' : 'es'})`}</title>
                </circle>
                {(points.length <= 7 || index % 2 === 0 || index === points.length - 1) && (
                  <text x={xOf(index)} y={HEIGHT - 28} textAnchor="middle" fontSize="12" fill="#d4c1d2">
                    {formatWeek(review.week_start)}
                  </text>
                )}
              </g>
            ))}
          </svg>
          <p className="mt-1 text-center text-[11px] text-gray-500">Last {points.length} assessed week{points.length === 1 ? '' : 's'} · Multiple assessed matches in a week are averaged · Empty weeks are not zero</p>
        </div>
      )}
      <p className="mt-4 text-xs text-gray-500">
        Overall KPI weights follow the supplied Excel workbook: Mechanics 20%, Macro 25%, Communication 15%, Role Execution 20%, Discipline 10%, Hero Pool 10%.
      </p>
    </section>
  );
}
