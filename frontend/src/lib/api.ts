import { getToken } from './auth'

export const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:5000'

export type ApiError = { error: string }

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
  const msg =
    typeof data === 'object' && data && 'error' in data ? String((data as ApiError).error) : res.statusText
  throw new Error(msg)
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...buildHeaders(options)
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers })
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'error' in data ? String((data as ApiError).error) : res.statusText
    throw new Error(msg)
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

  const res = await fetch(`${API_BASE}${path}`, { ...options, method: options?.method ?? 'POST', body, headers })
  const text = await res.text()
  const data = text ? (JSON.parse(text) as unknown) : null

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'error' in data ? String((data as ApiError).error) : res.statusText
    throw new Error(msg)
  }

  return data as T
}

export async function apiFetchBlob(
  path: string,
  options?: RequestInit & { auth?: boolean }
): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers: buildHeaders(options) })
  await throwIfNotOk(res)
  return res.blob()
}

