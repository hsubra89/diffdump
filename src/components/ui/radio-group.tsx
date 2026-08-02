import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'

import { cn } from '../../lib/cn'

export function RadioGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn('grid w-full gap-3', className)}
      {...props}
    />
  )
}

export function RadioGroupItem({
  className,
  ...props
}: RadioPrimitive.Root.Props) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group-item"
      className={cn(
        'group/radio relative flex size-4 shrink-0 rounded-full border border-line-bright bg-canvas outline-none transition-[border-color,background-color,box-shadow]',
        'focus-visible:border-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'data-checked:border-accent-text data-checked:bg-accent-text/20 data-disabled:cursor-not-allowed data-disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator
        data-slot="radio-group-indicator"
        className="flex size-full items-center justify-center"
      >
        <span className="size-1.5 rounded-full bg-accent-text" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Root>
  )
}
