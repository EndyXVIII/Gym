import { CalendarCheck2, ClipboardList, History, Settings2 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cx } from './ui';

const tabs = [
  { href: '/', label: 'Oggi', icon: CalendarCheck2, tone: 'tile-blue', match: (p: string) => p === '/' },
  { href: '/programma', label: 'Programma', icon: ClipboardList, tone: 'tile-amber', match: (p: string) => p.startsWith('/programma') },
  { href: '/storico', label: 'Storico', icon: History, tone: 'tile-pink', match: (p: string) => p.startsWith('/storico') },
  { href: '/impostazioni', label: 'Impostazioni', icon: Settings2, tone: 'tile-cyan', match: (p: string) => p.startsWith('/impostazioni') },
];

export const TAB_BAR_HEIGHT = 84;

/** Floating glass bar. The active tab gets its own colour. */
export function TabBar() {
  const [path] = useLocation();
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
      <nav aria-label="Sezioni" className="pointer-events-auto rounded-[30px] border border-line bg-[var(--glass)] shadow-[var(--shadow)] backdrop-blur-2xl backdrop-saturate-150">
        <ul className="grid grid-cols-4 px-1.5">
          {tabs.map((t) => {
            const active = t.match(path);
            const Icon = t.icon;
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  aria-current={active ? 'page' : undefined}
                  className={cx('pressable flex h-[68px] flex-col items-center justify-center gap-1 text-[11px] font-semibold', active ? 'text-ink' : 'text-muted')}
                >
                  <span className={cx('flex h-8 w-14 items-center justify-center rounded-full transition-all duration-200', active ? `tile ${t.tone}` : '')}>
                    <Icon size={22} strokeWidth={active ? 2.5 : 2} aria-hidden />
                  </span>
                  <span>{t.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
