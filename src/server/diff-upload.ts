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
    return textResponse(
      'This diff is larger than the 2 MiB sharing limit.',
      413,
    )
  }

  const body = await request.arrayBuffer()

  if (body.byteLength > MAX_DIFF_BYTES) {
    return textResponse(
      'This diff is larger than the 2 MiB sharing limit.',
      413,
    )
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
