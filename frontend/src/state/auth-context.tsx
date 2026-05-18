import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearAuth, getUser, setUser, type AuthUser } from '../lib/auth'
import { apiFetch } from '../lib/api'

// Auth context contract for app-wide session state
type AuthState = {
  user: AuthUser | null
  setAuth: (user: AuthUser) => void
  setUser: (user: AuthUser) => void
  logout: () => Promise<void>
}

const AUTH_EXPIRED_EVENT = 'aifit:auth-expired'
const Ctx = createContext<AuthState | null>(null)

// Auth provider: keeps in-memory state in sync with local storage
export function AuthProvider(props: { children: ReactNode }) {
  const [userValue, setUserValue] = useState<AuthUser | null>(getUser())

  // Commit authenticated user to local storage and React state
  const commitAuth = useCallback((user: AuthUser) => {
    setUser(user)
    setUserValue(user)
  }, [])

  // Commit user-only updates while preserving the current session
  const commitUser = useCallback((user: AuthUser) => {
    setUser(user)
    setUserValue(user)
  }, [])

  // Clear auth state from both local storage and React state
  const clearSession = useCallback(() => {
    clearAuth()
    setUserValue(null)
  }, [])

  const logout = useCallback(async () => {
    clearSession()
    try {
      await apiFetch<{ ok: boolean }>('/api/auth/logout', { method: 'POST', auth: false })
    } catch {
      // Local cleanup must still happen if the server session is already gone.
    }
  }, [clearSession])

  // React to explicit auth-expired events from API layer
  useEffect(() => {
    const onExpired = () => {
      clearSession()
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired)
  }, [clearSession])

  // Keep auth state synchronized across browser tabs/windows
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (!event.key || event.key !== 'aifitguard_user') return
      setUserValue(getUser())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Validate persisted user against server cookie session on app startup
  useEffect(() => {
    if (!userValue) return
    apiFetch<AuthUser>('/api/auth/me', { auth: false })
      .then((serverUser) => {
        setUser(serverUser)
        setUserValue(serverUser)
      })
      .catch(() => {
        clearSession()
      })
  }, [clearSession, userValue?.id])

  // Provide stable context value to avoid unnecessary consumer re-renders
  const value = useMemo<AuthState>(
    () => ({
      user: userValue,
      setAuth: commitAuth,
      setUser: commitUser,
      logout
    }),
    [commitAuth, commitUser, logout, userValue]
  )

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>
}

// Hook for consuming authenticated session state and actions
export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}


