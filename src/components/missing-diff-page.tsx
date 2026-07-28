import { Link } from '@tanstack/react-router'

import { buttonVariants } from './ui/button'
import { Wordmark } from './wordmark'

export function MissingDiffPage() {
  return (
    <main className="mx-auto flex min-h-screen w-[min(580px,calc(100%-40px))] flex-col items-start justify-center text-foreground">
      <Wordmark className="mb-9" />
      <p className="mb-5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-bright">
        404
      </p>
      <h1 className="mb-3.5 text-[clamp(38px,7vw,62px)] leading-[1.02] tracking-[-0.035em]">
        This diff is off the map.
      </h1>
      <p className="mb-7 leading-relaxed text-muted-bright">
        The link may be mistyped, expired, or never existed.
      </p>
      <Link
        className={buttonVariants({ variant: 'primary', size: 'sm' })}
        to="/"
      >
        Share a new diff
      </Link>
    </main>
  )
}
