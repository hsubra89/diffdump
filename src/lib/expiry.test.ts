import { describe, expect, it } from 'vitest'

import {
  formatAbsoluteExpiry,
  formatExpiryCountdown,
  getExpiryCountdownUpdateDelay,
} from './expiry'

const NOW = Date.parse('2026-07-27T12:00:00.000Z')

describe('expiry countdowns', () => {
  it('uses the largest useful time unit without expiring early', () => {
    expect(
      formatExpiryCountdown(
        new Date(NOW + 23 * 60 * 60 * 1_000 + 60 * 1_000).toISOString(),
        NOW,
        'en',
      ),
    ).toBe('Expires in 24 hours')

    expect(
      formatExpiryCountdown(
        new Date(NOW + 59 * 60 * 1_000 + 1_000).toISOString(),
        NOW,
        'en',
      ),
    ).toBe('Expires in 60 minutes')

    expect(
      formatExpiryCountdown(
        new Date(NOW + 42 * 1_000).toISOString(),
        NOW,
        'en',
      ),
    ).toBe('Expires in 42 seconds')
  })

  it('reports expired and invalid timestamps', () => {
    expect(
      formatExpiryCountdown(new Date(NOW).toISOString(), NOW, 'en'),
    ).toBe('Expired')
    expect(formatExpiryCountdown('not-a-date', NOW, 'en')).toBe(
      'Expiration unavailable',
    )
  })

  it('schedules updates when the displayed label will change', () => {
    const expiry = new Date(NOW + 42_200).toISOString()

    expect(getExpiryCountdownUpdateDelay(expiry, NOW)).toBe(250)
    expect(
      getExpiryCountdownUpdateDelay(
        new Date(NOW + 60 * 60 * 1_000).toISOString(),
        NOW,
      ),
    ).toBe(250)
    expect(getExpiryCountdownUpdateDelay(new Date(NOW).toISOString(), NOW)).toBe(
      null,
    )
  })
})

describe('absolute expiry timestamps', () => {
  it('formats the exact expiry in the requested local timezone', () => {
    const formatted = formatAbsoluteExpiry(
      '2026-07-27T12:00:00.000Z',
      'en-US',
      'UTC',
    )

    expect(formatted).toContain('Monday, July 27, 2026')
    expect(formatted).toContain('12:00:00 PM')
    expect(formatted).toContain('UTC')
  })
})
