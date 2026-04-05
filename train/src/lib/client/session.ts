export type SessionOk = {
  ok: true
  user: { id: string; email: string; name: string | null }
  session: { id: string; expiresAt: string }
}

type SessionState =
  | { status: 'idle' }
  | { status: 'loading'; promise: Promise<SessionOk | null> }
  | { status: 'ready'; value: SessionOk | null; fetchedAt: number }

const CACHE_TTL_MS = 30_000

let state: SessionState = { status: 'idle' }
const listeners = new Set<() => void>()

function emit() {
  for (const fn of listeners) fn()
}

function isFresh(s: Extract<SessionState, { status: 'ready' }>) {
  return Date.now() - s.fetchedAt < CACHE_TTL_MS
}

async function fetchSession(): Promise<SessionOk | null> {
  const res = await fetch('/api/v1/auth/session', { method: 'GET', cache: 'no-store', credentials: 'include' })
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as unknown
  if (!data || typeof data !== 'object') return null
  if (!('ok' in data) || (data as { ok?: unknown }).ok !== true) return null
  const obj = data as Record<string, unknown>
  const user = obj.user
  const session = obj.session
  if (!user || typeof user !== 'object') return null
  if (!session || typeof session !== 'object') return null
  if (typeof (user as Record<string, unknown>).id !== 'string') return null
  return data as SessionOk
}

export function subscribeSession(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function invalidateSessionCache(nextValue?: SessionOk | null) {
  state = { status: 'ready', value: nextValue ?? null, fetchedAt: Date.now() }
  emit()
}

export async function getSessionCached(opts?: { force?: boolean }): Promise<SessionOk | null> {
  const force = opts?.force ?? false

  if (!force && state.status === 'ready' && isFresh(state)) return state.value
  if (!force && state.status === 'loading') return state.promise

  const p = fetchSession()
    .then((value) => {
      state = { status: 'ready', value, fetchedAt: Date.now() }
      emit()
      return value
    })
    .catch(() => {
      state = { status: 'ready', value: null, fetchedAt: Date.now() }
      emit()
      return null
    })

  state = { status: 'loading', promise: p }
  emit()
  return p
}

export function getSessionSnapshot(): { status: 'idle' | 'loading' | 'ready'; value?: SessionOk | null } {
  if (state.status === 'idle') return { status: 'idle' }
  if (state.status === 'loading') return { status: 'loading' }
  return { status: 'ready', value: state.value }
}
