import type { FileDiffMetadata, SelectedLineRange } from '@pierre/diffs'

import type { GitHubPullReviewTarget } from './github-diffs'

const DRAFT_STORAGE_PREFIX = 'diffdump.review-drafts.'
const PENDING_REVIEW_STORAGE_PREFIX = 'diffdump.pending-review.'

export type PierreCommentSide = 'deletions' | 'additions'
export type GitHubCommentSide = 'LEFT' | 'RIGHT'

export type DraftReviewComment = {
  kind: 'draft'
  localId: string
  itemId: string
  path: string
  body: string
  range: SelectedLineRange
  headSha: string
}

export type GitHubReviewCommentAuthor = {
  login: string
  avatarUrl: string
  htmlUrl: string
}

export type GitHubReviewComment = {
  kind: 'github'
  id: number
  pullRequestReviewId: number | null
  inReplyToId: number | null
  path: string
  body: string
  author: GitHubReviewCommentAuthor
  createdAt: string
  htmlUrl: string
  range: SelectedLineRange | null
  outdated: boolean
}

export type ReviewCommentMetadata = DraftReviewComment | GitHubReviewComment

export type GitHubReviewEvent = 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES'

export type ReviewSubmission = {
  event: GitHubReviewEvent
  body: string
  comments: DraftReviewComment[]
  target: GitHubPullReviewTarget
}

/** A validated review comment from GitHub's list API, before it is anchored
 * to the loaded diff. */
export type PullReviewCommentData = {
  id: number
  pullRequestReviewId: number | null
  inReplyToId: number | null
  path: string
  body: string
  author: GitHubReviewCommentAuthor
  createdAt: string
  htmlUrl: string
  line: number | null
  side: GitHubCommentSide | null
  startLine: number | null
  startSide: GitHubCommentSide | null
}

/** The `comments[]` entry shape for GitHub's create-review API. */
export type GitHubDraftCommentPayload = {
  path: string
  body: string
  line: number
  side: GitHubCommentSide
  start_line?: number
  start_side?: GitHubCommentSide
}

export type DraftSerializationResult =
  | { ok: true; payload: GitHubDraftCommentPayload }
  | { ok: false; error: string }

export function toGitHubSide(side: PierreCommentSide): GitHubCommentSide {
  return side === 'deletions' ? 'LEFT' : 'RIGHT'
}

export function toPierreSide(side: GitHubCommentSide): PierreCommentSide {
  return side === 'LEFT' ? 'deletions' : 'additions'
}

/**
 * GitHub review comments always use the path of the file inside the pull
 * request: the new path for renames and the original path for deletions.
 * Pierre's parser stores exactly that in `name` (`prevName` only carries the
 * pre-rename path), so the patch-relative comment path is `name` for every
 * change type.
 */
export function resolveCommentPath(
  file: Pick<FileDiffMetadata, 'name'>,
): string {
  return file.name
}

/**
 * Maps every unchanged (context) line rendered by the patch from its old-file
 * line number to its new-file line number. Old-file lines the patch actually
 * deletes are absent.
 */
export function createContextLineMap(
  file: Pick<FileDiffMetadata, 'hunks'>,
): ReadonlyMap<number, number> {
  const contextLines = new Map<number, number>()

  for (const hunk of file.hunks) {
    let oldLine = hunk.deletionStart
    let newLine = hunk.additionStart

    for (const content of hunk.hunkContent) {
      if (content.type === 'context') {
        for (let offset = 0; offset < content.lines; offset += 1) {
          contextLines.set(oldLine + offset, newLine + offset)
        }
        oldLine += content.lines
        newLine += content.lines
      } else {
        oldLine += content.deletions
        newLine += content.additions
      }
    }
  }

  return contextLines
}

/**
 * GitHub only addresses unchanged lines as RIGHT with new-file line numbers,
 * but split view reports selections made in its left pane as `deletions` with
 * old-file numbers even on context lines. Remaps each deletion-side endpoint
 * that lands on a context line to the additions side so the draft serializes
 * to coordinates GitHub accepts.
 */
export function remapContextSelection(
  range: SelectedLineRange,
  contextLines: ReadonlyMap<number, number>,
): SelectedLineRange {
  const startSide = range.side ?? 'additions'
  const endSide = range.endSide ?? startSide
  const start =
    startSide === 'deletions' ? contextLines.get(range.start) : undefined
  const end = endSide === 'deletions' ? contextLines.get(range.end) : undefined

  if (start === undefined && end === undefined) {
    return range
  }

  return {
    start: start ?? range.start,
    side: start === undefined ? startSide : 'additions',
    end: end ?? range.end,
    endSide: end === undefined ? endSide : 'additions',
  }
}

export function serializeDraftComment(
  draft: DraftReviewComment,
): DraftSerializationResult {
  if (draft.body.trim() === '') {
    return { ok: false, error: 'This comment is empty.' }
  }

  /* Pierre leaves `side` unset for selections that start on context lines;
     GitHub addresses context lines on the RIGHT side. */
  const startSide = draft.range.side ?? 'additions'
  const endSide = draft.range.endSide ?? startSide

  if (startSide !== endSide) {
    return {
      ok: false,
      error:
        'GitHub cannot publish one comment across deleted and added lines. Split it into one comment per side.',
    }
  }

  const start = Math.min(draft.range.start, draft.range.end)
  const end = Math.max(draft.range.start, draft.range.end)
  const payload: GitHubDraftCommentPayload = {
    path: draft.path,
    body: draft.body,
    line: end,
    side: toGitHubSide(endSide),
  }

  if (start !== end) {
    payload.start_line = start
    payload.start_side = toGitHubSide(startSide)
  }

  return { ok: true, payload }
}

export function toSelectedLineRange(anchor: {
  line: number | null
  side: GitHubCommentSide | null
  startLine: number | null
  startSide: GitHubCommentSide | null
}): SelectedLineRange | null {
  if (anchor.line === null) {
    return null
  }

  const side = toPierreSide(anchor.side ?? 'RIGHT')
  if (anchor.startLine === null || anchor.startLine === anchor.line) {
    return { start: anchor.line, side, end: anchor.line, endSide: side }
  }

  return {
    start: anchor.startLine,
    side: toPierreSide(anchor.startSide ?? anchor.side ?? 'RIGHT'),
    end: anchor.line,
    endSide: side,
  }
}

type LineSpan = { start: number; count: number }
type FileLineSpans = { additions: LineSpan[]; deletions: LineSpan[] }

/** Per-path index of the line numbers each side of the loaded patch renders,
 * used to decide whether a GitHub comment anchor is still current. */
export type DiffLineIndex = ReadonlyMap<string, FileLineSpans>

export function createDiffLineIndex(
  files: readonly FileDiffMetadata[],
): DiffLineIndex {
  const index = new Map<string, FileLineSpans>()

  for (const file of files) {
    const spans: FileLineSpans = { additions: [], deletions: [] }

    for (const hunk of file.hunks) {
      if (hunk.additionCount > 0) {
        spans.additions.push({
          start: hunk.additionStart,
          count: hunk.additionCount,
        })
      }
      if (hunk.deletionCount > 0) {
        spans.deletions.push({
          start: hunk.deletionStart,
          count: hunk.deletionCount,
        })
      }
    }

    index.set(resolveCommentPath(file), spans)
  }

  return index
}

export function isRangeInDiff(
  index: DiffLineIndex,
  path: string,
  range: SelectedLineRange,
): boolean {
  const spans = index.get(path)
  if (!spans) {
    return false
  }

  return (
    hasLine(spans, range.start, range.side ?? 'additions') &&
    hasLine(spans, range.end, range.endSide ?? range.side ?? 'additions')
  )
}

function hasLine(
  spans: FileLineSpans,
  line: number,
  side: PierreCommentSide,
): boolean {
  return spans[side].some(
    (span) => line >= span.start && line < span.start + span.count,
  )
}

/** Anchors a listed GitHub comment to the loaded diff. Comments whose anchor
 * no longer maps to a rendered line keep `range: null` and are `outdated`. */
export function toGitHubReviewComment(
  data: PullReviewCommentData,
  index: DiffLineIndex,
): GitHubReviewComment {
  const range = toSelectedLineRange(data)
  const anchored = range !== null && isRangeInDiff(index, data.path, range)

  return {
    kind: 'github',
    id: data.id,
    pullRequestReviewId: data.pullRequestReviewId,
    inReplyToId: data.inReplyToId,
    path: data.path,
    body: data.body,
    author: data.author,
    createdAt: data.createdAt,
    htmlUrl: data.htmlUrl,
    range: anchored ? range : null,
    outdated: !anchored,
  }
}

export type ReviewCommentThread = {
  root: GitHubReviewComment
  replies: GitHubReviewComment[]
}

/** Groups replies under their top-level comment, preserving API order.
 * Replies whose parent is missing from the listing become their own root. */
export function groupCommentThreads(
  comments: readonly GitHubReviewComment[],
): ReviewCommentThread[] {
  const threads: ReviewCommentThread[] = []
  const threadsByRootId = new Map<number, ReviewCommentThread>()

  for (const comment of comments) {
    const parent =
      comment.inReplyToId === null
        ? undefined
        : threadsByRootId.get(comment.inReplyToId)

    if (parent) {
      parent.replies.push(comment)
    } else {
      const thread: ReviewCommentThread = { root: comment, replies: [] }
      threads.push(thread)
      threadsByRootId.set(comment.id, thread)
    }
  }

  return threads
}

export function createDraftId(): string {
  return crypto.randomUUID()
}

export function createDraftStorageKey(target: GitHubPullReviewTarget): string {
  return `${DRAFT_STORAGE_PREFIX}${target.owner}/${target.repo}/${target.pullNumber}@${target.headSha}`
}

export function readStoredDrafts(
  target: GitHubPullReviewTarget,
): DraftReviewComment[] {
  let raw: string | null

  try {
    raw =
      globalThis.localStorage?.getItem(createDraftStorageKey(target)) ?? null
  } catch {
    return []
  }

  if (raw === null) {
    return []
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }

  if (!Array.isArray(data)) {
    return []
  }

  return data.filter(
    (draft): draft is DraftReviewComment =>
      isDraftReviewComment(draft) && draft.headSha === target.headSha,
  )
}

export function writeStoredDrafts(
  target: GitHubPullReviewTarget,
  drafts: readonly DraftReviewComment[],
): void {
  try {
    if (drafts.length === 0) {
      globalThis.localStorage?.removeItem(createDraftStorageKey(target))
    } else {
      globalThis.localStorage?.setItem(
        createDraftStorageKey(target),
        JSON.stringify(drafts),
      )
    }
  } catch {
    // Drafts held in memory still work when browser storage is unavailable.
  }
}

/** A PENDING review GitHub created for a submission that has not completed.
 * The fingerprint records which serialized comments it holds, so it is only
 * resumed while the local drafts still match. */
export type StoredPendingReview = {
  reviewId: number
  fingerprint: string
}

export function fingerprintDraftPayloads(
  payloads: readonly GitHubDraftCommentPayload[],
): string {
  return JSON.stringify(payloads)
}

export function createPendingReviewStorageKey(
  target: GitHubPullReviewTarget,
): string {
  return `${PENDING_REVIEW_STORAGE_PREFIX}${target.owner}/${target.repo}/${target.pullNumber}@${target.headSha}`
}

export function readStoredPendingReview(
  target: GitHubPullReviewTarget,
): StoredPendingReview | null {
  let raw: string | null

  try {
    raw =
      globalThis.localStorage?.getItem(createPendingReviewStorageKey(target)) ??
      null
  } catch {
    return null
  }

  if (raw === null) {
    return null
  }

  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return null
  }

  return isStoredPendingReview(data) ? data : null
}

export function writeStoredPendingReview(
  target: GitHubPullReviewTarget,
  pending: StoredPendingReview | null,
): void {
  try {
    if (pending === null) {
      globalThis.localStorage?.removeItem(createPendingReviewStorageKey(target))
    } else {
      globalThis.localStorage?.setItem(
        createPendingReviewStorageKey(target),
        JSON.stringify(pending),
      )
    }
  } catch {
    // Without storage, an interrupted submission just cannot resume later.
  }
}

function isStoredPendingReview(value: unknown): value is StoredPendingReview {
  return (
    typeof value === 'object' &&
    value !== null &&
    'reviewId' in value &&
    typeof value.reviewId === 'number' &&
    'fingerprint' in value &&
    typeof value.fingerprint === 'string'
  )
}

function isDraftReviewComment(value: unknown): value is DraftReviewComment {
  return (
    typeof value === 'object' &&
    value !== null &&
    'kind' in value &&
    value.kind === 'draft' &&
    'localId' in value &&
    typeof value.localId === 'string' &&
    'itemId' in value &&
    typeof value.itemId === 'string' &&
    'path' in value &&
    typeof value.path === 'string' &&
    'body' in value &&
    typeof value.body === 'string' &&
    'headSha' in value &&
    typeof value.headSha === 'string' &&
    'range' in value &&
    isSelectedLineRange(value.range)
  )
}

function isSelectedLineRange(value: unknown): value is SelectedLineRange {
  return (
    typeof value === 'object' &&
    value !== null &&
    'start' in value &&
    typeof value.start === 'number' &&
    'end' in value &&
    typeof value.end === 'number' &&
    (!('side' in value) || isPierreSide(value.side)) &&
    (!('endSide' in value) || isPierreSide(value.endSide))
  )
}

function isPierreSide(value: unknown): value is PierreCommentSide {
  return value === 'deletions' || value === 'additions' || value === undefined
}
