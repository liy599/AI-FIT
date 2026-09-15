import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch } from '../../lib/api'
import { getMyMembership } from '../../lib/membership/api'
import type { MyMembership } from '../../lib/membership/api'
import { useAuth } from '../../state/auth-context'

type Course = {
  id: number
  title: string
  cover_image_url: string | null
  description: string
  instructor_name: string
  is_free: boolean
  price: number | null
  enrolled: boolean
  enroll_count?: number
  avg_rating?: number | null
}

const FALLBACK_IMAGES = [
  '/assets/images/pose/deep-squat.jpg',
  '/assets/images/pose/lateral-raise.jpg',
  '/assets/images/pose/push-up.jpg',
]

function StarRating({ rating }: { rating: number | null | undefined }) {
  const val = rating ?? 0
  const full = Math.floor(val)
  const half = val - full >= 0.5
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="16" height="16" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.44L7 8.905l-3.09 1.605.59-3.44L2 4.635l3.455-.505L7 1z"
            fill={i < full ? '#f59e0b' : i === full && half ? '#f59e0b' : '#e5e7eb'}
            opacity={i === full && half ? 0.5 : 1}
          />
        </svg>
      ))}
      {rating != null && (
        <span style={{ fontSize: 14, color: 'var(--color-text-muted)', marginLeft: 4, fontWeight: 600 }}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

export default function CourseDetailPage() {
  const { id } = useParams()
  const auth = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [error, setError] = useState('')
  const [enrolling, setEnrolling] = useState(false)
  const [enrolled, setEnrolled] = useState(false)

  const isPremiumMember = membership?.status === 'active' && membership.plan?.slug !== 'free'
  const canAccess = (course: Course) => course.is_free || isPremiumMember

  useEffect(() => {
    apiFetch<Course>(`/api/courses/${id}`)
      .then((data) => { setCourse(data); setEnrolled(data.enrolled) })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load course'))
    if (auth.user) {
      getMyMembership().then(setMembership).catch(() => {})
    }
  }, [id, auth.user])

  async function handleEnroll() {
    if (!course) return
    setEnrolling(true)
    try {
      await apiFetch(`/api/courses/${course.id}/enroll`, { method: 'POST', body: JSON.stringify({ paid: true }) })
      setEnrolled(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Enrollment failed')
    } finally {
      setEnrolling(false)
    }
  }

  if (error) {
    return (
      <section className="pt-100 pb-100">
        <div className="container">
          <div style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', padding: '16px 20px' }}>
            {error}
          </div>
          <Link to="/courses" style={{ display: 'inline-block', marginTop: 16, color: 'var(--color-brand)', fontWeight: 600 }}>
            ← Back to Courses
          </Link>
        </div>
      </section>
    )
  }

  if (!course) {
    return (
      <section className="pt-100 pb-100">
        <div className="container" style={{ textAlign: 'center', color: 'var(--color-text-muted)', paddingTop: 60 }}>
          Loading…
        </div>
      </section>
    )
  }

  const coverImg = course.cover_image_url || FALLBACK_IMAGES[(course.id - 1) % FALLBACK_IMAGES.length]

  return (
    <section className="pt-100 pb-100">
      <div className="container">

        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--color-text-muted)', marginBottom: 24 }}>
          <Link to="/courses" style={{ color: 'var(--color-brand)', textDecoration: 'none', fontWeight: 600 }}>Courses</Link>
          <span>/</span>
          <span style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{course.title}</span>
        </div>

        <div className="row">

          {/* Main content */}
          <div className="col-lg-8" style={{ marginBottom: 32 }}>

            {/* Cover image */}
            <div style={{ borderRadius: 'var(--radius-xl)', overflow: 'hidden', marginBottom: 32, boxShadow: 'var(--shadow-brand)' }}>
              <img
                src={coverImg}
                alt={course.title}
                style={{ width: '100%', maxHeight: 380, objectFit: 'cover', display: 'block' }}
              />
            </div>

            {/* Title + stats */}
            <h1 style={{ fontSize: 30, fontWeight: 900, color: 'var(--color-text-primary)', margin: '0 0 16px', lineHeight: 1.25 }}>
              {course.title}
            </h1>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, alignItems: 'center', marginBottom: 28 }}>
              <StarRating rating={course.avg_rating} />
              {course.enroll_count != null && (
                <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                  👥 {course.enroll_count.toLocaleString()} enrolled
                </span>
              )}
              <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
                🎓 {course.instructor_name}
              </span>
              <span style={{
                padding: '4px 14px', borderRadius: 999, fontSize: 13, fontWeight: 700,
                background: course.is_free ? 'rgba(52, 204, 149, 0.12)' : '#1e293b',
                color: course.is_free ? 'var(--color-brand)' : '#fff'
              }}>
                {course.is_free ? 'Free Course' : `€${course.price ?? '—'}`}
              </span>
            </div>

            {/* Description */}
            <div style={{
              background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
              padding: '24px 28px', boxShadow: 'var(--shadow-soft)'
            }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text-primary)', margin: '0 0 14px' }}>
                About this course
              </h2>
              <p style={{ fontSize: 15, color: 'var(--color-text-secondary)', lineHeight: 1.75, margin: 0, whiteSpace: 'pre-line' }}>
                {course.description || 'No description provided.'}
              </p>
            </div>

          </div>

          {/* Sidebar: enrollment card */}
          <div className="col-lg-4">
            <div style={{
              background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
              padding: '28px 24px', boxShadow: 'var(--shadow-brand)',
              border: '1.5px solid rgba(52, 204, 149, 0.2)',
              position: 'sticky', top: 100
            }}>
              <p style={{ fontSize: 26, fontWeight: 900, color: 'var(--color-text-primary)', margin: '0 0 4px' }}>
                {course.is_free ? 'Free' : `€${course.price ?? '—'}`}
              </p>
              {!course.is_free && course.price != null && (
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
                  One-time access fee
                </p>
              )}

              <div style={{ marginBottom: 24 }}>
                {enrolled ? (
                  <div style={{
                    background: 'var(--color-success-bg)', color: 'var(--color-success)',
                    borderRadius: 'var(--radius-md)', padding: '14px 16px',
                    textAlign: 'center', fontWeight: 700, fontSize: 15
                  }}>
                    ✓ You're enrolled
                  </div>
                ) : !canAccess(course) ? (
                  /* Premium lock */
                  <div>
                    <div style={{
                      background: 'linear-gradient(135deg, #faf5ff, #ede9fe)',
                      border: '1.5px solid #c4b5fd', borderRadius: 'var(--radius-md)',
                      padding: '16px', textAlign: 'center', marginBottom: 12
                    }}>
                      <p style={{ margin: '0 0 4px', fontSize: 22 }}>🔒</p>
                      <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 15, color: '#7c3aed' }}>
                        Premium Course
                      </p>
                      <p style={{ margin: 0, fontSize: 13, color: '#6d28d9' }}>
                        Upgrade your membership to access this course.
                      </p>
                    </div>
                    <Link
                      to="/membership"
                      className="app-btn app-btn--brand"
                      style={{ display: 'flex', width: '100%', justifyContent: 'center', height: 50, fontSize: 15, textDecoration: 'none' }}
                    >
                      Upgrade to Premium →
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleEnroll()}
                    disabled={enrolling}
                    className="app-btn app-btn--brand"
                    style={{ width: '100%', justifyContent: 'center', height: 50, fontSize: 15 }}
                  >
                    {enrolling ? 'Enrolling…' : course.is_free ? 'Start Free Course' : 'Enroll Now'}
                  </button>
                )}
              </div>

              {/* Instructor */}
              <div style={{
                borderTop: '1px solid var(--color-border-default)',
                paddingTop: 20
              }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 10px' }}>
                  INSTRUCTOR
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-brand), #2eb884)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 800, color: '#fff', flexShrink: 0
                  }}>
                    {course.instructor_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--color-text-primary)' }}>
                      {course.instructor_name}
                    </p>
                    <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                      Certified Instructor
                    </p>
                  </div>
                </div>
              </div>

              {/* What's included */}
              <div style={{ marginTop: 20, borderTop: '1px solid var(--color-border-default)', paddingTop: 20 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 12px' }}>
                  INCLUDED
                </p>
                {[
                  '🎥 HD video lessons',
                  '📋 Training plans',
                  '♾️ Lifetime access',
                  '🤖 AI Pose integration',
                ].map((item) => (
                  <p key={item} style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
