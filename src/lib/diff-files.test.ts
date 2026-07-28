import type { FileDiffMetadata } from '@pierre/diffs'
import { describe, expect, it } from 'vitest'

import {
  classifyDiffFile,
  createClassifiedDiffFiles,
  filterAndOrderDiffFiles,
  summarizeDiffFiles,
} from './diff-files'

describe('diff file classification', () => {
  it.each([
    ['src/components/button.tsx', 'source'],
    ['lib/parser.go', 'source'],
    ['tests/parser.test.ts', 'tests'],
    ['src/components/button.spec.tsx', 'tests'],
    ['pkg/parser_test.go', 'tests'],
    ['test_parser.py', 'tests'],
    ['docs/getting-started.tsx', 'docs'],
    ['README.md', 'docs'],
    ['CONTRIBUTING', 'docs'],
    ['package-lock.json', 'other'],
    ['turbo.json', 'other'],
    ['vite.config.ts', 'other'],
    ['public/logo.svg', 'other'],
    ['src/client.generated.ts', 'other'],
  ] as const)('classifies %s as %s', (path, category) => {
    expect(classifyDiffFile(path)).toBe(category)
  })

  it('gives test conventions precedence over documentation conventions', () => {
    expect(classifyDiffFile('docs/examples/reader.test.ts')).toBe('tests')
    expect(classifyDiffFile('tests/README.md')).toBe('tests')
  })

  it('handles Windows-style and case-insensitive paths', () => {
    expect(classifyDiffFile('Tests\\Parser.SPEC.TS')).toBe('tests')
    expect(classifyDiffFile('DOCS\\README.MDX')).toBe('docs')
  })
})

describe('classified diff files', () => {
  const files = [
    createFile('tests/parser.test.ts', 3, 1, 'tests'),
    createFile('src/parser.ts', 8, 2, 'source'),
    createFile('README.md', 2, 0, 'docs'),
    createFile('package-lock.json', 20, 20, 'lockfile'),
  ]

  it('creates stable records with line counts and original positions', () => {
    expect(createClassifiedDiffFiles(files).slice(0, 2)).toMatchObject([
      {
        id: 'tests-0',
        originalIndex: 0,
        category: 'tests',
        additions: 3,
        deletions: 1,
      },
      {
        id: 'source-1',
        originalIndex: 1,
        category: 'source',
        additions: 8,
        deletions: 2,
      },
    ])
  })

  it('keeps stored viewed state tied to the file revision', () => {
    const firstRevision = {
      ...createFile('src/parser.ts', 2, 1, 'first'),
      type: 'change',
      prevObjectId: '1111111',
      newObjectId: '2222222',
    } as FileDiffMetadata
    const nextRevision = {
      ...firstRevision,
      cacheKey: 'next',
      newObjectId: '3333333',
    }
    const repeatedRevision = { ...firstRevision, cacheKey: 'repeat' }
    const classified = createClassifiedDiffFiles([
      firstRevision,
      nextRevision,
      repeatedRevision,
    ])

    expect(classified[0].storageId).not.toBe(classified[1].storageId)
    expect(classified[2].storageId).toBe(`${classified[0].storageId}:2`)
  })

  it('summarizes additions and deletions by category', () => {
    expect(summarizeDiffFiles(createClassifiedDiffFiles(files))).toEqual({
      files: 4,
      additions: 33,
      deletions: 23,
      categories: {
        source: { files: 1, additions: 8, deletions: 2 },
        tests: { files: 1, additions: 3, deletions: 1 },
        docs: { files: 1, additions: 2, deletions: 0 },
        other: { files: 1, additions: 20, deletions: 20 },
      },
    })
  })

  it('filters files and applies a stable category order', () => {
    const classified = createClassifiedDiffFiles(files)

    expect(
      filterAndOrderDiffFiles(classified, 'all', 'category').map(
        (file) => file.file.name,
      ),
    ).toEqual([
      'src/parser.ts',
      'tests/parser.test.ts',
      'README.md',
      'package-lock.json',
    ])
    expect(
      filterAndOrderDiffFiles(classified, 'tests', 'patch').map(
        (file) => file.file.name,
      ),
    ).toEqual(['tests/parser.test.ts'])
  })
})

function createFile(
  name: string,
  additions: number,
  deletions: number,
  cacheKey: string,
): FileDiffMetadata {
  return {
    name,
    cacheKey,
    hunks: [{ additionLines: additions, deletionLines: deletions }],
  } as FileDiffMetadata
}
