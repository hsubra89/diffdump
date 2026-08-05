import { lazy, Suspense, useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'

import { GitHubRepoLink } from '../components/github-repo-link'
import { MissingDiffPage } from '../components/missing-diff-page'
import { Wordmark } from '../components/wordmark'
import { ThemeToggle } from '../components/ui/theme-toggle'
import type { StoredDiff } from '../lib/diffs'
import { createNoIndexPageHead } from '../lib/seo'
import { getDiff } from '../server/diffs.functions'

const DiffViewer = import.meta.env.SSR
  ? null
  : lazy(() => import('../components/diff-viewer'))

export const Route = createFileRoute('/view/$slug')({
  ssr: false,
  head: () =>
    createNoIndexPageHead({
      title: 'Shared diff — Diffdump',
      description:
        'Review a shared code diff in Diffdump’s focused, syntax-highlighted diff viewer.',
    }),
  pendingComponent: DiffLoading,
  errorComponent: MissingDiffPage,
  component: SharedDiffPage,
})

function SharedDiffPage() {
  const { slug } = Route.useParams()
  const getDiffFn = useServerFn(getDiff)
  const [storedDiff, setStoredDiff] = useState<StoredDiff | null>()
  const [loadError, setLoadError] = useState<Error | null>(null)

  useEffect(() => {
    let active = true

    setStoredDiff(undefined)
    setLoadError(null)
    void getDiffFn({ data: slug }).then(
      (result) => {
        if (active) {
          setStoredDiff(result)
        }
      },
      (error: unknown) => {
        if (active) {
          setLoadError(
            error instanceof Error
              ? error
              : new Error('The shared diff could not be loaded.'),
          )
        }
      },
    )

    return () => {
      active = false
    }
  }, [getDiffFn, slug])

  if (loadError) {
    throw loadError
  }

  if (storedDiff === undefined) {
    return <DiffLoading />
  }

  if (storedDiff === null) {
    return <MissingDiffPage />
  }

  if (!DiffViewer) {
    return <DiffLoading />
  }

  return (
    <Suspense fallback={<DiffLoading />}>
      <DiffViewer slug={slug} storedDiff={storedDiff} />
    </Suspense>
  )
}

function DiffLoading() {
  return (
    <main className="grid h-svh grid-rows-[56px_minmax(0,1fr)] overflow-hidden bg-canvas text-foreground">
      <header className="flex items-center justify-between border-b border-line bg-canvas/95 px-3 sm:px-5">
        <Wordmark />
        <div className="flex items-center gap-2">
          <GitHubRepoLink />
          <ThemeToggle />
        </div>
      </header>
      <div
        className="flex items-center justify-center gap-3 font-mono text-xs text-muted-foreground"
        aria-live="polite"
      >
        <span
          className="size-2 animate-pulse rounded-full bg-accent-text"
          aria-hidden="true"
        />
        Loading shared diff…
      </div>
    </main>
  )
}
