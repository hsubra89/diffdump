import { parsePatchFiles } from '@pierre/diffs'
import { describe, expect, it } from 'vitest'

import { createClassifiedDiffFiles, summarizeDiffFiles } from './diff-files'
import { EXAMPLE_DIFF, EXAMPLE_GITHUB_URL } from './example-diff'

describe('example diff', () => {
  it('uses a real TanStack Router pull request', () => {
    expect(EXAMPLE_GITHUB_URL).toBe(
      'https://github.com/TanStack/router/pull/7883',
    )
  })

  it('exercises source, test, and documentation categories', () => {
    const files = parsePatchFiles(EXAMPLE_DIFF, 'example', true).flatMap(
      (patch) => patch.files,
    )
    const summary = summarizeDiffFiles(createClassifiedDiffFiles(files))

    expect(files.map((file) => file.name)).toEqual([
      '.changeset/lane-match-loader-rewrite.md',
      'packages/react-router/src/Transitioner.tsx',
      'packages/react-router/tests/transitioner-remount.test.tsx',
      'packages/router-core/tests/masked-location-state-commit.test.ts',
    ])
    expect(summary).toEqual({
      files: 4,
      additions: 178,
      deletions: 3,
      categories: {
        source: { files: 1, additions: 3, deletions: 3 },
        tests: { files: 2, additions: 146, deletions: 0 },
        docs: { files: 1, additions: 29, deletions: 0 },
        other: { files: 0, additions: 0, deletions: 0 },
      },
    })
  })
})
