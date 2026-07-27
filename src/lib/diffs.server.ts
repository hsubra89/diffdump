import { generateShareSlug, type StoredDiff } from './diffs'

const OBJECT_PREFIX = 'diffs/'
const MAX_SLUG_ATTEMPTS = 5

type DiffBucket = Pick<R2Bucket, 'get' | 'put'>

type SaveDiffOptions = {
  now?: () => Date
  slugFactory?: () => string
}

export async function saveDiff(
  bucket: DiffBucket,
  diff: string,
  options: SaveDiffOptions = {},
): Promise<{ slug: string }> {
  const now = options.now ?? (() => new Date())
  const slugFactory = options.slugFactory ?? generateShareSlug

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt += 1) {
    const slug = slugFactory()
    const createdAt = now().toISOString()
    const stored = await bucket.put(objectKey(slug), diff, {
      onlyIf: {
        etagDoesNotMatch: '*',
      },
      httpMetadata: {
        contentType: 'text/x-diff; charset=utf-8',
      },
      customMetadata: {
        createdAt,
        schemaVersion: '1',
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
): Promise<StoredDiff | null> {
  const object = await bucket.get(objectKey(slug))

  if (!object) {
    return null
  }

  return {
    diff: await object.text(),
    createdAt: object.customMetadata?.createdAt ?? object.uploaded.toISOString(),
  }
}

function objectKey(slug: string): string {
  return `${OBJECT_PREFIX}${slug}`
}
