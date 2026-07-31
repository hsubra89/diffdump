import { describe, expect, it, vi } from 'vitest'

import { MAX_DIFF_BYTES } from '../lib/diffs'
import { handleDiffUpload } from './diff-upload'

type DiffUploadDependencies = Parameters<typeof handleDiffUpload>[1]
type DiffUploadLogger = NonNullable<DiffUploadDependencies['logger']>
type RateLimiter = DiffUploadDependencies['rateLimiter']
type SaveUploadedDiff = DiffUploadDependencies['saveUploadedDiff']

const VALID_DIFF = `diff --git a/hello.ts b/hello.ts
--- a/hello.ts
+++ b/hello.ts
@@ -1 +1 @@
-hello
+hello world
`

describe('PUT /d', () => {
  it('stores stdin exactly and returns the absolute share URL', async () => {
    const rateLimiter = allowingRateLimiter()
    const saveUploadedDiff = vi
      .fn<SaveUploadedDiff>()
      .mockResolvedValue({ slug: 'AAECAwQFBgcICQoL' })
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      headers: {
        'CF-Connecting-IP': '203.0.113.10',
      },
      body: VALID_DIFF,
    })

    const response = await handleDiffUpload(request, {
      rateLimiter,
      saveUploadedDiff,
    })

    expect(response.status).toBe(201)
    expect(response.headers.get('content-type')).toBe(
      'text/plain; charset=utf-8',
    )
    await expect(response.text()).resolves.toBe(
      'https://diffdump.example/view/AAECAwQFBgcICQoL\n',
    )
    expect(saveUploadedDiff).toHaveBeenCalledWith({
      diff: VALID_DIFF,
      source: null,
    })
    expect(rateLimiter.limit).toHaveBeenCalledWith({
      key: 'anonymous-diff:203.0.113.10',
    })
  })

  it('passes validated GitHub base metadata to storage', async () => {
    const saveUploadedDiff = vi
      .fn<SaveUploadedDiff>()
      .mockResolvedValue({ slug: 'AAECAwQFBgcICQoL' })
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      headers: {
        'X-Diffdump-Base-Sha': 'ABCDEF0123456789ABCDEF0123456789ABCDEF01',
        'X-Diffdump-GitHub-Repo': 'acme/widgets',
      },
      body: VALID_DIFF,
    })

    const response = await handleDiffUpload(request, {
      rateLimiter: allowingRateLimiter(),
      saveUploadedDiff,
    })

    expect(response.status).toBe(201)
    expect(saveUploadedDiff).toHaveBeenCalledWith({
      diff: VALID_DIFF,
      source: {
        kind: 'github-base',
        owner: 'acme',
        repo: 'widgets',
        baseSha: 'abcdef0123456789abcdef0123456789abcdef01',
      },
    })
  })

  it('rejects incomplete GitHub base metadata', async () => {
    const saveUploadedDiff = vi.fn<SaveUploadedDiff>()
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      headers: {
        'X-Diffdump-GitHub-Repo': 'acme/widgets',
      },
      body: VALID_DIFF,
    })

    const response = await handleDiffUpload(request, {
      rateLimiter: allowingRateLimiter(),
      saveUploadedDiff,
    })

    expect(response.status).toBe(400)
    await expect(response.text()).resolves.toContain('require both')
    expect(saveUploadedDiff).not.toHaveBeenCalled()
  })

  it('returns 429 with retry guidance before reading or saving the diff', async () => {
    const rateLimiter = {
      limit: vi.fn<RateLimiter['limit']>().mockResolvedValue({
        success: false,
      }),
    }
    const saveUploadedDiff = vi.fn<SaveUploadedDiff>()
    const logger = {
      error: vi.fn<DiffUploadLogger['error']>(),
      warn: vi.fn<DiffUploadLogger['warn']>(),
    }
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      headers: {
        'CF-Connecting-IP': '203.0.113.10',
      },
      body: 'not a diff',
    })

    const response = await handleDiffUpload(request, {
      logger,
      rateLimiter,
      saveUploadedDiff,
    })

    expect(response.status).toBe(429)
    expect(response.headers.get('retry-after')).toBe('60')
    expect(response.headers.get('cache-control')).toBe('no-store')
    await expect(response.text()).resolves.toBe(
      'Too many diff shares. Try again in 60 seconds.\n',
    )
    expect(saveUploadedDiff).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledOnce()
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('"event":"diff_creation_rate_limited"'),
    )
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('not a diff'),
    )
  })

  it('uses one fallback bucket when the Cloudflare client IP is unavailable', async () => {
    const rateLimiter = allowingRateLimiter()
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      body: VALID_DIFF,
    })

    await handleDiffUpload(request, {
      rateLimiter,
      saveUploadedDiff: vi
        .fn<SaveUploadedDiff>()
        .mockResolvedValue({ slug: 'AAECAwQFBgcICQoL' }),
    })

    expect(rateLimiter.limit).toHaveBeenCalledWith({
      key: 'anonymous-diff:unknown-client',
    })
  })

  it('fails closed when the rate limiter is unavailable', async () => {
    const rateLimiter = {
      limit: vi
        .fn<RateLimiter['limit']>()
        .mockRejectedValue(new Error('sensitive binding detail')),
    }
    const saveUploadedDiff = vi.fn<SaveUploadedDiff>()
    const logger = {
      error: vi.fn<DiffUploadLogger['error']>(),
      warn: vi.fn<DiffUploadLogger['warn']>(),
    }
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      body: VALID_DIFF,
    })

    const response = await handleDiffUpload(request, {
      logger,
      rateLimiter,
      saveUploadedDiff,
    })

    expect(response.status).toBe(503)
    expect(response.headers.get('retry-after')).toBe('60')
    await expect(response.text()).resolves.toBe(
      'Diff sharing is temporarily unavailable. Please try again soon.\n',
    )
    expect(saveUploadedDiff).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('"event":"diff_creation_rate_limit_error"'),
    )
  })

  it('returns a useful shell error for malformed input', async () => {
    const saveUploadedDiff = vi.fn<SaveUploadedDiff>()
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      body: 'not a diff',
    })

    const response = await handleDiffUpload(request, {
      rateLimiter: allowingRateLimiter(),
      saveUploadedDiff,
    })

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

    const response = await handleDiffUpload(request, {
      rateLimiter: allowingRateLimiter(),
      saveUploadedDiff,
    })

    expect(response.status).toBe(413)
    await expect(response.text()).resolves.toContain('2 MiB')
    expect(saveUploadedDiff).not.toHaveBeenCalled()
  })

  it('cancels a chunked upload as soon as it crosses the size limit', async () => {
    const saveUploadedDiff = vi.fn<SaveUploadedDiff>()
    const cancel = vi.fn<UnderlyingSourceCancelCallback>()
    const request = streamingRequest(
      [
        new Uint8Array(MAX_DIFF_BYTES),
        new Uint8Array([0]),
        new TextEncoder().encode(VALID_DIFF),
      ],
      cancel,
    )

    const response = await handleDiffUpload(request, {
      rateLimiter: allowingRateLimiter(),
      saveUploadedDiff,
    })

    expect(response.status).toBe(413)
    await expect(response.text()).resolves.toContain('2 MiB')
    expect(cancel).toHaveBeenCalledOnce()
    expect(saveUploadedDiff).not.toHaveBeenCalled()
  })

  it('preserves a chunked diff split inside a multibyte character', async () => {
    const diff = VALID_DIFF.replace('hello world', 'hello 🌎')
    const encodedDiff = new TextEncoder().encode(diff)
    const multibyteStart = encodedDiff.indexOf(0xf0)
    const request = streamingRequest([
      encodedDiff.subarray(0, multibyteStart + 2),
      encodedDiff.subarray(multibyteStart + 2),
    ])
    const saveUploadedDiff = vi
      .fn<SaveUploadedDiff>()
      .mockResolvedValue({ slug: 'AAECAwQFBgcICQoL' })

    const response = await handleDiffUpload(request, {
      rateLimiter: allowingRateLimiter(),
      saveUploadedDiff,
    })

    expect(response.status).toBe(201)
    expect(saveUploadedDiff).toHaveBeenCalledWith({
      diff,
      source: null,
    })
  })

  it('does not expose storage errors', async () => {
    const request = new Request('https://diffdump.example/d', {
      method: 'PUT',
      body: VALID_DIFF,
    })

    const response = await handleDiffUpload(request, {
      rateLimiter: allowingRateLimiter(),
      saveUploadedDiff: async () => {
        throw new Error('sensitive storage detail')
      },
    })

    expect(response.status).toBe(500)
    await expect(response.text()).resolves.toBe(
      'The share link could not be created. Please try again.\n',
    )
  })
})

function allowingRateLimiter(): RateLimiter {
  return {
    limit: vi.fn<RateLimiter['limit']>().mockResolvedValue({
      success: true,
    }),
  }
}

function streamingRequest(
  chunks: Uint8Array[],
  cancel?: UnderlyingSourceCancelCallback,
): Request {
  let index = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const chunk = chunks[index]
      index += 1

      if (chunk) {
        controller.enqueue(chunk)
      } else {
        controller.close()
      }
    },
    cancel,
  })

  return new Request('https://diffdump.example/d', {
    method: 'PUT',
    body,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' })
}
