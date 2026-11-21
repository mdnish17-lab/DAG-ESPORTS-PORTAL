'use client';

import type { WeeklyMetricKey } from '../../lib/weeklyKpi';

type Props = {
  id: string;
  label: string;
  weight: number;
  score: number | null;
  index: number;
  field: WeeklyMetricKey;
  onScore: (field: WeeklyMetricKey, score: number) => void;
  disabled?: boolean;
};

/** One accessible 1–5 KPI range slider plus five generous one-touch choices. */
export default function MobileKpiRating({ id, label, weight, score, index, field, onScore, disabled = false }: Props) {
  return (
    <fieldset className="min-w-0 rounded-2xl border border-gray-700 bg-[#101010] p-3.5 sm:p-5">
      <legend className="sr-only">{label} — 1 to 5 rating</legend>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label htmlFor={id} className="min-w-0 font-bold text-white">
          <span className="mr-2 text-xs font-black text-accent">{index}.</span>{label}
          <span className="ml-2 text-xs font-medium text-gray-400">{Math.round(weight * 100)}% weight</span>
        </label>
        <span className={`shrink-0 rounded-lg px-3 py-2 text-sm font-black ${score == null ? 'bg-gray-800 text-gray-300' : 'bg-accent/20 text-accent'}`}
          aria-live="polite">
          {score == null ? 'Not rated' : score + ' / 5'}
        </span>
      </div>
      <input
        id={id}
        aria-label={label + ' rating, choose 1 to 5'}
        aria-describedby={id + '-hint'}
        aria-valuetext={score == null ? 'Not rated yet. Move to set a score.' : score + ' out of 5'}
        type="range" min={1} max={5} step={1} value={score ?? 3}
        onChange={(event) => onScore(field, Number(event.currentTarget.value))}
        onPointerUp={(event) => {
          if (score == null) onScore(field, Number(event.currentTarget.value));
        }}
        disabled={disabled}
        className="my-1 h-10 w-full cursor-pointer touch-pan-x accent-pink-500 disabled:opacity-50"
      />
      <div className="mt-1 grid grid-cols-5 gap-1.5" role="group" aria-label={label + ' quick rating'}>
        {[1, 2, 3, 4, 5].map((value) => (
          <button
            key={value} type="button" aria-label={'Set ' + label + ' to ' + value + ' out of 5'}
            aria-pressed={score === value}
            disabled={disabled}
            onClick={() => onScore(field, value)}
            className={`flex min-h-11 min-w-0 items-center justify-center rounded-xl border text-base font-black transition-colors disabled:opacity-50 ${score === value
              ? 'border-accent bg-accent text-white'
              : 'border-gray-600 bg-[#1b1b1b] text-gray-200 active:bg-accent/25 hover:border-accent'}`}
          >
            {value}
          </button>
        ))}
      </div>
      <p id={id + '-hint'} className="mt-2 text-[11px] text-gray-500">
        {score == null ? 'Choose a rating with the slider or tap a number.' : 'Selected: ' + score + ' of 5.'}
      </p>
    </fieldset>
  );
}
