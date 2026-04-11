import { getToken } from './auth'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:5000'

export type ApiError = { error?: string; msg?: string; message?: string }

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

function buildHeaders(options?: RequestInit & { auth?: boolean }) {
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> | undefined)
  }

  const needsAuth = options?.auth !== false
  if (needsAuth) {
    const token = getToken()
    if (token) headers.Authorization = `Bearer ${token}`
  }

  return headers
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
    if (typeof apiError.error === 'string' && apiError.error.trim()) return apiError.error
    if (typeof apiError.msg === 'string' && apiError.msg.trim()) return apiError.msg
    if (typeof apiError.message === 'string' && apiError.message.trim()) return apiError.message
  }
  return res.statusText || `Request failed (${res.status})`
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
    'Content-Type': 'application/json',
    ...buildHeaders(options)
  }

  let res: Response
  try {
    res = await fetch(buildUrl(path), { ...options, headers })
  } catch {
    throw new Error('Network request failed. Check API server and CORS configuration.')
  }
  const text = await res.text()
  const data = parseJsonSafely(text)

  if (!res.ok) {
    throw new Error(extractErrorMessage(data, res))
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

  let res: Response
  try {
    res = await fetch(buildUrl(path), { ...options, method: options?.method ?? 'POST', body, headers })
  } catch {
    throw new Error('Upload failed. Check API server availability and file size limits.')
  }
  const text = await res.text()
  const data = parseJsonSafely(text)

  if (!res.ok) {
    throw new Error(extractErrorMessage(data, res))
  }

  return data as T
}

export async function apiFetchBlob(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<Blob> {
  const res = await fetch(buildUrl(path), { ...options, headers: buildHeaders(options) })
  await throwIfNotOk(res)
  return res.blob()
}

