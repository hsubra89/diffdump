import {
  DEFAULT_DIFF_TTL_MS,
  generateShareSlug,
  type StoredDiff,
} from './diffs'

const OBJECT_PREFIX = 'diffs/'
const MAX_SLUG_ATTEMPTS = 5

type DiffBucket = Pick<R2Bucket, 'get' | 'put'>

type SaveDiffOptions = {
  now?: () => Date
  slugFactory?: () => string
  ttlMs?: number
}

type LoadDiffOptions = {
  now?: () => Date
}

export async function saveDiff(
  bucket: DiffBucket,
  diff: string,
  options: SaveDiffOptions = {},
): Promise<{ slug: string }> {
  const now = options.now ?? (() => new Date())
  const slugFactory = options.slugFactory ?? generateShareSlug
  const ttlMs = options.ttlMs ?? DEFAULT_DIFF_TTL_MS

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const slug = slugFactory()
    const createdAtDate = now()
    const createdAt = createdAtDate.toISOString()
    const expiresAt = new Date(createdAtDate.getTime() + ttlMs).toISOString()
    const stored = await bucket.put(objectKey(slug), diff, {
      onlyIf: {
        etagDoesNotMatch: '*',
      },
      httpMetadata: {
        contentType: 'text/x-diff; charset=utf-8',
      },
      customMetadata: {
        createdAt,
        expiresAt,
        schemaVersion: '2',
      },
    })

    if (stored) {
      return { slug }
    }
  }

  throw new Error('Could not create a unique share link. Please try again.')
}

export async function loadDiff(
  bucket: DiffBucket,
  slug: string,
  options: LoadDiffOptions = {},
): Promise<StoredDiff | null> {
  const object = await bucket.get(objectKey(slug))

  if (!object) {
    return null
  }

  const createdAt = resolveCreatedAt(object)
  const expiresAt = resolveExpiresAt(object, createdAt)
  const now = options.now ?? (() => new Date())

  if (now().getTime() >= expiresAt.getTime()) {
    return null
  }

  return {
    diff: await object.text(),
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  }
}

function objectKey(slug: string): string {
  return `${OBJECT_PREFIX}${slug}`
}

function resolveCreatedAt(object: R2ObjectBody): Date {
  return parseDate(object.customMetadata?.createdAt) ?? object.uploaded
}

function resolveExpiresAt(object: R2ObjectBody, createdAt: Date): Date {
  return (
    parseDate(object.customMetadata?.expiresAt) ??
    new Date(createdAt.getTime() + DEFAULT_DIFF_TTL_MS)
  )
}

function parseDate(value: string | undefined): Date | null {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
