import { afterEach, describe, expect, it, vi } from 'vitest'
import { parsePatchFiles, type SelectedLineRange } from '@pierre/diffs'

import {
  classifyDiffLine,
  createContextLineMap,
  draftRangeError,
  createDiffLineIndex,
  createDraftStorageKey,
  createPendingReviewStorageKey,
  groupCommentThreads,
  isPatchAnchoredRange,
  isRangeInDiff,
  readStoredDrafts,
  readStoredPendingReview,
  remapContextSelection,
  resolveCommentPath,
  serializeDraftComment,
  toGitHubReviewComment,
  toSelectedLineRange,
  writeStoredDrafts,
  writeStoredPendingReview,
  type DraftReviewComment,
  type GitHubReviewComment,
  type PullReviewCommentData,
} from './review-comments'

const HEAD_SHA = '0123456789abcdef0123456789abcdef01234567'
const OTHER_SHA = 'fedcba9876543210fedcba9876543210fedcba98'

const TARGET = {
  owner: 'acme',
  repo: 'widgets',
  pullNumber: '42',
  headSha: HEAD_SHA,
}

/* One changed file (right lines 10-13, left lines 10-12), one added file,
   one deleted file, and one rename with changes. */
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
diff --git a/src/new.ts b/src/new.ts
new file mode 100644
index 0000000..2222222
--- /dev/null
+++ b/src/new.ts
@@ -0,0 +1,2 @@
+one
+two
diff --git a/docs/old.md b/docs/old.md
deleted file mode 100644
index 1111111..0000000
--- a/docs/old.md
+++ /dev/null
@@ -1,2 +0,0 @@
-first
-second
diff --git a/src/old-name.ts b/src/new-name.ts
similarity index 90%
rename from src/old-name.ts
rename to src/new-name.ts
index 1111111..2222222 100644
--- a/src/old-name.ts
+++ b/src/new-name.ts
@@ -1,2 +1,2 @@
-a
+b
 c
`

const FILES = parsePatchFiles(PATCH, 'review-comments-test', true).flatMap(
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
      avatarUrl: 'https://avatars.example/octocat',
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

function createGitHubComment(
  overrides: Partial<GitHubReviewComment> = {},
): GitHubReviewComment {
  return {
    kind: 'github',
    id: 1,
    pullRequestReviewId: 7,
    inReplyToId: null,
    path: 'src/app.ts',
    body: 'Existing comment.',
    author: {
      login: 'octocat',
      avatarUrl: 'https://avatars.example/octocat',
      htmlUrl: 'https://github.com/octocat',
    },
    createdAt: '2026-07-01T00:00:00Z',
    htmlUrl: 'https://github.com/acme/widgets/pull/42#discussion_r1',
    range: null,
    outdated: true,
    ...overrides,
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('draft serialization', () => {
  it('maps additions to RIGHT single-line comments without a start anchor', () => {
    expect(serializeDraftComment(createDraft())).toEqual({
      ok: true,
      payload: {
        path: 'src/app.ts',
        body: 'Consider renaming this.',
        line: 12,
        side: 'RIGHT',
      },
    })
  })

  it('maps deletions to LEFT with start anchors for multi-line ranges', () => {
    expect(
      serializeDraftComment(
        createDraft({
          range: {
            start: 10,
            side: 'deletions',
            end: 11,
            endSide: 'deletions',
          },
        }),
      ),
    ).toEqual({
      ok: true,
      payload: {
        path: 'src/app.ts',
        body: 'Consider renaming this.',
        line: 11,
        side: 'LEFT',
        start_line: 10,
        start_side: 'LEFT',
      },
    })
  })

  it('addresses context lines without a side on RIGHT', () => {
    const result = serializeDraftComment(
      createDraft({ range: { start: 10, end: 10 } }),
    )

    expect(result).toEqual({
      ok: true,
      payload: expect.objectContaining({ line: 10, side: 'RIGHT' }),
    })
  })

  it('normalizes ranges selected bottom-up', () => {
    expect(
      serializeDraftComment(
        createDraft({
          range: {
            start: 13,
            side: 'additions',
            end: 10,
            endSide: 'additions',
          },
        }),
      ),
    ).toEqual({
      ok: true,
      payload: expect.objectContaining({
        line: 13,
        start_line: 10,
        side: 'RIGHT',
        start_side: 'RIGHT',
      }),
    })
  })

  it('rejects cross-side selections before they reach GitHub', () => {
    const result = serializeDraftComment(
      createDraft({
        range: { start: 11, side: 'deletions', end: 12, endSide: 'additions' },
      }),
    )

    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('one comment per side'),
    })
  })

  it('rejects empty comment bodies', () => {
    expect(serializeDraftComment(createDraft({ body: '  ' }))).toEqual({
      ok: false,
      error: expect.stringContaining('empty'),
    })
  })
})

/* Split view reports left-pane selections as `deletions` with old-file line
   numbers even on context lines; GitHub only accepts context anchors as RIGHT
   with new-file numbers. The src/app.ts hunk is asymmetric, so old-file and
   new-file numbers diverge below the deleted line. */
describe('split-view context selection remapping', () => {
  const contextLines = createContextLineMap(FILES[0])

  it('maps context lines from old-file to new-file numbers, skipping deletions', () => {
    expect(contextLines).toEqual(
      new Map([
        [10, 10],
        [12, 11],
      ]),
    )
  })

  it('serializes a left-pane context selection as RIGHT with new-file numbers', () => {
    const range = remapContextSelection(
      { start: 10, side: 'deletions', end: 12, endSide: 'deletions' },
      contextLines,
    )

    expect(range).toEqual({
      start: 10,
      side: 'additions',
      end: 11,
      endSide: 'additions',
    })
    expect(serializeDraftComment(createDraft({ range }))).toEqual({
      ok: true,
      payload: {
        path: 'src/app.ts',
        body: 'Consider renaming this.',
        line: 11,
        side: 'RIGHT',
        start_line: 10,
        start_side: 'RIGHT',
      },
    })
  })

  it('keeps selections on deleted lines on the LEFT side', () => {
    const range: SelectedLineRange = {
      start: 11,
      side: 'deletions',
      end: 11,
      endSide: 'deletions',
    }

    expect(remapContextSelection(range, contextLines)).toBe(range)
  })

  it('keeps additions-side and side-less selections untouched', () => {
    const additions: SelectedLineRange = {
      start: 12,
      side: 'additions',
      end: 13,
      endSide: 'additions',
    }
    const sideless: SelectedLineRange = { start: 10, end: 10 }

    expect(remapContextSelection(additions, contextLines)).toBe(additions)
    expect(remapContextSelection(sideless, contextLines)).toBe(sideless)
  })

  it('remaps only the context endpoint of a deletion-plus-context selection', () => {
    const range = remapContextSelection(
      { start: 11, side: 'deletions', end: 12, endSide: 'deletions' },
      contextLines,
    )

    expect(range).toEqual({
      start: 11,
      side: 'deletions',
      end: 11,
      endSide: 'additions',
    })
    expect(serializeDraftComment(createDraft({ range }))).toEqual({
      ok: false,
      error: expect.stringContaining('one comment per side'),
    })
  })
})

describe('draft range validation', () => {
  it('accepts same-side and side-less ranges', () => {
    expect(
      draftRangeError({
        start: 12,
        side: 'additions',
        end: 13,
        endSide: 'additions',
      }),
    ).toBeNull()
    expect(draftRangeError({ start: 10, end: 10 })).toBeNull()
  })

  it('rejects cross-side ranges at draft time', () => {
    expect(
      draftRangeError({
        start: 11,
        side: 'deletions',
        end: 12,
        endSide: 'additions',
      }),
    ).toContain('one comment per side')
  })
})

describe('anchor line classification', () => {
  it('classifies added, deleted, and context lines on either side', () => {
    expect(classifyDiffLine(FILES[0], 'additions', 12)).toBe('addition')
    expect(classifyDiffLine(FILES[0], 'additions', 13)).toBe('addition')
    expect(classifyDiffLine(FILES[0], 'deletions', 11)).toBe('deletion')
    expect(classifyDiffLine(FILES[0], 'additions', 10)).toBe('context')
    expect(classifyDiffLine(FILES[0], 'additions', 11)).toBe('context')
    expect(classifyDiffLine(FILES[0], 'deletions', 12)).toBe('context')
  })

  it('returns null for lines the patch does not render', () => {
    expect(classifyDiffLine(FILES[0], 'additions', 99)).toBeNull()
    expect(classifyDiffLine(FILES[0], 'deletions', 13)).toBeNull()
    expect(classifyDiffLine(FILES[1], 'deletions', 1)).toBeNull()
  })
})

describe('patch-anchored range guard', () => {
  it('accepts ranges whose endpoints are rendered by the patch', () => {
    expect(
      isPatchAnchoredRange(FILES[0], {
        start: 10,
        side: 'additions',
        end: 13,
        endSide: 'additions',
      }),
    ).toBe(true)
    /* Pierre leaves `side` unset for context selections. */
    expect(isPatchAnchoredRange(FILES[0], { start: 10, end: 10 })).toBe(true)
    expect(
      isPatchAnchoredRange(FILES[0], {
        start: 11,
        side: 'deletions',
        end: 11,
        endSide: 'deletions',
      }),
    ).toBe(true)
  })

  it('rejects ranges touching expanded context outside the patch hunks', () => {
    expect(isPatchAnchoredRange(FILES[0], { start: 5, end: 5 })).toBe(false)
    expect(isPatchAnchoredRange(FILES[0], { start: 5, end: 10 })).toBe(false)
    expect(
      isPatchAnchoredRange(FILES[0], {
        start: 12,
        side: 'additions',
        end: 99,
        endSide: 'additions',
      }),
    ).toBe(false)
  })
})

describe('comment path resolution', () => {
  it('uses the patch path for changed, added, deleted, and renamed files', () => {
    expect(FILES.map((file) => [file.type, resolveCommentPath(file)])).toEqual([
      ['change', 'src/app.ts'],
      ['new', 'src/new.ts'],
      ['deleted', 'docs/old.md'],
      ['rename-changed', 'src/new-name.ts'],
    ])
  })
})

describe('GitHub anchor mapping', () => {
  it('returns null for comments GitHub no longer anchors', () => {
    expect(
      toSelectedLineRange({
        line: null,
        side: null,
        startLine: null,
        startSide: null,
      }),
    ).toBeNull()
  })

  it('maps single-line and multi-line anchors onto Pierre sides', () => {
    expect(
      toSelectedLineRange({
        line: 5,
        side: 'LEFT',
        startLine: null,
        startSide: null,
      }),
    ).toEqual({ start: 5, side: 'deletions', end: 5, endSide: 'deletions' })

    expect(
      toSelectedLineRange({
        line: 8,
        side: 'RIGHT',
        startLine: 5,
        startSide: 'RIGHT',
      }),
    ).toEqual({ start: 5, side: 'additions', end: 8, endSide: 'additions' })
  })

  it('defaults missing sides to RIGHT', () => {
    expect(
      toSelectedLineRange({
        line: 3,
        side: null,
        startLine: null,
        startSide: null,
      }),
    ).toEqual({ start: 3, side: 'additions', end: 3, endSide: 'additions' })
  })
})

describe('outdated comment detection', () => {
  const index = createDiffLineIndex(FILES)

  it('indexes each side of every hunk', () => {
    expect(
      isRangeInDiff(index, 'src/app.ts', {
        start: 13,
        end: 13,
        side: 'additions',
      }),
    ).toBe(true)
    expect(
      isRangeInDiff(index, 'src/app.ts', {
        start: 11,
        end: 11,
        side: 'deletions',
      }),
    ).toBe(true)
    expect(
      isRangeInDiff(index, 'src/app.ts', {
        start: 13,
        end: 13,
        side: 'deletions',
      }),
    ).toBe(false)
    expect(
      isRangeInDiff(index, 'docs/old.md', {
        start: 2,
        end: 2,
        side: 'deletions',
      }),
    ).toBe(true)
    expect(
      isRangeInDiff(index, 'src/new-name.ts', {
        start: 1,
        end: 1,
        side: 'additions',
      }),
    ).toBe(true)
  })

  it('keeps anchored comments inline and current', () => {
    const comment = toGitHubReviewComment(createCommentData(), index)

    expect(comment.outdated).toBe(false)
    expect(comment.range).toEqual({
      start: 13,
      side: 'additions',
      end: 13,
      endSide: 'additions',
    })
  })

  it('marks unanchored, out-of-range, and unknown-file comments outdated', () => {
    const unanchored = toGitHubReviewComment(
      createCommentData({ line: null, side: null }),
      index,
    )
    const outOfRange = toGitHubReviewComment(
      createCommentData({ line: 99 }),
      index,
    )
    const unknownFile = toGitHubReviewComment(
      createCommentData({ path: 'src/missing.ts' }),
      index,
    )

    for (const comment of [unanchored, outOfRange, unknownFile]) {
      expect(comment.outdated).toBe(true)
      expect(comment.range).toBeNull()
    }
  })
})

describe('reply grouping', () => {
  it('groups replies under their top-level comment in API order', () => {
    const root = createGitHubComment({ id: 1 })
    const reply = createGitHubComment({ id: 2, inReplyToId: 1 })
    const other = createGitHubComment({ id: 3 })
    const lateReply = createGitHubComment({ id: 4, inReplyToId: 1 })

    expect(groupCommentThreads([root, reply, other, lateReply])).toEqual([
      { root, replies: [reply, lateReply] },
      { root: other, replies: [] },
    ])
  })

  it('promotes replies whose parent is missing to their own thread', () => {
    const orphan = createGitHubComment({ id: 9, inReplyToId: 999 })

    expect(groupCommentThreads([orphan])).toEqual([
      { root: orphan, replies: [] },
    ])
  })
})

describe('draft storage', () => {
  function stubLocalStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial))
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => {
        values.set(key, value)
      },
    })
    return values
  }

  it('scopes storage keys by owner, repo, pull, and head SHA', () => {
    expect(createDraftStorageKey(TARGET)).toBe(
      `diffdump.review-drafts.acme/widgets/42@${HEAD_SHA}`,
    )
  })

  it('round-trips drafts and clears the slot when none remain', () => {
    const values = stubLocalStorage()
    const draft = createDraft()

    writeStoredDrafts(TARGET, [draft])
    expect(readStoredDrafts(TARGET)).toEqual([draft])

    writeStoredDrafts(TARGET, [])
    expect(values.size).toBe(0)
    expect(readStoredDrafts(TARGET)).toEqual([])
  })

  it('drops malformed entries and drafts from another head SHA', () => {
    const stored = [
      createDraft(),
      createDraft({ localId: 'local-2', headSha: OTHER_SHA }),
      { nonsense: true },
    ]
    stubLocalStorage({
      [createDraftStorageKey(TARGET)]: JSON.stringify(stored),
    })

    expect(readStoredDrafts(TARGET)).toEqual([createDraft()])
  })

  it('treats unreadable storage as empty', () => {
    stubLocalStorage({ [createDraftStorageKey(TARGET)]: 'not json' })

    expect(readStoredDrafts(TARGET)).toEqual([])
  })

  it('scopes pending review keys by owner, repo, pull, and head SHA', () => {
    expect(createPendingReviewStorageKey(TARGET)).toBe(
      `diffdump.pending-review.acme/widgets/42@${HEAD_SHA}`,
    )
  })

  it('round-trips the pending review and clears the slot on null', () => {
    const values = stubLocalStorage()
    const pending = { reviewId: 555, fingerprint: '[{"line":12}]' }

    writeStoredPendingReview(TARGET, pending)
    expect(readStoredPendingReview(TARGET)).toEqual(pending)

    writeStoredPendingReview(TARGET, null)
    expect(values.size).toBe(0)
    expect(readStoredPendingReview(TARGET)).toBeNull()
  })

  it('ignores malformed pending review entries', () => {
    stubLocalStorage({
      [createPendingReviewStorageKey(TARGET)]: JSON.stringify({
        reviewId: 'not-a-number',
      }),
    })

    expect(readStoredPendingReview(TARGET)).toBeNull()
  })
})
