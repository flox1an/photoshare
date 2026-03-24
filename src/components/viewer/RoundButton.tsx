import { type ButtonHTMLAttributes } from 'react';

interface RoundButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** pill=true → px-3 gap-1.5 text-sm (icon + label/count); default → w-10 (icon only) */
  pill?: boolean;
  /** active=true → slightly brighter bg, no hover effect */
  active?: boolean;
  /** Fully replaces the default bg + text color classes. Use for special states like rose/red. */
  colorClass?: string;
}

/**
 * Shared rounded action button used throughout the lightbox UI.
 * Icon-only (default): 40×40 circle.
 * Pill (pill=true): auto-width with px-3 and gap between icon and label/count.
 */
export default function RoundButton({
  pill,
  active,
  colorClass,
  className,
  children,
  ...props
}: RoundButtonProps) {
  const colors = colorClass ?? (active
    ? 'bg-white/20 text-white'
    : 'bg-white/10 text-white hover:bg-white/20');

  return (
    <button
      className={[
        'flex h-10 items-center justify-center rounded-full transition-colors select-none',
        pill ? 'px-3 gap-1.5 text-sm font-medium' : 'w-10',
        colors,
        'disabled:opacity-40 disabled:cursor-default',
        className,
      ].filter(Boolean).join(' ')}
      {...props}
    >
      {children}
    </button>
  );
}
