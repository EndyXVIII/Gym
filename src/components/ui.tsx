import { forwardRef, useId, type ButtonHTMLAttributes, type ReactNode } from 'react';

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
type Size = 'md' | 'lg' | 'sm';

const variants: Record<Variant, string> = {
  primary: 'grad-accent glow-accent text-on-accent font-bold',
  secondary: 'bg-raised text-ink border border-line font-semibold',
  ghost: 'text-ink font-semibold hover:bg-raised',
  danger: 'bg-[color-mix(in_srgb,var(--danger)_16%,transparent)] text-danger-ink font-bold border border-[color-mix(in_srgb,var(--danger)_40%,transparent)]',
  success: 'bg-[linear-gradient(135deg,var(--lower),var(--lower-2))] text-on-accent font-bold shadow-[0_14px_34px_-14px_var(--lower)]',
};

const sizes: Record<Size, string> = {
  sm: 'min-h-12 px-3.5 text-[14px] rounded-2xl gap-1.5',
  md: 'min-h-12 px-4 text-[15px] rounded-2xl gap-2',
  lg: 'min-h-14 px-5 text-[17px] rounded-[20px] gap-2.5',
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
        variant === 'accent' && 'grad-accent text-on-accent',
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
    <As className={cx('card-surface rounded-[22px]', className)} {...rest}>
      {children}
    </As>
  );
}

export type Tone = 'blue' | 'green' | 'amber' | 'pink' | 'cyan' | 'slate';

/** A vivid gradient square with an icon: gives lists and headers some colour. */
export function IconTile({ tone = 'blue', size = 40, children, className, round }: { tone?: Tone; size?: number; children: ReactNode; className?: string; round?: boolean }) {
  return (
    <span aria-hidden className={cx('tile', `tile-${tone}`, round ? 'rounded-full' : 'rounded-[14px]', className)} style={{ width: size, height: size }}>
      {children}
    </span>
  );
}

export function Chip({ children, className, tone = 'default', icon }: { children: ReactNode; className?: string; tone?: 'default' | 'accent' | 'warning' | 'success' | 'muted' | 'push' | 'pull' | 'legs' | 'core'; icon?: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] font-semibold whitespace-nowrap tnum',
        tone === 'default' && 'bg-raised text-ink',
        tone === 'muted' && 'bg-raised text-muted',
        tone === 'accent' && 'bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] text-accent-ink',
        tone === 'warning' && 'bg-[color-mix(in_srgb,var(--warning)_18%,transparent)] text-warning-ink',
        tone === 'success' && 'bg-[color-mix(in_srgb,var(--success)_18%,transparent)] text-success-ink',
        tone === 'push' && 'bg-[color-mix(in_srgb,var(--push)_18%,transparent)] text-[var(--push-ink)]',
        tone === 'pull' && 'bg-[color-mix(in_srgb,var(--pull)_18%,transparent)] text-[var(--pull-ink)]',
        tone === 'legs' && 'bg-[color-mix(in_srgb,var(--legs)_18%,transparent)] text-[var(--legs-ink)]',
        tone === 'core' && 'bg-[color-mix(in_srgb,var(--core)_20%,transparent)] text-[var(--core-ink)]',
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
        'inline-flex h-5 items-center rounded-md px-1.5 text-[11px] font-extrabold tracking-wide uppercase',
        tone === 'warning' && 'bg-[linear-gradient(135deg,var(--warm),var(--warm-2))] text-[#1b1305]',
        tone === 'success' && 'bg-success text-on-accent',
        tone === 'accent' && 'grad-accent text-on-accent',
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
      <h2 className="eyebrow text-muted">{children}</h2>
      {action}
    </div>
  );
}

export function Switch({ checked, onChange, label, description, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean }) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx('flex min-h-14 cursor-pointer items-center justify-between gap-4 py-2', disabled && 'opacity-50')}>
      <span className="min-w-0">
        <span className="block text-[15px] font-medium text-ink">{label}</span>
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
            checked ? 'border-transparent bg-[linear-gradient(135deg,var(--lower),var(--lower-2))]' : 'border-line bg-raised',
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
    <div role="radiogroup" aria-label={label} className={cx('flex rounded-[20px] border border-line bg-raised p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'pressable min-h-12 flex-1 rounded-2xl px-2 text-[14px] font-semibold',
            value === o.value ? 'grad-accent text-on-accent shadow-[0_6px_16px_-8px_var(--accent)]' : 'text-muted',
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
      <label htmlFor={htmlFor} className="px-1 text-[13px] font-semibold text-muted">
        {label}
      </label>
      {children}
      {hint && <p className="px-1 text-[12px] text-muted">{hint}</p>}
    </div>
  );
}

export const inputClass =
  'w-full min-h-12 rounded-2xl border border-line bg-raised px-4 text-[16px] text-ink placeholder:text-muted/70 outline-none focus:border-[var(--focus)]';

export function EmptyState({ icon, title, text, action, tone = 'blue' }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode; tone?: Tone }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-[22px] border border-dashed border-line px-6 py-10 text-center">
      {icon && (
        <IconTile tone={tone} size={56} className="mb-1" round>
          {icon}
        </IconTile>
      )}
      <p className="text-[17px] font-bold text-ink">{title}</p>
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
export function ScreenHeader({ title, subtitle, right, icon }: { title: string; subtitle?: ReactNode; right?: ReactNode; icon?: ReactNode }) {
  return (
    <header className="flex items-end justify-between gap-3 px-4 pt-safe pb-3">
      <div className="flex min-w-0 items-center gap-3 pt-4">
        {icon}
        <div className="min-w-0">
          {subtitle && <p className="eyebrow text-muted">{subtitle}</p>}
          <h1 className="truncate text-[32px] leading-tight font-extrabold tracking-tight text-ink">{title}</h1>
        </div>
      </div>
      {right && <div className="flex shrink-0 items-center gap-1 pb-1">{right}</div>}
    </header>
  );
}

export function accentStyle(type: 'upper' | 'lower' | undefined): React.CSSProperties {
  return type === 'lower'
    ? ({ '--accent': 'var(--lower)', '--accent-2': 'var(--lower-2)', '--accent-ink': 'var(--lower-ink)' } as React.CSSProperties)
    : ({ '--accent': 'var(--upper)', '--accent-2': 'var(--upper-2)', '--accent-ink': 'var(--upper-ink)' } as React.CSSProperties);
}
