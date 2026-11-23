import { PROGRAM_RULES } from '../../lib/program';
import { Sheet } from '../../components/Sheet';
import { cx } from '../../components/ui';

/** The rules of my program sheet, with this week's rule highlighted. */
export function RulesSheet({ open, onClose, week }: { open: boolean; onClose: () => void; week: number }) {
  const currentTitle = week === 1 ? 'Settimana 1' : week <= 3 ? 'Settimane 2-3' : week <= 5 ? 'Settimane 4-5' : 'Settimana 6';
  return (
    <Sheet open={open} onClose={onClose} title="Regole del programma">
      <ul className="flex flex-col gap-2 pb-2">
        {PROGRAM_RULES.map((r) => {
          const current = r.title === currentTitle;
          return (
            <li
              key={r.title}
              className={cx(
                'rounded-[20px] border px-4 py-3',
                current ? 'border-[color-mix(in_srgb,var(--upper)_60%,transparent)] bg-[linear-gradient(135deg,color-mix(in_srgb,var(--upper)_16%,var(--surface)),color-mix(in_srgb,var(--upper-2)_10%,var(--surface)))]' : 'border-line bg-raised',
              )}
            >
              <p className="text-[15px] font-bold">
                {r.title}
                {current && <span className="eyebrow ml-2 text-[11px] text-[var(--upper-ink)]">questa settimana</span>}
              </p>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">{r.text}</p>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
