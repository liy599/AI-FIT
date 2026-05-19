import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE, getMyProfile, resolveBackendUrl, updateMyProfile, uploadMyAvatar } from '../../modules/user'
import { useAuth } from '../../state/auth-context'
import type { UserProfile } from '../../modules/user/profileTypes'

const defaultAvatarImage = '/assets/images/bg/default.jpg'

export default function ProfileOnboardingPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)

  const [gender, setGender] = useState('')
  const [fitnessGoal, setFitnessGoal] = useState('')
  const [height, setHeight] = useState('')
  const [weight, setWeight] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const locked = busy || avatarUploading

  useEffect(() => {
    let active = true
    setError(null)
    ;(async () => {
      try {
        const p = await getMyProfile<UserProfile>()
        if (!active) return
        setProfile(p)
        setGender(p.gender ?? '')
        setFitnessGoal(p.fitness_goal ?? '')
        setHeight(p.height == null ? '' : String(p.height))
        setWeight(p.weight == null ? '' : String(p.weight))
      } catch (e: unknown) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to load profile')
      }
    })()
    return () => {
      active = false
    }
  }, [])

  function resolveAvatarUrl(url: string | null | undefined) {
    if (!url) return null
    return resolveBackendUrl(url)
  }

  async function onPickAvatar(file: File) {
    setError(null)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5MB or smaller')
      return
    }
    setAvatarUploading(true)
    try {
      const r = await uploadMyAvatar(file)
      setProfile((p) => (p ? { ...p, avatar_url: r.avatar_url } : p))
      if (auth.user) auth.setUser({ ...auth.user, avatar_url: r.avatar_url })
    } catch (e: unknown) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        setError(
          `Cannot reach backend upload endpoint: ${API_BASE}. Make sure the backend is running, set VITE_API_BASE to http://127.0.0.1:5000, then restart the frontend.`
        )
        return
      }
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function save() {
    setError(null)
    if (busy) return
    try {
      const payload: Record<string, unknown> = {}
      if (gender) payload.gender = gender
      if (fitnessGoal) payload.fitness_goal = fitnessGoal
      if (height.trim()) {
        const h = Number(height)
        if (!Number.isFinite(h) || h < 50 || h > 260) {
          setError('Invalid height')
          return
        }
        payload.height = h
      }
      if (weight.trim()) {
        const w = Number(weight)
        if (!Number.isFinite(w) || w < 20 || w > 400) {
          setError('Invalid weight')
          return
        }
        payload.weight = w
      }

      setBusy(true)
      if (Object.keys(payload).length > 0) {
        await updateMyProfile<UserProfile>(payload)
      }

      navigate('/profile', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  function skip() {
    navigate('/profile', { replace: true })
  }

  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Complete Profile</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Complete Profile</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 brand-page-body auth-page-body">
        <div className="page-container">
          <div className="page-row-center">
            <div className="page-col-auth">
              <div className="cl_blog_details-reply">
                <h3 className="cl_blog_details-reply-title">Complete your profile</h3>
                <form
                  action="#"
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault()
                    save().catch(() => {})
                  }}
                >
                  <div className="auth-form-grid">
                    <div>
                      <div className="cl_blog_details-reply-item auth-onboard-avatar-preview">
                        <label>Avatar (optional)</label>
                        <div className="auth-onboard-avatar-image">
                          <img
                            src={resolveAvatarUrl(profile?.avatar_url) ?? defaultAvatarImage}
                            alt="avatar"
                          />
                        </div>
                      </div>
                      <div className="cl_blog_details-reply-item">
                        <button
                          type="button"
                          className="auth-onboard-avatar-btn"
                          disabled={locked}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {avatarUploading ? 'Uploading...' : 'Change avatar'}
                        </button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            e.target.value = ''
                            if (!f) return
                            onPickAvatar(f).catch(() => {})
                          }}
                        />
                      </div>
                      <div className="cl_blog_details-reply-item">
                        <label htmlFor="gender">Gender</label>
                        <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} disabled={locked}>
                          <option value="">Prefer not to say</option>
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="cl_blog_details-reply-item">
                        <label htmlFor="fitness_goal">Fitness goal</label>
                        <select
                          id="fitness_goal"
                          value={fitnessGoal}
                          onChange={(e) => setFitnessGoal(e.target.value)}
                          disabled={locked}
                        >
                          <option value="">Select a fitness goal</option>
                          <option value="Build Muscle">Build Muscle</option>
                          <option value="Lose Fat">Lose Fat</option>
                          <option value="Stay Healthy">Stay Healthy</option>
                        </select>
                      </div>
                      <div className="cl_blog_details-reply-item">
                        <label htmlFor="height">Height (cm)</label>
                        <input
                          id="height"
                          inputMode="numeric"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          disabled={locked}
                        />
                      </div>
                      <div className="cl_blog_details-reply-item">
                        <label htmlFor="weight">Weight (kg)</label>
                        <input
                          id="weight"
                          inputMode="numeric"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          disabled={locked}
                        />
                      </div>
                    </div>

                    {error ? (
                      <div>
                        <div className="cl_blog-widget cl_auth-alert cl_auth-alert--error mb-30">{error}</div>
                      </div>
                    ) : null}

                    <div>
                      <div className="cl_blog_details-reply-item">
                        <button type="submit" disabled={locked}>
                          {busy ? 'Saving...' : 'Save & Continue'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="cl_blog_details-reply-item">
                        <button type="button" onClick={skip} disabled={locked}>
                          Skip
                        </button>
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
