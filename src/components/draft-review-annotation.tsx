import { useEffect, useRef, useState, type KeyboardEvent } from 'react'

import { Button } from './ui/button'
import type { DraftReviewComment } from '../lib/review-comments'

const cardClassName =
  'mx-2 my-1.5 flex max-w-[680px] flex-col gap-2 rounded-control border border-line bg-surface-raised p-2.5 font-sans text-xs leading-relaxed text-foreground shadow-sm'

export function DraftReviewComposer({
  draft,
  onSave,
  onCancel,
}: {
  draft: DraftReviewComment
  onSave: (body: string) => void
  onCancel: () => void
}) {
  const [body, setBody] = useState(draft.body)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const canSave = body.trim() !== ''

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [])

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      onCancel()
    } else if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      if (canSave) {
        onSave(body.trim())
      }
    }
  }

  return (
    <form
      className={cardClassName}
      onSubmit={(event) => {
        event.preventDefault()
        if (canSave) {
          onSave(body.trim())
        }
      }}
    >
      <textarea
        ref={textareaRef}
        className="min-h-16 w-full resize-y rounded-control border border-line bg-canvas px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted/70"
        value={body}
        placeholder="Leave a review comment"
        aria-label="Review comment"
        spellCheck
        onChange={(event) => setBody(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" type="button" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" size="sm" type="submit" disabled={!canSave}>
          {draft.body === '' ? 'Add review comment' : 'Update comment'}
        </Button>
      </div>
    </form>
  )
}

export function DraftReviewAnnotation({
  draft,
  onEdit,
  onDelete,
}: {
  draft: DraftReviewComment
  onEdit: (draft: DraftReviewComment) => void
  onDelete: (localId: string) => void
}) {
  return (
    <div className={cardClassName} data-testid="draft-review-annotation">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-accent-text">
          Pending
        </span>
        <span className="text-muted">Part of your unsubmitted review</span>
        <span className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            type="button"
            onClick={() => onEdit(draft)}
          >
            Edit
          </Button>
          <Button
            variant="ghost"
            size="xs"
            type="button"
            onClick={() => onDelete(draft.localId)}
          >
            Delete
          </Button>
        </span>
      </div>
      <p className="whitespace-pre-wrap break-words">{draft.body}</p>
    </div>
  )
}
