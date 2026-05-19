import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FallbackImage } from '../../components/ui'
import { TrainingInsightsPanel } from '../../components/user/ExerciseDashboardPanel'
import { displayBlogTagName, getBlogs, resolveBlogMediaUrl, type BlogCard } from '../../modules/blog'
import { listPoseTrainings, type PoseTrainingSession } from '../../modules/pose'
import { formatYmdLocal } from '../../modules/user/profileDate'
import { useAuth } from '../../state/auth-context'

// Resolve media URLs for blog covers (supports relative backend paths)
function resolveMediaUrl(url: string | null | undefined) {
  return resolveBlogMediaUrl(url)
}

// Shared CTA arrow icon
function Arrow15() {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12.9613 11.8986C12.9805 11.8986 13.3488 11.678 13.7796 11.4083C14.2103 11.1385 14.5543 10.9016 14.544 10.882C14.5336 10.8624 14.3268 10.583 14.0842 10.2612C13.5972 9.61499 13.1283 8.76064 12.9205 8.14091C12.273 6.2094 12.571 4.2037 13.7462 2.58473L14.0454 2.17245L13.4757 1.6028L12.9061 1.03311L12.5295 1.30145C10.0626 3.05956 7.10577 2.85727 4.48433 0.751109C4.31316 0.613566 4.16681 0.507421 4.15907 0.515159C4.08782 0.586408 3.19178 2.05146 3.192 2.09632C3.19215 2.12877 3.34886 2.26146 3.54023 2.3911C5.65916 3.8268 8.08355 4.29492 9.95758 3.63031L10.4071 3.4709L4.15728 9.74345L0.205318 13.7098L1.3582 14.8627L5.33478 10.9006L11.5926 4.66555L11.403 5.24471C10.911 6.74715 11.1125 8.52771 11.9778 10.3229C12.2243 10.8344 12.8883 11.8983 12.9613 11.8986Z"
        fill="currentColor"
      />
    </svg>
  )
}

const HERO_SLIDES = [
  { src: '/assets/images/hero/hero_slide_1.jpg', label: 'Outdoor gym equipment' },
  { src: '/assets/images/hero/hero_slide_2.jpg', label: 'Kettlebell training' },
  { src: '/assets/images/hero/hero_slide_3.jpg', label: 'Healthy garden salad' },
  { src: '/assets/images/hero/hero_slide_4.jpg', label: 'Active recovery' }
] as const

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric'
})

// Build card image fallback based on card position
function fallbackBlogImage(index: number) {
  return `/assets/images/blog/h2_${(index % 9) + 1}.png`
}

// Main homepage component
export default function HomePage() {
  const auth = useAuth()
  // Blog state for homepage featured section
  const [blogs, setBlogs] = useState<BlogCard[]>([])
  const [blogsLoading, setBlogsLoading] = useState(true)
  const [blogsError, setBlogsError] = useState<string | null>(null)
  const [trainingItems, setTrainingItems] = useState<PoseTrainingSession[]>([])
  const [trainingLoading, setTrainingLoading] = useState(false)
  const [trainingError, setTrainingError] = useState<string | null>(null)

  // Reveal state for staggered row animation
  const [blogReveal, setBlogReveal] = useState<0 | 1 | 2>(0)
  const row1Ref = useRef<HTMLDivElement | null>(null)
  const row2Ref = useRef<HTMLDivElement | null>(null)

  // Hero carousel active slide index
  const [heroIndex, setHeroIndex] = useState(0)

  // Load latest blog cards for homepage display
  useEffect(() => {
    let cancelled = false
    setBlogsLoading(true)
    setBlogsError(null)

    getBlogs({ page: 1, page_size: 8, auth: false, sort_by: 'view_count', sort_dir: 'desc' })
      .then((r) => {
        if (cancelled) return
        setBlogs(r.items)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setBlogsError(error instanceof Error ? error.message : 'Failed to load blogs')
      })
      .finally(() => {
        if (cancelled) return
        setBlogsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!auth.user) {
      setTrainingItems([])
      setTrainingLoading(false)
      setTrainingError(null)
      return
    }

    let cancelled = false
    const today = new Date()
    const start = new Date(today)
    start.setDate(today.getDate() - 6)

    setTrainingLoading(true)
    setTrainingError(null)
    listPoseTrainings({
      page: 1,
      page_size: 100,
      date_from: formatYmdLocal(start),
      date_to: formatYmdLocal(today)
    })
      .then((result) => {
        if (cancelled) return
        setTrainingItems(result.items)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        setTrainingError(error instanceof Error ? error.message : 'Failed to load training insights')
      })
      .finally(() => {
        if (cancelled) return
        setTrainingLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [auth.user?.id])

  // Auto-rotate hero slides (respects reduced-motion preference)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length)
    }, 6500)

    return () => window.clearInterval(id)
  }, [])

  // Reveal blog rows when they enter viewport
  useEffect(() => {
    if (blogs.length === 0) return

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setBlogReveal(2)
      return
    }

    const row1 = row1Ref.current
    const row2 = row2Ref.current

    if (!row1) {
      setBlogReveal(2)
      return
    }

    const ioRow1 = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry?.isIntersecting) return
        setBlogReveal((prev) => (prev >= 1 ? prev : 1))
        ioRow1.disconnect()
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    )
    ioRow1.observe(row1)

    let ioRow2: IntersectionObserver | null = null
    if (row2) {
      ioRow2 = new IntersectionObserver(
        (entries) => {
          const entry = entries[0]
          if (!entry?.isIntersecting) return
          setBlogReveal((prev) => (prev >= 2 ? prev : 2))
          ioRow2?.disconnect()
        },
        { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
      )
      ioRow2.observe(row2)
    }

    return () => {
      ioRow1.disconnect()
      ioRow2?.disconnect()
    }
  }, [blogs.length])

  const featuredBlogs = blogs.slice(0, 6)
  const row1 = featuredBlogs.slice(0, 3)
  const row2 = featuredBlogs.slice(3, 6)
  const trainingInsightsPath = '/profile?tab=Dashboard#training-insights'
  const trainingInsightsLink = auth.user ? trainingInsightsPath : `/login?from=${encodeURIComponent(trainingInsightsPath)}`

  // Render a single blog card row
  function renderBlogRow(items: BlogCard[], rowOffset: number) {
    return items.map((b, idx) => {
      const tagLabel = b.tags[0]?.name ? displayBlogTagName(b.tags[0].name) : 'AI FitGuard'
      const fallbackSrc = fallbackBlogImage(idx + rowOffset)
      const img = resolveMediaUrl(b.cover_image_url) ?? fallbackSrc
      return (
        <article className="cl_home-blog-card" key={b.id}>
          <Link to={`/blogs/${b.id}`} className="cl_home-blog-card-media">
            <FallbackImage src={img} fallbackSrc={fallbackSrc} alt={b.title} loading="lazy" />
            <span className="cl_home-blog-card-tag">{tagLabel}</span>
          </Link>
          <div className="cl_home-blog-card-body">
            <h3 className="cl_home-blog-card-title">
              <Link to={`/blogs/${b.id}`}>{b.title}</Link>
            </h3>
            <p className="cl_home-blog-card-excerpt">{b.excerpt}</p>
            <div className="cl_home-blog-card-meta">
              <span>By {b.author.username}</span>
              <span>{DATE_FORMATTER.format(new Date(b.created_at))}</span>
            </div>
            <Link to={`/blogs/${b.id}`} className="cl_home-blog-card-cta">
              Read more <Arrow15 />
            </Link>
          </div>
        </article>
      )
    })
  }

  return (
    <>
      {/* Hero section with rotating visual slides */}
      <section className="cl_hero-area">
        <div className="common_width_1">
          <div className="cl_hero-wrap cl_hero-carousel">
            <div className="cl_hero-carousel-slides" aria-hidden="true">
              {HERO_SLIDES.map((s, idx) => (
                <div
                  key={s.src}
                  className={`cl_hero-carousel-slide${idx === heroIndex ? ' is-active' : ''}`}
                >
                  <img className="cl_hero-carousel-slide-image" src={s.src} alt={s.label} loading="lazy" />
                </div>
              ))}
            </div>
            <div className="cl_hero-carousel-overlay" aria-hidden="true" />
            <div className="cl_hero-content">
              <h1>Train smarter.</h1>
              <div className="cl_hero-content-btn">
                <Link to="/tools/pose" className="cl_theme-btn cl_hero-btn">
                  Start Pose Coaching <Arrow15 />
                </Link>
                <Link to="/blogs" className="cl_hero-btn-2">
                  Read Community Posts <Arrow15 />
                </Link>
              </div>
            </div>
            <div className="cl_hero-carousel-dots">
              {HERO_SLIDES.map((s, idx) => (
                <button
                  key={s.src}
                  type="button"
                  className={`cl_hero-carousel-dot${idx === heroIndex ? ' is-active' : ''}`}
                  aria-label={`Go to slide ${idx + 1}: ${s.label}`}
                  onClick={() => setHeroIndex(idx)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Featured blogs section */}
      <section className="cl_blog-area home-blogs-section">
        <div className="page-container">
          <div className="home-training-insights">
            <div className="cl_home-blogs-header home-training-insights-header">
              <div className="cl_section-area mb-0 pb-0">
                <h2 className="cl_section-title mb-0">Recent Training</h2>
              </div>
              <Link to={trainingInsightsLink} className="cl_home-blogs-viewall">
                View all <Arrow15 />
              </Link>
            </div>

            {auth.user ? (
              <TrainingInsightsPanel
                title="Training Insights"
                sessions={trainingItems}
                loading={trainingLoading}
                error={trainingError}
                fixedRange="day"
                showRangeTabs={false}
                showWindowControls={false}
                showFooter={false}
              />
            ) : (
              <div className="profile-panel home-training-insights-guest">
                <div>
                  <div className="text-sm font-semibold">Training Insights</div>
                  <div className="mt-1 text-xs text-slate-600">Sign in to see your last 7 days of pose training data.</div>
                </div>
                <div className="home-training-insights-actions">
                  <Link to="/login?from=%2F" className="profile-btn-primary">
                    Sign in
                  </Link>
                  <Link to="/tools/pose" className="profile-btn-secondary">
                    Try pose tools
                  </Link>
                </div>
              </div>
            )}
          </div>

          <div className="cl_home-blogs-header">
            <div className="cl_section-area mb-0 pb-0">
              <h2 className="cl_section-title mb-0">Featured Blogs</h2>
            </div>
            <Link to="/blogs" className="cl_home-blogs-viewall">
              View all <Arrow15 />
            </Link>
          </div>

          {blogsLoading ? (
            <div className="cl_home-blogs-empty">
              <h3 className="cl_home-blogs-empty-title">Loading blogs...</h3>
            </div>
          ) : blogsError ? (
            <div className="cl_home-blogs-empty">
              <h3 className="cl_home-blogs-empty-title">Failed to load blogs</h3>
              <p className="cl_home-blogs-empty-text">{blogsError}</p>
            </div>
          ) : blogs.length === 0 ? (
            <div className="cl_home-blogs-empty">
              <h3 className="cl_home-blogs-empty-title">No posts yet</h3>
              <p className="cl_home-blogs-empty-text">
                Create and publish a blog post in your profile, then come back here to see it.
              </p>
              <Link to="/profile" className="cl_home-blogs-empty-cta">
                Create one <Arrow15 />
              </Link>
            </div>
          ) : (
            <div className="cl_home-blogs-grid">
              <div ref={row1Ref} className={`cl_home-blogs-row${blogReveal >= 1 ? ' is-visible' : ''}`}>
                {renderBlogRow(row1, 0)}
              </div>
              {row2.length > 0 ? (
                <div ref={row2Ref} className={`cl_home-blogs-row${blogReveal >= 2 ? ' is-visible' : ''}`}>
                  {renderBlogRow(row2, 3)}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </>
  )
}

