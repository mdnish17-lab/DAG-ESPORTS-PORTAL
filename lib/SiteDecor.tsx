"use client";

// Decorations shared by every page:
//  - "DAG ESPORTS" text repeating down both sides of the screen (scrolls top -> bottom)
//  - "Made By Nishikudo." credit fixed at the bottom right
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
            className="font-black"
            style={{
              writingMode: 'vertical-rl',
              transform: flip ? 'rotate(180deg)' : undefined,
              letterSpacing: '0.35em',
              fontSize: 22,
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

      <div aria-hidden className="hidden md:block fixed inset-y-0 left-0 w-14 overflow-hidden z-[5] pointer-events-none opacity-20 select-none">
        <Column />
      </div>
      <div aria-hidden className="hidden md:block fixed inset-y-0 right-0 w-14 overflow-hidden z-[5] pointer-events-none opacity-20 select-none">
        <Column flip />
      </div>

      <div className="fixed bottom-3 right-4 z-40 px-3 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur text-[11px] tracking-wider text-gray-300 pointer-events-none select-none">
        Made By <span className="font-bold" style={{ color: 'var(--accent-color, #c8196b)' }}>Nishikudo</span>.
      </div>
    </>
  );
}