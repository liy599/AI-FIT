export type AuthUser = {
  id: number
  email: string
  username: string
  avatar_url?: string | null
  is_admin?: boolean
  is_disabled?: boolean
}

const USER_KEY = 'aifitguard_user'
const LEGACY_TOKEN_KEY = 'aifitguard_token'

export function getUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    return null
  }
}

export function setUser(user: AuthUser | null) {
  if (!user) localStorage.removeItem(USER_KEY)
  else localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export function clearAuth() {
  setUser(null)
  localStorage.removeItem(LEGACY_TOKEN_KEY)
}


