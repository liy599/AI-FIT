import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../state/auth-context'

export default function LoginPage() {
  const auth = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from ?? '/profile'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resetLink, setResetLink] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setResetLink(null)
    setBusy(true)
    try {
      const r = await apiFetch<{ access_token: string; user: { id: number; email: string; username: string } }>(
        '/api/auth/login',
        { method: 'POST', auth: false, body: JSON.stringify({ email, password }) }
      )
      auth.setAuth(r.access_token, r.user)
      nav(from, { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '登录失败')
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    setError(null)
    setResetLink(null)
    try {
      const r = await apiFetch<{ reset_link?: string }>('/api/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email })
      })
      setResetLink(r.reset_link ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '请求失败')
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
      <h1 className="text-xl font-semibold">登录</h1>
      <div className="mt-4 space-y-3">
        <input
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
          placeholder="密码"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error ? <div className="text-xs text-rose-300">{error}</div> : null}
        <button
          className="w-full rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          disabled={busy || !email || !password}
          onClick={submit}
        >
          登录
        </button>
        <button
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
          disabled={!email}
          onClick={forgot}
        >
          忘记密码
        </button>
        {resetLink ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
            开发模式重置链接：<a className="text-indigo-300 underline" href={resetLink}>{resetLink}</a>
          </div>
        ) : null}
        <div className="text-xs text-slate-400">
          还没有账号？{' '}
          <Link to="/register" className="text-indigo-300 hover:text-indigo-200">
            去注册
          </Link>
        </div>
      </div>
    </div>
  )
}

