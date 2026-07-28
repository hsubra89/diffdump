const SECOND_MS = 1_000
const MINUTE_MS = 60 * SECOND_MS
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS
const MINIMUM_UPDATE_DELAY_MS = 250

type RelativeTimeUnit = 'second' | 'minute' | 'hour' | 'day'

type CountdownUnit = {
  milliseconds: number
  name: RelativeTimeUnit
}

export function formatExpiryCountdown(
  expiresAt: string,
  nowMs = Date.now(),
  locales?: Intl.LocalesArgument,
): string {
  const remainingMs = getRemainingMilliseconds(expiresAt, nowMs)

  if (remainingMs === null) {
    return 'Expiration unavailable'
  }

  if (remainingMs <= 0) {
    return 'Expired'
  }

  const unit = getCountdownUnit(remainingMs)
  const amount = Math.ceil(remainingMs / unit.milliseconds)
  const relativeTime = new Intl.RelativeTimeFormat(locales, {
    numeric: 'always',
  }).format(amount, unit.name)

  return `Expires ${relativeTime}`
}

export function getExpiryCountdownUpdateDelay(
  expiresAt: string,
  nowMs = Date.now(),
): number | null {
  const remainingMs = getRemainingMilliseconds(expiresAt, nowMs)

  if (remainingMs === null || remainingMs <= 0) {
    return null
  }

  const unit = getCountdownUnit(remainingMs)
  const amount = Math.ceil(remainingMs / unit.milliseconds)
  const untilNextCount = remainingMs - (amount - 1) * unit.milliseconds
  const untilSmallerUnit =
    unit.name === 'second' ? remainingMs : remainingMs - unit.milliseconds
  const untilNextLabel = Math.min(untilNextCount, untilSmallerUnit)

  return Math.max(MINIMUM_UPDATE_DELAY_MS, Math.ceil(untilNextLabel) + 25)
}

export function formatAbsoluteExpiry(
  expiresAt: string,
  locales?: Intl.LocalesArgument,
  timeZone?: string,
): string {
  const date = new Date(expiresAt)

  if (!Number.isFinite(date.getTime())) {
    return 'Expiration time unavailable'
  }

  const formatter = new Intl.DateTimeFormat(locales, {
    dateStyle: 'full',
    timeStyle: 'medium',
    ...(timeZone ? { timeZone } : {}),
  })

  return `${formatter.format(date)} (${formatter.resolvedOptions().timeZone})`
}

function getRemainingMilliseconds(
  expiresAt: string,
  nowMs: number,
): number | null {
  const expiresAtMs = new Date(expiresAt).getTime()

  if (!Number.isFinite(expiresAtMs)) {
    return null
  }

  return expiresAtMs - nowMs
}

function getCountdownUnit(remainingMs: number): CountdownUnit {
  if (remainingMs < MINUTE_MS) {
    return { milliseconds: SECOND_MS, name: 'second' }
  }

  if (remainingMs < HOUR_MS) {
    return { milliseconds: MINUTE_MS, name: 'minute' }
  }

  if (remainingMs < DAY_MS) {
    return { milliseconds: HOUR_MS, name: 'hour' }
  }

  return { milliseconds: DAY_MS, name: 'day' }
}
