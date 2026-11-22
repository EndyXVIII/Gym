import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'md' | 'lg' | 'sm';

const variants: Record<Variant, string> = {
  primary: 'bg-accent text-on-accent font-semibold shadow-[0_6px_20px_-8px_var(--accent)]',
  secondary: 'bg-raised text-ink border border-line font-medium',
  ghost: 'text-ink font-medium hover:bg-raised',
  danger: 'bg-[color-mix(in_srgb,var(--danger)_14%,transparent)] text-danger font-semibold border border-[color-mix(in_srgb,var(--danger)_35%,transparent)]',
  success: 'bg-success text-on-accent font-semibold',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-10 px-3 text-[14px] rounded-xl gap-1.5',
  md: 'min-h-12 px-4 text-[15px] rounded-2xl gap-2',
  lg: 'min-h-14 px-5 text-[17px] rounded-2xl gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', block, icon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'pressable inline-flex items-center justify-center whitespace-nowrap select-none disabled:opacity-45 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        block && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'plain' | 'raised' | 'accent';
  size?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'plain', size = 48, className, children, type = 'button', style, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cx(
        'pressable inline-flex shrink-0 items-center justify-center rounded-2xl disabled:opacity-40',
        variant === 'raised' && 'bg-raised border border-line text-ink',
        variant === 'plain' && 'text-ink hover:bg-raised',
        variant === 'accent' && 'bg-accent text-on-accent',
        className,
      )}
      style={{ width: size, height: size, ...style }}
      {...rest}
    >
      {children}
    </button>
  );
});

export function Card({ className, children, as: As = 'div', ...rest }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' | 'li' } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cx('rounded-[18px] border border-line bg-surface', className)} {...rest}>
      {children}
    </As>
  );
}

export function Chip({ children, className, tone = 'default', icon }: { children: ReactNode; className?: string; tone?: 'default' | 'accent' | 'warning' | 'success' | 'muted'; icon?: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-medium whitespace-nowrap tnum',
        tone === 'default' && 'bg-raised text-ink',
        tone === 'muted' && 'bg-raised text-muted',
        tone === 'accent' && 'bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent-ink',
        tone === 'warning' && 'bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-warning',
        tone === 'success' && 'bg-[color-mix(in_srgb,var(--success)_16%,transparent)] text-success-ink',
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

export function Badge({ children, tone = 'warning', className }: { children: ReactNode; tone?: 'warning' | 'success' | 'accent' | 'danger'; className?: string }) {
  return (
    <span
      className={cx(
        'inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-bold tracking-wide uppercase',
        tone === 'warning' && 'bg-warning text-[#1b1305]',
        tone === 'success' && 'bg-success text-on-accent',
        tone === 'accent' && 'bg-accent text-on-accent',
        tone === 'danger' && 'bg-danger text-[#1b0505]',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-h-8 items-center justify-between gap-3 px-1', className)}>
      <h2 className="text-[13px] font-semibold tracking-[0.06em] text-muted uppercase">{children}</h2>
      {action}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2', disabled && 'opacity-50')}>
      <span className="min-w-0">
        <span className="block text-[15px] text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          id={id}
          type="checkbox"
          role="switch"
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          aria-hidden
          className={cx(
            'h-[31px] w-[51px] rounded-full border transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)]',
            checked ? 'border-transparent bg-success' : 'border-line bg-raised',
          )}
        />
        <span
          aria-hidden
          className={cx(
            'pointer-events-none absolute top-[2px] left-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-md transition-transform duration-200 ease-out',
            checked && 'translate-x-[20px]',
          )}
        />
      </span>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cx('flex rounded-2xl border border-line bg-raised p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'pressable min-h-10 flex-1 rounded-xl px-2 text-[14px] font-medium',
            value === o.value ? 'bg-surface text-ink shadow-[0_1px_0_var(--border),0_4px_12px_-6px_rgb(0_0_0/0.5)]' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="px-1 text-[13px] font-medium text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="px-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full min-h-12 rounded-2xl border border-line bg-raised px-4 text-[16px] text-ink placeholder:text-muted/70 outline-none focus:border-[var(--focus)]';

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[18px] border border-dashed border-line px-6 py-10 text-center">
      {icon && <div className="mb-1 text-muted">{icon}</div>}
      <p className="text-[16px] font-semibold text-ink">{title}</p>
      {text && <p className="max-w-[34ch] text-[14px] text-muted">{text}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('skeleton', className)} />;
}

export function ScreenSkeleton() {
  return (
    <div className="flex flex-col gap-4 px-4 pt-safe" aria-busy="true" aria-label="Caricamento">
      <Skeleton className="mt-6 h-8 w-40" />
      <Skeleton className="h-24" />
      <Skeleton className="h-56" />
      <Skeleton className="h-16" />
    </div>
  );
}

/** Large title header used by the tab screens. */
export function ScreenHeader({ title, subtitle, right }: { title: string; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pt-safe pb-3">
      <div className="min-w-0 pt-4">
        {subtitle && <p className="text-[14px] font-medium text-muted">{subtitle}</p>}
        <h1 className="truncate text-[30px] leading-tight font-bold tracking-tight text-ink">{title}</h1>
      </div>
      {right && <div className="flex shrink-0 items-center gap-1 pb-1">{right}</div>}
    </header>
  );
}

export function accentStyle(type: 'upper' | 'lower' | undefined): React.CSSProperties {
  return type === 'lower'
    ? ({ '--accent': 'var(--lower)', '--accent-ink': 'var(--lower-ink)' } as React.CSSProperties)
    : ({ '--accent': 'var(--upper)', '--accent-ink': 'var(--upper-ink)' } as React.CSSProperties);
}
