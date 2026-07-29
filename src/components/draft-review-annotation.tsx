import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
  type RefObject,
} from 'react'

import { Button } from './ui/button'
import {
  draftRangeError,
  type DraftReviewComment,
} from '../lib/review-comments'

const cardClassName =
  'mx-2 my-1.5 flex max-w-[680px] flex-col gap-2 rounded-control border border-line bg-surface-raised p-2.5 font-sans text-xs leading-relaxed text-foreground shadow-sm'

export type DraftReviewComposerHandle = {
  /** The draft the open composer is editing. */
  draft: DraftReviewComment
  /** Asks the composer to close: true when it holds no unsaved text, false
   * after switching to the inline discard prompt instead. */
  requestClose: () => boolean
}

/** The composer's latest text, owned by the viewer. The composer unmounts
 * whenever its diff item leaves the virtualization window, so its typed text
 * must outlive the component to survive a scroll away and back. */
export type ComposerBodyStore = { localId: string; body: string }

export function DraftReviewComposer({
  ref,
  draft,
  bodyStore,
  onSave,
  onCancel,
}: {
  ref?: Ref<DraftReviewComposerHandle>
  draft: DraftReviewComment
  bodyStore: RefObject<ComposerBodyStore | null>
  onSave: (body: string) => void
  onCancel: () => void
}) {
  const [body, setBody] = useState(() =>
    bodyStore.current?.localId === draft.localId
      ? bodyStore.current.body
      : draft.body,
  )
  const [confirmingDiscard, setConfirmingDiscard] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const rangeError = draftRangeError(draft.range)
  const canSave = body.trim() !== '' && rangeError === null
  const dirty = body.trim() !== draft.body.trim()

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }

    textarea.focus({ preventScroll: true })
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      draft,
      requestClose: () => {
        if (!dirty) {
          return true
        }

        setConfirmingDiscard(true)
        textareaRef.current?.focus({ preventScroll: true })
        return false
      },
    }),
    [dirty, draft],
  )

  /* Cancel is two-step while the textarea holds unsaved text: the first
     request switches to the discard prompt, the second discards. */
  function requestCancel() {
    if (dirty && !confirmingDiscard) {
      setConfirmingDiscard(true)
      return
    }

    onCancel()
  }

  function keepEditing() {
    setConfirmingDiscard(false)
    textareaRef.current?.focus({ preventScroll: true })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      requestCancel()
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
        onChange={(event) => {
          setBody(event.currentTarget.value)
          bodyStore.current = {
            localId: draft.localId,
            body: event.currentTarget.value,
          }
          setConfirmingDiscard(false)
        }}
        onKeyDown={handleKeyDown}
      />
      {rangeError !== null && (
        <p className="leading-snug text-deletion" role="alert">
          {rangeError}
        </p>
      )}
      {confirmingDiscard ? (
        <div className="flex items-center justify-end gap-2">
          <span className="mr-auto" role="alert">
            {draft.body === ''
              ? 'Discard this comment?'
              : 'Discard your changes?'}
          </span>
          <Button variant="outline" size="sm" type="button" onClick={onCancel}>
            Discard
          </Button>
          <Button
            variant="primary"
            size="sm"
            type="button"
            onClick={keepEditing}
          >
            Keep editing
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={requestCancel}
          >
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" disabled={!canSave}>
            {draft.body === '' ? 'Add review comment' : 'Update comment'}
          </Button>
        </div>
      )}
    </form>
  )
}

export function DraftInvalidBadge({ error }: { error: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-deletion"
      title={error}
    >
      Can’t submit
    </span>
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
  const rangeError = draftRangeError(draft.range)

  return (
    <div className={cardClassName} data-testid="draft-review-annotation">
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-accent-text">
          Pending
        </span>
        {rangeError !== null && <DraftInvalidBadge error={rangeError} />}
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
