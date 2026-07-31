import { describe, expect, it, vi } from 'vitest'

import { loadDiff, saveDiff } from './diffs.server'

type DiffBucket = Pick<R2Bucket, 'get' | 'put'>
type MockR2Get = (key: string) => Promise<unknown>
type MockR2Put = (...args: unknown[]) => Promise<unknown>

describe('R2 diff storage', () => {
  it('retries a colliding slug without overwriting an object', async () => {
    const put = vi
      .fn<MockR2Put>()
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
          expiresAt: '2026-07-28T12:00:00.000Z',
          schemaVersion: '3',
        },
      }),
    )
  })

  it('loads the raw diff and metadata', async () => {
    const bucket = {
      get: vi.fn<MockR2Get>().mockResolvedValue({
        customMetadata: {
          createdAt: '2026-07-27T12:00:00.000Z',
          expiresAt: '2026-07-28T12:00:00.000Z',
        },
        uploaded: new Date('2026-07-27T12:00:01.000Z'),
        text: () => Promise.resolve('diff contents'),
      }),
    } as unknown as DiffBucket

    await expect(
      loadDiff(bucket, 'AAECAwQFBgcICQoL', {
        now: () => new Date('2026-07-28T11:59:59.999Z'),
      }),
    ).resolves.toEqual({
      diff: 'diff contents',
      createdAt: '2026-07-27T12:00:00.000Z',
      expiresAt: '2026-07-28T12:00:00.000Z',
      source: null,
    })
  })

  it('round-trips GitHub base metadata through R2 custom metadata', async () => {
    const put = vi.fn<MockR2Put>().mockResolvedValue({ key: 'diffs/source' })
    const source = {
      kind: 'github-base' as const,
      owner: 'acme',
      repo: 'widgets',
      baseSha: 'abcdef0123456789abcdef0123456789abcdef01',
    }

    await saveDiff({ put } as unknown as DiffBucket, 'a diff', {
      source,
      now: () => new Date('2026-07-27T12:00:00.000Z'),
      slugFactory: () => 'source-share-slug',
    })

    expect(put).toHaveBeenCalledWith(
      'diffs/source-share-slug',
      'a diff',
      expect.objectContaining({
        customMetadata: expect.objectContaining({
          githubBaseSha: source.baseSha,
          githubRepo: 'acme/widgets',
        }),
      }),
    )

    const bucket = {
      get: vi.fn<MockR2Get>().mockResolvedValue({
        customMetadata: {
          createdAt: '2026-07-27T12:00:00.000Z',
          expiresAt: '2026-07-28T12:00:00.000Z',
          githubBaseSha: source.baseSha,
          githubRepo: 'acme/widgets',
        },
        uploaded: new Date('2026-07-27T12:00:01.000Z'),
        text: () => Promise.resolve('diff contents'),
      }),
    } as unknown as DiffBucket

    await expect(
      loadDiff(bucket, 'AAECAwQFBgcICQoL', {
        now: () => new Date('2026-07-28T11:59:59.999Z'),
      }),
    ).resolves.toMatchObject({ source })
  })

  it('returns null for a missing object', async () => {
    const bucket = {
      get: vi.fn<MockR2Get>().mockResolvedValue(null),
    } as unknown as DiffBucket

    await expect(loadDiff(bucket, 'AAECAwQFBgcICQoL')).resolves.toBeNull()
  })

  it('expires a share exactly at its one-day boundary', async () => {
    const text = vi
      .fn<() => Promise<string>>()
      .mockResolvedValue('diff contents')
    const bucket = {
      get: vi.fn<MockR2Get>().mockResolvedValue({
        customMetadata: {
          createdAt: '2026-07-27T12:00:00.000Z',
          expiresAt: '2026-07-28T12:00:00.000Z',
        },
        uploaded: new Date('2026-07-27T12:00:01.000Z'),
        text,
      }),
    } as unknown as DiffBucket

    await expect(
      loadDiff(bucket, 'AAECAwQFBgcICQoL', {
        now: () => new Date('2026-07-28T12:00:00.000Z'),
      }),
    ).resolves.toBeNull()
    expect(text).not.toHaveBeenCalled()
  })

  it('applies the one-day default to legacy objects', async () => {
    const bucket = {
      get: vi.fn<MockR2Get>().mockResolvedValue({
        customMetadata: {
          createdAt: '2026-07-27T12:00:00.000Z',
        },
        uploaded: new Date('2026-07-27T12:00:01.000Z'),
        text: () => Promise.resolve('diff contents'),
      }),
    } as unknown as DiffBucket

    await expect(
      loadDiff(bucket, 'AAECAwQFBgcICQoL', {
        now: () => new Date('2026-07-28T11:59:59.999Z'),
      }),
    ).resolves.toMatchObject({
      expiresAt: '2026-07-28T12:00:00.000Z',
    })
  })
})
