import { Link } from '@tanstack/react-router'

import { cn } from '../lib/cn'

type WordmarkProps = {
  className?: string
}

export function Wordmark({ className }: WordmarkProps) {
  return (
    <Link
      className={cn(
        'inline-flex items-center gap-2 font-sans text-[15px] font-semibold tracking-[-0.025em]',
        className,
      )}
      to="/"
    >
      <svg className="size-6 shrink-0" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--logo-accent)" />
        <path
          d="M22 0h1a9 9 0 0 1 9 9v14a9 9 0 0 1-9 9H10Z"
          fill="var(--logo-neutral)"
        />
        <line
          x1="13"
          y1="25"
          x2="19"
          y2="7"
          stroke="var(--logo-mark)"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>
      diffdump
    </Link>
  )
}
