import type {
  DiffLineAnnotation,
  FileDiffMetadata,
  SelectedLineRange,
} from '@pierre/diffs'

import {
  PendingReviewExistsError,
  PullHeadChangedError,
} from './github-reviews'
import {
  createDiffLineIndex,
  createDraftId,
  groupCommentThreads,
  toGitHubReviewComment,
  type DraftReviewComment,
  type PierreCommentSide,
  type PullReviewCommentData,
  type ReviewCommentMetadata,
  type ReviewCommentThread,
} from './review-comments'

/** Loading state for a pull request's published review comments. */
export type ReviewCommentsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; comments: PullReviewCommentData[] }
  | { status: 'error'; message: string }

/** Which recovery action a failed submission needs: reload the diff, resolve
 * an existing pending review on GitHub, or plain retry. */
export type SubmitErrorReason =
  'head-changed' | 'pending-review-exists' | 'generic'

export type SubmitReviewState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'error'; message: string; reason: SubmitErrorReason }
  | { phase: 'success'; reviewId: number }

export function toSubmitErrorState(error: unknown): SubmitReviewState {
  if (error instanceof PullHeadChangedError) {
    return { phase: 'error', message: error.message, reason: 'head-changed' }
  }

  if (error instanceof PendingReviewExistsError) {
    return {
      phase: 'error',
      message: error.message,
      reason: 'pending-review-exists',
    }
  }

  return {
    phase: 'error',
    message:
      error instanceof Error
        ? error.message
        : 'The review could not be published.',
    reason: 'generic',
  }
}

/** The inline anchor for a range annotation: GitHub and Pierre both hang the
 * annotation off the range's end line. */
export function annotationAnchor(range: SelectedLineRange): {
  side: PierreCommentSide
  lineNumber: number
} {
  return {
    side: range.endSide ?? range.side ?? 'additions',
    lineNumber: range.end,
  }
}

export function createComposerDraft({
  itemId,
  path,
  range,
  headSha,
}: {
  itemId: string
  path: string
  range: SelectedLineRange
  headSha: string
}): DraftReviewComment {
  return {
    kind: 'draft',
    localId: createDraftId(),
    itemId,
    path,
    body: '',
    range,
    headSha,
  }
}

export function upsertDraft(
  drafts: readonly DraftReviewComment[],
  draft: DraftReviewComment,
): DraftReviewComment[] {
  const index = drafts.findIndex(
    (existing) => existing.localId === draft.localId,
  )

  if (index === -1) {
    return [...drafts, draft]
  }

  const next = [...drafts]
  next[index] = draft
  return next
}

export function removeDraft(
  drafts: readonly DraftReviewComment[],
  localId: string,
): DraftReviewComment[] {
  return drafts.filter((draft) => draft.localId !== localId)
}

/** Anchors listed GitHub comments to the loaded patch and groups replies
 * under their top-level comment. */
export function anchorReviewThreads(
  comments: readonly PullReviewCommentData[],
  files: readonly FileDiffMetadata[],
): ReviewCommentThread[] {
  const index = createDiffLineIndex(files)

  return groupCommentThreads(
    comments.map((comment) => toGitHubReviewComment(comment, index)),
  )
}

/**
 * Assembles the inline annotations for every diff item: current GitHub
 * threads (anchored via their root comment), saved drafts, then the open
 * composer. Metadata references stay identical to the caller's state objects
 * so unchanged annotation slots are reused across renders. Outdated threads
 * are omitted — they render only in the comments sidebar.
 */
export function buildReviewAnnotations({
  drafts,
  composer,
  threads,
  itemIdByPath,
}: {
  drafts: readonly DraftReviewComment[]
  composer: DraftReviewComment | null
  threads: readonly ReviewCommentThread[]
  itemIdByPath: ReadonlyMap<string, string>
}): Map<string, DiffLineAnnotation<ReviewCommentMetadata>[]> {
  const annotations = new Map<
    string,
    DiffLineAnnotation<ReviewCommentMetadata>[]
  >()

  function push(
    itemId: string,
    annotation: DiffLineAnnotation<ReviewCommentMetadata>,
  ) {
    const existing = annotations.get(itemId)
    if (existing) {
      existing.push(annotation)
    } else {
      annotations.set(itemId, [annotation])
    }
  }

  for (const thread of threads) {
    const itemId = itemIdByPath.get(thread.root.path)
    if (thread.root.range === null || itemId === undefined) {
      continue
    }

    push(itemId, {
      ...annotationAnchor(thread.root.range),
      metadata: thread.root,
    })
  }

  for (const draft of drafts) {
    if (draft.localId === composer?.localId) {
      continue
    }

    push(draft.itemId, { ...annotationAnchor(draft.range), metadata: draft })
  }

  if (composer) {
    push(composer.itemId, {
      ...annotationAnchor(composer.range),
      metadata: composer,
    })
  }

  return annotations
}
