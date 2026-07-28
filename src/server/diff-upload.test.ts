import { describe, expect, it, vi } from 'vitest'

import { MAX_DIFF_BYTES } from '../lib/diffs'
import { handleDiffUpload } from './diff-upload'

type SaveUploadedDiff = Parameters<typeof handleDiffUpload>[1]

const VALID_DIFF = `diff --git a/hello.ts b/hello.ts
--- a/hello.ts
+++ b/hello.ts
@@ -1 +1 @@
-hello
+hello world
`

describe('PUT /d', () => {
  it('stores stdin exactly and returns the absolute share URL', async () => {
    const saveUploadedDiff = vi
      .fn<SaveUploadedDiff>()
      .mockResolvedValue({ slug: 'AAECAwQFBgcICQoL' })
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      body: VALID_DIFF,
    })

    const response = await handleDiffUpload(request, saveUploadedDiff)

    expect(response.status).toBe(201)
    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8',
    )
    await expect(response.text()).resolves.toBe(
      'https://diffdump.example/view/AAECAwQFBgcICQoL\n',
    )
    expect(saveUploadedDiff).toHaveBeenCalledWith(VALID_DIFF)
  })

  it('returns a useful shell error for malformed input', async () => {
    const saveUploadedDiff = vi.fn<SaveUploadedDiff>()
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      body: 'not a diff',
    })

    const response = await handleDiffUpload(request, saveUploadedDiff)

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toContain(
      'renderable unified git diff',
    )
    expect(saveUploadedDiff).not.toHaveBeenCalled()
  })

  it('rejects oversized content before saving it', async () => {
    const saveUploadedDiff = vi.fn<SaveUploadedDiff>()
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      headers: {
        'Content-Length': String(MAX_DIFF_BYTES + 1),
      },
      body: VALID_DIFF,
    })

    const response = await handleDiffUpload(request, saveUploadedDiff)

    expect(response.status).toBe(413)
    await expect(response.text()).resolves.toContain('2 MiB')
    expect(saveUploadedDiff).not.toHaveBeenCalled()
  })

  it('does not expose storage errors', async () => {
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      body: VALID_DIFF,
    })

    const response = await handleDiffUpload(request, async () => {
      throw new Error('sensitive storage detail')
    })

    expect(response.status).toBe(500)
    await expect(response.text()).resolves.toBe(
      'The share link could not be created. Please try again.\n',
    )
  })
})
