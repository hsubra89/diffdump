import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createViewedFilesStorageKey,
  readStoredViewedFileIds,
  writeStoredViewedFileIds,
} from './viewed-files'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('viewed file storage', () => {
  it('stores each review under its own encoded key', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: vi.fn<(key: string) => string | null>(
        (key) => values.get(key) ?? null,
      ),
      removeItem: vi.fn<(key: string) => void>((key) => values.delete(key)),
      setItem: vi.fn<(key: string, value: string) => void>((key, value) => {
        values.set(key, value)
      }),
    })

    writeStoredViewedFileIds('github:https://github.com/acme/widgets/pull/42', [
      'src/two.ts',
      'src/one.ts',
      'src/two.ts',
    ])
    writeStoredViewedFileIds('shared:abc123', ['README.md'])

    expect(
      readStoredViewedFileIds('github:https://github.com/acme/widgets/pull/42'),
    ).toEqual(['src/one.ts', 'src/two.ts'])
    expect(readStoredViewedFileIds('shared:abc123')).toEqual(['README.md'])
    expect(
      createViewedFilesStorageKey(
        'github:https://github.com/acme/widgets/pull/42',
      ),
    ).toBe(
      'diffdump.viewed-files.v1:github%3Ahttps%3A%2F%2Fgithub.com%2Facme%2Fwidgets%2Fpull%2F42',
    )
  })

  it('removes empty state and ignores malformed stored values', () => {
    const removeItem = vi.fn<(key: string) => void>()
    const getItem = vi
      .fn<(key: string) => string | null>()
      .mockReturnValueOnce('{"viewed":true}')
      .mockReturnValueOnce('not json')
    vi.stubGlobal('localStorage', {
      getItem,
      removeItem,
      setItem: vi.fn<(key: string, value: string) => void>(),
    })

    expect(readStoredViewedFileIds('shared:one')).toEqual([])
    expect(readStoredViewedFileIds('shared:two')).toEqual([])

    writeStoredViewedFileIds('shared:one', [])
    expect(removeItem).toHaveBeenCalledWith(
      createViewedFilesStorageKey('shared:one'),
    )
  })

  it('does not break the review when local storage is unavailable', () => {
    vi.stubGlobal('localStorage', {
      getItem: vi.fn<(key: string) => string | null>(() => {
        throw new Error('blocked')
      }),
      removeItem: vi.fn<(key: string) => void>(() => {
        throw new Error('blocked')
      }),
      setItem: vi.fn<(key: string, value: string) => void>(() => {
        throw new Error('blocked')
      }),
    })

    expect(readStoredViewedFileIds('shared:one')).toEqual([])
    expect(() =>
      writeStoredViewedFileIds('shared:one', ['src/index.ts']),
    ).not.toThrow()
  })
})
