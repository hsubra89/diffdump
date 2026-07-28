export const MAX_DIFF_BYTES = 2 * 1024 * 1024
export const DEFAULT_DIFF_TTL_MS = 24 * 60 * 60 * 1000
export const SHARE_SLUG_BYTES = 12
export const SHARE_SLUG_LENGTH = 16

const BASE64_URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

export type CreateDiffInput = {
  diff: string
}

export type StoredDiff = {
  diff: string
  createdAt: string
  expiresAt: string
}

export function validateCreateDiffInput(input: unknown): CreateDiffInput {
  if (
    typeof input !== 'object' ||
    input === null ||
    !('diff' in input) ||
    typeof input.diff !== 'string'
  ) {
    throw new Error('Paste a git diff to continue.')
  }

  const diff = input.diff

  if (diff.trim().length === 0) {
    throw new Error('Paste a git diff to continue.')
  }

  const byteLength = new TextEncoder().encode(diff).byteLength
  if (byteLength > MAX_DIFF_BYTES) {
    throw new Error('This diff is larger than the 2 MiB sharing limit.')
  }

  if (!looksLikeUnifiedDiff(diff)) {
    throw new Error(
      'This does not look like a renderable unified git diff. Include file headers and at least one hunk.',
    )
  }

  return { diff }
}

export function validateShareSlug(input: unknown): string {
  if (
    typeof input !== 'string' ||
    !new RegExp(`^[A-Za-z0-9_-]{${SHARE_SLUG_LENGTH}}$`).test(input)
  ) {
    throw new Error('Invalid share link.')
  }

  return input
}

export function generateShareSlug(
  randomBytes: (
    target: Uint8Array<ArrayBuffer>,
  ) => Uint8Array<ArrayBuffer> = (target) => crypto.getRandomValues(target),
): string {
  const bytes = randomBytes(new Uint8Array(SHARE_SLUG_BYTES))
  return encodeBase64Url(bytes)
}

export function looksLikeUnifiedDiff(diff: string): boolean {
  const hasOldFile = /^---\s+\S+/m.test(diff)
  const hasNewFile = /^\+\+\+\s+\S+/m.test(diff)
  const hasHunk = /^@@\s+-\d+(?:,\d+)?\s+\+\d+(?:,\d+)?\s+@@/m.test(diff)

  return hasOldFile && hasNewFile && hasHunk
}

function encodeBase64Url(bytes: Uint8Array): string {
  let result = ''

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index] ?? 0
    const second = bytes[index + 1] ?? 0
    const third = bytes[index + 2] ?? 0

    result += BASE64_URL_ALPHABET[first >> 2]
    result += BASE64_URL_ALPHABET[((first & 0b11) << 4) | (second >> 4)]

    if (index + 1 < bytes.length) {
      result +=
        BASE64_URL_ALPHABET[((second & 0b1111) << 2) | (third >> 6)]
    }

    if (index + 2 < bytes.length) {
      result += BASE64_URL_ALPHABET[third & 0b111111]
    }
  }

  return result
}
