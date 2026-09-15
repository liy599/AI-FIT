import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch } from '../../lib/api'

type Course = {
  id: number
  title: string
  cover_image_url: string | null
  instructor_name: string
  is_free: boolean
  price: number | null
  enroll_count: number
  avg_rating: number | null
}

const FALLBACK_IMAGES = [
  '/assets/images/pose/deep-squat.jpg',
  '/assets/images/pose/lateral-raise.jpg',
  '/assets/images/pose/push-up.jpg',
]

const FILTERS = ['All', 'Free', 'Premium']

function StarRating({ rating }: { rating: number | null }) {
  const val = rating ?? 0
  const full = Math.floor(val)
  const half = val - full >= 0.5
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path
            d="M7 1l1.545 3.13L12 4.635l-2.5 2.435.59 3.44L7 8.905l-3.09 1.605.59-3.44L2 4.635l3.455-.505L7 1z"
            fill={i < full ? '#f59e0b' : i === full && half ? '#f59e0b' : '#e5e7eb'}
            opacity={i === full && half ? 0.5 : 1}
          />
        </svg>
      ))}
      {rating !== null && (
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)', marginLeft: 2 }}>
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}

export default function CoursesListPage() {
  const [items, setItems] = useState<Course[]>([])
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('All')

  useEffect(() => {
    apiFetch<{ items: Course[] }>('/api/courses?page=1&page_size=24')
      .then((data) => setItems(data.items))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Unable to load courses'))
  }, [])

  const visible = useMemo(() => {
    if (filter === 'Free') return items.filter((c) => c.is_free)
    if (filter === 'Premium') return items.filter((c) => !c.is_free)
    return items
  }, [items, filter])

  return (
    <section className="pt-100 pb-100">
      <div className="container">

        {/* Page header */}
        <div style={{
          background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
          borderRadius: 'var(--radius-xl)', padding: '40px 36px', marginBottom: 40,
          border: '1px solid rgba(52, 204, 149, 0.2)'
        }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand)', letterSpacing: 1.2, textTransform: 'uppercase', margin: '0 0 10px' }}>
            LEARN · TRAIN · GROW
          </p>
          <h1 style={{ fontSize: 34, fontWeight: 900, color: 'var(--color-text-primary)', margin: '0 0 10px', lineHeight: 1.2 }}>
            Fitness Courses
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 16, margin: '0 0 24px', maxWidth: 520 }}>
            Structured learning paths designed by certified instructors — from beginner foundations to advanced performance.
          </p>
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', fontSize: 14, color: 'var(--color-text-muted)' }}>
            <span>📚 {items.length} courses available</span>
            <span>🎓 Expert instructors</span>
            <span>⚡ Pairs with AI Pose training</span>
          </div>
        </div>

        {error && (
          <div style={{
            background: 'var(--color-error-bg)', color: 'var(--color-error)',
            borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 24, fontSize: 14
          }}>
            {error}
          </div>
        )}

        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                height: 38, padding: '0 18px', borderRadius: 999, fontSize: 14, fontWeight: 600,
                border: '1.5px solid',
                borderColor: filter === f ? 'var(--color-brand)' : 'var(--color-border-default)',
                background: filter === f ? 'var(--color-brand)' : 'var(--color-bg-surface)',
                color: filter === f ? '#fff' : 'var(--color-text-muted)',
                cursor: 'pointer', transition: 'all 0.15s ease'
              }}
            >
              {f}
              {f !== 'All' && (
                <span style={{ marginLeft: 6, opacity: 0.75 }}>
                  ({f === 'Free' ? items.filter((c) => c.is_free).length : items.filter((c) => !c.is_free).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Course grid */}
        {visible.length === 0 && !error ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--color-text-muted)' }}>
            <p style={{ fontSize: 16 }}>No courses found.</p>
          </div>
        ) : (
          <div className="row">
            {visible.map((course, index) => (
              <div className="col-lg-4 col-md-6" key={course.id} style={{ marginBottom: 28 }}>
                <div style={{
                  background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-soft)', overflow: 'hidden',
                  border: '1.5px solid var(--color-border-default)',
                  height: '100%', display: 'flex', flexDirection: 'column',
                  transition: 'box-shadow 0.2s, transform 0.2s'
                }}>
                  {/* Cover image */}
                  <div style={{ position: 'relative' }}>
                    <img
                      src={course.cover_image_url || FALLBACK_IMAGES[index % FALLBACK_IMAGES.length]}
                      alt={course.title}
                      style={{ width: '100%', height: 190, objectFit: 'cover', display: 'block' }}
                    />
                    {/* Free / Paid badge */}
                    <div style={{
                      position: 'absolute', top: 12, left: 12,
                      padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700,
                      background: course.is_free ? 'var(--color-brand)' : '#1e293b',
                      color: '#fff'
                    }}>
                      {course.is_free ? 'FREE' : `€${course.price ?? '—'}`}
                    </div>
                  </div>

                  {/* Card body */}
                  <div style={{ padding: '18px 20px', flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text-primary)', margin: 0, lineHeight: 1.3 }}>
                      {course.title}
                    </h3>
                    <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: 0 }}>
                      by {course.instructor_name}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <StarRating rating={course.avg_rating} />
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        👥 {course.enroll_count.toLocaleString()} enrolled
                      </span>
                    </div>

                    <div style={{ flex: 1 }} />

                    <Link
                      to={`/courses/${course.id}`}
                      style={{
                        display: 'block', textAlign: 'center', marginTop: 8,
                        padding: '10px 0', borderRadius: 999, fontSize: 14, fontWeight: 700,
                        background: 'rgba(52, 204, 149, 0.1)',
                        color: 'var(--color-brand)',
                        border: '1.5px solid rgba(52, 204, 149, 0.3)',
                        textDecoration: 'none', transition: 'background 0.15s'
                      }}
                    >
                      View Course →
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </section>
  )
}
