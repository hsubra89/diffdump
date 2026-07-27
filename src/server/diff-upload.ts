import { MAX_DIFF_BYTES, validateCreateDiffInput } from '../lib/diffs'

type SaveUploadedDiff = (diff: string) => Promise<{ slug: string }>

export async function handleDiffUpload(
  request: Request,
  saveUploadedDiff: SaveUploadedDiff,
): Promise<Response> {
  const contentLength = Number(request.headers.get('content-length'))

  if (Number.isFinite(contentLength) && contentLength > MAX_DIFF_BYTES) {
    return textResponse('This diff is larger than the 2 MiB sharing limit.', 413)
  }

  const body = await request.arrayBuffer()

  if (body.byteLength > MAX_DIFF_BYTES) {
    return textResponse('This diff is larger than the 2 MiB sharing limit.', 413)
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

function textResponse(message: string, status: number): Response {
  return new Response(`${message}\n`, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
