import { useEffect, useId, useRef, useState } from 'react'
import { IconArrowUpRight, IconCheck } from '@pierre/icons'

import { Button } from './ui/button'
import { RadioGroup, RadioGroupItem } from './ui/radio-group'
import { Textarea } from './ui/textarea'
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
  const summaryRef = useRef<HTMLTextAreaElement>(null)
  const reviewEventId = useId()
  const submitting = submitState.phase === 'submitting'
  const succeeded = submitState.phase === 'success'
  const controlsDisabled = submitting || succeeded
  const errorReason = submitState.phase === 'error' ? submitState.reason : null
  /* GitHub rejects a review that carries no comments and no summary. A moved
     head SHA blocks submission entirely until the diff is reloaded. */
  const canSubmit =
    !submitting &&
    !succeeded &&
    errorReason !== 'head-changed' &&
    (draftCount > 0 || body.trim() !== '')

  /* The panel can arrive after its popover opens because it is lazy-loaded;
     move focus into the form when that deferred content mounts. */
  useEffect(() => {
    summaryRef.current?.focus({ preventScroll: true })
  }, [])

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
        <span className="text-muted-foreground tabular-nums">
          {draftCount} {draftCount === 1 ? 'draft' : 'drafts'}
        </span>
      </div>

      <Textarea
        ref={summaryRef}
        value={body}
        placeholder="Review summary (optional)"
        aria-label="Review summary"
        disabled={controlsDisabled}
        onChange={(changeEvent) => setBody(changeEvent.currentTarget.value)}
      />

      <RadioGroup
        aria-label="Review type"
        className="flex flex-col gap-1"
        name="review-event"
        value={event}
        disabled={controlsDisabled}
        onValueChange={setEvent}
      >
        {REVIEW_EVENTS.map((option) => {
          const optionId = `${reviewEventId}-${option.event.toLowerCase()}`
          const labelId = `${optionId}-label`
          const descriptionId = `${optionId}-description`

          return (
            <label
              key={option.event}
              htmlFor={optionId}
              className={cn(
                'flex items-start gap-2 rounded-control border border-transparent px-2 py-1.5 transition-colors',
                controlsDisabled
                  ? 'cursor-not-allowed opacity-55'
                  : 'cursor-pointer hover:bg-surface-raised',
                event === option.event && 'border-line bg-surface-raised',
              )}
            >
              <RadioGroupItem
                id={optionId}
                className="mt-0.5"
                value={option.event}
                aria-labelledby={labelId}
                aria-describedby={descriptionId}
              />
              <span className="flex flex-col gap-0.5">
                <span id={labelId} className="font-medium">
                  {option.label}
                </span>
                <span
                  id={descriptionId}
                  className="leading-snug text-muted-foreground"
                >
                  {option.description}
                </span>
              </span>
            </label>
          )
        })}
      </RadioGroup>

      <p className="leading-snug text-muted-foreground">
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
          className="inline-flex self-start items-center gap-1 text-accent-text underline underline-offset-2 hover:no-underline"
          href={pullRequestUrl}
          target="_blank"
          rel="noreferrer noopener"
        >
          Resolve the pending review on GitHub
          <IconArrowUpRight aria-hidden="true" />
        </a>
      )}

      {succeeded ? (
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 text-addition">
            Review published <IconCheck aria-hidden="true" />
          </span>
          {reviewUrl !== null && (
            <a
              className="inline-flex items-center gap-1 text-accent-text underline underline-offset-2 hover:no-underline"
              href={reviewUrl}
              target="_blank"
              rel="noreferrer noopener"
            >
              View on GitHub <IconArrowUpRight aria-hidden="true" />
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
