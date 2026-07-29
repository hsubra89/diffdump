import { MAX_DIFF_BYTES, validateCreateDiffInput } from '../lib/diffs'

type SaveUploadedDiff = (diff: string) => Promise<{ slug: string }>
type DiffCreationRateLimiter = Pick<RateLimit, 'limit'>
type DiffUploadLogger = Pick<Console, 'error' | 'warn'>

type DiffUploadDependencies = {
  logger?: DiffUploadLogger
  rateLimiter: DiffCreationRateLimiter
  saveUploadedDiff: SaveUploadedDiff
}

export const DIFF_CREATION_RATE_LIMIT_PERIOD_SECONDS = 60

const RATE_LIMITED_MESSAGE = 'Too many diff shares. Try again in 60 seconds.'
const RATE_LIMIT_UNAVAILABLE_MESSAGE =
  'Diff sharing is temporarily unavailable. Please try again soon.'
const DIFF_TOO_LARGE_MESSAGE =
  'This diff is larger than the 2 MiB sharing limit.'

export async function handleDiffUpload(
  request: Request,
  { logger = console, rateLimiter, saveUploadedDiff }: DiffUploadDependencies,
): Promise<Response> {
  let isAllowed: boolean

  try {
    const clientAddress =
      request.headers.get('CF-Connecting-IP') ?? 'unknown-client'
    const outcome = await rateLimiter.limit({
      key: `anonymous-diff:${clientAddress}`,
    })
    isAllowed = outcome.success
  } catch {
    logger.error(
      JSON.stringify({
        event: 'diff_creation_rate_limit_error',
        colo: request.cf?.colo ?? 'unknown',
      }),
    )

    return textResponse(RATE_LIMIT_UNAVAILABLE_MESSAGE, 503, {
      'Retry-After': String(DIFF_CREATION_RATE_LIMIT_PERIOD_SECONDS),
    })
  }

  if (!isAllowed) {
    logger.warn(
      JSON.stringify({
        event: 'diff_creation_rate_limited',
        colo: request.cf?.colo ?? 'unknown',
      }),
    )

    return textResponse(RATE_LIMITED_MESSAGE, 429, {
      'Retry-After': String(DIFF_CREATION_RATE_LIMIT_PERIOD_SECONDS),
    })
  }

  const contentLength = Number(request.headers.get('content-length'))

  if (Number.isFinite(contentLength) && contentLength > MAX_DIFF_BYTES) {
    await cancelBody(request.body)

    return textResponse(DIFF_TOO_LARGE_MESSAGE, 413)
  }

  const body = await readBodyWithinLimit(request.body, MAX_DIFF_BYTES)

  if (!body) {
    return textResponse(DIFF_TOO_LARGE_MESSAGE, 413)
  }

  let diff: string

  try {
    diff = validateCreateDiffInput({
      diff: new TextDecoder().decode(body),
    }).diff
  } catch (error) {
    return textResponse(
      error instanceof Error ? error.message : 'The diff could not be read.',
      400,
    )
  }

  try {
    const { slug } = await saveUploadedDiff(diff)
    const shareUrl = new URL(`/view/${slug}`, request.url)

    return textResponse(shareUrl.toString(), 201)
  } catch {
    return textResponse(
      'The share link could not be created. Please try again.',
      500,
    )
  }
}

async function readBodyWithinLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!body) {
    return new Uint8Array()
  }

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let byteLength = 0

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        break
      }

      if (value.byteLength > maxBytes - byteLength) {
        await cancelReader(reader)
        return null
      }

      chunks.push(value)
      byteLength += value.byteLength
    }
  } finally {
    reader.releaseLock()
  }

  const result = new Uint8Array(byteLength)
  let offset = 0

  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }

  return result
}

async function cancelBody(body: ReadableStream<Uint8Array> | null) {
  try {
    await body?.cancel(DIFF_TOO_LARGE_MESSAGE)
  } catch {
    // The response should remain a 413 even if the client stream cannot cancel.
  }
}

async function cancelReader(reader: ReadableStreamDefaultReader<Uint8Array>) {
  try {
    await reader.cancel(DIFF_TOO_LARGE_MESSAGE)
  } catch {
    // The response should remain a 413 even if the client stream cannot cancel.
  }
}

function textResponse(
  message: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return new Response(`${message}\n`, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...headers,
    },
  })
}
