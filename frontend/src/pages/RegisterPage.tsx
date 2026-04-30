import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { registerByPassword } from '../features/user'
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
    if (busy) return
    if (!email.trim()) {
      setError('Email is required.')
      return
    }
    if (!username.trim()) {
      setError('Username is required.')
      return
    }
    if (!password.trim()) {
      setError('Password is required.')
      return
    }
    setBusy(true)
    try {
      const r = await registerByPassword(email, username, password)
      auth.setAuth(r.access_token, r.user)
      nav('/profile', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Registration failed')
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
                  <h2 className="cl_breadcrumb-content-title">Register</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Register</span>
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
                <h3 className="cl_blog_details-reply-title">Create account</h3>
                <p>After registration, you will be signed in and redirected to your profile.</p>
                <form
                  action="#"
                  noValidate
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
                        <input type="email" id="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="cl_blog_details-reply-item">
                        <label htmlFor="username">
                          Username<span>*</span>
                        </label>
                        <input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="cl_blog_details-reply-item">
                        <label htmlFor="password">
                          Password<span>*</span>
                        </label>
                        <input type="password" id="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                      </div>
                    </div>
                    {error ? (
                      <div className="col-12">
                        <div className="cl_blog-widget cl_auth-alert cl_auth-alert--error mb-30">{error}</div>
                      </div>
                    ) : null}
                    <div className="col-12">
                      <div className="cl_blog_details-reply-item">
                        <button type="submit">
                          Register
                        </button>
                      </div>
                    </div>
                    <div className="col-12">
                      <div className="cl_blog-widget cl_auth-switch">
                        Already have an account? <Link to="/login">Sign in</Link>
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
