import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PasswordField } from '../../components/ui'
import { loginByPassword } from '../../modules/user'
import { useAuth } from '../../state/auth-context'

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
}

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

  async function submit() {
    setError(null)
    setNotice(null)
    if (busy) return
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Email is required.')
      return
    }
    if (!password.trim()) {
      setError('Password is required.')
      return
    }
    setBusy(true)
    try {
      const r = await loginByPassword(normalizedEmail, password)
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
    const normalizedEmail = email.trim().toLowerCase()
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      setError('Invalid email format.')
      return
    }
    if (!normalizedEmail) {
      nav('/reset-password', { replace: true })
      return
    }
    const q = new URLSearchParams()
    q.set('email', normalizedEmail)
    nav(`/reset-password?${q.toString()}`, { replace: true })
  }

  return (
    <>
      <section className="pt-100 pb-100 brand-page-body auth-page-body auth-primary-page">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-auth">
              <div className="cl_blog_details-reply">
                <h3 className="cl_blog_details-reply-title">Sign in</h3>
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
                          autoComplete="email"
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
                        <PasswordField
                          id="password"
                          required
                          autoComplete="current-password"
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
                        <button type="submit" disabled={busy}>
                          {busy ? 'Signing in...' : 'Login'}
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

