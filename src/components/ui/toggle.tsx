import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

import { cn } from '../../lib/cn'

type ToggleProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-pressed'
> & {
  pressed: boolean
  children: ReactNode
}

export const Toggle = forwardRef<HTMLButtonElement, ToggleProps>(
  ({ pressed, children, className, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      aria-pressed={pressed}
      className={cn(
        'inline-flex h-8 items-center gap-2.5 rounded-control px-1 text-xs font-medium text-muted',
        'transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
        className,
      )}
      {...props}
    >
      {children}
      <span
        aria-hidden="true"
        className={cn(
          'relative h-4 w-7 rounded-full border border-line-bright bg-surface transition-colors',
          "after:absolute after:left-0.5 after:top-0.5 after:size-2.5 after:rounded-full after:bg-muted after:transition-[transform,background-color] after:content-['']",
          pressed &&
            'border-accent-text/40 bg-accent-text/20 after:translate-x-[11px] after:bg-accent-text',
        )}
      />
    </button>
  ),
)

Toggle.displayName = 'Toggle'
