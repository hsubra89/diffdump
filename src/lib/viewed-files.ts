export const VIEWED_FILES_STORAGE_KEY_PREFIX = 'diffdump.viewed-files.v1:'

export function createViewedFilesStorageKey(reviewId: string): string {
  return `${VIEWED_FILES_STORAGE_KEY_PREFIX}${encodeURIComponent(reviewId)}`
}

export function readStoredViewedFileIds(reviewId: string): string[] {
  try {
    const stored = globalThis.localStorage?.getItem(
      createViewedFilesStorageKey(reviewId),
    )

    if (stored === null || stored === undefined) {
      return []
    }

    const parsed: unknown = JSON.parse(stored)
    return normalizeFileIds(parsed)
  } catch {
    return []
  }
}

export function writeStoredViewedFileIds(
  reviewId: string,
  fileIds: Iterable<string>,
): void {
  try {
    const storageKey = createViewedFilesStorageKey(reviewId)
    const normalized = normalizeFileIds([...fileIds]).sort()

    if (normalized.length === 0) {
      globalThis.localStorage?.removeItem(storageKey)
      return
    }

    globalThis.localStorage?.setItem(storageKey, JSON.stringify(normalized))
  } catch {
    // Reviewing still works when storage is unavailable or full.
  }
}

function normalizeFileIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return [
    ...new Set(
      value.filter(
        (fileId): fileId is string =>
          typeof fileId === 'string' && fileId.length > 0,
      ),
    ),
  ]
}
