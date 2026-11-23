const COLORS = ['var(--upper)', 'var(--upper-2)', 'var(--lower)', 'var(--warm)', 'var(--pink)', 'var(--lower-2)'];

/** A short burst of confetti (CSS only; hidden with reduced motion). Deterministic, no randomness at render. */
export function Confetti({ count = 26 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[360px] overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const r1 = ((i * 7919) % 100) / 100;
        const r2 = ((i * 104729) % 100) / 100;
        const r3 = ((i * 1299709) % 100) / 100;
        return (
          <span
            key={i}
            className="confetti-piece"
            style={
              {
                left: `${6 + r1 * 88}%`,
                background: COLORS[i % COLORS.length],
                '--dx': `${(r2 - 0.5) * 120}px`,
                '--rot': `${360 + r3 * 540}deg`,
                '--dur': `${1.6 + r2 * 1.2}s`,
                '--delay': `${r3 * 0.5}s`,
              } as React.CSSProperties
            }
          />
        );
      })}
    </div>
  );
}
