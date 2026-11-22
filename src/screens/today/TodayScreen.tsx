import { useLiveQuery } from 'dexie-react-hooks';
import { useSettings } from '../../app/SettingsContext';
import { useToday } from '../../lib/hooks';
import { weekInfo } from '../../lib/program';
import { loadToday } from '../../lib/queries';
import { Card, ScreenHeader, ScreenSkeleton } from '../../components/ui';

export function TodayScreen() {
  const settings = useSettings();
  const today = useToday();
  const data = useLiveQuery(loadToday, []);
  if (!data) return <ScreenSkeleton />;
  const w = weekInfo(settings, today);
  return (
    <div>
      <ScreenHeader title={`Ciao, ${settings.name}`} subtitle={today} />
      <div className="flex flex-col gap-3 px-4">
        <Card className="p-4">Settimana {w.week} di 7</Card>
        {data.days.map((d) => (
          <Card key={d.id} className="p-4">
            {d.title} · {data.slotsByDay.get(d.key)?.length ?? 0} esercizi
          </Card>
        ))}
      </div>
    </div>
  );
}
