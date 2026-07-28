import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
} from 'react'

import { cn } from '../../lib/cn'

export function SegmentedControl({
  className,
  ...props
}: HTMLAttributes<HTMLFieldSetElement>) {
  return (
    <fieldset
      className={cn(
        'inline-flex h-8 items-center rounded-control border border-line bg-canvas p-0.5',
        className,
      )}
      {...props}
    />
  )
}

type SegmentedControlItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  active: boolean
}

export const SegmentedControlItem = forwardRef<
  HTMLButtonElement,
  SegmentedControlItemProps
>(({ active, className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={active}
    className={cn(
      'h-[26px] rounded-[5px] px-2.5 text-[11px] font-medium text-muted transition-colors',
      'hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
      active && 'bg-surface-raised text-foreground shadow-sm',
      className,
    )}
    {...props}
  />
))

SegmentedControlItem.displayName = 'SegmentedControlItem'
