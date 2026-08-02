import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { Link } from '@tanstack/react-router'

import { ErrorHero } from './error-hero'
import { GitHubRepoLink, HeroPageActions } from './github-repo-link'
import type { GitHubPullStackLoadState } from './github-stack-selector'
import { Wordmark } from './wordmark'
import { ThemeToggle } from './ui/theme-toggle'
import { Button, buttonVariants } from './ui/button'
import { Input } from './ui/input'
import { eyebrowClassName } from './ui/surfaces'
import { cn } from '../lib/cn'
import {
  CREATE_CLASSIC_GITHUB_TOKEN_URL,
  CREATE_FINE_GRAINED_GITHUB_TOKEN_URL,
  isTokenFixableGitHubError,
  loadGitHubDiff,
  loadGitHubPullStack,
  parseGitHubDiffUrl,
  readStoredGitHubToken,
  writeStoredGitHubToken,
  type GitHubPullReviewTarget,
  type LoadedGitHubDiff,
} from '../lib/github-diffs'
import { listPullReviewComments } from '../lib/github-reviews'
import type { ReviewCommentsState } from '../lib/review-state'

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
      key={`${url}:${attempt}`}
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
  const reviewTarget =
    state.status === 'loaded' ? state.loaded.reviewTarget : null
  const [commentsState, setCommentsState] = useState<ReviewCommentsState>({
    status: 'idle',
  })
  const [commentsAttempt, setCommentsAttempt] = useState(0)
  const [stackAttempt, setStackAttempt] = useState(0)
  const [stackState, setStackState] = useState<GitHubPullStackLoadState>({
    status: 'loading',
  })

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

  /* Stack navigation is progressive enhancement. The PR response gives us
     enough membership data to reserve the row immediately; the full ordered
     stack loads separately so an unavailable preview endpoint never blocks
     the diff or reviews. */
  useEffect(() => {
    if (
      state.status !== 'loaded' ||
      state.loaded.source.kind !== 'pull' ||
      state.loaded.stackSummary === null
    ) {
      setStackState({ status: 'unavailable' })
      return
    }

    const controller = new AbortController()
    const { source, stackSummary } = state.loaded
    setStackState({ status: 'loading' })

    void loadGitHubPullStack(source, stackSummary.number, {
      signal: controller.signal,
      token: readStoredGitHubToken(),
    }).then(
      (stack) => {
        if (!controller.signal.aborted) {
          setStackState(
            stack?.pullRequests.some((pull) => pull.number === source.number)
              ? { status: 'loaded', stack }
              : { status: 'unavailable' },
          )
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setStackState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : `GitHub could not load stack #${stackSummary.number}.`,
          })
        }
      },
    )

    return () => controller.abort()
  }, [stackAttempt, state])

  /* Published review comments load client-side after the diff, and reload
     after a review is published so drafts reconcile into GitHub-backed
     annotations. A failure here never blocks the diff itself. */
  useEffect(() => {
    if (!reviewTarget) {
      setCommentsState({ status: 'idle' })
      return
    }

    const controller = new AbortController()
    setCommentsState({ status: 'loading' })

    void loadReviewComments(reviewTarget, controller.signal).then(
      (loaded) => {
        if (!controller.signal.aborted) {
          setCommentsState(loaded)
        }
      },
      () => {},
    )

    return () => controller.abort()
  }, [commentsAttempt, reviewTarget])

  if (state.status === 'error') {
    if (state.tokenFixable) {
      return <GitHubTokenPrompt message={state.message} onRetry={onRetry} />
    }

    return (
      <main className="relative grid min-h-screen text-foreground">
        <HeroPageActions />
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
      <DiffViewer
        mode="github"
        githubUrl={url}
        diff={state.loaded.diff}
        reviewTarget={state.loaded.reviewTarget}
        stackSummary={state.loaded.stackSummary}
        stackState={stackState}
        reviewComments={commentsState}
        onReloadComments={() => setCommentsAttempt((current) => current + 1)}
        onReloadDiff={onRetry}
        onReloadStack={() => setStackAttempt((current) => current + 1)}
      />
    </Suspense>
  )
}

async function loadReviewComments(
  reviewTarget: GitHubPullReviewTarget,
  signal: AbortSignal,
): Promise<ReviewCommentsState> {
  try {
    const comments = await listPullReviewComments(reviewTarget, {
      signal,
      token: readStoredGitHubToken(),
    })
    return { status: 'loaded', comments }
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof Error
          ? error.message
          : 'GitHub review comments could not be loaded.',
    }
  }
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
    <main className="relative grid min-h-screen text-foreground">
      <HeroPageActions />
      <section className="flex w-[min(580px,calc(100%-40px))] flex-col items-start justify-center justify-self-center">
        <Wordmark className="mb-9" />
        <p className={cn(eyebrowClassName, 'mb-5 text-muted-bright')}>
          GitHub access
        </p>
        <h1 className="mb-3.5 text-[clamp(38px,7vw,62px)] font-[560] leading-[0.98] tracking-[-0.04em]">
          This diff needs access.
        </h1>
        <p className="mb-7 leading-relaxed text-muted-bright">{message}</p>

        <form
          className="flex w-full flex-col items-stretch gap-2 sm:flex-row"
          onSubmit={handleSubmit}
        >
          <Input
            className="flex-1 font-mono"
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

        <p className="mt-3 text-xs leading-snug text-muted-foreground">
          <a
            className="text-accent-text underline underline-offset-2 hover:no-underline"
            href={CREATE_FINE_GRAINED_GITHUB_TOKEN_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            Create a fine-grained PAT
          </a>{' '}
          with{' '}
          <span className="text-foreground">Pull requests: Read and write</span>{' '}
          (loads pull requests and publishes the reviews you submit) and{' '}
          <span className="text-foreground">Contents: Read</span> (commit and
          comparison diffs), or a{' '}
          <a
            className="text-accent-text underline underline-offset-2 hover:no-underline"
            href={CREATE_CLASSIC_GITHUB_TOKEN_URL}
            target="_blank"
            rel="noreferrer noopener"
          >
            classic PAT
          </a>{' '}
          with <code className="font-mono">repo</code> scope. Either token can
          publish pull-request reviews from this browser. Saved only in this
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
        Loading GitHub diff…
      </div>
    </main>
  )
}
