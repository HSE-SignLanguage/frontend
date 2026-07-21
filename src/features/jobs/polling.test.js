import { describe, expect, it } from 'vitest'

import { getRetryAfterDelay, isTerminalPollingStatus } from './polling'

describe('job polling helpers', () => {
  it.each([400, 401, 403, 404, 422])('treats %i as terminal', (status) => {
    expect(isTerminalPollingStatus(status)).toBe(true)
  })

  it('keeps transient and rate-limit statuses retryable', () => {
    expect(isTerminalPollingStatus(429)).toBe(false)
    expect(isTerminalPollingStatus(503)).toBe(false)
  })

  it('parses Retry-After seconds and dates', () => {
    const now = Date.parse('2026-07-21T10:00:00Z')

    expect(getRetryAfterDelay('3', 2_000, now)).toBe(3_000)
    expect(getRetryAfterDelay('Tue, 21 Jul 2026 10:00:05 GMT', 2_000, now)).toBe(5_000)
  })

  it('falls back for invalid values and caps excessive delays', () => {
    expect(getRetryAfterDelay('later', 4_000)).toBe(4_000)
    expect(getRetryAfterDelay('3600', 4_000)).toBe(60_000)
  })
})
