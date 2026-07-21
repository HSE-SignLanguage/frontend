import { diagnostics } from '../diagnostics/logger'

const FALLBACK_API_BASE = '/api/'

function getOrigin() {
  return window.location.origin
}

function getApiBaseUrl() {
  const configuredBase = import.meta.env.VITE_API_BASE_URL?.trim()
  const baseValue = configuredBase || FALLBACK_API_BASE

  try {
    const url = new URL(baseValue, getOrigin())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Unsupported API protocol: ${url.protocol}`)
    }

    url.pathname = `${url.pathname.replace(/\/+$/, '')}/`
    url.search = ''
    url.hash = ''
    return url
  } catch {
    diagnostics.warn('invalid-api-base')
    return new URL(FALLBACK_API_BASE, getOrigin())
  }
}

export function getApiUrl(endpoint) {
  const relativeEndpoint = String(endpoint).replace(/^\/+/, '')
  return new URL(relativeEndpoint, getApiBaseUrl()).toString()
}

export function getWsUrl(endpoint = 'socket') {
  const url = new URL(getApiUrl(endpoint))
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}
