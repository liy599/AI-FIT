import React, { createContext, useContext, useMemo, useState } from 'react'
import { clearAuth, getToken, getUser, setToken, setUser, type AuthUser } from '../lib/auth'

type AuthState = {
  user: AuthUser | null
  token: string | null
  setAuth: (token: string, user: AuthUser) => void
  setUser: (user: AuthUser) => void
  logout: () => void
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider(props: { children: React.ReactNode }) {
  const [tokenValue, setTokenValue] = useState<string | null>(getToken())
  const [userValue, setUserValue] = useState<AuthUser | null>(getUser())

  const value = useMemo<AuthState>(
    () => ({
      user: userValue,
      token: tokenValue,
      setAuth: (token, user) => {
        setToken(token)
        setUser(user)
        setTokenValue(token)
        setUserValue(user)
      },
      setUser: (user) => {
        setUser(user)
        setUserValue(user)
      },
      logout: () => {
        clearAuth()
        setTokenValue(null)
        setUserValue(null)
      }
    }),
    [tokenValue, userValue]
  )

  return <Ctx.Provider value={value}>{props.children}</Ctx.Provider>
}

export function useAuth() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

