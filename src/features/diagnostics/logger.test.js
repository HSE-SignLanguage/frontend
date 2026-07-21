import { describe, expect, it, vi } from 'vitest'

import { createDiagnosticLogger } from './logger'

describe('diagnostic logger', () => {
  it('keeps production diagnostics silent', () => {
    const sink = vi.fn()
    const logger = createDiagnosticLogger({ enabled: false, sink })

    logger.warn('upload-failed')

    expect(sink).not.toHaveBeenCalled()
  })

  it('logs only allow-listed messages without attached payloads', () => {
    const sink = vi.fn()
    const logger = createDiagnosticLogger({ enabled: true, sink })

    logger.warn('upload-failed')
    logger.warn('server-response-with-sensitive-data')

    expect(sink).toHaveBeenCalledOnce()
    expect(sink).toHaveBeenCalledWith('[Sigma Sign] Video upload request failed')
  })
})
