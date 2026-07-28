import { describe, expect, it, vi } from 'vitest'

import { createSharedDiff } from './create-shared-diff'

type FetchDiffUpload = Parameters<typeof createSharedDiff>[1]

describe('browser diff creation', () => {
  it('uploads the raw diff to /d and returns the share slug', async () => {
    const fetchDiffUpload = vi
      .fn<NonNullable<FetchDiffUpload>>()
      .mockResolvedValue(
        new Response('https://diffdump.example/view/AAECAwQFBgcICQoL\n', {
          status: 201,
        }),
      )

    await expect(createSharedDiff('a diff', fetchDiffUpload)).resolves.toEqual({
      slug: 'AAECAwQFBgcICQoL',
    })
    expect(fetchDiffUpload).toHaveBeenCalledWith('/d', {
      method: 'PUT',
      headers: {
        'Content-Type': 'text/x-diff; charset=utf-8',
      },
      body: 'a diff',
    })
  })

  it('surfaces the rate-limit message returned by /d', async () => {
    const fetchDiffUpload = vi
      .fn<NonNullable<FetchDiffUpload>>()
      .mockResolvedValue(
        new Response('Too many diff shares. Try again in 60 seconds.\n', {
          status: 429,
          headers: {
            'Retry-After': '60',
          },
        }),
      )

    await expect(createSharedDiff('a diff', fetchDiffUpload)).rejects.toThrow(
      'Too many diff shares. Try again in 60 seconds.',
    )
  })

  it('uses a safe fallback when an error response has no body', async () => {
    const fetchDiffUpload = vi
      .fn<NonNullable<FetchDiffUpload>>()
      .mockResolvedValue(new Response(null, { status: 500 }))

    await expect(createSharedDiff('a diff', fetchDiffUpload)).rejects.toThrow(
      'Something went wrong while creating the share link.',
    )
  })

  it('rejects a malformed success response', async () => {
    const fetchDiffUpload = vi
      .fn<NonNullable<FetchDiffUpload>>()
      .mockResolvedValue(
        new Response('https://attacker.example/not-a-share', {
          status: 201,
        }),
      )

    await expect(createSharedDiff('a diff', fetchDiffUpload)).rejects.toThrow(
      'The server returned an invalid share link.',
    )
  })
})
