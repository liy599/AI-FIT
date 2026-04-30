import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getBlogs, resolveBlogMediaUrl, type BlogCard } from '../features/blog'

function resolveMediaUrl(url: string | null | undefined) {
  return resolveBlogMediaUrl(url)
}

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

export default function HomePage() {
  const [blogs, setBlogs] = useState<BlogCard[]>([])
  const [blogReveal, setBlogReveal] = useState<0 | 1 | 2>(0)
  const row1Ref = useRef<HTMLDivElement | null>(null)
  const row2Ref = useRef<HTMLDivElement | null>(null)
  const heroSlides = [
    { src: '/assets/images/hero/hero_slide_1.jpg', label: 'Outdoor gym equipment' },
    { src: '/assets/images/hero/hero_slide_2.jpg', label: 'Kettlebell training' },
    { src: '/assets/images/hero/hero_slide_3.jpg', label: 'Healthy garden salad' },
    { src: '/assets/images/hero/hero_slide_4.jpg', label: 'Healthy meal' }
  ] as const
  const [heroIndex, setHeroIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    getBlogs({ page: 1, page_size: 8, auth: false })
      .then((r) => {
        if (cancelled) return
        setBlogs(r.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroSlides.length)
    }, 6500)
    return () => window.clearInterval(id)
  }, [heroSlides.length])

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

  return (
    <>
      <section className="cl_hero-area">
        <div className="common_width_1">
          <div className="cl_hero-wrap cl_hero-carousel">
            <div className="cl_hero-carousel-slides" aria-hidden="true">
              {heroSlides.map((s, idx) => (
                <div
                  key={s.src}
                  className={`cl_hero-carousel-slide${idx === heroIndex ? ' is-active' : ''}`}
                  style={{ backgroundImage: `url(${s.src})` }}
                />
              ))}
            </div>
            <div className="cl_hero-carousel-overlay" aria-hidden="true" />
            <div className="cl_hero-content">
              <h1>Train smarter. Eat clearer.</h1>
              <div className="cl_hero-content-btn">
                <Link to="/tools/pose" className="cl_theme-btn cl_hero-btn">
                  Start Pose Coaching <Arrow15 />
                </Link>
                <Link to="/food" className="cl_hero-btn-2">
                  Start Food Tracking <Arrow15 />
                </Link>
              </div>
            </div>
            <div className="cl_hero-carousel-dots">
              {heroSlides.map((s, idx) => (
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

      <section className="cl_blog-area pt-100 pb-70">
        <div className="container">
          <div className="cl_home-blogs-header">
            <div className="cl_section-area mb-0 pb-0">
              <span className="cl_section-subtitle">Our Blogs</span>
              <h2 className="cl_section-title mb-0">Featured Blogs</h2>
            </div>
            <Link to="/blogs" className="cl_home-blogs-viewall">
              View all <Arrow15 />
            </Link>
          </div>

          {blogs.length === 0 ? (
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
                {row1.map((b, idx) => {
                  const tagLabel = b.tags[0]?.name ?? 'AI FitGuard'
                  const img =
                    resolveMediaUrl(b.cover_image_url) ?? `/assets/images/blog/h2_${(idx % 9) + 1}.png`
                  return (
                    <article className="cl_home-blog-card" key={b.id}>
                      <Link to={`/blogs/${b.id}`} className="cl_home-blog-card-media">
                        <img src={img} alt={b.title} loading="lazy" />
                        <span className="cl_home-blog-card-tag">{tagLabel}</span>
                      </Link>
                      <div className="cl_home-blog-card-body">
                        <h3 className="cl_home-blog-card-title">
                          <Link to={`/blogs/${b.id}`}>{b.title}</Link>
                        </h3>
                        <p className="cl_home-blog-card-excerpt">{b.excerpt}</p>
                        <div className="cl_home-blog-card-meta">
                          <span>By {b.author.username}</span>
                          <span>{new Date(b.created_at).toLocaleDateString()}</span>
                        </div>
                        <Link to={`/blogs/${b.id}`} className="cl_home-blog-card-cta">
                          Read more <Arrow15 />
                        </Link>
                      </div>
                    </article>
                  )
                })}
              </div>
              {row2.length > 0 ? (
                <div ref={row2Ref} className={`cl_home-blogs-row${blogReveal >= 2 ? ' is-visible' : ''}`}>
                  {row2.map((b, idx) => {
                    const tagLabel = b.tags[0]?.name ?? 'AI FitGuard'
                    const img =
                      resolveMediaUrl(b.cover_image_url) ?? `/assets/images/blog/h2_${((idx + 3) % 9) + 1}.png`
                    return (
                      <article className="cl_home-blog-card" key={b.id}>
                        <Link to={`/blogs/${b.id}`} className="cl_home-blog-card-media">
                          <img src={img} alt={b.title} loading="lazy" />
                          <span className="cl_home-blog-card-tag">{tagLabel}</span>
                        </Link>
                        <div className="cl_home-blog-card-body">
                          <h3 className="cl_home-blog-card-title">
                            <Link to={`/blogs/${b.id}`}>{b.title}</Link>
                          </h3>
                          <p className="cl_home-blog-card-excerpt">{b.excerpt}</p>
                          <div className="cl_home-blog-card-meta">
                            <span>By {b.author.username}</span>
                            <span>{new Date(b.created_at).toLocaleDateString()}</span>
                          </div>
                          <Link to={`/blogs/${b.id}`} className="cl_home-blog-card-cta">
                            Read more <Arrow15 />
                          </Link>
                        </div>
                      </article>
                    )
                  })}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
