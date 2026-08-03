import { Link, useNavigate } from '@tanstack/react-router'
import {
  IconArrow,
  IconArrowRight,
  IconArrowRightShort,
  IconCircle,
  IconDraft,
  IconMerged,
  IconX,
} from '@pierre/icons'

import { Button, buttonVariants } from './ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
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

  function selectPull(selectedPullNumber: string | null) {
    if (selectedPullNumber && selectedPullNumber !== pullNumber) {
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
      className="flex min-w-0 items-center"
      aria-label={`Pull request stack #${summary.number}`}
      aria-busy={state.status === 'loading'}
      data-testid="github-stack-selector"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 px-3 sm:hidden">
        <StackStepLink
          direction="previous"
          owner={owner}
          repo={repo}
          pull={previousPull}
        />

        {stack ? (
          <Select value={pullNumber} onValueChange={selectPull}>
            <SelectTrigger
              className="flex-1 justify-center bg-surface-raised px-3 font-mono text-[11px] font-medium"
              aria-label={`Select a pull request in stack #${summary.number}`}
              data-testid="github-stack-select"
            >
              <SelectValue>
                {`PR #${pullNumber} · Layer ${position} of ${size}`}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="w-[min(24rem,calc(100vw-5rem))]">
              <SelectGroup>
                <SelectLabel>
                  Stack #{summary.number} · base {baseRef}
                </SelectLabel>
                {stack.pullRequests.map((pull, index) => {
                  const status = getPullStatus(pull)

                  return (
                    <SelectItem
                      key={pull.number}
                      value={pull.number}
                      label={`Pull request #${pull.number}: ${pull.title}. ${status}. Layer ${index + 1} of ${stack.pullRequests.length}.`}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span
                          className="shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        >
                          {getPullStatusIcon(pull)}
                        </span>
                        <span className="shrink-0 font-mono font-medium text-foreground">
                          #{pull.number}
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                          {index + 1}/{stack.pullRequests.length}
                        </span>
                        <span className="truncate">{pull.title}</span>
                      </span>
                    </SelectItem>
                  )
                })}
              </SelectGroup>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-control border border-line bg-surface-raised px-3">
            {state.status === 'error' ? (
              <StackErrorMessage
                className="truncate font-mono text-[11px] font-medium text-foreground"
                label={`Layer ${position} of ${size} · Stack unavailable`}
                message={state.message}
              />
            ) : (
              <span className="truncate font-mono text-[11px] font-medium text-foreground">
                PR #{pullNumber} · Layer {position} of {size}
              </span>
            )}
            {state.status === 'loading' && (
              <span
                className="ml-2 text-[10px] text-muted-foreground"
                aria-hidden="true"
              >
                …
              </span>
            )}
            {state.status === 'error' && (
              <RetryStackButton
                className="ml-2 shrink-0"
                statusId={statusId}
                onRetry={onRetry}
              />
            )}
          </div>
        )}

        <StackStepLink
          direction="next"
          owner={owner}
          repo={repo}
          pull={nextPull}
        />
      </div>

      <div className="hidden min-w-0 items-center gap-2 sm:flex">
        <span className="shrink-0 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Stack #{summary.number}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <span
                className="inline-block h-7 max-w-40 shrink-0 cursor-help truncate rounded-control border border-line bg-surface px-2 font-mono text-[11px] leading-[26px] text-muted-bright"
                aria-label={`Stack base: ${baseRef}`}
              />
            }
          >
            {baseRef}
          </TooltipTrigger>
          <TooltipContent>Stack base: {baseRef}</TooltipContent>
        </Tooltip>
        <span className="shrink-0 text-muted-foreground" aria-hidden="true">
          <IconArrowRightShort />
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
                    <span className="text-muted-foreground" aria-hidden="true">
                      <IconArrowRightShort />
                    </span>
                  )}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Link
                          className={cn(
                            buttonVariants({
                              variant: current ? 'primary' : 'outline',
                              size: 'xs',
                            }),
                            'h-7 gap-1.5 px-2.5 font-mono text-[11px]',
                          )}
                          to="/$"
                          params={{
                            _splat: createPullSplat(owner, repo, pull.number),
                          }}
                          aria-current={current ? 'page' : undefined}
                          aria-label={`Pull request #${pull.number}: ${pull.title}. ${status}. Layer ${index + 1} of ${stack.pullRequests.length}.`}
                          data-testid={`github-stack-pull-${pull.number}`}
                        />
                      }
                    >
                      <span aria-hidden="true">{getPullStatusIcon(pull)}</span>
                      <span>#{pull.number}</span>
                      {current && (
                        <span
                          className="border-l border-current/30 pl-1.5 opacity-75"
                          aria-hidden="true"
                        >
                          {position}/{size}
                        </span>
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {pull.title} · {pull.headRef} · {status}
                    </TooltipContent>
                  </Tooltip>
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
                <StackErrorMessage
                  className="max-w-80 truncate text-danger"
                  label={state.message}
                  message={state.message}
                />
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

export default GitHubStackSelector

function StackErrorMessage({
  className,
  label,
  message,
}: {
  className?: string
  label: string
  message: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn('cursor-help', className)}
            aria-label={label === message ? message : `${label}: ${message}`}
          />
        }
      >
        {label}
      </TooltipTrigger>
      <TooltipContent>{message}</TooltipContent>
    </Tooltip>
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
    <Button
      className={cn('h-6 px-1.5 font-mono text-[11px]', className)}
      variant="ghost"
      size="xs"
      aria-describedby={statusId}
      onClick={onRetry}
    >
      Retry
    </Button>
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
  const icon = direction === 'previous' ? <IconArrow /> : <IconArrowRight />

  if (!pull) {
    return (
      <span
        className={cn(
          buttonVariants({ variant: 'outline', size: 'iconSm' }),
          'opacity-35',
        )}
        aria-hidden="true"
      >
        {icon}
      </span>
    )
  }

  const accessibleLabel = `${label}: pull request #${pull.number}, ${pull.title}`

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            className={buttonVariants({
              variant: 'outline',
              size: 'iconSm',
            })}
            to="/$"
            params={{ _splat: createPullSplat(owner, repo, pull.number) }}
            aria-label={accessibleLabel}
          />
        }
      >
        <span aria-hidden="true">{icon}</span>
      </TooltipTrigger>
      <TooltipContent>{`${label}: #${pull.number}`}</TooltipContent>
    </Tooltip>
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

function getPullStatusIcon(pull: GitHubPullStackItem) {
  switch (getPullStatus(pull)) {
    case 'Merged':
      return <IconMerged />
    case 'Draft':
      return <IconDraft />
    case 'Closed':
      return <IconX />
    default:
      return <IconCircle />
  }
}
