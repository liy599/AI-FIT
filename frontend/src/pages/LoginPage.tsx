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
      const r = await apiFetch<{
        access_token: string
        user: { id: number; email: string; username: string; avatar_url?: string | null }
      }>(
        '/api/auth/login',
        { method: 'POST', auth: false, body: JSON.stringify({ email, password }) }
      )
      auth.setAuth(r.access_token, r.user)
      nav(from, { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Login failed')
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
      setError(e instanceof Error ? e.message : 'Request failed')
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
        <div className="container">
          <div className="row justify-content-center">
            <div className="col-xl-6 col-lg-8">
              <div className="cl_blog_details-reply">
                <h3 className="cl_blog_details-reply-title">Sign in</h3>
                <p>Sign in with your email and password (after signing in you can access courses, your profile, and more).</p>
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
                    <div className="col-12">
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
                      <div className="col-12">
                        <div className="cl_blog-widget mb-30">{error}</div>
                      </div>
                    ) : null}
                    <div className="col-12">
                      <div className="cl_blog_details-reply-item">
                        <button type="submit" disabled={busy || !email || !password}>
                          Login
                        </button>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="cl_blog_details-reply-item">
                        <button
                          type="button"
                          disabled={!email}
                          onClick={() => {
                            forgot().catch(() => {})
                          }}
                        >
                          Forgot Password
                        </button>
                      </div>
                    </div>
                    {resetLink ? (
                      <div className="col-12">
                        <div className="cl_blog-widget mb-30">
                          Dev reset link:{' '}
                          <a href={resetLink} target="_blank" rel="noreferrer">
                            {resetLink}
                          </a>
                        </div>
                      </div>
                    ) : null}
                    <div className="col-12">
                      <div className="cl_blog-widget">
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
