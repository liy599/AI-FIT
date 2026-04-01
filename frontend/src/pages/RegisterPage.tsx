import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../state/auth-context'

export default function RegisterPage() {
  const auth = useAuth()
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      const r = await apiFetch<{
        access_token: string
        user: { id: number; email: string; username: string; avatar_url?: string | null }
      }>(
        '/api/auth/register',
        { method: 'POST', auth: false, body: JSON.stringify({ email, username, password }) }
      )
      auth.setAuth(r.access_token, r.user)
      nav('/profile', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '注册失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
      <h1 className="text-xl font-semibold">注册</h1>
      <div className="mt-4 space-y-3">
        <input
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
          placeholder="邮箱"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
          placeholder="用户名"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
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
          disabled={busy || !email || !username || !password}
          onClick={submit}
        >
          创建账号
        </button>
        <div className="text-xs text-slate-400">
          已有账号？{' '}
          <Link to="/login" className="text-indigo-300 hover:text-indigo-200">
            去登录
          </Link>
        </div>
      </div>
    </div>
  )
}

