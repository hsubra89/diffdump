import type { HTMLAttributes } from 'react'

import { cn } from '../../lib/cn'

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
        'flex h-10 shrink-0 items-center gap-2 border-b border-line px-3 font-mono text-[10px] font-bold uppercase tracking-[0.08em] text-muted-bright',
        className,
      )}
      {...props}
    />
  )
}
