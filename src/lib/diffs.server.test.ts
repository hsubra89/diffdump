import { describe, expect, it, vi } from 'vitest'

import { loadDiff, saveDiff } from './diffs.server'

type DiffBucket = Pick<R2Bucket, 'get' | 'put'>

describe('R2 diff storage', () => {
  it('retries a colliding slug without overwriting an object', async () => {
    const put = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ key: 'diffs/new-slug' })
    const bucket = { put } as unknown as DiffBucket
    const slugs = ['collision-slug1', 'fresh-share-slug']

    const result = await saveDiff(bucket, 'a diff', {
      now: () => new Date('2026-07-27T12:00:00.000Z'),
      slugFactory: () => slugs.shift() ?? 'unused-share-sl',
    })

    expect(result).toEqual({ slug: 'fresh-share-slug' })
    expect(put).toHaveBeenCalledTimes(2)
    expect(put).toHaveBeenNthCalledWith(
      1,
      'diffs/collision-slug1',
      'a diff',
      expect.objectContaining({
        onlyIf: { etagDoesNotMatch: '*' },
      }),
    )
    expect(put).toHaveBeenNthCalledWith(
      2,
      'diffs/fresh-share-slug',
      'a diff',
      expect.objectContaining({
        customMetadata: {
          createdAt: '2026-07-27T12:00:00.000Z',
          schemaVersion: '1',
        },
      }),
    )
  })

  it('loads the raw diff and metadata', async () => {
    const bucket = {
      get: vi.fn().mockResolvedValue({
        customMetadata: {
          createdAt: '2026-07-27T12:00:00.000Z',
        },
        uploaded: new Date('2026-07-27T12:00:01.000Z'),
        text: () => Promise.resolve('diff contents'),
      }),
    } as unknown as DiffBucket

    await expect(loadDiff(bucket, 'AAECAwQFBgcICQoL')).resolves.toEqual({
      diff: 'diff contents',
      createdAt: '2026-07-27T12:00:00.000Z',
    })
  })

  it('returns null for a missing object', async () => {
    const bucket = {
      get: vi.fn().mockResolvedValue(null),
    } as unknown as DiffBucket

    await expect(loadDiff(bucket, 'AAECAwQFBgcICQoL')).resolves.toBeNull()
  })
})
