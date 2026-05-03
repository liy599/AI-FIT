import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { confirmPasswordReset } from '../features/user'

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
    if (busy) return
    if (!token.trim()) {
      setError('Token is required.')
      return
    }
    if (!newPassword.trim()) {
      setError('New password is required.')
      return
    }
    setBusy(true)
    try {
      await confirmPasswordReset(token, newPassword)
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
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
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
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-auth">
              <div className="cl_blog_details-reply">
                <h3 className="cl_blog_details-reply-title">Set a new password</h3>
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
                      <div>
                        <div className="cl_blog-widget cl_auth-alert cl_auth-alert--error mb-30">{error}</div>
                      </div>
                    ) : null}
                    {ok ? (
                      <div>
                        <div className="cl_blog-widget cl_auth-alert cl_auth-alert--notice mb-30">
                          Password updated. Redirecting to login…
                        </div>
                      </div>
                    ) : null}
                    <div>
                      <div className="cl_blog_details-reply-item">
                        <button type="submit">
                          Confirm
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="cl_blog-widget cl_auth-switch">
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
