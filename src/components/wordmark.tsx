import { Link } from '@tanstack/react-router'

import { cn } from '../lib/cn'

type WordmarkProps = {
  className?: string
}

export function Wordmark({ className }: WordmarkProps) {
  return (
    <Link
      className={cn(
        'inline-flex items-center gap-2 font-mono text-[15px] font-bold tracking-[-0.04em]',
        className,
      )}
      to="/"
    >
      <span
        className="grid size-6 place-items-center rounded-control bg-accent text-[17px] font-black text-accent-ink"
        aria-hidden="true"
      >
        /
      </span>
      diffdump
    </Link>
  )
}
