import { describe, expect, it } from 'vitest'
import { parsePatchFiles } from '@pierre/diffs'

import { createClassifiedDiffFiles } from './diff-files'
import { buildSearchCorpus, searchDiffCorpus } from './diff-search'

function classifyPatch(patch: string) {
  return createClassifiedDiffFiles(
    parsePatchFiles(patch, 'test', true).flatMap((parsed) => parsed.files),
  )
}

const MIXED_BLOCKS_PATCH = `diff --git a/src/alpha.ts b/src/alpha.ts
index 1111111..2222222 100644
--- a/src/alpha.ts
+++ b/src/alpha.ts
@@ -1,5 +1,5 @@
 shared context one
-old Needle line
+new needle line
 shared context two
-removed tail
+added tail
 shared context three
`

const OFFSET_HUNKS_PATCH = `diff --git a/src/beta.ts b/src/beta.ts
index 3333333..4444444 100644
--- a/src/beta.ts
+++ b/src/beta.ts
@@ -1,2 +1,2 @@
 top context
-first old
+first new
@@ -10,3 +12,4 @@
 context ten
+inserted line
 context eleven
 context twelve
`

describe('buildSearchCorpus', () => {
  it('walks mixed context/change blocks, deduping context to the addition side', () => {
    const [corpus] = buildSearchCorpus(classifyPatch(MIXED_BLOCKS_PATCH))

    expect(corpus.entries).toEqual([
      { side: 'additions', lineNumber: 1, text: 'shared context one' },
      { side: 'deletions', lineNumber: 2, text: 'old needle line' },
      { side: 'additions', lineNumber: 2, text: 'new needle line' },
      { side: 'additions', lineNumber: 3, text: 'shared context two' },
      { side: 'deletions', lineNumber: 4, text: 'removed tail' },
      { side: 'additions', lineNumber: 4, text: 'added tail' },
      { side: 'additions', lineNumber: 5, text: 'shared context three' },
    ])
  })

  it('seeds line numbers per hunk from each side of the hunk header', () => {
    const [corpus] = buildSearchCorpus(classifyPatch(OFFSET_HUNKS_PATCH))

    expect(corpus.entries).toEqual([
      { side: 'additions', lineNumber: 1, text: 'top context' },
      { side: 'deletions', lineNumber: 2, text: 'first old' },
      { side: 'additions', lineNumber: 2, text: 'first new' },
      { side: 'additions', lineNumber: 12, text: 'context ten' },
      { side: 'additions', lineNumber: 13, text: 'inserted line' },
      { side: 'additions', lineNumber: 14, text: 'context eleven' },
      { side: 'additions', lineNumber: 15, text: 'context twelve' },
    ])
  })

  it('keys each corpus entry to the classified file id', () => {
    const corpus = buildSearchCorpus(
      classifyPatch(MIXED_BLOCKS_PATCH + OFFSET_HUNKS_PATCH),
    )
    const files = classifyPatch(MIXED_BLOCKS_PATCH + OFFSET_HUNKS_PATCH)

    expect(corpus.map((file) => file.fileId)).toEqual(files.map((f) => f.id))
  })
})

describe('searchDiffCorpus', () => {
  const corpus = buildSearchCorpus(
    classifyPatch(MIXED_BLOCKS_PATCH + OFFSET_HUNKS_PATCH),
  )

  it('matches case-insensitively on both sides', () => {
    const { matches, limited } = searchDiffCorpus(corpus, 'NEEDLE')

    expect(limited).toBe(false)
    expect(matches).toEqual([
      { fileId: corpus[0].fileId, side: 'deletions', lineNumber: 2 },
      { fileId: corpus[0].fileId, side: 'additions', lineNumber: 2 },
    ])
  })

  it('returns matches in document order across files', () => {
    const { matches } = searchDiffCorpus(corpus, 'first')

    expect(matches).toEqual([
      { fileId: corpus[1].fileId, side: 'deletions', lineNumber: 2 },
      { fileId: corpus[1].fileId, side: 'additions', lineNumber: 2 },
    ])

    const contextMatches = searchDiffCorpus(corpus, 'context').matches
    expect(contextMatches.map((match) => match.fileId)).toEqual([
      corpus[0].fileId,
      corpus[0].fileId,
      corpus[0].fileId,
      corpus[1].fileId,
      corpus[1].fileId,
      corpus[1].fileId,
      corpus[1].fileId,
    ])
  })

  it('counts context matches once', () => {
    const { matches } = searchDiffCorpus(corpus, 'shared context one')

    expect(matches).toEqual([
      { fileId: corpus[0].fileId, side: 'additions', lineNumber: 1 },
    ])
  })

  it('stops scanning at the match limit', () => {
    const { matches, limited } = searchDiffCorpus(corpus, 'context', 3)

    expect(limited).toBe(true)
    expect(matches).toHaveLength(3)
  })

  it('returns no matches for an empty query', () => {
    expect(searchDiffCorpus(corpus, '')).toEqual({
      matches: [],
      limited: false,
    })
  })

  it('returns no matches when the query is absent', () => {
    expect(searchDiffCorpus(corpus, 'missing text').matches).toEqual([])
  })
})
