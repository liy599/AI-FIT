import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { loginByPassword, requestPasswordReset } from '../modules/user'
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
  const [notice, setNotice] = useState<string | null>(null)

  const qs = new URLSearchParams(loc.search)
  const reason = qs.get('reason')
  const fromQuery = qs.get('from')
  const effectiveFrom = fromQuery || from

  function buildResetPath(resetLink?: string) {
    if (!resetLink) return null
    try {
      const u = new URL(resetLink, window.location.origin)
      if (u.pathname === '/reset-password') return `${u.pathname}${u.search}${u.hash}`
      const token = u.searchParams.get('token')
      if (token) return `/reset-password?token=${encodeURIComponent(token)}`
      return null
    } catch {
      if (resetLink.includes('token=')) {
        const token = resetLink.split('token=')[1]?.split('&')[0]
        if (token) return `/reset-password?token=${encodeURIComponent(token)}`
      }
      return null
    }
  }

  async function submit() {
    setError(null)
    setNotice(null)
    if (busy) return
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (!password.trim()) {
      setError('Password is required.')
      return
    }
    setBusy(true)
    try {
      const r = await loginByPassword(email, password)
      auth.setAuth(r.user)
      nav(effectiveFrom, { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  async function forgot() {
    setError(null)
    setNotice(null)
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    try {
      const r = await requestPasswordReset(email)
      const path = buildResetPath(r.reset_link)
      if (path) {
        nav(path, { replace: true })
        return
      }
      setError('Reset link generation failed.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      setError(msg === 'email not found' ? 'Email not found.' : msg)
    }
  }

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Login</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Login</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-auth">
              <div className="cl_blog_details-reply">
                <h3 className="cl_blog_details-reply-title">Sign in</h3>
                <p>Sign in with your email and password (after signing in you can access your profile and more).</p>
                {reason === 'session_expired' ? (
                  <div className="cl_blog-widget cl_auth-alert cl_auth-alert--notice mb-30">
                    Your session has expired. Please sign in again.
                  </div>
                ) : null}
                <form
                  action="#"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    submit().catch(() => {})
                  }}
                >
                  <div className="auth-form-grid">
                    <div>
                      <div className="cl_blog_details-reply-item">
                        <label htmlFor="email">
                          Email<span>*</span>
                        </label>
                        <input
                          type="email"
                          id="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <div className="cl_blog_details-reply-item">
                        <label htmlFor="password">
                          Password<span>*</span>
                        </label>
                        <input
                          type="password"
                          id="password"
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    </div>
                    {error ? (
                      <div>
                        <div className="cl_blog-widget cl_auth-alert cl_auth-alert--error mb-30">{error}</div>
                      </div>
                    ) : null}
                    {notice ? (
                      <div>
                        <div className="cl_blog-widget cl_auth-alert cl_auth-alert--notice mb-30">{notice}</div>
                      </div>
                    ) : null}
                    <div>
                      <div className="cl_blog_details-reply-item">
                        <button type="submit">
                          Login
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="cl_blog_details-reply-item">
                        <button
                          type="button"
                          onClick={() => {
                            forgot().catch(() => {})
                          }}
                        >
                          Forgot Password
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="cl_blog-widget cl_auth-switch">
                        No account yet? <Link to="/register">Create one</Link>
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

