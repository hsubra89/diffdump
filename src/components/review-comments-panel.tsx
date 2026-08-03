import { useMemo, type MouseEvent, type ReactNode } from 'react'
import type { SelectedLineRange } from '@pierre/diffs'
import { IconArrowUpRight } from '@pierre/icons'

import {
  DraftDeleteButton,
  DraftInvalidBadge,
  type DraftDeletionDialogHandle,
} from './draft-review-annotation'
import { Button } from './ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { cn } from '../lib/cn'
import {
  draftRangeError,
  type DiffLineKind,
  type DraftReviewComment,
  type ReviewCommentThread,
} from '../lib/review-comments'
import type { ReviewCommentsState } from '../lib/review-state'

const rowClassName =
  'flex w-full flex-col items-start gap-1 rounded-control border border-transparent px-2 py-1.5 text-left text-xs leading-snug transition-colors'
const clickableRowClassName =
  'cursor-pointer outline-none hover:border-line hover:bg-surface-raised focus-visible:border-accent-text focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export type AnchorClassifier = (
  path: string,
  range: SelectedLineRange,
) => DiffLineKind | null

/** Rows navigate on click, but their comment text is selectable — a click
 * that just finished selecting text inside the row is not navigation. */
function clickSelectsRowText(event: MouseEvent<HTMLElement>): boolean {
  /* Enter and Space dispatch a click with detail 0. A selection left on the
     page must not suppress those keyboard activations. */
  if (event.detail === 0) {
    return false
  }

  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) {
    return false
  }

  const row = event.currentTarget
  return (
    (selection.anchorNode !== null && row.contains(selection.anchorNode)) ||
    (selection.focusNode !== null && row.contains(selection.focusNode))
  )
}

export default function ReviewCommentsPanel({
  drafts,
  threads,
  commentsState,
  classifyAnchor,
  onSelectDraft,
  onEditDraft,
  deleteDialogHandle,
  onSelectThread,
  onReloadComments,
}: {
  drafts: readonly DraftReviewComment[]
  threads: readonly ReviewCommentThread[]
  commentsState: ReviewCommentsState
  classifyAnchor: AnchorClassifier
  onSelectDraft: (draft: DraftReviewComment) => void
  onEditDraft: (draft: DraftReviewComment) => void
  deleteDialogHandle: DraftDeletionDialogHandle
  onSelectThread: (thread: ReviewCommentThread) => void
  onReloadComments: () => void
}) {
  const threadsByFile = useMemo(() => {
    const groups = new Map<string, ReviewCommentThread[]>()

    for (const thread of threads) {
      const group = groups.get(thread.root.path)
      if (group) {
        group.push(thread)
      } else {
        groups.set(thread.root.path, [thread])
      }
    }

    return [...groups.entries()]
  }, [threads])

  return (
    <div
      className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-2 py-3"
      data-testid="review-comments-panel"
    >
      <section aria-label="Draft review comments">
        <PanelSectionTitle>
          Your drafts
          <span className="text-muted-foreground tabular-nums">
            {drafts.length}
          </span>
        </PanelSectionTitle>
        {drafts.length === 0 ? (
          <p className="px-2 text-xs leading-snug text-muted-foreground">
            Select lines in the diff and use the gutter control to draft review
            comments.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {drafts.map((draft) => {
              const rangeError = draftRangeError(draft.range)

              return (
                <li key={draft.localId} className={cn(rowClassName, 'gap-1.5')}>
                  <Button
                    className={cn(
                      'h-auto w-full flex-col items-start gap-1 whitespace-normal border-0 px-0 py-0 text-left font-normal text-foreground',
                      'hover:bg-transparent hover:text-foreground',
                    )}
                    variant="ghost"
                    size="xs"
                    onClick={(event) => {
                      if (!clickSelectsRowText(event)) {
                        onSelectDraft(draft)
                      }
                    }}
                  >
                    <span className="sr-only">Show in diff: </span>
                    <span className="flex w-full items-center gap-1.5">
                      <CommentLocation
                        path={draft.path}
                        line={draft.range.end}
                        kind={classifyAnchor(draft.path, draft.range)}
                      />
                      {rangeError !== null && (
                        <DraftInvalidBadge error={rangeError} />
                      )}
                    </span>
                    <span className="line-clamp-2 w-full select-text break-words text-muted-bright">
                      {draft.body}
                    </span>
                  </Button>
                  <span className="flex gap-1.5">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => onEditDraft(draft)}
                    >
                      Edit
                    </Button>
                    <DraftDeleteButton
                      draft={draft}
                      dialogHandle={deleteDialogHandle}
                    />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-label="Published review comments">
        <PanelSectionTitle>
          Comments
          {commentsState.status === 'loaded' && (
            <span className="text-muted-foreground tabular-nums">
              {threads.length}
            </span>
          )}
        </PanelSectionTitle>

        {commentsState.status === 'loading' && (
          <p className="px-2 text-xs text-muted-foreground" aria-live="polite">
            Loading GitHub comments…
          </p>
        )}

        {commentsState.status === 'error' && (
          <div className="flex flex-col items-start gap-2 px-2">
            <p className="text-xs leading-snug text-muted-bright">
              {commentsState.message}
            </p>
            <Button variant="outline" size="xs" onClick={onReloadComments}>
              Retry
            </Button>
          </div>
        )}

        {commentsState.status === 'loaded' &&
          (threads.length === 0 ? (
            <p className="px-2 text-xs text-muted-foreground">
              No review comments on this pull request yet.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              {threadsByFile.map(([path, fileThreads]) => (
                <div key={path}>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <p className="truncate px-2 pb-1 font-mono text-[11px] text-muted-foreground" />
                      }
                    >
                      {path}
                    </TooltipTrigger>
                    <TooltipContent side="right">{path}</TooltipContent>
                  </Tooltip>
                  <ul className="flex flex-col gap-0.5">
                    {fileThreads.map((thread) => (
                      <li key={thread.root.id}>
                        <ThreadRow
                          thread={thread}
                          classifyAnchor={classifyAnchor}
                          onSelect={onSelectThread}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ))}
      </section>
    </div>
  )
}

function ThreadRow({
  thread,
  classifyAnchor,
  onSelect,
}: {
  thread: ReviewCommentThread
  classifyAnchor: AnchorClassifier
  onSelect: (thread: ReviewCommentThread) => void
}) {
  const { root, replies } = thread
  const meta = (
    <>
      <span className="flex w-full items-center gap-1.5">
        <span className="truncate font-medium">{root.author.login}</span>
        {root.outdated && (
          <span className="inline-flex shrink-0 items-center rounded border border-line bg-surface px-1 py-px font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Outdated
          </span>
        )}
        {replies.length > 0 && (
          <span className="shrink-0 text-muted-foreground tabular-nums">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </span>
        )}
      </span>
      <span className="line-clamp-2 w-full select-text break-words text-muted-bright">
        {root.body}
      </span>
    </>
  )

  /* Outdated comments no longer anchor to the rendered patch, so the row
     links out to GitHub instead of scrolling the viewer. */
  if (root.outdated) {
    return (
      <a
        className={cn(rowClassName, clickableRowClassName)}
        href={root.htmlUrl}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(event) => {
          if (clickSelectsRowText(event)) {
            event.preventDefault()
          }
        }}
      >
        {meta}
        <span className="inline-flex items-center gap-1 text-accent-text">
          View on GitHub <IconArrowUpRight aria-hidden="true" />
        </span>
      </a>
    )
  }

  return (
    <Button
      className={cn(
        rowClassName,
        clickableRowClassName,
        'h-auto whitespace-normal font-normal text-foreground',
      )}
      variant="ghost"
      size="xs"
      onClick={(event) => {
        if (!clickSelectsRowText(event)) {
          onSelect(thread)
        }
      }}
    >
      <span className="sr-only">Show in diff: </span>
      <CommentLocation
        path={null}
        line={root.range === null ? null : root.range.end}
        kind={
          root.range === null ? null : classifyAnchor(root.path, root.range)
        }
      />
      {meta}
    </Button>
  )
}

const DIFF_LINE_KIND_LABELS: Record<DiffLineKind, string> = {
  addition: 'added line',
  deletion: 'deleted line',
  context: 'unchanged line',
}

function CommentLocation({
  path,
  line,
  kind,
}: {
  path: string | null
  line: number | null
  kind: DiffLineKind | null
}) {
  if (path === null && line === null) {
    return null
  }

  /* Bare line numbers are ambiguous between the old and new file, so anchors
     carry their diff marker: +N for added lines, −N for deleted (old-file)
     lines, plain N for unchanged lines. */
  const marker = kind === 'addition' ? '+' : kind === 'deletion' ? '−' : ''
  const visibleLocation =
    path !== null
      ? `${path}${line !== null ? `:${marker}${line}` : ''}`
      : `Line ${marker}${line}`
  const lineDescription =
    kind !== null && line !== null
      ? ` · ${DIFF_LINE_KIND_LABELS[kind]} ${line}`
      : ''

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground" />
        }
      >
        {visibleLocation}
      </TooltipTrigger>
      <TooltipContent side="right">
        {visibleLocation}
        {lineDescription}
      </TooltipContent>
    </Tooltip>
  )
}

function PanelSectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 px-2 pb-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-bright">
      {children}
    </p>
  )
}
