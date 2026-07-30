import { describe, expect, it } from 'vitest'

import { getCanonicalRedirect } from './canonical-domain'

describe('getCanonicalRedirect', () => {
  it('permanently redirects www URLs to the apex domain', () => {
    const response = getCanonicalRedirect(
      'https://www.diffdump.com/org/repo/pull/123?view=split&file=src%2Fapp.ts',
    )

    expect(response?.status).toBe(301)
    expect(response?.headers.get('location')).toBe(
      'https://diffdump.com/org/repo/pull/123?view=split&file=src%2Fapp.ts',
    )
  })

  it('does not redirect the canonical domain', () => {
    expect(
      getCanonicalRedirect('https://diffdump.com/view/example'),
    ).toBeUndefined()
  })

  it('does not redirect unrelated domains', () => {
    expect(
      getCanonicalRedirect('https://www.example.com/view/example'),
    ).toBeUndefined()
  })
})
