"use client";

// Decorations shared by every page:
//  - "DAG ESPORTS" text repeating down both sides of the screen (scrolls top -> bottom)
//  - "Made by NishiKudo" credit fixed in the viewport on every page
// Colors follow the team theme (--accent-color is set on <main>).

const WORD = 'DAG ESPORTS';
const REPEATS = 8;

function Column({ flip }: { flip?: boolean }) {
  const items = Array.from({ length: REPEATS });
  const half = (key: string) => (
    <div key={key} className="flex flex-col items-center">
      {items.map((_, i) => (
        <div key={i} className="flex flex-col items-center py-5">
          <span
            className="dag-side-word font-black"
            style={{
              writingMode: 'vertical-rl',
              transform: flip ? 'rotate(180deg)' : undefined,
              color: 'var(--accent-color, #c8196b)',
            }}
          >
            {WORD}
          </span>
          <span className="mt-5 text-[10px]" style={{ color: 'var(--accent-color, #c8196b)' }}>◆</span>
        </div>
      ))}
    </div>
  );
  return (
    <div className="dag-fall flex flex-col" style={{ animation: 'dagFall 60s linear infinite' }}>
      {half('a')}
      {half('b')}
    </div>
  );
}

export default function SiteDecor() {
  return (
    <>
      <style>{`
        @keyframes dagFall { from { transform: translateY(-50%); } to { transform: translateY(0); } }
        @media (prefers-reduced-motion: reduce) { .dag-fall { animation: none !important; } }
      `}</style>

      {/* Subtle DAG emblem atmosphere behind page content; animations stop when reduced motion is preferred. */}
      <div aria-hidden="true" className="dag-animated-background pointer-events-none fixed inset-0 z-0 overflow-hidden select-none">
        <div className="dag-ambient-glow dag-ambient-glow-left" />
        <div className="dag-ambient-glow dag-ambient-glow-right" />
        <div className="dag-background-logo" />
        <div className="dag-background-ring" />
      </div>

      <div aria-hidden className="fixed inset-y-0 left-0 z-[5] w-5 overflow-hidden opacity-15 pointer-events-none select-none sm:w-10 md:w-14 md:opacity-20">
        <Column />
      </div>
      <div aria-hidden className="fixed inset-y-0 right-0 z-[5] w-5 overflow-hidden opacity-15 pointer-events-none select-none sm:w-10 md:w-14 md:opacity-20">
        <Column flip />
      </div>

      <div className="fixed bottom-20 right-2 z-[50] rounded-full border border-white/15 bg-black/85 px-3 py-1 text-[10px] tracking-wide text-gray-200 shadow-lg backdrop-blur pointer-events-none select-none sm:bottom-3 sm:right-4 sm:text-[11px]">
        Made by <span className="font-bold" style={{ color: 'var(--accent-color, #c8196b)' }}>NishiKudo</span>
      </div>
    </>
  );
}