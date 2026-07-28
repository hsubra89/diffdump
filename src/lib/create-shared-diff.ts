import { validateShareSlug } from './diffs'

type FetchDiffUpload = (input: string, init: RequestInit) => Promise<Response>

const CREATE_FAILED_MESSAGE =
  'Something went wrong while creating the share link.'
const INVALID_SHARE_LINK_MESSAGE = 'The server returned an invalid share link.'

export async function createSharedDiff(
  diff: string,
  fetchDiffUpload: FetchDiffUpload = fetch,
): Promise<{ slug: string }> {
  const response = await fetchDiffUpload('/d', {
    method: 'PUT',
    headers: {
      'Content-Type': 'text/x-diff; charset=utf-8',
    },
    body: diff,
  })
  const message = (await response.text()).trim()

  if (!response.ok) {
    throw new Error(message || CREATE_FAILED_MESSAGE)
  }

  try {
    const shareUrl = new URL(message)
    const match = /^\/view\/([^/]+)$/.exec(shareUrl.pathname)

    return {
      slug: validateShareSlug(match?.[1]),
    }
  } catch {
    throw new Error(INVALID_SHARE_LINK_MESSAGE)
  }
}
