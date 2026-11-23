import { useMemo, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { BookOpen, Check, ChevronRight, Clock3, Dumbbell, Layers, Moon, Play, RotateCcw, Sparkles, Timer, Zap } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { useNow, useToday } from '../../lib/hooks';
import { addDays, BLOCK_WEEKS, dayPlanSummary, isoWeekday, weekInfo, weekRule, type WeekInfo } from '../../lib/program';
import { loadExerciseMap, loadToday, type TodayData } from '../../lib/queries';
import { loadWeekMuscles } from '../../lib/muscleQueries';
import { FULL_AT_WEEK, totalSerie } from '../../lib/muscleStats';
import { startSession } from '../../lib/sessionOps';
import { startNewBlock } from '../../lib/settingsOps';
import { restTimer } from '../../lib/timer';
import { capitalize, formatDateLong, formatSeconds, greeting, plural, weekdayName, WEEKDAYS_SHORT_IT } from '../../lib/format';
import type { Day, Exercise, Session, Slot } from '../../lib/types';
import { accentStyle, Button, Card, cx, IconTile, ScreenSkeleton, SectionTitle } from '../../components/ui';
import { WeekProgress } from '../../components/WeekProgress';
import { SyncDot } from '../../components/SyncDot';
import { ExerciseThumb } from '../../components/ExerciseThumb';
import { MuscleMini } from '../../components/MuscleReport';
import { Confetti } from '../../components/Confetti';
import { toast } from '../../components/Toast';
import { setsForWeek } from '../../lib/program';
import { RulesSheet } from './RulesSheet';
import { DaySheet } from './DaySheet';

export function TodayScreen() {
  const settings = useSettings();
  const today = useToday();
  const data = useLiveQuery(loadToday, []);
  const exercises = useLiveQuery(() => loadExerciseMap(), []);
  const [, navigate] = useLocation();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState<Day | null>(null);

  const w = weekInfo(settings, today);
  const muscles = useLiveQuery(() => loadWeekMuscles(settings.blockStartDate, w.week), [settings.blockStartDate, w.week]);
  const view = useMemo(() => (data ? buildView(data, w, settings.blockStartDate, today) : null), [data, w.week, settings.blockStartDate, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !view) return <ScreenSkeleton />;

  const start = async (day: Day) => {
    const id = await startSession(day.key, w.week, settings.blockStartDate, today);
    navigate(`/sessione/${id}`);
  };

  const hour = new Date().getHours();
  const rule = weekRule(w.week);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-center justify-between gap-3 px-4 pt-safe">
        <div className="flex min-w-0 items-center gap-3 pt-4">
          <IconTile tone="blue" size={52} round>
            <span className="text-[22px] font-extrabold">{settings.name.trim().charAt(0).toUpperCase() || 'S'}</span>
          </IconTile>
          <div className="min-w-0">
            <p className="eyebrow text-muted">{capitalize(formatDateLong(today))}</p>
            <h1 className="truncate text-[28px] leading-tight font-extrabold tracking-tight">
              {greeting(hour)}, <span className="text-grad">{settings.name}</span>
            </h1>
          </div>
        </div>
        <SyncDot className="mt-4 p-2" />
      </header>

      <div className="flex flex-col gap-5 px-4">
        {/* Block / week */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[20px] font-extrabold tnum">
              Settimana {w.week} di {BLOCK_WEEKS}
            </p>
            {w.overridden && <span className="text-[12px] font-medium text-muted">impostata a mano</span>}
          </div>
          <WeekProgress week={w.week} completed={w.completed} />
          <button type="button" onClick={() => setRulesOpen(true)} className="pressable mt-4 flex min-h-14 w-full items-center gap-3 rounded-2xl bg-raised px-3 py-2 text-left">
            <IconTile tone="amber" size={36}>
              <BookOpen size={18} />
            </IconTile>
            <span className="min-w-0 flex-1 text-[14px] leading-snug">
              <span className="font-bold">{rule.title}.</span> <span className="text-muted">{rule.text}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
          </button>
          {w.notStarted && <p className="mt-3 text-[14px] text-muted">Il blocco inizia {formatDateLong(settings.blockStartDate)}.</p>}
        </Card>

        {/* In progress first */}
        {view.inProgress.map((s) => (
          <ResumeCard key={s.id} session={s} day={view.dayByKey.get(s.dayKey)} onOpen={() => navigate(`/sessione/${s.id}`)} />
        ))}

        {w.completed && (
          <BlockCompletedCard
            onStart={async () => {
              const startDate = await startNewBlock(today);
              toast.show(`Nuovo blocco: si parte ${formatDateLong(startDate)}.`, { tone: 'success' });
            }}
          />
        )}

        {/* Today */}
        {view.todayDays.length > 0 ? (
          view.todayDays.map((d) => (
            <TodayCard
              key={d.id}
              day={d}
              slots={data.slotsByDay.get(d.key) ?? []}
              week={w.week}
              extraSets={settings.extraSets}
              exercises={exercises}
              done={view.doneThisWeek.get(d.key)}
              inProgress={view.inProgress.some((s) => s.dayKey === d.key)}
              onStart={() => start(d)}
              onOpenDone={(s) => navigate(`/sessione/${s.id}`)}
            />
          ))
        ) : (
          <RestCard next={view.next} onOpenAny={() => setDayOpen(view.next?.day ?? data.days[0] ?? null)} />
        )}

        {/* The week */}
        <section aria-labelledby="week-sessions">
          <SectionTitle
            action={
              <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--success)_18%,transparent)] px-2 text-[13px] font-extrabold text-success-ink tnum">
                {view.doneCount}/{view.plannedCount}
              </span>
            }
          >
            <span id="week-sessions">
              Questa settimana · <span className="tnum">{view.doneCount}/{view.plannedCount}</span>
            </span>
          </SectionTitle>
          <ul className="mt-2 flex flex-col gap-2.5">
            {data.days.map((d) => {
              const done = view.doneThisWeek.get(d.key);
              const isToday = view.todayDays.some((t) => t.id === d.id);
              const summary = dayPlanSummary(data.slotsByDay.get(d.key) ?? [], w.week, settings.extraSets);
              return (
                <li key={d.id} style={accentStyle(d.type)}>
                  <button
                    type="button"
                    onClick={() => setDayOpen(d)}
                    className={cx(
                      'pressable card-surface flex min-h-[72px] w-full items-center gap-3.5 rounded-[22px] px-3 py-2.5 text-left',
                      isToday && 'border-[color-mix(in_srgb,var(--accent)_55%,var(--border))]',
                    )}
                  >
                    <span className="relative">
                      <IconTile tone={d.type === 'lower' ? 'green' : 'blue'} size={50}>
                        <span className="text-[13px] font-extrabold tracking-wide uppercase">{d.weekday ? WEEKDAYS_SHORT_IT[d.weekday - 1] : '—'}</span>
                      </IconTile>
                      {done && (
                        <span className="absolute -right-1.5 -bottom-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-success text-on-accent" aria-hidden>
                          <Check size={14} strokeWidth={3.4} />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[17px] font-bold">
                        {d.title}
                        {isToday && <span className="ml-2 text-[12px] font-bold tracking-wide text-accent-ink uppercase">oggi</span>}
                      </span>
                      <span className="block truncate text-[13px] text-muted">
                        {capitalize(weekdayName(d.weekday))} · {plural(summary.exercises, 'esercizio', 'esercizi')} · {summary.sets} serie
                        {done ? ' · fatto' : ''}
                      </span>
                    </span>
                    <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Muscles of the week */}
        <section aria-labelledby="week-muscles">
          <SectionTitle>
            <span id="week-muscles">Muscoli della settimana</span>
          </SectionTitle>
          <button
            type="button"
            onClick={() => {
              try {
                localStorage.setItem('scheda:history-tab', 'muscles');
              } catch {
                /* ignore */
              }
              navigate('/storico');
            }}
            className="pressable card-surface mt-2 flex w-full items-center gap-2 rounded-[22px] p-3 text-left"
            aria-label="Muscoli della settimana: apri la mappa nello storico"
          >
            {muscles && totalSerie(muscles.credits) > 0 ? (
              <MuscleMini credits={muscles.credits} fullAt={FULL_AT_WEEK} />
            ) : (
              <div className="flex w-full items-center gap-3 px-1 py-2">
                <IconTile tone="amber" size={48}>
                  <Zap size={22} />
                </IconTile>
                <p className="min-w-0 flex-1 text-[14px] text-muted">Dopo il primo allenamento vedi qui quali muscoli hai colpito, sulla mappa.</p>
              </div>
            )}
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
          </button>
        </section>
      </div>

      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} week={w.week} />
      <DaySheet
        day={dayOpen}
        onClose={() => setDayOpen(null)}
        week={w.week}
        slots={dayOpen ? (data.slotsByDay.get(dayOpen.key) ?? []) : []}
        exercises={exercises}
        done={dayOpen ? view.doneThisWeek.get(dayOpen.key) : undefined}
        inProgress={dayOpen ? view.inProgress.find((s) => s.dayKey === dayOpen.key) : undefined}
        onStart={(d) => {
          setDayOpen(null);
          void start(d);
        }}
        onOpenSession={(s) => {
          setDayOpen(null);
          navigate(`/sessione/${s.id}`);
        }}
      />
    </div>
  );
}

interface TodayView {
  dayByKey: Map<string, Day>;
  todayDays: Day[];
  inProgress: Session[];
  doneThisWeek: Map<string, Session>;
  doneCount: number;
  plannedCount: number;
  next: { day: Day; date: string } | null;
}

function buildView(data: TodayData, w: WeekInfo, blockStart: string, today: string): TodayView {
  const dayByKey = new Map(data.days.map((d) => [d.key, d]));
  const wd = isoWeekday(today);
  const todayDays = data.days.filter((d) => d.weekday === wd);
  const doneThisWeek = new Map<string, Session>();
  for (const s of data.sessions) {
    if (s.finishedAt && s.blockStart === blockStart && s.week === w.week && !doneThisWeek.has(s.dayKey)) doneThisWeek.set(s.dayKey, s);
  }
  const planned = data.days.filter((d) => d.weekday !== null);
  // Next training day after today (wrapping to next week).
  let next: TodayView['next'] = null;
  for (let i = 1; i <= 7 && !next; i++) {
    const nwd = ((wd - 1 + i) % 7) + 1;
    const d = data.days.find((x) => x.weekday === nwd);
    if (d) next = { day: d, date: addDays(today, i) };
  }
  return {
    dayByKey,
    todayDays,
    inProgress: data.inProgress,
    doneThisWeek,
    doneCount: [...doneThisWeek.keys()].filter((k) => dayByKey.has(k)).length,
    plannedCount: planned.length || data.days.length,
    next,
  };
}

/** The first few exercises of the day as overlapping round pictures. */
function ThumbStack({ slots, week, extraSets, exercises }: { slots: Slot[]; week: number; extraSets: boolean; exercises: Map<string, Exercise> | undefined }) {
  const shown = slots.filter((s) => setsForWeek(s.sets, week, extraSets) > 0).slice(0, 5);
  const more = slots.filter((s) => setsForWeek(s.sets, week, extraSets) > 0).length - shown.length;
  if (!exercises || shown.length === 0) return null;
  return (
    <div className="flex items-center" aria-hidden>
      {shown.map((s) => (
        <ExerciseThumb key={s.id} exercise={exercises.get(s.exerciseKey)} size={44} className="-ml-2.5 rounded-full border-2 border-[var(--surface)] first:ml-0" />
      ))}
      {more > 0 && <span className="-ml-2.5 flex h-11 min-w-11 items-center justify-center rounded-full border-2 border-[var(--surface)] bg-raised px-1 text-[13px] font-bold tnum">+{more}</span>}
    </div>
  );
}

function TodayCard({
  day,
  slots,
  week,
  extraSets,
  exercises,
  done,
  inProgress,
  onStart,
  onOpenDone,
}: {
  day: Day;
  slots: Slot[];
  week: number;
  extraSets: boolean;
  exercises: Map<string, Exercise> | undefined;
  done: Session | undefined;
  inProgress: boolean;
  onStart: () => void;
  onOpenDone: (s: Session) => void;
}) {
  const summary = dayPlanSummary(slots, week, extraSets);
  return (
    <section style={accentStyle(day.type)} aria-label={`Allenamento di oggi: ${day.title}`} className="hero rounded-[28px] p-5">
      <p className="eyebrow text-accent-ink">Oggi · {day.type === 'upper' ? 'parte alta' : 'parte bassa'}</p>
      <h2 className="mt-1 text-[44px] leading-none font-extrabold tracking-tight">{day.title}</h2>
      <ul className="mt-4 flex flex-wrap gap-1.5 text-[13.5px] font-semibold tnum">
        <li className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--text)_9%,transparent)] px-2.5 py-1.5">
          <Layers size={15} aria-hidden /> {plural(summary.exercises, 'esercizio', 'esercizi')}
        </li>
        <li className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--text)_9%,transparent)] px-2.5 py-1.5">
          <Zap size={15} aria-hidden /> {summary.sets} serie
        </li>
        <li className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--text)_9%,transparent)] px-2.5 py-1.5">
          <Clock3 size={15} aria-hidden /> ~{day.estimatedMinutes} min
        </li>
      </ul>
      <div className="mt-4">
        <ThumbStack slots={slots} week={week} extraSets={extraSets} exercises={exercises} />
      </div>
      <div className="mt-5">
        {done && !inProgress ? (
          <div className="flex flex-col gap-2.5">
            <p className="flex items-center gap-2 text-[15px] font-bold text-success-ink">
              <Check size={18} strokeWidth={3} aria-hidden /> Fatto questa settimana
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" size="lg" onClick={() => onOpenDone(done)}>
                Rivedi
              </Button>
              <Button variant="primary" size="lg" icon={<Play size={18} fill="currentColor" aria-hidden />} onClick={onStart}>
                Di nuovo
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="primary" size="lg" block className="sheen min-h-[60px] text-[19px]" icon={inProgress ? <RotateCcw size={22} aria-hidden /> : <Play size={22} fill="currentColor" aria-hidden />} onClick={onStart}>
            {inProgress ? 'Riprendi' : 'Inizia'}
          </Button>
        )}
      </div>
    </section>
  );
}

function ResumeCard({ session, day, onOpen }: { session: Session; day: Day | undefined; onOpen: () => void }) {
  const timer = useSyncExternalStore(restTimer.subscribe, restTimer.get, restTimer.get);
  const now = useNow(1000, !!timer && timer.sessionId === session.id);
  const resting = timer && timer.sessionId === session.id ? Math.ceil(restTimer.remainingMs(now) / 1000) : 0;
  const minutes = session.startedAt ? Math.max(0, Math.round((now - Date.parse(session.startedAt)) / 60000)) : 0;
  return (
    <Card className="hero flex items-center gap-3 rounded-[24px] p-3.5" style={accentStyle(day?.type)}>
      <IconTile tone={day?.type === 'lower' ? 'green' : 'blue'} size={52}>
        <Timer size={24} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className="eyebrow text-accent-ink">In corso</p>
        <p className="truncate text-[18px] font-extrabold">{day?.title ?? 'Allenamento'}</p>
        <p className="text-[13px] text-muted tnum">{resting > 0 ? `Recupero ${formatSeconds(resting)}` : `Iniziato ${minutes} min fa`}</p>
      </div>
      <Button variant="primary" onClick={onOpen} icon={<RotateCcw size={18} aria-hidden />}>
        Riprendi
      </Button>
    </Card>
  );
}

function RestCard({ next, onOpenAny }: { next: { day: Day; date: string } | null; onOpenAny: () => void }) {
  return (
    <section aria-label="Riposo" className="relative overflow-hidden rounded-[28px] border border-line bg-[radial-gradient(110%_90%_at_100%_0%,color-mix(in_srgb,var(--upper-2)_30%,transparent),transparent_60%),linear-gradient(160deg,color-mix(in_srgb,var(--upper-2)_14%,var(--surface)),var(--surface)_75%)] p-5">
      <div className="flex items-center gap-4">
        <IconTile tone="blue" size={60} round>
          <Moon size={28} />
        </IconTile>
        <div>
          <h2 className="text-[32px] leading-none font-extrabold">Riposo</h2>
          <p className="mt-1.5 text-[14px] text-muted">Oggi niente pesi: i muscoli crescono mentre recuperi.</p>
        </div>
      </div>
      {next && (
        <p className="mt-4 rounded-2xl bg-[color-mix(in_srgb,var(--text)_7%,transparent)] px-4 py-3 text-[15px]">
          Prossima sessione: <span className="font-bold">{next.day.title}</span>, {formatDateLong(next.date)}
        </p>
      )}
      <Button variant="secondary" size="lg" block className="mt-4" icon={<Dumbbell size={20} aria-hidden />} onClick={onOpenAny}>
        Apri un giorno
      </Button>
    </section>
  );
}

function BlockCompletedCard({ onStart }: { onStart: () => void }) {
  return (
    <section
      aria-label="Blocco completato"
      className="relative overflow-hidden rounded-[28px] border border-[color-mix(in_srgb,var(--warm)_50%,var(--border))] bg-[radial-gradient(110%_90%_at_100%_0%,color-mix(in_srgb,var(--pink)_32%,transparent),transparent_60%),linear-gradient(160deg,color-mix(in_srgb,var(--warm)_20%,var(--surface)),var(--surface)_75%)] p-5"
    >
      <Confetti />
      <p className="eyebrow flex items-center gap-2 text-warm-ink">
        <Sparkles size={16} aria-hidden /> {BLOCK_WEEKS} settimane fatte
      </p>
      <h2 className="mt-1 text-[34px] leading-tight font-extrabold">Blocco completato</h2>
      <p className="mt-2 text-[15px] text-muted">Stesso programma, storico conservato. Il nuovo blocco parte lunedì dalla settimana 1.</p>
      <Button
        variant="primary"
        size="lg"
        block
        className="mt-4"
        style={{ '--accent': 'var(--warm)', '--accent-2': 'var(--warm-2)' } as React.CSSProperties}
        onClick={onStart}
      >
        Inizia un nuovo blocco
      </Button>
    </section>
  );
}
