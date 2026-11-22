import { EmptyState, ScreenHeader } from '../../components/ui';

export default function HistoryScreen(_props: Record<string, unknown>) {
  return (
    <div>
      <ScreenHeader title="HistoryScreen" />
      <div className="px-4">
        <EmptyState title="In arrivo" text="Questa schermata arriva nel prossimo passo." />
      </div>
    </div>
  );
}
