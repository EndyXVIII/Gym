import { useMemo, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { BookOpen, Check, ChevronRight, Clock3, Dumbbell, Moon, Play, RotateCcw, Sparkles, Timer } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { useNow, useToday } from '../../lib/hooks';
import { addDays, dayPlanSummary, isoWeekday, weekInfo, weekRule, type WeekInfo } from '../../lib/program';
import { loadToday, type TodayData } from '../../lib/queries';
import { startSession } from '../../lib/sessionOps';
import { startNewBlock } from '../../lib/settingsOps';
import { restTimer } from '../../lib/timer';
import { capitalize, formatDateLong, formatSeconds, greeting, plural, weekdayName } from '../../lib/format';
import type { Day, Session } from '../../lib/types';
import { accentStyle, Badge, Button, Card, cx, ScreenSkeleton, SectionTitle } from '../../components/ui';
import { WeekProgress } from '../../components/WeekProgress';
import { SyncDot } from '../../components/SyncDot';
import { toast } from '../../components/Toast';
import { RulesSheet } from './RulesSheet';
import { DaySheet } from './DaySheet';

export function TodayScreen() {
  const settings = useSettings();
  const today = useToday();
  const data = useLiveQuery(loadToday, []);
  const [, navigate] = useLocation();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [dayOpen, setDayOpen] = useState<Day | null>(null);

  const w = weekInfo(settings, today);
  const view = useMemo(() => (data ? buildView(data, w, settings.blockStartDate, today) : null), [data, w.week, settings.blockStartDate, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !view) return <ScreenSkeleton />;

  const start = async (day: Day) => {
    const id = await startSession(day.key, w.week, settings.blockStartDate, today);
    navigate(`/sessione/${id}`);
  };

  const hour = new Date().getHours();
  const rule = weekRule(w.week);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-start justify-between gap-3 px-4 pt-safe">
        <div className="pt-4">
          <p className="text-[14px] font-medium text-muted">{capitalize(formatDateLong(today))}</p>
          <h1 className="text-[30px] leading-tight font-bold tracking-tight">
            {greeting(hour)}, {settings.name}
          </h1>
        </div>
        <SyncDot className="mt-6 p-2" />
      </header>

      <div className="flex flex-col gap-4 px-4">
        {/* Week */}
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-[17px] font-semibold tnum">
              Settimana {w.week} di 7
              {w.overridden && <span className="ml-2 text-[13px] font-normal text-muted">(impostata a mano)</span>}
            </p>
            {w.isDeload && <Badge tone="warning">Scarico</Badge>}
          </div>
          <WeekProgress week={w.week} completed={w.completed} />
          <button type="button" onClick={() => setRulesOpen(true)} className="pressable mt-3 flex min-h-12 w-full items-center gap-3 rounded-2xl bg-raised px-3 py-2 text-left">
            <BookOpen size={18} className="shrink-0 text-muted" aria-hidden />
            <span className="min-w-0 flex-1 text-[14px] leading-snug">
              <span className="font-semibold">{rule.title}.</span> <span className="text-muted">{rule.text}</span>
            </span>
            <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
          </button>
          {w.notStarted && <p className="mt-3 text-[14px] text-muted">Il blocco inizia {formatDateLong(settings.blockStartDate)}.</p>}
        </Card>

        {/* In progress first */}
        {view.inProgress.map((s) => (
          <ResumeCard key={s.id} session={s} day={view.dayByKey.get(s.dayKey)} onOpen={() => navigate(`/sessione/${s.id}`)} />
        ))}

        {w.completed && <BlockCompletedCard onStart={async () => {
          const startDate = await startNewBlock(today);
          toast.show(`Nuovo blocco: si parte ${formatDateLong(startDate)}.`, { tone: 'success' });
        }} />}

        {/* Today */}
        {view.todayDays.length > 0 ? (
          view.todayDays.map((d) => (
            <TodayCard
              key={d.id}
              day={d}
              summary={dayPlanSummary(data.slotsByDay.get(d.key) ?? [], w.week, settings.extraSets)}
              done={view.doneThisWeek.get(d.key)}
              inProgress={view.inProgress.some((s) => s.dayKey === d.key)}
              onStart={() => start(d)}
              onOpenDone={(s) => navigate(`/sessione/${s.id}`)}
            />
          ))
        ) : (
          <RestCard next={view.next} onOpenAny={() => setDayOpen(view.next?.day ?? data.days[0] ?? null)} />
        )}

        {/* This week */}
        <section aria-labelledby="week-sessions">
          <SectionTitle>
            <span id="week-sessions">
              Questa settimana · <span className="tnum">{view.doneCount}/{view.plannedCount}</span>
            </span>
          </SectionTitle>
          <ul className="mt-2 flex flex-col gap-2">
            {data.days.map((d) => {
              const done = view.doneThisWeek.get(d.key);
              const isToday = view.todayDays.some((t) => t.id === d.id);
              const summary = dayPlanSummary(data.slotsByDay.get(d.key) ?? [], w.week, settings.extraSets);
              return (
                <li key={d.id} style={accentStyle(d.type)}>
                  <button
                    type="button"
                    onClick={() => setDayOpen(d)}
                    className="pressable flex min-h-16 w-full items-center gap-3 rounded-[18px] border border-line bg-surface px-3 py-2 text-left"
                  >
                    <span
                      className={cx(
                        'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        done ? 'bg-success text-on-accent' : 'bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent-ink',
                      )}
                      aria-hidden
                    >
                      {done ? <Check size={20} strokeWidth={3} /> : <Dumbbell size={19} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[16px] font-semibold">
                        {d.title}
                        {isToday && <span className="ml-2 text-[13px] font-medium text-accent-ink">oggi</span>}
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
      </div>

      <RulesSheet open={rulesOpen} onClose={() => setRulesOpen(false)} week={w.week} />
      <DaySheet
        day={dayOpen}
        onClose={() => setDayOpen(null)}
        week={w.week}
        slots={dayOpen ? (data.slotsByDay.get(dayOpen.key) ?? []) : []}
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

function TodayCard({
  day,
  summary,
  done,
  inProgress,
  onStart,
  onOpenDone,
}: {
  day: Day;
  summary: { exercises: number; sets: number };
  done: Session | undefined;
  inProgress: boolean;
  onStart: () => void;
  onOpenDone: (s: Session) => void;
}) {
  return (
    <section
      style={accentStyle(day.type)}
      aria-label={`Allenamento di oggi: ${day.title}`}
      className="relative overflow-hidden rounded-[22px] border border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--accent)_24%,var(--surface))_0%,var(--surface)_62%)] p-5"
    >
      <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-[radial-gradient(closest-side,color-mix(in_srgb,var(--accent)_35%,transparent),transparent)]" />
      <p className="text-[13px] font-semibold tracking-[0.08em] text-accent-ink uppercase">Oggi · {day.type === 'upper' ? 'parte alta' : 'parte bassa'}</p>
      <h2 className="mt-1 text-[34px] leading-none font-bold tracking-tight">{day.title}</h2>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-muted tnum">
        <span>{plural(summary.exercises, 'esercizio', 'esercizi')}</span>
        <span aria-hidden>·</span>
        <span>{summary.sets} serie</span>
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1">
          <Clock3 size={15} aria-hidden /> ~{day.estimatedMinutes} min
        </span>
      </p>
      <div className="mt-6">
        {done && !inProgress ? (
          <div className="flex flex-col gap-2">
            <p className="flex items-center gap-2 text-[15px] font-semibold text-success-ink">
              <Check size={18} strokeWidth={3} aria-hidden /> Fatto questa settimana
            </p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="lg" onClick={() => onOpenDone(done)}>
                Rivedi
              </Button>
              <Button variant="primary" size="lg" icon={<Play size={18} fill="currentColor" aria-hidden />} onClick={onStart}>
                Di nuovo
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="primary" size="lg" block icon={inProgress ? <RotateCcw size={20} aria-hidden /> : <Play size={20} fill="currentColor" aria-hidden />} onClick={onStart}>
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
    <Card className="flex items-center gap-3 p-3" style={accentStyle(day?.type)}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent" aria-hidden>
        <Timer size={22} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold tracking-[0.06em] text-accent-ink uppercase">In corso</p>
        <p className="truncate text-[16px] font-semibold">{day?.title ?? 'Allenamento'}</p>
        <p className="text-[13px] text-muted tnum">
          {resting > 0 ? `Recupero ${formatSeconds(resting)}` : `Iniziato ${minutes} min fa`}
        </p>
      </div>
      <Button variant="primary" onClick={onOpen} icon={<RotateCcw size={18} aria-hidden />}>
        Riprendi
      </Button>
    </Card>
  );
}

function RestCard({ next, onOpenAny }: { next: { day: Day; date: string } | null; onOpenAny: () => void }) {
  return (
    <section aria-label="Riposo" className="rounded-[22px] border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-raised text-muted" aria-hidden>
          <Moon size={22} />
        </span>
        <div>
          <h2 className="text-[26px] leading-none font-bold">Riposo</h2>
          <p className="mt-1 text-[14px] text-muted">Oggi niente pesi: si recupera.</p>
        </div>
      </div>
      {next && (
        <p className="mt-4 text-[15px]">
          Prossima sessione: <span className="font-semibold">{next.day.title}</span>, {formatDateLong(next.date)}
        </p>
      )}
      <Button variant="secondary" size="lg" block className="mt-4" onClick={onOpenAny}>
        Apri un giorno
      </Button>
    </section>
  );
}

function BlockCompletedCard({ onStart }: { onStart: () => void }) {
  return (
    <section aria-label="Blocco completato" className="rounded-[22px] border border-[color-mix(in_srgb,var(--warning)_45%,transparent)] bg-[linear-gradient(160deg,color-mix(in_srgb,var(--warning)_16%,var(--surface)),var(--surface)_65%)] p-5">
      <p className="flex items-center gap-2 text-[13px] font-semibold tracking-[0.08em] text-warning uppercase">
        <Sparkles size={16} aria-hidden /> 7 settimane fatte
      </p>
      <h2 className="mt-1 text-[28px] leading-tight font-bold">Blocco completato</h2>
      <p className="mt-2 text-[15px] text-muted">Stesso programma, storico conservato. Il nuovo blocco parte lunedì dalla settimana 1.</p>
      <Button variant="primary" size="lg" block className="mt-4" style={{ '--accent': 'var(--warning)' } as React.CSSProperties} onClick={onStart}>
        Inizia un nuovo blocco
      </Button>
    </section>
  );
}
