import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
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
      setError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Reset Password</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Reset</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-xl-6 col-lg-8">
              <div className="cl_blog_details-reply">
                <h3 className="cl_blog_details-reply-title">Set a new password</h3>
                <p>This page requires a token parameter from the reset link.</p>
                <form
                  action="#"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submit().catch(() => {})
                  }}
                >
                  <div className="row">
                    <div className="col-12">
                      <div className="cl_blog_details-reply-item">
                        <label htmlFor="newPassword">
                          New password<span>*</span>
                        </label>
                        <input
                          id="newPassword"
                          type="password"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    {error ? (
                      <div className="col-12">
                        <div className="cl_blog-widget mb-30">{error}</div>
                      </div>
                    ) : null}
                    {ok ? (
                      <div className="col-12">
                        <div className="cl_blog-widget mb-30">Password updated. Redirecting to login…</div>
                      </div>
                    ) : null}
                    <div className="col-12">
                      <div className="cl_blog_details-reply-item">
                        <button type="submit" disabled={busy || !token || !newPassword}>
                          Confirm
                        </button>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="cl_blog-widget">
                        <Link to="/login">Back to login</Link>
                      </div>
                    </div>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
