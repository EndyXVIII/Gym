import { CalendarCheck2, ClipboardList, History, Settings2 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cx } from './ui';

const tabs = [
  { href: '/', label: 'Oggi', icon: CalendarCheck2, match: (p: string) => p === '/' },
  { href: '/programma', label: 'Programma', icon: ClipboardList, match: (p: string) => p.startsWith('/programma') },
  { href: '/storico', label: 'Storico', icon: History, match: (p: string) => p.startsWith('/storico') },
  { href: '/impostazioni', label: 'Impostazioni', icon: Settings2, match: (p: string) => p.startsWith('/impostazioni') },
];

export const TAB_BAR_HEIGHT = 64;

export function TabBar() {
  const [path] = useLocation();
  return (
    <nav
      aria-label="Sezioni"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] border-t border-line bg-[var(--tabbar)] backdrop-blur-xl backdrop-saturate-150"
    >
      <ul className="grid grid-cols-4 pb-safe">
        {tabs.map((t) => {
          const active = t.match(path);
          const Icon = t.icon;
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'pressable flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium',
                  active ? 'text-ink' : 'text-muted',
                )}
              >
                <Icon size={24} strokeWidth={active ? 2.4 : 1.9} aria-hidden className={active ? 'text-[var(--upper-ink)]' : undefined} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
