import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { PasswordField } from '../../components/ui'
import { confirmPasswordReset, requestPasswordReset, verifyPasswordResetCode } from '../../modules/user'

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
}

function validatePassword(password: string, email: string, username: string) {
  if (!password.trim()) return 'New password is required.'
  if (password.length < 8 || password.length > 20) return 'Password length must be 8-20.'
  if (/\s/.test(password)) return 'Password cannot contain whitespace.'
  if (/^[0-9]+$/.test(password)) return 'Password is too weak. Use 8-20 chars and include letters and numbers.'
  const lower = password.toLowerCase()
  if (['12345678', 'password', '123456789', 'qwerty123'].includes(lower)) {
    return 'Password is too weak. Use 8-20 chars and include letters and numbers.'
  }
  if (email && lower === email.toLowerCase()) return 'Password is too weak. Use 8-20 chars and include letters and numbers.'
  if (username && lower === username.toLowerCase()) return 'Password is too weak. Use 8-20 chars and include letters and numbers.'
  if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Password is too weak. Use 8-20 chars and include letters and numbers.'
  }
  return null
}

export default function ResetPasswordPage() {
  const [sp] = useSearchParams()
  const initialEmail = useMemo(() => sp.get('email') ?? '', [sp])
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmNewPassword, setConfirmNewPassword] = useState('')
  const [busyAction, setBusyAction] = useState<'send' | 'verify' | 'submit' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)
  const [verifiedResetEmail, setVerifiedResetEmail] = useState<string | null>(null)

  const normalizedEmail = email.trim().toLowerCase()
  const codeVerified = Boolean(verifiedResetEmail && normalizedEmail === verifiedResetEmail)
  const busy = Boolean(busyAction)

  useEffect(() => {
    if (initialEmail && !email) setEmail(initialEmail)
  }, [email, initialEmail])

  async function sendCode() {
    setError(null)
    if (busy) return
    const e = normalizedEmail
    if (!e) {
      setError('Email is required.')
      return
    }
    if (!isValidEmail(e)) {
      setError('Invalid email format.')
      return
    }
    setVerifiedResetEmail(null)
    setNewPassword('')
    setConfirmNewPassword('')
    setBusyAction('send')
    try {
      const r = await requestPasswordReset(e)
      if (r.reset_code) setCode(String(r.reset_code))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      if (msg === 'email not found') {
        setError('Email not found.')
        return
      }
      if (msg === 'email delivery not configured') {
        setError('Password reset email is not configured on the server yet.')
        return
      }
      if (msg === 'email delivery failed') {
        setError('Failed to send reset code. Please try again later.')
        return
      }
      setError(msg)
    } finally {
      setBusyAction(null)
    }
  }

  async function verifyCode() {
    setError(null)
    if (busy) return
    const e = normalizedEmail
    const c = code.trim()
    if (!e) {
      setError('Email is required.')
      return
    }
    if (!isValidEmail(e)) {
      setError('Invalid email format.')
      return
    }
    if (!/^[0-9]{6}$/.test(c)) {
      setError('Verification code must be 6 digits.')
      return
    }
    setBusyAction('verify')
    try {
      await verifyPasswordResetCode(e, c)
      setVerifiedResetEmail(e)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Verification failed'
      if (msg === 'code expired') {
        setError('This verification code has expired. Please request a new one.')
        return
      }
      if (msg === 'invalid code') {
        setError('Invalid verification code.')
        return
      }
      if (msg === 'email not found') {
        setError('Email not found.')
        return
      }
      setError(msg)
    } finally {
      setBusyAction(null)
    }
  }

  async function submit() {
    setError(null)
    if (busy) return
    const e = normalizedEmail
    const c = code.trim()
    if (!codeVerified) {
      setError('Please verify the reset code first.')
      return
    }
    if (!confirmNewPassword.trim()) {
      setError('Please confirm your new password.')
      return
    }
    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match.')
      return
    }
    const passwordErr = validatePassword(newPassword, e, '')
    if (passwordErr) {
      setError(passwordErr)
      return
    }
    setBusyAction('submit')
    try {
      await confirmPasswordReset(e, c, newPassword)
      setOk(true)
      setTimeout(() => nav('/login'), 800)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Reset failed'
      if (msg === 'code expired') {
        setError('This verification code has expired. Please request a new one.')
        return
      }
      if (msg === 'invalid code') {
        setError('Invalid verification code.')
        return
      }
      if (msg === 'password length must be 8-20') {
        setError('Password length must be 8-20.')
        return
      }
      if (msg === 'password cannot contain whitespace') {
        setError('Password cannot contain whitespace.')
        return
      }
      if (msg === 'password too weak') {
        setError('Password is too weak. Use 8-20 chars and include letters and numbers.')
        return
      }
      if (msg === 'email not found') {
        setError('Email not found.')
        return
      }
      setError(msg)
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <>
      <section className="pt-100 pb-100 brand-page-body auth-page-body auth-primary-page">
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
                        <label htmlFor="email">
                          Email<span>*</span>
                        </label>
                        <input
                          id="email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            setVerifiedResetEmail(null)
                            setNewPassword('')
                            setConfirmNewPassword('')
                          }}
                        />
                      </div>
                    </div>
                    {!codeVerified ? (
                      <div>
                        <div className="cl_blog_details-reply-item">
                          <label htmlFor="code">
                            Verification code<span>*</span>
                          </label>
                          <input
                            id="code"
                            type="text"
                            inputMode="numeric"
                            required
                            value={code}
                            onChange={(e) => setCode(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                    {codeVerified ? (
                      <div>
                        <div className="cl_blog_details-reply-item">
                          <label htmlFor="newPassword">
                            New password<span>*</span>
                          </label>
                          <PasswordField
                            id="newPassword"
                            required
                            autoComplete="new-password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                    {codeVerified ? (
                      <div>
                        <div className="cl_blog_details-reply-item">
                          <label htmlFor="confirmNewPassword">
                            Confirm new password<span>*</span>
                          </label>
                          <PasswordField
                            id="confirmNewPassword"
                            required
                            autoComplete="new-password"
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                          />
                        </div>
                      </div>
                    ) : null}
                    {error ? (
                      <div>
                        <div className="cl_blog-widget cl_auth-alert cl_auth-alert--error mb-30">{error}</div>
                      </div>
                    ) : null}
                    {ok ? (
                      <div>
                        <div className="cl_blog-widget cl_auth-alert cl_auth-alert--notice mb-30">
                          Password updated. Redirecting to login...
                        </div>
                      </div>
                    ) : null}
                    {!codeVerified ? (
                      <div>
                        <div className="cl_blog_details-reply-item">
                          <button type="button" onClick={() => sendCode().catch(() => {})} disabled={busy}>
                            {busyAction === 'send' ? 'Sending...' : 'Send reset code'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {!codeVerified ? (
                      <div>
                        <div className="cl_blog_details-reply-item">
                          <button type="button" onClick={() => verifyCode().catch(() => {})} disabled={busy}>
                            {busyAction === 'verify' ? 'Verifying...' : 'Verify code'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {codeVerified ? (
                      <div>
                        <div className="cl_blog_details-reply-item">
                          <button type="submit" disabled={busy}>
                            {busyAction === 'submit' ? 'Confirming...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    ) : null}
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

