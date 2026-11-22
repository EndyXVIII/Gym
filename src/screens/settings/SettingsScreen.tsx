import { EmptyState, ScreenHeader } from '../../components/ui';

export default function SettingsScreen(_props: Record<string, unknown>) {
  return (
    <div>
      <ScreenHeader title="SettingsScreen" />
      <div className="px-4">
        <EmptyState title="In arrivo" text="Questa schermata arriva nel prossimo passo." />
      </div>
    </div>
  );
}
