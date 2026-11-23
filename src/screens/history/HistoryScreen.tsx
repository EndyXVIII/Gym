import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { ArrowUp, CalendarDays, ChevronRight, History } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { useToday } from '../../lib/hooks';
import { loadHistoryGrid, loadSessionList, type GridDay, type GridRow } from '../../lib/historyQueries';
import { BLOCK_WEEKS, compareSets, displayReps, weekInfo } from '../../lib/program';
import { capitalize, formatDateShort, formatDateWithYear, formatKg, formatVolume } from '../../lib/format';
import { accentStyle, Card, cx, EmptyState, IconTile, ScreenHeader, Segmented, Skeleton } from '../../components/ui';
import { SyncDot } from '../../components/SyncDot';
import { CellEditorSheet, type CellTarget } from './CellEditorSheet';
import { ExerciseList } from './ExerciseList';
import { MusclesTab } from './MusclesTab';

type Tab = 'grid' | 'exercises' | 'muscles' | 'sessions';
const TABS: Tab[] = ['grid', 'exercises', 'muscles', 'sessions'];
const TAB_KEY = 'scheda:history-tab';

export default function HistoryScreen() {
  const [tab, setTab] = useState<Tab>(() => {
    try {
      const saved = localStorage.getItem(TAB_KEY) as Tab | null;
      return saved && TABS.includes(saved) ? saved : 'grid';
    } catch {
      return 'grid';
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(TAB_KEY, tab);
    } catch {
      /* ignore */
    }
  }, [tab]);

  return (
    <div>
      <ScreenHeader
        title="Storico"
        subtitle="I tuoi progressi"
        icon={
          <IconTile tone="pink" size={48} round>
            <History size={24} />
          </IconTile>
        }
        right={<SyncDot className="p-2" />}
      />
      <div className="px-4">
        <Segmented
          label="Vista dello storico"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'grid', label: 'Griglia' },
            { value: 'exercises', label: 'Esercizi' },
            { value: 'muscles', label: 'Muscoli' },
            { value: 'sessions', label: 'Sessioni' },
          ]}
        />
      </div>
      <div className="mt-4">
        {tab === 'grid' && <GridView />}
        {tab === 'exercises' && <ExerciseList />}
        {tab === 'muscles' && <MusclesTab />}
        {tab === 'sessions' && <SessionsView />}
      </div>
    </div>
  );
}

function GridView() {
  const settings = useSettings();
  const today = useToday();
  const [block, setBlock] = useState<string | null>(null);
  const grid = useLiveQuery(() => loadHistoryGrid(block), [block, settings.blockStartDate]);
  const [cell, setCell] = useState<CellTarget | null>(null);
  const currentWeek = weekInfo(settings, today).week;

  if (!grid) {
    return (
      <div className="flex flex-col gap-4 px-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (grid.days.length === 0) return <div className="px-4"><EmptyState title="Nessun giorno nel programma" text="Aggiungi un giorno in Programma." /></div>;

  const isCurrentBlock = grid.blockStart === settings.blockStartDate;

  return (
    <div className="flex flex-col gap-5">
      {grid.blocks.length > 1 && (
        <label className="mx-4 flex items-center gap-3">
          <CalendarDays size={18} className="text-muted" aria-hidden />
          <span className="text-[14px] text-muted">Blocco</span>
          <select
            className="min-h-11 flex-1 rounded-xl border border-line bg-raised px-3 text-[16px]"
            value={grid.blockStart}
            onChange={(e) => setBlock(e.target.value)}
          >
            {grid.blocks.map((b) => (
              <option key={b} value={b}>
                dal {formatDateWithYear(b)}
                {b === settings.blockStartDate ? ' (attuale)' : ''}
              </option>
            ))}
          </select>
        </label>
      )}
      {grid.days.map((d) => (
        <DayTable key={d.day.id} data={d} currentWeek={isCurrentBlock ? currentWeek : null} onCell={(row, week) => setCell({ day: d.day, row, week, blockStart: grid.blockStart, session: d.sessionsByWeek[week - 1] })} />
      ))}
      <p className="px-6 text-center text-[13px] text-muted">Ogni casella mostra la serie migliore della settimana. La freccia verde indica un miglioramento. Toccala per correggere le serie.</p>
      <CellEditorSheet target={cell} onClose={() => setCell(null)} />
    </div>
  );
}

function DayTable({ data, currentWeek, onCell }: { data: GridDay; currentWeek: number | null; onCell: (row: GridRow, week: number) => void }) {
  const { day, rows } = data;
  return (
    <section style={accentStyle(day.type)} aria-labelledby={`grid-${day.id}`}>
      <h2 id={`grid-${day.id}`} className="mb-2.5 flex items-center gap-3 px-4 text-[20px] font-extrabold">
        <IconTile tone={day.type === 'lower' ? 'green' : 'blue'} size={34}>
          <span className="text-[14px] font-extrabold">{day.title.trim().charAt(0).toUpperCase()}</span>
        </IconTile>
        {day.title}
        <span className="text-[13px] font-medium text-muted">{day.type === 'upper' ? 'parte alta' : 'parte bassa'}</span>
      </h2>
      <div className="card-surface mx-4 overflow-hidden rounded-[22px]">
        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-max min-w-full border-separate border-spacing-0 text-[14px]">
            <caption className="sr-only">
              {day.title}: serie migliore per esercizio e settimana
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sticky left-0 z-10 w-[132px] min-w-[132px] border-b border-line bg-surface px-3 py-2.5 text-left text-[12px] font-bold text-muted uppercase">
                  Esercizio
                </th>
                {Array.from({ length: BLOCK_WEEKS }, (_, i) => (
                  <th
                    key={i}
                    scope="col"
                    className={cx(
                      'w-[66px] min-w-[66px] border-b border-l border-line px-1 py-2.5 text-center text-[12px] font-bold tnum',
                      currentWeek === i + 1 ? 'bg-[color-mix(in_srgb,var(--accent)_20%,var(--surface))] text-accent-ink' : 'text-muted',
                    )}
                  >
                    Sett. {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.exerciseKey}:${row.slotId ?? 'x'}`}>
                  <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface px-3 py-1.5 text-left font-normal">
                    <span className="flex items-start gap-1.5">
                      <span className={cx('mt-px min-w-6 text-[12px] font-extrabold tnum', row.extra ? 'text-muted' : 'text-accent-ink')}>{row.label || '·'}</span>
                      <span className={cx('line-clamp-2 text-[13px] leading-tight font-medium', row.extra && 'text-muted italic')}>{shortName(row.name)}</span>
                    </span>
                  </th>
                  {row.cells.map((c, i) => {
                    // Better than the last week with a number (more weight, or more reps at the same weight)?
                    const before = row.cells.slice(0, i).reverse().find((x) => x.top);
                    const up = !!c.top && !!before?.top && compareSets(c.top, before.top) > 0;
                    return (
                      <td
                        key={i}
                        className={cx(
                          'border-b border-l border-line p-0',
                          up ? 'bg-[color-mix(in_srgb,var(--success)_14%,transparent)]' : currentWeek === i + 1 && 'bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => onCell(row, i + 1)}
                          className="pressable flex h-[56px] w-full flex-col items-center justify-center px-0.5 text-center"
                          aria-label={`${row.name}, settimana ${i + 1}: ${c.top ? `${formatKg(c.top.weightKg)} kg per ${displayReps(c.top)}${up ? ', migliorato' : ''}` : c.skipped ? 'saltato' : 'vuoto'}. Modifica`}
                        >
                          {c.top ? (
                            <>
                              <span className="flex items-center gap-0.5 text-[14px] leading-tight font-extrabold tnum">
                                {up && <ArrowUp size={11} strokeWidth={3.2} className="text-success-ink" aria-hidden />}
                                <span>
                                  {c.top.weightKg === null ? '—' : formatKg(c.top.weightKg)}
                                  <span className="font-normal text-muted">×</span>
                                  {displayReps(c.top)}
                                </span>
                              </span>
                              {(c.pr || c.count > 1) && (
                                <span className="mt-0.5 text-[10px] leading-none font-extrabold tnum">
                                  {c.pr && <span className="rounded bg-[linear-gradient(135deg,var(--warm),var(--warm-2))] px-0.5 text-[#1b1305]">PR</span>}
                                  {c.count > 1 && <span className="ml-0.5 text-muted">{c.count}s</span>}
                                </span>
                              )}
                            </>
                          ) : c.skipped ? (
                            <span className="text-[12px] text-muted italic">saltato</span>
                          ) : (
                            <span className="text-muted/60" aria-hidden>
                              ·
                            </span>
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

/** "Bench press (barbell, flat)" -> "Bench press" for the narrow first column. */
function shortName(name: string): string {
  return name.replace(/\s*\(.*\)\s*$/, '').replace(/,.*$/, '');
}

function SessionsView() {
  const list = useLiveQuery(loadSessionList, []);
  const [, navigate] = useLocation();
  if (!list) return <div className="flex flex-col gap-2 px-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>;
  if (list.length === 0) return <div className="px-4"><EmptyState title="Nessuna sessione" text="Le sessioni che fai compaiono qui." /></div>;
  return (
    <ul className="flex flex-col gap-2 px-4">
      {list.map(({ session, day, sets, volume }) => (
        <li key={session.id} style={accentStyle(day?.type)}>
          <Card className="overflow-hidden">
            <button type="button" onClick={() => navigate(`/sessione/${session.id}`)} className="pressable flex min-h-16 w-full items-center gap-3 px-3 py-2.5 text-left">
              <span className="tile flex w-12 shrink-0 flex-col items-center rounded-[14px] py-1.5" style={{ '--t1': 'var(--accent)', '--t2': 'var(--accent-2)' } as React.CSSProperties} aria-hidden>
                <span className="text-[18px] leading-tight font-extrabold tnum">{session.date.slice(8)}</span>
                <span className="text-[11px] font-bold uppercase">{formatDateShort(session.date).split(' ')[1]}</span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[16px] font-bold">
                  {day?.title ?? 'Giorno eliminato'}
                  {!session.finishedAt && <span className="ml-2 text-[12px] font-bold text-warning-ink uppercase">in corso</span>}
                </span>
                <span className="block truncate text-[13px] text-muted tnum">
                  {capitalize(`settimana ${session.week}`)} · {sets} serie{volume > 0 ? ` · ${formatVolume(volume)} kg` : ''}
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
            </button>
          </Card>
        </li>
      ))}
    </ul>
  );
}
