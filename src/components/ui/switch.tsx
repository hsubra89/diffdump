import { Switch as SwitchPrimitive } from '@base-ui/react/switch'

import { cn } from '../../lib/cn'

export function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'relative h-4 w-7 shrink-0 rounded-full border border-line-bright bg-surface outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'data-checked:border-accent-text/40 data-checked:bg-accent-text/20 data-disabled:pointer-events-none data-disabled:opacity-55',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-2.5 translate-x-0.5 rounded-full bg-muted-foreground transition-transform data-checked:translate-x-[11px] data-checked:bg-accent-text" />
    </SwitchPrimitive.Root>
  )
}
