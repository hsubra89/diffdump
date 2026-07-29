import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'

import { ErrorHero } from './error-hero'
import { Wordmark } from './wordmark'
import { Button, buttonVariants } from './ui/button'
import { eyebrowClassName } from './ui/surfaces'
import { cn } from '../lib/cn'
import {
  CREATE_CLASSIC_GITHUB_TOKEN_URL,
  isTokenFixableGitHubError,
  loadGitHubDiff,
  parseGitHubDiffUrl,
  readStoredGitHubToken,
  writeStoredGitHubToken,
  type LoadedGitHubDiff,
} from '../lib/github-diffs'

const DiffViewer = import.meta.env.SSR
  ? null
  : lazy(() => import('./diff-viewer'))

type GitHubDiffState =
  | { status: 'loading' }
  | { status: 'loaded'; loaded: LoadedGitHubDiff }
  | { status: 'error'; message: string; tokenFixable: boolean }

export function GitHubDiffPage({ url }: { url: string }) {
  const [attempt, setAttempt] = useState(0)

  return (
    <GitHubDiffAttempt
      key={attempt}
      url={url}
      onRetry={() => setAttempt((current) => current + 1)}
    />
  )
}

function GitHubDiffAttempt({
  url,
  onRetry,
}: {
  url: string
  onRetry: () => void
}) {
  const [state, setState] = useState<GitHubDiffState>({ status: 'loading' })

  useEffect(() => {
    if (!parseGitHubDiffUrl(url)) {
      setState({
        status: 'error',
        message: 'Enter a GitHub pull request, commit, or comparison URL.',
        tokenFixable: false,
      })
      return
    }

    const controller = new AbortController()
    setState({ status: 'loading' })

    void loadGitHubDiff(url, {
      signal: controller.signal,
      token: readStoredGitHubToken(),
    }).then(
      (loaded) => {
        if (!controller.signal.aborted) {
          setState({ status: 'loaded', loaded })
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
            tokenFixable: isTokenFixableGitHubError(error),
          })
        }
      },
    )

    return () => controller.abort()
  }, [url])

  if (state.status === 'error') {
    if (state.tokenFixable) {
      return <GitHubTokenPrompt message={state.message} onRetry={onRetry} />
    }

    return (
      <main className="grid min-h-screen text-foreground">
        <ErrorHero
          className="justify-self-center"
          eyebrow="GitHub access"
          title="This diff could not be opened."
          description={state.message}
          actionLabel="Back to Diffdump"
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
      <DiffViewer mode="github" githubUrl={url} diff={state.loaded.diff} />
    </Suspense>
  )
}

function GitHubTokenPrompt({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  const [tokenDraft, setTokenDraft] = useState('')
  const [hasStoredToken, setHasStoredToken] = useState(
    () => readStoredGitHubToken() !== '',
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const token = tokenDraft.trim()
    if (!token) {
      return
    }

    writeStoredGitHubToken(token)
    onRetry()
  }

  return (
    <main className="grid min-h-screen text-foreground">
      <section className="flex w-[min(580px,calc(100%-40px))] flex-col items-start justify-center justify-self-center">
        <Wordmark className="mb-9" />
        <p className={cn(eyebrowClassName, 'mb-5 text-muted-bright')}>
          GitHub access
        </p>
        <h1 className="mb-3.5 text-[clamp(38px,7vw,62px)] font-semibold leading-[0.98] tracking-[-0.04em]">
          This diff needs access.
        </h1>
        <p className="mb-7 leading-relaxed text-muted-bright">{message}</p>

        <form
          className="flex w-full flex-col items-stretch gap-2 sm:flex-row"
          onSubmit={handleSubmit}
        >
          <input
            className="h-8 min-w-0 flex-1 rounded-control border border-line bg-canvas px-3 font-mono text-xs text-foreground outline-none placeholder:text-muted/70"
            type="password"
            value={tokenDraft}
            onChange={(event) => setTokenDraft(event.currentTarget.value)}
            placeholder="Paste a GitHub token"
            aria-label="GitHub personal access token"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            spellCheck={false}
          />
          <Button
            variant="primary"
            size="sm"
            type="submit"
            disabled={tokenDraft.trim() === ''}
          >
            {hasStoredToken ? 'Replace token & retry' : 'Save token & retry'}
          </Button>
        </form>

        <p className="mt-3 text-xs leading-snug text-muted">
          <a
            className="text-accent-text underline underline-offset-2 hover:no-underline"
            href={CREATE_CLASSIC_GITHUB_TOKEN_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            Create a classic PAT
          </a>{' '}
          with <code className="font-mono">repo</code> scope. Saved only in this
          browser, sent only to GitHub.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-2.5">
          {hasStoredToken && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                writeStoredGitHubToken('')
                setHasStoredToken(false)
                onRetry()
              }}
            >
              Clear token & retry
            </Button>
          )}
          <Link
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            to="/"
          >
            Back to Diffdump
          </Link>
        </div>
      </section>
    </main>
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
