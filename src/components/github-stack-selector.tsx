import type { ChangeEvent } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'

import { buttonVariants } from './ui/button'
import { cn } from '../lib/cn'
import type {
  GitHubPullStack,
  GitHubPullStackItem,
  GitHubPullStackSummary,
} from '../lib/github-diffs'

export type GitHubPullStackLoadState =
  | { status: 'loading' }
  | { status: 'loaded'; stack: GitHubPullStack }
  | { status: 'unavailable' }
  | { status: 'error'; message: string }

export function GitHubStackSelector({
  owner,
  repo,
  pullNumber,
  summary,
  state,
  onRetry,
}: {
  owner: string
  repo: string
  pullNumber: string
  summary: GitHubPullStackSummary
  state: GitHubPullStackLoadState
  onRetry: () => void
}) {
  const navigate = useNavigate()
  const stack = state.status === 'loaded' ? state.stack : null
  const currentIndex =
    stack?.pullRequests.findIndex((pull) => pull.number === pullNumber) ?? -1
  const previousPull =
    currentIndex > 0 ? (stack?.pullRequests[currentIndex - 1] ?? null) : null
  const nextPull =
    stack && currentIndex >= 0 && currentIndex < stack.pullRequests.length - 1
      ? stack.pullRequests[currentIndex + 1]
      : null
  const position = currentIndex >= 0 ? currentIndex + 1 : summary.position
  const size = stack?.pullRequests.length ?? summary.size
  const baseRef = stack?.baseRef ?? summary.baseRef
  const statusId = `github-stack-status-${summary.number}`

  function selectPull(event: ChangeEvent<HTMLSelectElement>) {
    const selectedPullNumber = event.currentTarget.value
    if (selectedPullNumber !== pullNumber) {
      void navigate({
        to: '/$',
        params: {
          _splat: createPullSplat(owner, repo, selectedPullNumber),
        },
      })
    }
  }

  return (
    <section
      className="border-b border-line bg-panel"
      aria-label={`Pull request stack #${summary.number}`}
      aria-busy={state.status === 'loading'}
      data-testid="github-stack-selector"
    >
      <div className="flex h-11 items-center gap-2 px-3 sm:hidden">
        <StackStepLink
          direction="previous"
          owner={owner}
          repo={repo}
          pull={previousPull}
        />

        <div
          className={cn(
            'relative flex h-8 min-w-0 flex-1 items-center justify-center rounded-control border border-line bg-surface-raised px-3',
            stack &&
              'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent-text',
          )}
        >
          <span
            className="truncate font-mono text-[11px] font-medium text-foreground"
            aria-hidden={stack !== null}
            title={state.status === 'error' ? state.message : undefined}
          >
            {state.status === 'error'
              ? `Layer ${position} of ${size} · Stack unavailable`
              : `PR #${pullNumber} · Layer ${position} of ${size}`}
          </span>
          <span className="ml-2 text-[10px] text-muted" aria-hidden="true">
            {stack ? '▾' : state.status === 'loading' ? '…' : ''}
          </span>
          {state.status === 'error' && (
            <RetryStackButton
              className="ml-2 shrink-0"
              statusId={statusId}
              onRetry={onRetry}
            />
          )}
          {stack && (
            <select
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label={`Select a pull request in stack #${summary.number}`}
              value={pullNumber}
              onChange={selectPull}
              data-testid="github-stack-select"
            >
              {stack.pullRequests.map((pull, index) => (
                <option key={pull.number} value={pull.number}>
                  {`#${pull.number} · ${index + 1} of ${stack.pullRequests.length} · ${pull.title} · ${getPullStatus(pull)}`}
                </option>
              ))}
            </select>
          )}
        </div>

        <StackStepLink
          direction="next"
          owner={owner}
          repo={repo}
          pull={nextPull}
        />
      </div>

      <div className="hidden h-11 min-w-0 items-center gap-2 px-4 sm:flex">
        <span className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
          Stack #{summary.number}
        </span>
        <span
          className="max-w-40 shrink-0 truncate rounded border border-line bg-canvas px-2 py-1 font-mono text-[11px] text-muted-bright"
          title={`Stack base: ${baseRef}`}
        >
          {baseRef}
        </span>
        <span className="shrink-0 text-muted" aria-hidden="true">
          →
        </span>

        {stack ? (
          <nav
            className="category-filter-scroll flex min-w-0 items-center gap-1.5 overflow-x-auto"
            aria-label={`Pull requests in stack #${summary.number}, ordered from base to top`}
          >
            {stack.pullRequests.map((pull, index) => {
              const current = pull.number === pullNumber
              const status = getPullStatus(pull)

              return (
                <span
                  className="inline-flex shrink-0 items-center gap-1.5"
                  key={pull.number}
                >
                  {index > 0 && (
                    <span className="text-muted" aria-hidden="true">
                      →
                    </span>
                  )}
                  <Link
                    className={cn(
                      'inline-flex h-7 shrink-0 items-center gap-1.5 rounded-control border px-2.5 font-mono text-[11px] font-medium transition-colors',
                      current
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line bg-canvas text-muted-bright hover:border-line-bright hover:bg-surface-raised hover:text-foreground',
                    )}
                    to="/$"
                    params={{
                      _splat: createPullSplat(owner, repo, pull.number),
                    }}
                    aria-current={current ? 'page' : undefined}
                    aria-label={`Pull request #${pull.number}: ${pull.title}. ${status}. Layer ${index + 1} of ${stack.pullRequests.length}.`}
                    title={`${pull.title} · ${pull.headRef} · ${status}`}
                    data-testid={`github-stack-pull-${pull.number}`}
                  >
                    <span aria-hidden="true">{getPullStatusSymbol(pull)}</span>
                    <span>#{pull.number}</span>
                    {current && (
                      <span
                        className="border-l border-current/30 pl-1.5 opacity-75"
                        aria-hidden="true"
                      >
                        {position}/{size}
                      </span>
                    )}
                  </Link>
                </span>
              )
            })}
          </nav>
        ) : (
          <span className="inline-flex items-center gap-2 font-mono text-[11px] text-muted-bright">
            {state.status === 'loading' && (
              <span
                className="size-1.5 animate-pulse rounded-full bg-accent-text"
                aria-hidden="true"
              />
            )}
            Layer {position} of {size}
            {state.status === 'error' && (
              <>
                <span aria-hidden="true">·</span>
                <span
                  className="max-w-80 truncate text-danger"
                  title={state.message}
                >
                  {state.message}
                </span>
                <RetryStackButton statusId={statusId} onRetry={onRetry} />
              </>
            )}
          </span>
        )}
      </div>

      {state.status !== 'loaded' && (
        <output className="sr-only" id={statusId}>
          {getStackLoadStatus(state, summary.number)}
        </output>
      )}
    </section>
  )
}

function RetryStackButton({
  className,
  statusId,
  onRetry,
}: {
  className?: string
  statusId: string
  onRetry: () => void
}) {
  return (
    <button
      className={cn(
        'font-mono text-[11px] font-medium text-accent-text underline underline-offset-2 hover:no-underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-text',
        className,
      )}
      type="button"
      aria-describedby={statusId}
      onClick={onRetry}
    >
      Retry
    </button>
  )
}

function getStackLoadStatus(
  state: Exclude<GitHubPullStackLoadState, { status: 'loaded' }>,
  stackNumber: number,
): string {
  switch (state.status) {
    case 'loading':
      return `Loading navigation for pull request stack #${stackNumber}.`
    case 'unavailable':
      return `Navigation for pull request stack #${stackNumber} is unavailable.`
    case 'error':
      return `${state.message} Stack navigation is unavailable.`
  }
}

function StackStepLink({
  direction,
  owner,
  repo,
  pull,
}: {
  direction: 'previous' | 'next'
  owner: string
  repo: string
  pull: GitHubPullStackItem | null
}) {
  const label = direction === 'previous' ? 'Previous layer' : 'Next layer'
  const symbol = direction === 'previous' ? '←' : '→'

  if (!pull) {
    return (
      <span
        className={cn(
          buttonVariants({ variant: 'outline', size: 'iconSm' }),
          'opacity-35',
        )}
        aria-hidden="true"
      >
        {symbol}
      </span>
    )
  }

  return (
    <Link
      className={buttonVariants({ variant: 'outline', size: 'iconSm' })}
      to="/$"
      params={{ _splat: createPullSplat(owner, repo, pull.number) }}
      aria-label={`${label}: pull request #${pull.number}, ${pull.title}`}
      title={`${label}: #${pull.number}`}
    >
      <span aria-hidden="true">{symbol}</span>
    </Link>
  )
}

function createPullSplat(
  owner: string,
  repo: string,
  pullNumber: string,
): string {
  return `${owner}/${repo}/pull/${pullNumber}`
}

function getPullStatus(pull: GitHubPullStackItem): string {
  if (pull.mergedAt !== null) {
    return 'Merged'
  }
  if (pull.draft) {
    return 'Draft'
  }
  return pull.state === 'open' ? 'Open' : 'Closed'
}

function getPullStatusSymbol(pull: GitHubPullStackItem): string {
  switch (getPullStatus(pull)) {
    case 'Merged':
      return '✓'
    case 'Draft':
      return '◌'
    case 'Closed':
      return '×'
    default:
      return '○'
  }
}
