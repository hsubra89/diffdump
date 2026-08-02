import type { ComponentProps } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

import { cn } from '../../lib/cn'

export function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

export function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

export function PopoverContent({
  className,
  align = 'end',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 6,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'origin-[var(--transform-origin)] rounded-control border border-border bg-popover text-popover-foreground shadow-float outline-none',
            'duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export function PopoverTitle({
  className,
  ...props
}: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      className={cn('font-medium text-foreground', className)}
      {...props}
    />
  )
}

export function PopoverDescription({
  className,
  ...props
}: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      className={cn('text-muted-foreground', className)}
      {...props}
    />
  )
}

export type PopoverContentProps = ComponentProps<typeof PopoverContent>
