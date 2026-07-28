import { lazy, Suspense, useEffect, useState } from 'react'

import { ErrorHero } from './error-hero'
import { Wordmark } from './wordmark'
import {
  loadGitHubDiff,
  parseGitHubDiffUrl,
  readStoredGitHubToken,
} from '../lib/github-diffs'

const DiffViewer = import.meta.env.SSR
  ? null
  : lazy(() => import('./diff-viewer'))

type GitHubDiffState =
  | { status: 'loading' }
  | { status: 'loaded'; diff: string }
  | { status: 'error'; message: string }

export function GitHubDiffPage({ url }: { url: string }) {
  const [state, setState] = useState<GitHubDiffState>({ status: 'loading' })

  useEffect(() => {
    if (!parseGitHubDiffUrl(url)) {
      setState({
        status: 'error',
        message: 'Enter a GitHub pull request, commit, or comparison URL.',
      })
      return
    }

    const controller = new AbortController()
    setState({ status: 'loading' })

    void loadGitHubDiff(url, {
      signal: controller.signal,
      token: readStoredGitHubToken(),
    }).then(
      (diff) => {
        if (!controller.signal.aborted) {
          setState({ status: 'loaded', diff })
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The GitHub diff could not be loaded.',
          })
        }
      },
    )

    return () => controller.abort()
  }, [url])

  if (state.status === 'error') {
    return (
      <main className="grid min-h-screen text-foreground">
        <ErrorHero
          className="justify-self-center"
          eyebrow="GitHub access"
          title="This diff could not be opened."
          description={state.message}
          actionLabel="Back to private access"
          actionHash="private-github"
        >
          <Wordmark className="mb-9" />
        </ErrorHero>
      </main>
    )
  }

  if (state.status === 'loading' || !DiffViewer) {
    return <GitHubDiffLoading />
  }

  return (
    <Suspense fallback={<GitHubDiffLoading />}>
      <DiffViewer mode="github" githubUrl={url} diff={state.diff} />
    </Suspense>
  )
}

function GitHubDiffLoading() {
  return (
    <main className="grid h-svh grid-rows-[56px_minmax(0,1fr)] overflow-hidden bg-canvas text-foreground">
      <header className="flex items-center border-b border-line bg-canvas/95 px-3 sm:px-5">
        <Wordmark />
      </header>
      <div
        className="flex items-center justify-center gap-3 font-mono text-xs text-muted"
        aria-live="polite"
      >
        <span
          className="size-2 animate-pulse rounded-full bg-accent-text"
          aria-hidden="true"
        />
        Loading GitHub diff…
      </div>
    </main>
  )
}
