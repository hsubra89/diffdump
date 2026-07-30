import { useState } from 'react'

import { Button } from './ui/button'
import { cn } from '../lib/cn'
import type { GitHubReviewEvent } from '../lib/review-comments'
import type { SubmitReviewState } from '../lib/review-state'

const REVIEW_EVENTS: ReadonlyArray<{
  event: GitHubReviewEvent
  label: string
  description: string
}> = [
  {
    event: 'COMMENT',
    label: 'Comment',
    description: 'Submit feedback without explicit approval.',
  },
  {
    event: 'APPROVE',
    label: 'Approve',
    description: 'Approve merging these changes.',
  },
  {
    event: 'REQUEST_CHANGES',
    label: 'Request changes',
    description: 'Feedback that must be addressed before merging.',
  },
]

export default function SubmitReviewPanel({
  draftCount,
  submitState,
  reviewUrl,
  pullRequestUrl,
  onSubmit,
  onReloadDiff,
  onClose,
}: {
  draftCount: number
  submitState: SubmitReviewState
  /** GitHub URL of the published review once submission succeeds. */
  reviewUrl: string | null
  /** GitHub URL of the pull request under review. */
  pullRequestUrl: string | null
  onSubmit: (event: GitHubReviewEvent, body: string) => void
  onReloadDiff: () => void
  onClose: () => void
}) {
  const [event, setEvent] = useState<GitHubReviewEvent>('COMMENT')
  const [body, setBody] = useState('')
  const submitting = submitState.phase === 'submitting'
  const succeeded = submitState.phase === 'success'
  const errorReason = submitState.phase === 'error' ? submitState.reason : null
  /* GitHub rejects a review that carries no comments and no summary. A moved
     head SHA blocks submission entirely until the diff is reloaded. */
  const canSubmit =
    !submitting &&
    !succeeded &&
    errorReason !== 'head-changed' &&
    (draftCount > 0 || body.trim() !== '')

  return (
    <form
      className="flex w-72 flex-col gap-3 rounded-control border border-line bg-canvas p-3 text-xs shadow-float"
      aria-label="Submit review"
      data-testid="submit-review-panel"
      onSubmit={(formEvent) => {
        formEvent.preventDefault()
        if (canSubmit) {
          onSubmit(event, body.trim())
        }
      }}
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-muted-bright">
          Submit review
        </span>
        <span className="text-muted tabular-nums">
          {draftCount} {draftCount === 1 ? 'draft' : 'drafts'}
        </span>
      </div>

      <textarea
        className="min-h-16 w-full resize-y rounded-control border border-line bg-canvas px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted/70"
        value={body}
        placeholder="Review summary (optional)"
        aria-label="Review summary"
        disabled={submitting || succeeded}
        onChange={(changeEvent) => setBody(changeEvent.currentTarget.value)}
      />

      <fieldset
        className="flex flex-col gap-1"
        disabled={submitting || succeeded}
      >
        {REVIEW_EVENTS.map((option) => (
          <label
            key={option.event}
            aria-label={option.label}
            className={cn(
              'flex cursor-pointer items-start gap-2 rounded-control border border-transparent px-2 py-1.5 transition-colors hover:bg-surface-raised',
              event === option.event && 'border-line bg-surface-raised',
            )}
          >
            <input
              className="mt-0.5"
              type="radio"
              name="review-event"
              checked={event === option.event}
              style={{ accentColor: 'var(--accent-text)' }}
              onChange={() => setEvent(option.event)}
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{option.label}</span>
              <span className="leading-snug text-muted">
                {option.description}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="leading-snug text-muted">
        Publishes this review to GitHub from this browser with your saved token.
      </p>

      {submitState.phase === 'error' && (
        <p className="leading-snug text-deletion" role="alert">
          {submitState.message}
          {errorReason === 'head-changed' &&
            ' Your drafts stay saved for the revision they were written on.'}
        </p>
      )}

      {errorReason === 'pending-review-exists' && pullRequestUrl !== null && (
        <a
          className="self-start text-accent-text underline underline-offset-2 hover:no-underline"
          href={pullRequestUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Resolve the pending review on GitHub ↗
        </a>
      )}

      {succeeded ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-addition">Review published ✓</span>
          {reviewUrl !== null && (
            <a
              className="text-accent-text underline underline-offset-2 hover:no-underline"
              href={reviewUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              View on GitHub ↗
            </a>
          )}
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          {errorReason === 'head-changed' ? (
            <Button variant="primary" size="sm" onClick={onReloadDiff}>
              Reload diff
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={!canSubmit}
            >
              {submitting
                ? 'Publishing…'
                : submitState.phase === 'error'
                  ? 'Retry submission'
                  : 'Submit review'}
            </Button>
          )}
        </div>
      )}
    </form>
  )
}
