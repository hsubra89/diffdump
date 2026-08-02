import type { ComponentProps } from 'react'
import { Input as InputPrimitive } from '@base-ui/react/input'

import { cn } from '../../lib/cn'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <InputPrimitive
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 rounded-control border border-line bg-canvas px-3 py-1 text-xs text-foreground outline-none transition-[border-color,box-shadow]',
        'file:mr-2 file:inline-flex file:h-6 file:border-0 file:bg-transparent file:p-0 file:text-xs file:font-medium file:text-foreground',
        'placeholder:text-muted-foreground/70 focus-visible:border-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    />
  )
}
