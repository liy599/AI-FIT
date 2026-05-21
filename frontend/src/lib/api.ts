import { clearAuth } from './auth'

function resolveDefaultApiBase() {
  if (typeof window === 'undefined') return 'http://localhost:5000'
  return `${window.location.protocol}//${window.location.hostname}:5000`
}

function normalizeLoopbackApiBase(base: string) {
  if (typeof window === 'undefined') return base
  let parsed: URL
  try {
    parsed = new URL(base)
  } catch {
    return base
  }
  const loopbacks = new Set(['localhost', '127.0.0.1'])
  const currentHost = window.location.hostname
  if (loopbacks.has(parsed.hostname) && loopbacks.has(currentHost) && parsed.hostname !== currentHost) {
    parsed.hostname = currentHost
    parsed.protocol = window.location.protocol
    return parsed.toString().replace(/\/$/, '')
  }
  return base
}

export const API_BASE = normalizeLoopbackApiBase(import.meta.env.VITE_API_BASE ?? resolveDefaultApiBase())

function stripApiSuffix(base: string) {
  return base.endsWith('/api') ? base.slice(0, -4) : base
}

export type ApiError = { error?: string; msg?: string; message?: string; retry_after?: number }
const AUTH_EXPIRED_EVENT = 'aifit:auth-expired'

function buildUrl(path: string) {
  const base = API_BASE.replace(/\/+$/, '')
  const p0 = path.startsWith('/') ? path : `/${path}`
  const p =
    base.endsWith('/api') && (p0 === '/api' || p0.startsWith('/api/'))
      ? p0 === '/api'
        ? ''
        : p0.slice(4)
      : p0
  return `${base}${p}`
}

export function resolveBackendUrl(path: string) {
  if (!path) return path
  if (
    path.startsWith('http://') ||
    path.startsWith('https://') ||
    path.startsWith('data:') ||
    path.startsWith('blob:')
  ) {
    return path
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const base = API_BASE.replace(/\/+$/, '')

  if (normalizedPath === '/api' || normalizedPath.startsWith('/api/')) {
    return buildUrl(normalizedPath)
  }

  return `${stripApiSuffix(base)}${normalizedPath}`
}

function buildHeaders(options?: RequestInit & { auth?: boolean }) {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined)
  }

  return headers
}

function readCookie(name: string) {
  if (typeof document === 'undefined') return ''
  const key = `${name}=`
  const found = document.cookie.split(';').map((v) => v.trim()).find((v) => v.startsWith(key))
  return found ? decodeURIComponent(found.slice(key.length)) : ''
}

function isMutationMethod(method: string | undefined) {
  const upper = (method ?? 'GET').toUpperCase()
  return upper !== 'GET' && upper !== 'HEAD' && upper !== 'OPTIONS'
}

async function throwIfNotOk(res: Response) {
  if (res.ok) return
  const text = await res.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text) as unknown
    } catch {
      data = null
    }
  }
  throw new Error(extractErrorMessage(data, res))
}

function extractErrorMessage(data: unknown, res: Response) {
  if (typeof data === 'object' && data) {
    const apiError = data as ApiError
    const retryMessage = formatRetryAfterMessage(apiError)
    if (retryMessage) return retryMessage
    if (typeof apiError.error === 'string' && apiError.error.trim()) return apiError.error
    if (typeof apiError.msg === 'string' && apiError.msg.trim()) return apiError.msg
    if (typeof apiError.message === 'string' && apiError.message.trim()) return apiError.message
  }
  return res.statusText || `Request failed (${res.status})`
}

function formatRetryAfterMessage(apiError: ApiError) {
  const raw = apiError.error ?? apiError.msg ?? apiError.message ?? ''
  if (raw.toLowerCase() !== 'too many requests') return null
  const retryAfter = Number(apiError.retry_after)
  if (!Number.isFinite(retryAfter) || retryAfter <= 0) return 'Too many requests. Please try again later.'
  const rounded = Math.ceil(retryAfter)
  if (rounded < 60) return `Too many requests. Please try again in ${rounded} second${rounded === 1 ? '' : 's'}.`
  const minutes = Math.ceil(rounded / 60)
  return `Too many requests. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`
}

function isAuthExpiredMessage(message: string) {
  const normalized = message.toLowerCase()
  return (
    normalized.includes('missing cookie "access_token_cookie"') ||
    normalized.includes("missing cookie 'access_token_cookie'") ||
    normalized.includes('missing cookie') ||
    normalized.includes('token has expired') ||
    normalized.includes('signature has expired') ||
    normalized.includes('jwt expired') ||
    normalized.includes('authorization required')
  )
}

function notifyAuthExpired(message: string) {
  clearAuth()
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { message } }))
  const here = `${window.location.pathname}${window.location.search}`
  if (!window.location.pathname.startsWith('/login')) {
    window.location.assign(`/login?reason=session_expired&from=${encodeURIComponent(here)}`)
  }
}

function parseJsonSafely(text: string) {
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    ...buildHeaders(options)
  }
  if (options?.body != null && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json'
  }
  if (isMutationMethod(options?.method)) {
    const csrfToken = readCookie('csrf_access_token')
    if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path), { ...options, headers, credentials: 'include' })
  } catch {
    throw new Error('Network request failed. Check API server and CORS configuration.')
  }
  const text = await res.text()
  const data = parseJsonSafely(text)

  if (!res.ok) {
    const message = extractErrorMessage(data, res)
    const needsAuth = options?.auth !== false
    if (needsAuth && res.status === 401 && isAuthExpiredMessage(message)) {
      notifyAuthExpired(message)
    }
    throw new Error(message)
  }

  return data as T
}

export async function apiUpload<T>(
  path: string,
  body: FormData,
  options?: Omit<RequestInit, 'body'> & { auth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = buildHeaders(options)
  if ('Content-Type' in headers) delete headers['Content-Type']
  if (isMutationMethod(options?.method ?? 'POST')) {
    const csrfToken = readCookie('csrf_access_token')
    if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path), { ...options, method: options?.method ?? 'POST', body, headers, credentials: 'include' })
  } catch {
    throw new Error('Upload failed. Check API server availability and file size limits.')
  }
  const text = await res.text()
  const data = parseJsonSafely(text)

  if (!res.ok) {
    const message = extractErrorMessage(data, res)
    const needsAuth = options?.auth !== false
    if (needsAuth && res.status === 401 && isAuthExpiredMessage(message)) {
      notifyAuthExpired(message)
    }
    throw new Error(message)
  }

  return data as T
}

export async function apiFetchBlob(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<Blob> {
  const headers: Record<string, string> = buildHeaders(options)
  if (isMutationMethod(options?.method)) {
    const csrfToken = readCookie('csrf_access_token')
    if (csrfToken) headers['X-CSRF-TOKEN'] = csrfToken
  }
  const res = await fetch(buildUrl(path), { ...options, headers, credentials: 'include' })
  if (!res.ok) {
    const text = await res.text()
    const data = parseJsonSafely(text)
    const message = extractErrorMessage(data, res)
    const needsAuth = options?.auth !== false
    if (needsAuth && res.status === 401 && isAuthExpiredMessage(message)) {
      notifyAuthExpired(message)
    }
    throw new Error(message)
  }
  return res.blob()
}


