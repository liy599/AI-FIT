import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PasswordField } from '../../components/ui'
import { registerByPassword, requestEmailVerification, verifyEmail } from '../../modules/user'
import { useAuth } from '../../state/auth-context'

function isValidEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
}

export default function RegisterPage() {
  const auth = useAuth()
  const nav = useNavigate()

  const [email, setEmail] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null)

  const normalizedEmail = email.trim().toLowerCase()
  const emailVerified = Boolean(verifiedEmail && normalizedEmail === verifiedEmail)

  async function sendVerification() {
    setError(null)
    const e = normalizedEmail
    if (!e) {
      setError('Email is required.')
      return
    }
    if (!isValidEmail(e)) {
      setError('Invalid email format.')
      return
    }
    setBusy(true)
    try {
      const r = await requestEmailVerification(e)
      if (r.verification_code) setEmailCode(String(r.verification_code))
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Request failed'
      if (msg === 'email already exists') {
        setError('Email already exists')
        return
      }
      if (msg === 'email delivery not configured') {
        setError('Email delivery is not configured on the server yet.')
        return
      }
      if (msg === 'email delivery failed') {
        setError('Failed to send the verification email. Please try again later.')
        return
      }
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function confirmEmailCode() {
    setError(null)
    const e = normalizedEmail
    const c = emailCode.trim()
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
    setBusy(true)
    try {
      await verifyEmail(e, c)
      setVerifiedEmail(e)
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
      if (msg === 'email already exists') {
        setError('Email already exists')
        return
      }
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    setError(null)
    if (busy) return
    if (!normalizedEmail) {
      setError('Email is required.')
      return
    }
    if (!isValidEmail(normalizedEmail)) {
      setError('Invalid email format.')
      return
    }
    if (!username.trim()) {
      setError('Username is required.')
      return
    }
    if (username.trim().length < 3 || username.trim().length > 15) {
      setError('Username length must be 3-15.')
      return
    }
    if (/\s/.test(username)) {
      setError('Username cannot contain whitespace.')
      return
    }
    if (!password.trim()) {
      setError('Password is required.')
      return
    }
    if (!confirmPassword.trim()) {
      setError('Please confirm your password.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 8 || password.length > 20) {
      setError('Password length must be 8-20.')
      return
    }
    if (/\s/.test(password)) {
      setError('Password cannot contain whitespace.')
      return
    }
    if (/^[0-9]+$/.test(password)) {
      setError('Password is too weak. Use 8-20 chars and include letters and numbers.')
      return
    }
    const lower = password.toLowerCase()
    if (['12345678', 'password', '123456789', 'qwerty123'].includes(lower)) {
      setError('Password is too weak. Use 8-20 chars and include letters and numbers.')
      return
    }
    if (normalizedEmail && lower === normalizedEmail.toLowerCase()) {
      setError('Password is too weak. Use 8-20 chars and include letters and numbers.')
      return
    }
    if (username && lower === username.toLowerCase()) {
      setError('Password is too weak. Use 8-20 chars and include letters and numbers.')
      return
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Password is too weak. Use 8-20 chars and include letters and numbers.')
      return
    }
    if (!emailVerified) {
      setError('Please verify your email with the code before creating the account.')
      return
    }
    setBusy(true)
    try {
      const r = await registerByPassword(normalizedEmail, username, password)
      auth.setAuth(r.user)
      nav('/onboarding/profile', { replace: true })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed'
      if (msg === 'email not verified') {
        setVerifiedEmail(null)
        setError('Please verify your email with the code before creating the account.')
        return
      }
      if (msg === 'invalid email') {
        setError('Invalid email format.')
        return
      }
      if (msg === 'username length must be 3-15') {
        setError('Username length must be 3-15.')
        return
      }
      if (msg === 'username cannot contain whitespace') {
        setError('Username cannot contain whitespace.')
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
      if (msg === 'email already exists') {
        setError('Email already exists')
        return
      }
      setError(msg)
    } finally {
      setBusy(false)
    }
  }

  function useDifferentEmail() {
    setVerifiedEmail(null)
    setEmailCode('')
    setConfirmPassword('')
    setError(null)
  }

  return (
    <>
      <section className="pt-100 pb-100 brand-page-body auth-page-body auth-primary-page">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-auth">
              <div className="cl_blog_details-reply">
                <h3 className="cl_blog_details-reply-title">Create account</h3>
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
                          disabled={emailVerified}
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value)
                            setVerifiedEmail(null)
                            setEmailCode('')
                          }}
                        />
                      </div>
                      {!emailVerified ? (
                        <div className="cl_blog_details-reply-item">
                          <label htmlFor="emailCode">
                            Verification code<span>*</span>
                          </label>
                          <input
                            type="text"
                            id="emailCode"
                            inputMode="numeric"
                            value={emailCode}
                            onChange={(e) => setEmailCode(e.target.value)}
                          />
                        </div>
                      ) : null}
                      <div className="cl_blog_details-reply-item">
                        {!emailVerified ? (
                          <button type="button" onClick={() => sendVerification().catch(() => {})} disabled={busy}>
                            {busy ? 'Sending...' : 'Send verification code'}
                          </button>
                        ) : null}
                      </div>
                      {!emailVerified ? (
                        <div className="cl_blog_details-reply-item">
                          <button type="button" onClick={() => confirmEmailCode().catch(() => {})} disabled={busy}>
                            {busy ? 'Verifying...' : 'Confirm code'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {emailVerified ? (
                      <>
                        <div>
                          <div className="cl_blog_details-reply-item">
                            <label htmlFor="username">
                              Username<span>*</span>
                            </label>
                            <input id="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
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
                              autoComplete="new-password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="cl_blog_details-reply-item">
                            <label htmlFor="confirmPassword">
                              Confirm password<span>*</span>
                            </label>
                            <PasswordField
                              id="confirmPassword"
                              required
                              autoComplete="new-password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                          </div>
                        </div>
                      </>
                    ) : null}
                    {error ? (
                      <div>
                        <div className="cl_blog-widget cl_auth-alert cl_auth-alert--error mb-30">{error}</div>
                      </div>
                    ) : null}
                    {emailVerified ? (
                      <div>
                        <div className="cl_blog_details-reply-item">
                          <button type="submit" disabled={busy}>
                            {busy ? 'Creating account...' : 'Register'}
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {emailVerified ? (
                      <div>
                        <div className="cl_blog_details-reply-item">
                          <button type="button" onClick={useDifferentEmail} disabled={busy}>
                            Use a different email
                          </button>
                        </div>
                      </div>
                    ) : null}
                    <div>
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
