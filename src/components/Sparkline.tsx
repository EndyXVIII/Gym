/** Tiny trend line of top weight per session. No axes, no chart library. */
export function Sparkline({ values, width = 84, height = 28, label }: { values: number[]; width?: number; height?: number; label: string }) {
  if (values.length === 0) return <span className="inline-block text-[12px] text-muted" style={{ width }}>—</span>;
  const pad = 3;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  const pts = values.map((v, i) => [pad + i * step, height - pad - ((v - min) / span) * (height - pad * 2)] as const);
  if (values.length === 1) pts.splice(0, 1, [width / 2, height / 2]);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="shrink-0 overflow-visible">
      {values.length > 1 && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />}
      <circle cx={lx} cy={ly} r={3} fill="var(--accent)" />
    </svg>
  );
}
