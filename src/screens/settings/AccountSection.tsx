import { syncLabel, useSyncState, SyncDot } from '../../components/SyncDot';
import { Section, Row } from './SettingsScreen';

/** Account and sync (completed in step 5). */
export function AccountSection() {
  const s = useSyncState();
  return (
    <Section title="Sincronizzazione">
      <Row>
        <div className="flex items-center gap-3">
          <SyncDot />
          <p className="text-[15px]">{syncLabel(s.kind)}</p>
        </div>
      </Row>
    </Section>
  );
}
