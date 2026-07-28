import { lazy, Suspense } from 'react'
import { Link, createFileRoute, notFound } from '@tanstack/react-router'

import { getDiff } from '../server/diffs.functions'

const DiffViewer = import.meta.env.SSR
  ? null
  : lazy(() => import('../components/diff-viewer'))

export const Route = createFileRoute('/view/$slug')({
  ssr: false,
  loader: async ({ params }) => {
    const storedDiff = await getDiff({ data: params.slug })

    if (!storedDiff) {
      throw notFound()
    }

    return storedDiff
  },
  head: () => ({
    meta: [
      {
        title: 'Shared diff — Diffdump',
      },
      {
        name: 'robots',
        content: 'noindex, nofollow',
      },
    ],
  }),
  pendingComponent: DiffLoading,
  component: SharedDiffPage,
})

function SharedDiffPage() {
  const { slug } = Route.useParams()
  const storedDiff = Route.useLoaderData()

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
      <header className="flex items-center border-b border-line bg-canvas/95 px-3 sm:px-5">
        <Link className="wordmark" to="/">
          <span aria-hidden="true">/</span>
          diffdump
        </Link>
      </header>
      <div
        className="flex items-center justify-center gap-3 font-mono text-xs text-muted"
        aria-live="polite"
      >
        <span
          className="size-2 animate-pulse rounded-full bg-accent"
          aria-hidden="true"
        />
        Loading shared diff…
      </div>
    </main>
  )
}
