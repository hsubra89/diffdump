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
      <svg className="size-6 shrink-0" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--logo-add)" />
        <path
          d="M21.8 0H23a9 9 0 0 1 9 9v14a9 9 0 0 1-9 9H10.2Z"
          fill="var(--logo-del)"
        />
        <line
          x1="12.6"
          y1="25.4"
          x2="19.4"
          y2="6.6"
          stroke="var(--accent-ink)"
          strokeWidth="3.6"
          strokeLinecap="round"
        />
      </svg>
      diffdump
    </Link>
  )
}
