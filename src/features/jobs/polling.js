const TERMINAL_CLIENT_STATUSES = new Set([400, 401, 403, 404, 422])

export function isTerminalPollingStatus(status) {
  return TERMINAL_CLIENT_STATUSES.has(status)
}

export function getRetryAfterDelay(retryAfter, fallbackDelay, now = Date.now(), maxDelay = 60_000) {
  if (typeof retryAfter !== 'string' || retryAfter.trim() === '') {
    return fallbackDelay
  }

  const rawValue = retryAfter.trim()
  const seconds = Number(rawValue)
  const requestedDelay = Number.isFinite(seconds) ? seconds * 1_000 : Date.parse(rawValue) - now

  if (!Number.isFinite(requestedDelay) || requestedDelay < 0) {
    return fallbackDelay
  }

  return Math.min(Math.max(Math.ceil(requestedDelay), 1_000), maxDelay)
}
