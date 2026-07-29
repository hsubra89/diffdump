import { describe, expect, it } from 'vitest'
import { parsePatchFiles } from '@pierre/diffs'

import {
  PendingReviewExistsError,
  PullHeadChangedError,
} from './github-reviews'
import type {
  DraftReviewComment,
  GitHubReviewComment,
  PullReviewCommentData,
  ReviewCommentThread,
} from './review-comments'
import {
  anchorReviewThreads,
  annotationAnchor,
  buildReviewAnnotations,
  createComposerDraft,
  removeDraft,
  toSubmitErrorState,
  upsertDraft,
} from './review-state'

const HEAD_SHA = '0123456789abcdef0123456789abcdef01234567'

const PATCH = `diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -10,3 +10,4 @@
 ctx1
-old line
 ctx2
+new line
+extra line
`

const FILES = parsePatchFiles(PATCH, 'review-state-test', true).flatMap(
  (patch) => patch.files,
)

function createDraft(
  overrides: Partial<DraftReviewComment> = {},
): DraftReviewComment {
  return {
    kind: 'draft',
    localId: 'local-1',
    itemId: 'item-1',
    path: 'src/app.ts',
    body: 'Consider renaming this.',
    range: { start: 12, end: 12, side: 'additions' },
    headSha: HEAD_SHA,
    ...overrides,
  }
}

function createCommentData(
  overrides: Partial<PullReviewCommentData> = {},
): PullReviewCommentData {
  return {
    id: 1,
    pullRequestReviewId: 7,
    inReplyToId: null,
    path: 'src/app.ts',
    body: 'Existing comment.',
    author: {
      login: 'octocat',
      avatarUrl: '',
      htmlUrl: 'https://github.com/octocat',
    },
    createdAt: '2026-07-01T00:00:00Z',
    htmlUrl: 'https://github.com/acme/widgets/pull/42#discussion_r1',
    line: 13,
    side: 'RIGHT',
    startLine: null,
    startSide: null,
    ...overrides,
  }
}

function createThread(root: Partial<GitHubReviewComment>): ReviewCommentThread {
  return {
    root: {
      kind: 'github',
      id: 1,
      pullRequestReviewId: 7,
      inReplyToId: null,
      path: 'src/app.ts',
      body: 'Existing comment.',
      author: { login: 'octocat', avatarUrl: '', htmlUrl: '' },
      createdAt: '2026-07-01T00:00:00Z',
      htmlUrl: 'https://github.com/acme/widgets/pull/42#discussion_r1',
      range: { start: 13, side: 'additions', end: 13, endSide: 'additions' },
      outdated: false,
      ...root,
    },
    replies: [],
  }
}

describe('annotation anchors', () => {
  it('anchors annotations on the range end, defaulting to additions', () => {
    expect(annotationAnchor({ start: 3, end: 5 })).toEqual({
      side: 'additions',
      lineNumber: 5,
    })
    expect(annotationAnchor({ start: 3, side: 'deletions', end: 5 })).toEqual({
      side: 'deletions',
      lineNumber: 5,
    })
    expect(
      annotationAnchor({
        start: 3,
        side: 'deletions',
        end: 5,
        endSide: 'additions',
      }),
    ).toEqual({ side: 'additions', lineNumber: 5 })
  })
})

describe('draft collection updates', () => {
  it('creates composer drafts with unique local ids and empty bodies', () => {
    const seed = {
      itemId: 'item-1',
      path: 'src/app.ts',
      range: { start: 12, end: 12 },
      headSha: HEAD_SHA,
    }
    const first = createComposerDraft(seed)
    const second = createComposerDraft(seed)

    expect(first).toMatchObject({ kind: 'draft', body: '', ...seed })
    expect(first.localId).not.toBe(second.localId)
  })

  it('appends new drafts and replaces edited ones in place', () => {
    const first = createDraft()
    const second = createDraft({ localId: 'local-2', body: 'Second.' })
    const drafts = upsertDraft(upsertDraft([], first), second)

    expect(drafts).toEqual([first, second])
    expect(
      upsertDraft(drafts, { ...first, body: 'Edited.' }).map((d) => d.body),
    ).toEqual(['Edited.', 'Second.'])
    expect(removeDraft(drafts, 'local-1')).toEqual([second])
  })
})

describe('anchoring review threads', () => {
  it('anchors current comments and marks unmappable ones outdated', () => {
    const threads = anchorReviewThreads(
      [
        createCommentData(),
        createCommentData({ id: 2, inReplyToId: 1, line: null, side: null }),
        createCommentData({ id: 3, line: 99 }),
      ],
      FILES,
    )

    expect(threads).toHaveLength(2)
    expect(threads[0].root.outdated).toBe(false)
    expect(threads[0].root.range).toEqual({
      start: 13,
      side: 'additions',
      end: 13,
      endSide: 'additions',
    })
    expect(threads[0].replies.map((reply) => reply.id)).toEqual([2])
    expect(threads[1].root).toMatchObject({
      id: 3,
      outdated: true,
      range: null,
    })
  })
})

describe('mapping submission failures', () => {
  const OTHER_SHA = 'fedcba9876543210fedcba9876543210fedcba98'

  it('routes each failure to its recovery action', () => {
    expect(
      toSubmitErrorState(new PullHeadChangedError(HEAD_SHA, OTHER_SHA)),
    ).toMatchObject({ phase: 'error', reason: 'head-changed' })
    expect(toSubmitErrorState(new PendingReviewExistsError())).toMatchObject({
      phase: 'error',
      reason: 'pending-review-exists',
    })
    expect(toSubmitErrorState(new Error('boom'))).toEqual({
      phase: 'error',
      message: 'boom',
      reason: 'generic',
    })
    expect(toSubmitErrorState('not an error')).toEqual({
      phase: 'error',
      message: 'The review could not be published.',
      reason: 'generic',
    })
  })
})

describe('building review annotations', () => {
  const itemIdByPath = new Map([['src/app.ts', 'item-1']])

  it('maps threads, drafts, and the composer onto their items in order', () => {
    const thread = createThread({})
    const draft = createDraft({ localId: 'saved-1' })
    const composer = createDraft({ localId: 'composer-1', body: '' })

    const annotations = buildReviewAnnotations({
      drafts: [draft],
      composer,
      threads: [thread],
      itemIdByPath,
    })

    expect(annotations.get('item-1')).toEqual([
      { side: 'additions', lineNumber: 13, metadata: thread.root },
      { side: 'additions', lineNumber: 12, metadata: draft },
      { side: 'additions', lineNumber: 12, metadata: composer },
    ])
    /* Metadata must be the caller's state objects so annotation slots are
       reused across renders. */
    expect(annotations.get('item-1')?.[0].metadata).toBe(thread.root)
    expect(annotations.get('item-1')?.[1].metadata).toBe(draft)
  })

  it('hides a saved draft while it is being edited in the composer', () => {
    const draft = createDraft({ localId: 'saved-1' })

    const annotations = buildReviewAnnotations({
      drafts: [draft],
      composer: draft,
      threads: [],
      itemIdByPath,
    })

    expect(annotations.get('item-1')).toEqual([
      { side: 'additions', lineNumber: 12, metadata: draft },
    ])
  })

  it('skips threads without an anchor or a matching item', () => {
    const unanchored = createThread({ range: null, outdated: true })
    const unknownFile = createThread({ id: 2, path: 'src/missing.ts' })

    const annotations = buildReviewAnnotations({
      drafts: [],
      composer: null,
      threads: [unanchored, unknownFile],
      itemIdByPath,
    })

    expect(annotations.size).toBe(0)
  })
})
