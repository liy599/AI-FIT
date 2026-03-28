import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'

export default function ResetPasswordPage() {
  const [sp] = useSearchParams()
  const token = useMemo(() => sp.get('token') ?? '', [sp])
  const nav = useNavigate()

  const [newPassword, setNewPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function submit() {
    setError(null)
    setBusy(true)
    try {
      await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ token, new_password: newPassword })
      })
      setOk(true)
      setTimeout(() => nav('/login'), 800)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '重置失败')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-white/5 p-6">
      <h1 className="text-xl font-semibold">重置密码</h1>
      <div className="mt-4 space-y-3">
        <input
          className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
          placeholder="新密码"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        {error ? <div className="text-xs text-rose-300">{error}</div> : null}
        {ok ? <div className="text-xs text-emerald-300">已重置，正在跳转登录…</div> : null}
        <button
          className="w-full rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
          disabled={busy || !token || !newPassword}
          onClick={submit}
        >
          确认重置
        </button>
      </div>
    </div>
  )
}

