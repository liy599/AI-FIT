'use client'

import { useRouter } from 'next/navigation'
import { useState, type FormEvent } from 'react'
import { getSessionCached } from '@/lib/client/session'

export default function LoginForm(props: { nextPath: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as null | { error?: string }
        setError(data?.error || 'Sign-in failed')
        return
      }

      await getSessionCached({ force: true })
      router.push(props.nextPath)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="form">
      <label className="field">
        <span className="fieldLabel">Email</span>
        <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
      </label>
      <label className="field">
        <span className="fieldLabel">Password</span>
        <input
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <button className="btn btnPrimary" disabled={loading} type="submit">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      {error ? <div className="alert">{error}</div> : null}
    </form>
  )
}
