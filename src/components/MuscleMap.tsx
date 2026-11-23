import { memo, useId } from 'react';
import { muscleLabel } from '../lib/muscles';
import { formatSerie, HEAT_LEVELS } from '../lib/muscleStats';
import type { MuscleKey } from '../lib/types';
import { cx } from './ui';

/*
 * Front and back silhouettes drawn for Scheda. Paths describe the figure's left
 * half (x 0-50) and are mirrored for the right half.
 *
 * Two ways to colour it:
 *  - "binary": the muscles of one exercise (primary in the accent, secondary dimmer);
 *  - "heat": how much each muscle was trained, in 5 steps of ONE hue (--heat-1..5),
 *    lighter = more serie on the dark theme, darker = more on the light theme.
 */

type Region = { muscle: MuscleKey | null; d: string };

const OUTLINE =
  'M46,38 C40,40 33,41 28,43 C22,45 19,49 18,56 C17,66 16.5,78 16,88 C15.5,93 14.5,96 14,100 C13,109 12,118 12.5,126 C12,130 11.5,134 12,138 C12.5,142 15,144 18,143.5 C21,142.5 22.5,138 22.5,134 C23,131 23.5,128 24,126 C25.5,117 27.5,108 29,99 C30,94 30.5,90 31,86 C31.8,78 32.4,70 33,62 C33.8,70 34.5,78 35,86 C35.6,96 36.4,104 36,110 C35,114 33.5,117 33,121 C31.5,131 31,141 31.5,151 C32,158 33,163 34,168 C33,176 32.5,184 33.5,192 C34.5,197 36,201 36.5,204 C35,206.5 34.5,209 36,211 C38.5,212.5 43,212.5 45,211 C46.2,209.5 46.2,207 45.5,204 C46.5,196 46.8,186 46.5,178 C46.5,174 47,170 47.5,166 C48.3,156 49,146 49.4,136 C49.6,134 49.8,133 50,132 L50,38 Z';

const FRONT: Region[] = [
  { muscle: 'upper-back', d: 'M45.5,38.5 C41,41 36,42.5 31,44 C35,45.5 40,45.6 44,44.6 C45.5,42.8 46,40.8 45.5,38.5 Z' },
  { muscle: 'side-delts', d: 'M27,44.6 C22,46.4 19.6,50.5 19.2,56.5 C19.1,59 19.3,61.2 19.8,63 C21.2,60.4 22.4,57.2 23.4,53.6 C24.5,50 25.8,47 27,44.6 Z' },
  { muscle: 'front-delts', d: 'M29.6,45.2 C26.6,47.4 24.6,51.4 23.8,56.4 C23.2,59.8 23.2,62.6 24,64.6 C27.6,62.4 30.6,59.2 32.6,55.6 C33.4,52.4 32.4,48 29.6,45.2 Z' },
  { muscle: 'chest', d: 'M48.6,47.2 C43,46 37.4,46.6 33.8,49.6 C32.2,53.8 32.2,59.4 33.8,64 C36.4,68.6 41.4,70.6 46.4,69.8 C48,69.4 48.8,68.4 49,66.8 C49.4,60.4 49.4,53.6 48.6,47.2 Z' },
  { muscle: 'biceps', d: 'M24.2,66.4 C21.8,70.6 20.6,77.4 21,84.2 C21.4,87.4 23.6,89.4 26.4,89 C28.6,88.4 29.8,86 30,83.2 C30.4,77.4 30.4,71.2 29.6,66.4 C28,64.8 25.6,64.8 24.2,66.4 Z' },
  { muscle: 'forearm-flexors', d: 'M18.6,95.2 C16.4,102.4 15,111.4 15,120.2 C15.2,123.4 17.4,125.2 19.8,124.6 C21.6,124 22.6,122.2 23,120 C24.6,112 26.2,104 27.2,96.8 C26.4,93.6 21.2,92.4 18.6,95.2 Z' },
  { muscle: null, d: 'M35.4,74.6 C34.6,84.4 35.2,95.2 37.6,105.6 C39.4,108.8 41.4,110.2 43,110.4 C42.6,98 42.4,86 42.6,74.6 C40,73 37.2,73.2 35.4,74.6 Z' },
  { muscle: 'abs', d: 'M44.2,73.4 L49,73.4 L49,82.6 L44.2,82.6 C43.8,79.6 43.8,76.4 44.2,73.4 Z' },
  { muscle: 'abs', d: 'M44,84.6 L49,84.6 L49,93.8 L44,93.8 C43.7,90.8 43.7,87.6 44,84.6 Z' },
  { muscle: 'abs', d: 'M44,95.8 L49,95.8 L49,105 L44.2,105 C43.9,102 43.8,98.8 44,95.8 Z' },
  { muscle: 'abs', d: 'M44.4,107 L49,107 L49,118.4 C47,118.2 45.4,116.6 44.8,114.2 C44.4,111.8 44.3,109.4 44.4,107 Z' },
  { muscle: 'quads', d: 'M35.2,124.4 C32.8,132.6 32.4,143 33.6,152.6 C34.4,159 36.6,163.8 40,165.6 C43.2,166.6 45.8,164.6 46.6,161 C47.6,152.6 48,142.8 47.4,133.4 C46.2,128.4 42.6,124.6 38.8,123.4 C37.6,123.2 36.2,123.6 35.2,124.4 Z' },
  { muscle: null, d: 'M48.4,128.6 C49.4,136.6 49.6,145.2 49,153 L49.8,153 L49.8,128.6 Z' },
  { muscle: null, d: 'M36.4,173.6 C34.8,181.6 35.2,190.6 37.2,198.2 C38.6,200.6 41.4,200.8 42.8,198.6 C44.8,191 45.4,182.2 44.6,174.6 C42.6,170.8 38.6,170.4 36.4,173.6 Z' },
];

const BACK: Region[] = [
  { muscle: 'upper-back', d: 'M50,37.6 C47,40.4 41,43 31.6,44.8 C36.8,48.6 41.4,54.6 44.6,62.4 C46.6,68.4 48.4,74.6 50,79 Z' },
  { muscle: 'side-delts', d: 'M27,44.6 C22,46.4 19.6,50.5 19.2,56.5 C19.1,59 19.3,61.2 19.8,63 C21.2,60.4 22.4,57.2 23.4,53.6 C24.5,50 25.8,47 27,44.6 Z' },
  { muscle: 'rear-delts', d: 'M29.8,45.4 C26.6,47.4 24.6,51.4 23.8,56.4 C23.2,59.8 23.2,62.6 24,64.6 C27.8,62.6 31.2,59.6 33.6,55.8 C33.8,51.8 32.4,47.8 29.8,45.4 Z' },
  { muscle: 'triceps', d: 'M24.2,66.4 C21.8,70.6 20.6,77.4 21,84.6 C21.4,88 23.6,90 26.4,89.6 C28.8,89 30,86.4 30.2,83.4 C30.6,77.6 30.4,71.2 29.6,66.4 C28,64.8 25.6,64.8 24.2,66.4 Z' },
  { muscle: 'forearm-extensors', d: 'M18.6,95.2 C16.4,102.4 15,111.4 15,120.2 C15.2,123.4 17.4,125.2 19.8,124.6 C21.6,124 22.6,122.2 23,120 C24.6,112 26.2,104 27.2,96.8 C26.4,93.6 21.2,92.4 18.6,95.2 Z' },
  { muscle: 'lats', d: 'M33.6,58.4 C33.4,68.6 34.6,80.2 37.2,91 C38.8,97.6 41.6,102.4 45.2,104.6 C46.4,98.6 45.8,91.4 44.4,84 C43.6,76.6 42.8,69.6 40.2,64 C38.2,61.2 35.8,59.4 33.6,58.4 Z' },
  { muscle: 'lower-back', d: 'M45.8,84.4 C44.8,92.4 44.8,101.4 45.2,109.6 C45.6,113.2 47.2,115.4 49.2,116 L49.2,84.4 C48.2,82.8 46.8,82.8 45.8,84.4 Z' },
  { muscle: 'glute-medius', d: 'M35.8,113.4 C34,116.6 33.6,120.4 34.6,124.2 C37.8,122.2 41.4,120.6 45.2,119.6 C43.6,116.4 40.6,113.8 37.6,112.8 C36.8,112.6 36.2,112.8 35.8,113.4 Z' },
  { muscle: 'glutes', d: 'M34.4,126.4 C33.2,132.6 34.6,138.8 38.6,142.2 C42,144.6 46.2,144.2 48.6,141.4 C49.4,135.4 49.4,128.4 48.8,121.8 C43.6,121.6 38.6,123 34.4,126.4 Z' },
  { muscle: 'hamstrings', d: 'M35.2,146.6 C33.4,152.6 33.8,159.6 36.2,165 C38.4,168.4 42.6,169 45.4,166.6 C47.4,160.6 48,153.6 47.6,146.8 C44,144.6 38.8,144.6 35.2,146.6 Z' },
  { muscle: 'calves', d: 'M36.2,173.4 C33.6,180.6 34,189.6 36.8,196.6 C38.4,199.6 41.8,199.8 43.4,197 C45.6,190 46,181.6 44.8,174.4 C42.6,170.6 38.4,170.2 36.2,173.4 Z' },
];

const BODY = 'color-mix(in srgb, var(--muted) 13%, var(--surface))';

function binaryFill(m: MuscleKey | null, primary: Set<MuscleKey>, secondary: Set<MuscleKey>): string {
  if (m && primary.has(m)) return 'var(--accent)';
  if (m && secondary.has(m)) return 'color-mix(in srgb, var(--accent) 42%, var(--surface))';
  return 'color-mix(in srgb, var(--muted) 26%, var(--surface))';
}

/** "forearms" lights both flexors and extensors. */
function expand(list: readonly MuscleKey[]): Set<MuscleKey> {
  const s = new Set(list);
  if (s.has('forearms')) {
    s.add('forearm-flexors');
    s.add('forearm-extensors');
  }
  return s;
}

interface FigureProps {
  regions: Region[];
  x: number;
  fill: (m: MuscleKey | null) => string;
  level?: (m: MuscleKey | null) => number;
  glowId?: string;
  selected?: MuscleKey | null;
  onSelect?: (m: MuscleKey) => void;
}

function Figure({ regions, x, fill, level, glowId, selected, onSelect }: FigureProps) {
  const ordered = selected ? [...regions.filter((r) => r.muscle !== selected), ...regions.filter((r) => r.muscle === selected)] : regions;
  const half = (
    <>
      <path d={OUTLINE} fill={BODY} />
      {glowId &&
        ordered.map((r, i) =>
          r.muscle && (level?.(r.muscle) ?? 0) >= 4 ? <path key={`g${i}`} d={r.d} fill={fill(r.muscle)} filter={`url(#${glowId})`} opacity={0.7} /> : null,
        )}
      {ordered.map((r, i) => {
        const isSel = !!r.muscle && r.muscle === selected;
        return (
          <path
            key={i}
            d={r.d}
            fill={fill(r.muscle)}
            stroke={isSel ? 'var(--text)' : 'var(--map-stroke)'}
            strokeWidth={isSel ? 1.4 : 0.6}
            strokeLinejoin="round"
            onClick={onSelect && r.muscle ? () => onSelect(r.muscle!) : undefined}
            style={onSelect && r.muscle ? { cursor: 'pointer' } : undefined}
          />
        );
      })}
    </>
  );
  const skin = BODY;
  return (
    <g transform={`translate(${x},0)`}>
      <ellipse cx={50} cy={20} rx={10.5} ry={12.6} fill={skin} />
      <rect x={45.4} y={30} width={9.2} height={10} rx={3} fill={skin} />
      {half}
      <g transform="translate(100,0) scale(-1,1)">{half}</g>
    </g>
  );
}

interface CommonProps {
  className?: string;
  /** Overrides the screen reader description. */
  label?: string;
}
type BinaryProps = CommonProps & { heat?: undefined; primary: readonly MuscleKey[]; secondary: readonly MuscleKey[]; showLegend?: boolean };
type HeatProps = CommonProps & {
  /** Level 1..5 per muscle; missing = not trained. */
  heat: Partial<Record<MuscleKey, number>>;
  primary?: undefined;
  secondary?: undefined;
  selected?: MuscleKey | null;
  onSelect?: (m: MuscleKey | null) => void;
  showLegend?: undefined;
};
export type MuscleMapProps = BinaryProps | HeatProps;

export const MuscleMap = memo(function MuscleMap(props: MuscleMapProps) {
  const glowId = useId().replace(/:/g, '');
  const { className } = props;
  let fill: (m: MuscleKey | null) => string;
  let level: ((m: MuscleKey | null) => number) | undefined;
  let label: string;
  let legend: React.ReactNode = null;
  let selected: MuscleKey | null = null;
  let onSelect: ((m: MuscleKey) => void) | undefined;

  if (props.heat) {
    const heat = props.heat;
    level = (m) => (m ? (heat[m] ?? 0) : 0);
    fill = (m) => `var(--heat-${Math.min(HEAT_LEVELS, level!(m))})`;
    selected = props.selected ?? null;
    onSelect = props.onSelect ? (m) => props.onSelect!(m === props.selected ? null : m) : undefined;
    const trained = Object.keys(heat) as MuscleKey[];
    label = props.label ?? (trained.length ? `Mappa muscolare. Muscoli allenati: ${trained.map(muscleLabel).join(', ')}.` : 'Mappa muscolare: nessun muscolo allenato.');
  } else {
    const p = expand(props.primary);
    const s = expand(props.secondary.filter((m) => !props.primary.includes(m)));
    fill = (m) => binaryFill(m, p, s);
    label =
      props.label ??
      (props.primary.length
        ? `Mappa muscolare. Principali: ${props.primary.map(muscleLabel).join(', ')}${props.secondary.length ? `. Secondari: ${props.secondary.map(muscleLabel).join(', ')}` : ''}.`
        : 'Mappa muscolare: muscoli non indicati.');
    if (props.showLegend !== false && props.primary.length > 0) {
      legend = (
        <div className="absolute bottom-2 left-2 flex flex-col gap-1 text-[11px] text-muted" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> principali
          </span>
          {props.secondary.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-[color-mix(in_srgb,var(--accent)_42%,var(--surface))]" /> secondari
            </span>
          )}
        </div>
      );
    }
  }

  return (
    <div className={cx('relative flex h-full w-full items-center justify-center', className)}>
      <svg viewBox="0 0 220 226" role="img" aria-label={label} className="h-full max-h-full w-auto max-w-full overflow-visible">
        {props.heat && (
          <defs>
            <filter id={glowId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
          </defs>
        )}
        <Figure regions={FRONT} x={4} fill={fill} level={level} glowId={props.heat ? glowId : undefined} selected={selected} onSelect={onSelect} />
        <Figure regions={BACK} x={116} fill={fill} level={level} glowId={props.heat ? glowId : undefined} selected={selected} onSelect={onSelect} />
        <text x={54} y={224} textAnchor="middle" fontSize={7.5} fontWeight={600} fill="var(--muted)" fontFamily="inherit">
          FRONTE
        </text>
        <text x={166} y={224} textAnchor="middle" fontSize={7.5} fontWeight={600} fill="var(--muted)" fontFamily="inherit">
          RETRO
        </text>
      </svg>
      {legend}
    </div>
  );
});

/** The five steps of the heat scale, with its end labels. `fullAt` = serie that fill the scale. */
export function HeatLegend({ fullAt, unit = 'serie', className }: { fullAt: number; unit?: string; className?: string }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div className="flex items-center gap-1" aria-hidden>
        <span className="h-3 w-6 rounded-[5px]" style={{ background: 'var(--heat-0)' }} />
        <span className="mx-1 text-[11px] text-muted">0</span>
        {Array.from({ length: HEAT_LEVELS }, (_, i) => (
          <span key={i} className="h-3 flex-1 rounded-[5px]" style={{ background: `var(--heat-${i + 1})` }} />
        ))}
        <span className="ml-1 text-[11px] text-muted tnum">{formatSerie(fullAt)}+</span>
      </div>
      <p className="text-[12px] text-muted">
        Più intenso il colore, più {unit} per quel muscolo (scala fino a {formatSerie(fullAt)}). Una serie conta 1 per i muscoli principali e 0,5 per i secondari.
      </p>
    </div>
  );
}
