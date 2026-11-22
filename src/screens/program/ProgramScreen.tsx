import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useLocation } from 'wouter';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ChevronLeft, ChevronRight, GripVertical, Link2, Plus, Settings2, Trash2 } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { loadProgram } from '../../lib/queries';
import { addDay, addSlot, addSlotWithNewExercise, deleteDay, moveDay, reorderSlots, updateDay } from '../../lib/programOps';
import { formatSetsColumn, setsForWeek, weekInfo } from '../../lib/program';
import { formatRest, plural, WEEKDAYS_IT, capitalize } from '../../lib/format';
import { useToday } from '../../lib/hooks';
import { db } from '../../lib/db';
import type { Day, Slot } from '../../lib/types';
import { accentStyle, Button, Card, cx, EmptyState, Field, inputClass, ScreenHeader, Segmented, ScreenSkeleton } from '../../components/ui';
import { ConfirmSheet, Sheet } from '../../components/Sheet';
import { ExercisePicker } from '../../components/ExercisePicker';
import { SyncDot } from '../../components/SyncDot';
import { toast } from '../../components/Toast';
import { undoStore } from '../../lib/repo';
import { SlotEditorSheet } from './SlotEditorSheet';

export default function ProgramScreen({ dayKey }: { dayKey?: string }) {
  const data = useLiveQuery(loadProgram, []);
  const [, navigate] = useLocation();
  const settings = useSettings();
  const today = useToday();
  const week = weekInfo(settings, today).week;

  if (!data) return <ScreenSkeleton />;
  const day = data.days.find((d) => d.key === dayKey) ?? data.days[0];

  return (
    <div>
      <ScreenHeader title="Programma" right={<SyncDot className="p-2" />} />
      <nav aria-label="Giorni" className="scrollbar-none -mb-1 flex gap-2 overflow-x-auto px-4 pb-1">
        {data.days.map((d) => (
          <button
            key={d.id}
            type="button"
            style={accentStyle(d.type)}
            aria-current={d.id === day?.id ? 'page' : undefined}
            onClick={() => navigate(`/programma/${encodeURIComponent(d.key)}`, { replace: true })}
            className={cx(
              'pressable flex h-12 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-semibold whitespace-nowrap',
              d.id === day?.id ? 'border-transparent bg-accent text-on-accent' : 'border-line bg-surface text-ink',
            )}
          >
            {d.id !== day?.id && <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />}
            {d.title}
          </button>
        ))}
        <button
          type="button"
          onClick={async () => {
            const d = await addDay();
            navigate(`/programma/${encodeURIComponent(d.key)}`, { replace: true });
            toast.show('Giorno aggiunto: scegli il giorno della settimana');
          }}
          className="pressable flex h-12 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-line px-4 text-[15px] font-medium text-muted"
        >
          <Plus size={18} aria-hidden /> Giorno
        </button>
      </nav>

      <div className="mt-4 px-4">
        {day ? (
          <DayEditor key={day.id} day={day} slots={data.slotsByDay.get(day.key) ?? []} week={week} isFirst={data.days[0]?.id === day.id} isLast={data.days.at(-1)?.id === day.id} onDeleted={() => navigate('/programma', { replace: true })} />
        ) : (
          <EmptyState title="Nessun giorno" text="Aggiungi il primo giorno della scheda." action={<Button variant="primary" onClick={() => void addDay()}>Aggiungi un giorno</Button>} />
        )}
      </div>
    </div>
  );
}

function DayEditor({ day, slots, week, isFirst, isLast, onDeleted }: { day: Day; slots: Slot[]; week: number; isFirst: boolean; isLast: boolean; onDeleted: () => void }) {
  const settings = useSettings();
  const [order, setOrder] = useState(() => slots.map((s) => s.id));
  const [editing, setEditing] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setOrder(slots.map((s) => s.id)), [slots]);

  const byId = useMemo(() => new Map(slots.map((s) => [s.id, s])), [slots]);
  const ordered = order.map((id) => byId.get(id)).filter((s): s is Slot => !!s);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const next = arrayMove(order, order.indexOf(String(e.active.id)), order.indexOf(String(e.over.id)));
    setOrder(next);
    void reorderSlots(day.key, next);
  };

  const totalSets = slots.reduce((n, s) => n + setsForWeek(s.sets, week, settings.extraSets), 0);

  return (
    <div style={accentStyle(day.type)} className="flex flex-col gap-3">
      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[22px] font-bold">{day.title}</h2>
            <p className="mt-0.5 text-[14px] text-muted tnum">
              {day.weekday ? capitalize(WEEKDAYS_IT[day.weekday - 1]) : 'Nessun giorno fisso'} · {day.type === 'upper' ? 'parte alta' : 'parte bassa'} · ~{day.estimatedMinutes} min
            </p>
            <p className="mt-0.5 text-[14px] text-muted tnum">
              Settimana {week}: {plural(slots.filter((s) => setsForWeek(s.sets, week, settings.extraSets) > 0).length, 'esercizio', 'esercizi')}, {totalSets} serie
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={<Settings2 size={16} aria-hidden />} onClick={() => setSettingsOpen(true)}>
            Giorno
          </Button>
        </div>
      </Card>

      {ordered.length === 0 ? (
        <EmptyState title="Nessun esercizio" text="Aggiungi il primo esercizio di questo giorno." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-2" aria-label={`Esercizi di ${day.title}`}>
              {ordered.map((s, i) => {
                const prev = ordered[i - 1];
                const linked = !!s.superset && prev?.superset?.group === s.superset.group;
                return <SortableSlot key={s.id} slot={s} week={week} linkedToPrev={linked} onOpen={() => setEditing(s.id)} />;
              })}
            </ol>
          </SortableContext>
        </DndContext>
      )}
      <p className="px-2 text-[13px] text-muted">Tieni premuta la maniglia per riordinare. Le serie passate non cambiano mai.</p>

      <Button variant="secondary" size="lg" block icon={<Plus size={20} aria-hidden />} onClick={() => setPicker(true)}>
        Aggiungi esercizio
      </Button>

      <SlotEditorSheet slotId={editing} onClose={() => setEditing(null)} />
      <ExercisePicker
        open={picker}
        onClose={() => setPicker(false)}
        title={`Aggiungi a ${day.title}`}
        onPick={async (key) => {
          setPicker(false);
          const ex = (await db.exercises.where('key').equals(key).toArray()).find((e) => !e.deletedAt);
          if (ex) {
            const slot = await addSlot(day.key, ex);
            setEditing(slot.id);
          }
        }}
        onCreate={async (name) => {
          setPicker(false);
          const slot = await addSlotWithNewExercise(day.key, name);
          setEditing(slot.id);
        }}
      />
      <DaySettingsSheet
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        day={day}
        isFirst={isFirst}
        isLast={isLast}
        onDelete={() => {
          setSettingsOpen(false);
          setConfirmDelete(true);
        }}
      />
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Eliminare ${day.title}?`}
        text="Il giorno e i suoi esercizi escono dal programma. Lo storico delle sessioni resta."
        confirmLabel="Elimina giorno"
        danger
        onConfirm={async () => {
          await deleteDay(day.id);
          onDeleted();
          toast.show(`${day.title} eliminato`, { actionLabel: 'Annulla', onAction: () => void undoStore.undoLast() });
        }}
      />
    </div>
  );
}

function SortableSlot({ slot, week, linkedToPrev, onOpen }: { slot: Slot; week: number; linkedToPrev: boolean; onOpen: () => void }) {
  const settings = useSettings();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: slot.id });
  const n = setsForWeek(slot.sets, week, settings.extraSets);
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx('relative', isDragging && 'z-20', linkedToPrev && '-mt-1')}
    >
      {linkedToPrev && (
        <span className="absolute -top-2 left-[58px] z-10 flex items-center gap-1 rounded-full bg-surface px-1.5 text-[11px] font-semibold text-accent-ink" aria-hidden>
          <Link2 size={12} /> superserie
        </span>
      )}
      <div
        className={cx(
          'flex min-h-[72px] items-center rounded-[18px] border bg-surface',
          slot.superset ? 'border-[color-mix(in_srgb,var(--accent)_40%,transparent)]' : 'border-line',
          isDragging && 'shadow-[var(--shadow)] ring-2 ring-[var(--accent)]',
        )}
      >
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Riordina ${slot.name}`}
          className="flex h-[72px] w-11 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
        >
          <GripVertical size={20} aria-hidden />
        </button>
        <button type="button" onClick={onOpen} className="pressable flex min-h-[72px] min-w-0 flex-1 items-center gap-3 py-2 pr-3 text-left">
          <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-1 text-[15px] font-bold text-accent-ink tnum">{slot.label}</span>
          <span className="min-w-0 flex-1">
            <span className="line-clamp-2 text-[15px] leading-snug font-semibold">{slot.name}</span>
            <span className="mt-0.5 block text-[13px] text-muted tnum">
              {formatSetsColumn(slot.sets)} × {slot.reps} · RIR {slot.rir} · {slot.restSeconds === 0 ? 'subito la b' : formatRest(slot.restSeconds)}
              {n === 0 && ' · nascosto questa settimana'}
            </span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-muted" aria-hidden />
        </button>
      </div>
    </li>
  );
}

function DaySettingsSheet({ open, onClose, day, isFirst, isLast, onDelete }: { open: boolean; onClose: () => void; day: Day; isFirst: boolean; isLast: boolean; onDelete: () => void }) {
  const [title, setTitle] = useState(day.title);
  const [minutes, setMinutes] = useState(String(day.estimatedMinutes));
  useEffect(() => {
    if (open) {
      setTitle(day.title);
      setMinutes(String(day.estimatedMinutes));
    }
  }, [open, day.title, day.estimatedMinutes]);

  return (
    <Sheet open={open} onClose={onClose} title="Impostazioni del giorno">
      <div className="flex flex-col gap-4 pb-2" style={accentStyle(day.type)}>
        <Field label="Nome" htmlFor="day-title">
          <input
            id="day-title"
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() && title !== day.title && void updateDay(day.id, { title: title.trim() })}
          />
        </Field>
        <Field label="Giorno della settimana" htmlFor="day-weekday">
          <select
            id="day-weekday"
            className={inputClass}
            value={day.weekday ?? ''}
            onChange={(e) => void updateDay(day.id, { weekday: e.target.value ? Number(e.target.value) : null })}
          >
            <option value="">Nessuno (lo apro quando voglio)</option>
            {WEEKDAYS_IT.map((w, i) => (
              <option key={w} value={i + 1}>
                {capitalize(w)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Tipo (colore)">
          <Segmented
            label="Tipo di giorno"
            value={day.type}
            onChange={(v) => void updateDay(day.id, { type: v })}
            options={[
              { value: 'upper', label: 'Parte alta' },
              { value: 'lower', label: 'Parte bassa' },
            ]}
          />
        </Field>
        <Field label="Durata stimata (minuti)" htmlFor="day-min">
          <input
            id="day-min"
            className={inputClass}
            inputMode="numeric"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={() => {
              const m = Number(minutes);
              if (m > 0 && m !== day.estimatedMinutes) void updateDay(day.id, { estimatedMinutes: m });
            }}
          />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={isFirst} icon={<ChevronLeft size={18} aria-hidden />} onClick={() => void moveDay(day.id, -1)}>
            Sposta prima
          </Button>
          <Button variant="secondary" disabled={isLast} icon={<ChevronRight size={18} aria-hidden />} onClick={() => void moveDay(day.id, 1)}>
            Sposta dopo
          </Button>
        </div>
        <Button variant="danger" icon={<Trash2 size={18} aria-hidden />} onClick={onDelete}>
          Elimina giorno
        </Button>
      </div>
    </Sheet>
  );
}
