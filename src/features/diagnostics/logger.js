const SAFE_DIAGNOSTIC_MESSAGES = Object.freeze({
  'invalid-api-base': 'Invalid API base; using same-origin fallback',
  'malformed-websocket-message': 'Ignored malformed WebSocket message',
  'polling-failed': 'Job polling attempt failed',
  'realtime-failed': 'Realtime session stopped after a client error',
  'upload-failed': 'Video upload request failed',
})

function noop() {}

export function createDiagnosticLogger({ enabled = false, sink = noop } = {}) {
  return Object.freeze({
    warn(eventName) {
      if (!enabled) return

      const message = SAFE_DIAGNOSTIC_MESSAGES[eventName]
      if (!message) return
      sink(`[Sigma Sign] ${message}`)
    },
  })
}

const developmentSink = import.meta.env.DEV ? (message) => console.warn(message) : noop

export const diagnostics = createDiagnosticLogger({
  enabled: import.meta.env.DEV,
  sink: developmentSink,
})
