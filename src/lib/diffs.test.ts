import { describe, expect, it } from 'vitest'

import {
  MAX_DIFF_BYTES,
  generateShareSlug,
  looksLikeUnifiedDiff,
  validateCreateDiffInput,
  validateShareSlug,
} from './diffs'

const VALID_DIFF = `diff --git a/hello.ts b/hello.ts
index ce01362..cc628cc 100644
--- a/hello.ts
+++ b/hello.ts
@@ -1 +1 @@
-hello
+hello world
`

describe('diff input validation', () => {
  it('accepts a unified git diff without changing it', () => {
    expect(validateCreateDiffInput({ diff: VALID_DIFF })).toEqual({
      diff: VALID_DIFF,
    })
  })

  it('rejects empty, malformed, and oversized input', () => {
    expect(() => validateCreateDiffInput({ diff: '  ' })).toThrow(
      'Paste a git diff',
    )
    expect(() => validateCreateDiffInput({ diff: 'not a diff' })).toThrow(
      'renderable unified git diff',
    )
    expect(() =>
      validateCreateDiffInput({ diff: 'x'.repeat(MAX_DIFF_BYTES + 1) }),
    ).toThrow('2 MiB')
  })
})

describe('share slugs', () => {
  it('encodes 96 random bits as a 16-character base64url slug', () => {
    const slug = generateShareSlug((target) => {
      target.set(Array.from({ length: target.length }, (_, index) => index))
      return target
    })

    expect(slug).toBe('AAECAwQFBgcICQoL')
    expect(validateShareSlug(slug)).toBe(slug)
  })

  it('rejects invalid share slugs', () => {
    expect(() => validateShareSlug('too-short')).toThrow('Invalid share link')
    expect(() => validateShareSlug('AAAAAAAAAAAAAAA!')).toThrow(
      'Invalid share link',
    )
  })
})

describe('unified diff detection', () => {
  it('requires old/new file headers and a hunk', () => {
    expect(looksLikeUnifiedDiff(VALID_DIFF)).toBe(true)
    expect(looksLikeUnifiedDiff('--- a/file\\n+++ b/file\\n')).toBe(false)
  })
})
