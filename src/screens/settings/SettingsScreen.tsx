import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CalendarRange, Database, Dumbbell, Download, ExternalLink, FileSpreadsheet, Info, Palette, Settings2, Upload, UserRound, Volume2 } from 'lucide-react';
import { useSettings } from '../../app/SettingsContext';
import { updateSettings, startNewBlock } from '../../lib/settingsOps';
import { BLOCK_WEEKS, weekInfo } from '../../lib/program';
import { useToday } from '../../lib/hooks';
import { backupFileName, buildCsv, buildExport, importBackup, ImportError, saveFile } from '../../lib/exportImport';
import { softBeep, unlockAudio } from '../../lib/feedback';
import { capitalize, formatDateLong, formatKg } from '../../lib/format';
import { REPDB_CREDIT, REPDB_URL } from '../../data/exerciseImages';
import { Button, Card, cx, IconTile, inputClass, ScreenHeader, Segmented, Switch, type Tone } from '../../components/ui';
import { ConfirmSheet } from '../../components/Sheet';
import { SyncDot } from '../../components/SyncDot';
import { toast } from '../../components/Toast';
import { AccountSection } from './AccountSection';

const STEPS = [0.5, 1, 1.25, 2, 2.5, 5];

export default function SettingsScreen() {
  const settings = useSettings();
  const today = useToday();
  const w = weekInfo(settings, today);
  const [name, setName] = useState(settings.name);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => setName(settings.name), [settings.name]);

  const exportJson = async () => {
    const data = await buildExport();
    await saveFile(backupFileName('json'), new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
  };
  const exportCsv = async () => {
    await saveFile(backupFileName('csv'), new Blob([await buildCsv()], { type: 'text/csv;charset=utf-8' }));
  };
  const onImport = async (file: File) => {
    try {
      const r = await importBackup(await file.text());
      toast.show(r.added + r.updated === 0 ? 'Niente di nuovo: avevi già tutto.' : `Importati ${r.added} nuovi record, aggiornati ${r.updated}.`, { tone: 'success' });
    } catch (e) {
      toast.show(e instanceof ImportError ? e.message : 'Importazione non riuscita.', { tone: 'error' });
    }
  };

  return (
    <div>
      <ScreenHeader
        title="Impostazioni"
        subtitle="Scheda"
        icon={
          <IconTile tone="cyan" size={48} round>
            <Settings2 size={24} />
          </IconTile>
        }
        right={<SyncDot className="p-2" />}
      />
      <div className="flex flex-col gap-6 px-4 pt-2">
        <Section title="Profilo" icon={<UserRound size={16} />} tone="blue">
          <Row>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-muted">Nome</span>
              <input
                className={inputClass}
                value={name}
                autoComplete="given-name"
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && name !== settings.name && void updateSettings({ name: name.trim() })}
              />
            </label>
          </Row>
        </Section>

        <Section title={`Blocco di ${BLOCK_WEEKS} settimane`} icon={<CalendarRange size={16} />} tone="pink">
          <Row>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-muted">Inizio del blocco (lunedì)</span>
              <input
                type="date"
                className={inputClass}
                value={settings.blockStartDate}
                onChange={(e) => e.target.value && void updateSettings({ blockStartDate: e.target.value })}
              />
            </label>
            <p className="mt-2 text-[13px] text-muted">{capitalize(formatDateLong(settings.blockStartDate))}</p>
          </Row>
          <Row>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-muted">Settimana corrente</span>
              <select
                className={inputClass}
                value={settings.weekOverride ?? ''}
                onChange={(e) => void updateSettings({ weekOverride: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">Automatica: settimana {Math.min(BLOCK_WEEKS, Math.max(1, w.calendar))}</option>
                {Array.from({ length: BLOCK_WEEKS }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    Settimana {n}
                  </option>
                ))}
              </select>
            </label>
          </Row>
          <Row>
            <Switch
              label="Serie extra"
              description="Settimane 4-6: usa il secondo numero dove c’è la freccia (3 → 4, 0 → 3)"
              checked={settings.extraSets}
              onChange={(v) => void updateSettings({ extraSets: v })}
            />
          </Row>
          <Row>
            <Button variant="secondary" block onClick={() => setConfirmBlock(true)}>
              Inizia un nuovo blocco
            </Button>
          </Row>
        </Section>

        <Section title="Allenamento" icon={<Dumbbell size={16} />} tone="amber">
          <Row>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-medium text-muted">Scatto di carico predefinito (− e +)</span>
              <select className={inputClass} value={settings.defaultLoadStepKg} onChange={(e) => void updateSettings({ defaultLoadStepKg: Number(e.target.value) })}>
                {STEPS.map((s) => (
                  <option key={s} value={s}>
                    {formatKg(s)} kg
                  </option>
                ))}
              </select>
            </label>
          </Row>
          <Row>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <Switch label="Suono a fine recupero" description="Un bip leggero. Con il silenzioso attivo l’iPhone non suona." checked={settings.sound} onChange={(v) => void updateSettings({ sound: v })} />
              </div>
              <Button
                variant="secondary"
                size="sm"
                icon={<Volume2 size={16} aria-hidden />}
                onClick={() => {
                  unlockAudio();
                  softBeep();
                }}
              >
                Prova
              </Button>
            </div>
          </Row>
        </Section>

        <Section title="Aspetto" icon={<Palette size={16} />} tone="pink">
          <Row>
            <Segmented
              label="Tema"
              value={settings.theme}
              onChange={(v) => void updateSettings({ theme: v })}
              options={[
                { value: 'system', label: 'Sistema' },
                { value: 'dark', label: 'Scuro' },
                { value: 'light', label: 'Chiaro' },
              ]}
            />
          </Row>
        </Section>

        <AccountSection />

        <Section title="Dati" icon={<Database size={16} />} tone="cyan">
          <Row>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" icon={<Download size={18} aria-hidden />} onClick={() => void exportJson()}>
                Esporta JSON
              </Button>
              <Button variant="secondary" icon={<FileSpreadsheet size={18} aria-hidden />} onClick={() => void exportCsv()}>
                Esporta CSV
              </Button>
            </div>
            <Button variant="ghost" block className="mt-2" icon={<Upload size={18} aria-hidden />} onClick={() => fileInput.current?.click()}>
              Importa un backup JSON
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="File di backup da importare"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onImport(f);
                e.target.value = '';
              }}
            />
            <p className="mt-2 text-[13px] text-muted">L’importazione unisce i dati: tiene sempre la versione modificata per ultima. Le foto non sono nel backup JSON.</p>
          </Row>
        </Section>

        <Section title="Informazioni" icon={<Info size={16} />} tone="slate">
          <Row>
            <p className="text-[15px] font-semibold">Scheda {__APP_VERSION__}</p>
            <p className="mt-1 text-[14px] leading-relaxed text-muted">
              App privata: i dati stanno sul telefono e, se accedi, nel tuo database Supabase. Nessuna statistica, nessun tracker, nessuna pubblicità, nessuno script di terze parti.
            </p>
          </Row>
          <Row>
            <p className="text-[13px] font-medium text-muted">Crediti</p>
            <p className="mt-1 text-[14px] leading-relaxed">
              <a href={REPDB_URL} target="_blank" rel="nofollow noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--upper-ink)] underline underline-offset-2">
                {REPDB_CREDIT} <ExternalLink size={14} aria-hidden />
              </a>
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted">
              Illustrazioni degli esercizi dal dataset gratuito RepDB (licenza RepDB Free Tier), usate solo dentro l’app. Mappe muscolari disegnate per Scheda. Icone: Lucide (ISC).
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">Il programma, le note degli esercizi e i numeri della settimana 1 vengono dalla mia scheda.</p>
          </Row>
        </Section>
      </div>
      <ConfirmSheet
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title="Iniziare un nuovo blocco?"
        text="Stesso programma, storico conservato. La data di inizio passa al prossimo lunedì e si riparte dalla settimana 1."
        confirmLabel="Inizia un nuovo blocco"
        onConfirm={async () => {
          const start = await startNewBlock(today);
          toast.show(`Nuovo blocco dal ${formatDateLong(start)}`, { tone: 'success' });
        }}
      />
    </div>
  );
}

export function Section({ title, icon, tone = 'blue', children }: { title: string; icon?: ReactNode; tone?: Tone; children: ReactNode }) {
  return (
    <section>
      <div className="flex items-center gap-2.5 px-1">
        {icon && (
          <IconTile tone={tone} size={30} className="rounded-[10px]">
            {icon}
          </IconTile>
        )}
        <h2 className="eyebrow text-muted">{title}</h2>
      </div>
      <Card className="mt-2.5 divide-y divide-[var(--border)]">{children}</Card>
    </section>
  );
}

export function Row({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('px-4 py-3', className)}>{children}</div>;
}
