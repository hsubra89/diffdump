import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

export const eyebrowClassName =
  'font-mono text-[11px] font-medium uppercase tracking-[0.08em]'

export function Toolbar({ className, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={cn(
        'flex min-h-12 items-center justify-between border-b border-line bg-panel px-4',
        className,
      )}
      {...props}
    />
  )
}

export function PanelHeader({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        eyebrowClassName,
        'flex h-10 shrink-0 items-center gap-2 border-b border-line px-3 text-muted-bright md:px-4',
        className,
      )}
      {...props}
    />
  )
}
