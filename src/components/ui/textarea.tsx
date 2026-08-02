import type { ComponentProps } from 'react'

import { cn } from '../../lib/cn'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex min-h-16 w-full resize-y rounded-control border border-line bg-canvas px-2 py-1.5 text-xs text-foreground outline-none transition-[border-color,box-shadow]',
        'placeholder:text-muted-foreground/70 focus-visible:border-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-55',
        className,
      )}
      {...props}
    />
  )
}
