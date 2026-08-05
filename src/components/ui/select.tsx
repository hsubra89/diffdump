import type { ComponentProps } from 'react'
import { Select as SelectPrimitive } from '@base-ui/react/select'
import { IconCheck, IconChevronSm } from '@pierre/icons'

import { cn } from '../../lib/cn'

export const Select = SelectPrimitive.Root
export const SelectGroup = SelectPrimitive.Group
export const SelectValue = SelectPrimitive.Value

export function SelectTrigger({
  className,
  children,
  ...props
}: SelectPrimitive.Trigger.Props) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      className={cn(
        'group flex h-8 min-w-0 items-center justify-between gap-2 rounded-control border border-line bg-canvas px-3 text-xs text-foreground outline-none transition-[color,background-color,border-color,box-shadow]',
        'hover:border-line-bright hover:bg-surface focus-visible:border-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:pointer-events-none disabled:opacity-55 [&_[data-slot=select-value]]:min-w-0 [&_[data-slot=select-value]]:truncate',
        className,
      )}
      {...props}
    >
      {children}
      <IconChevronSm
        className="shrink-0 text-muted-foreground transition-transform group-data-[popup-open]:rotate-180"
        aria-hidden="true"
      />
    </SelectPrimitive.Trigger>
  )
}

export function SelectContent({
  className,
  children,
  align = 'center',
  alignOffset = 0,
  alignItemWithTrigger = false,
  side = 'bottom',
  sideOffset = 5,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<
    SelectPrimitive.Positioner.Props,
    'align' | 'alignItemWithTrigger' | 'alignOffset' | 'side' | 'sideOffset'
  >) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        alignItemWithTrigger={alignItemWithTrigger}
        side={side}
        sideOffset={sideOffset}
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          className={cn(
            'max-h-[var(--available-height)] min-w-[var(--anchor-width)] origin-[var(--transform-origin)] overflow-hidden rounded-control border border-border bg-popover text-popover-foreground shadow-float outline-none',
            'duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List className="max-h-[min(320px,var(--available-height))] scroll-py-1 overflow-y-auto p-1">
            {children}
          </SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

export function SelectLabel({
  className,
  ...props
}: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn(
        'px-2 py-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground',
        className,
      )}
      {...props}
    />
  )
}

export function SelectItem({
  className,
  children,
  ...props
}: SelectPrimitive.Item.Props) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'relative flex min-h-8 cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-xs text-muted-bright outline-none',
        'data-highlighted:bg-surface-raised data-highlighted:text-foreground data-selected:text-foreground data-disabled:pointer-events-none data-disabled:opacity-45',
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="min-w-0 flex-1">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2 inline-flex size-4 items-center justify-center text-accent-text">
        <IconCheck aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<'div'>) {
  return (
    <div
      data-slot="select-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({
  className,
  ...props
}: SelectPrimitive.ScrollUpArrow.Props) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn(
        'flex h-6 cursor-default items-center justify-center bg-popover text-muted-foreground',
        className,
      )}
      {...props}
    >
      <IconChevronSm className="rotate-180" aria-hidden="true" />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({
  className,
  ...props
}: SelectPrimitive.ScrollDownArrow.Props) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn(
        'flex h-6 cursor-default items-center justify-center bg-popover text-muted-foreground',
        className,
      )}
      {...props}
    >
      <IconChevronSm aria-hidden="true" />
    </SelectPrimitive.ScrollDownArrow>
  )
}
