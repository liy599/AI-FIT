import { getSessionCached, invalidateSessionCache } from './session'

export class NotLoggedInError extends Error {
  name = 'NotLoggedInError'
}

export async function privateFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const session = await getSessionCached()
  if (!session) throw new NotLoggedInError('Signed out')

  const res = await fetch(input, {
    cache: 'no-store',
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers ?? {})
    }
  })

  if (res.status === 401) {
    invalidateSessionCache(null)
    throw new NotLoggedInError('Signed out')
  }

  return res
}

export async function privateJson<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await privateFetch(input, init)
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const msg =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : `HTTP ${res.status}`
    throw new Error(msg)
  }
  if (data === null || data === undefined) throw new Error(`HTTP ${res.status}`)
  return data as T
}
