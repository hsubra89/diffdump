import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { IconCheck } from '@pierre/icons'

import { cn } from '../../lib/cn'

export function Checkbox({
  className,
  ...props
}: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'inline-flex size-3.5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-line-bright bg-canvas text-accent-text outline-none transition-[border-color,background-color,box-shadow]',
        'focus-visible:border-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'data-checked:border-accent-text data-checked:bg-accent-text/20 data-indeterminate:border-accent-text data-indeterminate:bg-accent-text/20',
        'data-disabled:pointer-events-none data-disabled:cursor-not-allowed data-disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex size-full items-center justify-center data-indeterminate:[&_svg]:hidden data-indeterminate:[&_span]:block"
      >
        <IconCheck className="size-3" aria-hidden="true" />
        <span className="hidden h-px w-2 rounded-full bg-current" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
