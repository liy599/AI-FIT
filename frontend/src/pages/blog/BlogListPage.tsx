import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getBlogTags, queryBlogs, type BlogCard, type BlogTag as Tag } from '../../modules/blog'
import { useAuth } from '../../state/auth-context'
import {
  BlogTeaserCard,
  clamp01,
  estimateReadMinutes,
  FeaturedBlogGridCard,
  formatLongDate,
  getViewCount,
  resolveMediaUrl,
  TopViewedStack,
  useRevealOnScroll
} from '../../components/blog/BlogListParts'
export default function BlogListPage() {
  const auth = useAuth()
  const [sp, setSp] = useSearchParams()
  const [tags, setTags] = useState<Tag[]>([])
  const [items, setItems] = useState<BlogCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = sp.get('q') ?? ''
  const tagIds = sp.getAll('tag').map((x) => Number(x)).filter((x) => Number.isFinite(x))

  useEffect(() => {
    getBlogTags()
      .then(setTags)
      .catch(() => {})
  }, [])

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', '1')
    p.set('page_size', '24')
    if (q.trim()) p.set('q', q.trim())
    for (const t of tagIds) p.append('tag', String(t))
    return p.toString()
  }, [q, tagIds])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    queryBlogs(queryString)
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [queryString])

  function toggleTag(id: number) {
    const next = new URLSearchParams(sp)
    const has = tagIds.includes(id)
    next.delete('tag')
    const kept = has ? tagIds.filter((t) => t !== id) : [...tagIds, id]
    kept.forEach((t) => next.append('tag', String(t)))
    setSp(next)
  }

  const categoryPills = useMemo(() => {
    const fallback = [
      'Hobbies',
      'Gaming',
      'Automotive',
      'Pet Care',
      'Science',
      'Work Life',
      'Social Issues',
      'Entertainment',
      'Travel & Culture',
      'Technology',
      'Lifestyle',
    ]

    if (!tags.length) return fallback.map((name) => ({ name, id: null as number | null }))
    const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))
    return sorted.slice(0, 12).map((t) => ({ name: t.name, id: t.id as number | null }))
  }, [tags])

  const hero = items[0]
  const recent = items.slice(0, 4)
  const featured = items.slice(4, 11)
  const popular = items.slice(11, 17)

  const featuredCount = featured.length || 6
  const popularCount = popular.length || 6
  const featuredProgress = clamp01(featuredCount / 6)
  const popularProgress = clamp01(popularCount / 6)
  const topViewed = useMemo(() => {
    if (!items.length) return []
    const sorted = [...items].sort((a, b) => getViewCount(b) - getViewCount(a))
    const best = sorted.slice(0, 3)
    const hasViews = best.some((b) => getViewCount(b) > 0)
    if (!hasViews) return items.slice(0, 3)
    return best
  }, [items])

  const recentReveal = useRevealOnScroll<HTMLElement>()
  const categoriesReveal = useRevealOnScroll<HTMLElement>()
  const featuredReveal = useRevealOnScroll<HTMLElement>()
  const joinReveal = useRevealOnScroll<HTMLElement>()
  const featuredGridReveal = useRevealOnScroll<HTMLDivElement>()

  return (
    <main className="bg-white">
      <style>{`
        .reveal {
          opacity: 0;
          transform: translateY(40px);
          transition: all 0.6s ease;
          will-change: opacity, transform;
        }
        .reveal.visible {
          opacity: 1;
          transform: translateY(0);
        }
        .reveal-stagger > * {
          opacity: 0;
          transform: translateY(40px);
          transition: all 0.6s ease;
          will-change: opacity, transform;
        }
        .reveal-stagger.visible > * {
          opacity: 1;
          transform: translateY(0);
        }
        .reveal-stagger.visible > *:nth-child(1) { transition-delay: 0ms; }
        .reveal-stagger.visible > *:nth-child(2) { transition-delay: 100ms; }
        .reveal-stagger.visible > *:nth-child(3) { transition-delay: 200ms; }
        .reveal-stagger.visible > *:nth-child(4) { transition-delay: 300ms; }
        .reveal-stagger.visible > *:nth-child(5) { transition-delay: 400ms; }
        .reveal-stagger.visible > *:nth-child(6) { transition-delay: 500ms; }
        .reveal-stagger.visible > *:nth-child(7) { transition-delay: 600ms; }
        .reveal-stagger.visible > *:nth-child(8) { transition-delay: 700ms; }
        .reveal-stagger.visible > *:nth-child(9) { transition-delay: 800ms; }
        .reveal-stagger.visible > *:nth-child(10) { transition-delay: 900ms; }
        .reveal-stagger.visible > *:nth-child(11) { transition-delay: 1000ms; }
        .reveal-stagger.visible > *:nth-child(12) { transition-delay: 1100ms; }
        .blog-list-light-bg {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(135deg, rgba(14, 85, 60, 0.92), rgba(18, 24, 38, 0.9)),
            url('/assets/images/bg/waves-shape.png') center / cover no-repeat;
        }
      `}</style>
      <section className="relative overflow-hidden bg-neutral-50 px-4 pb-16 pt-10 md:pb-24 md:pt-16">
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%]">
          <div className="blog-list-light-bg" />
          <div className="absolute inset-0 bg-gradient-to-b from-neutral-950/70 via-neutral-950/45 to-transparent" />
        </div>
        <div className="blog-list-hero-grid">
          <div className="blog-list-hero-col-main">
            <div className="blog-list-hero-title-wrap">
              <h1 className="text-[44px] font-semibold leading-[1.02] tracking-tight text-neutral-900 sm:text-[56px] md:text-[64px]">
                Fitness / Nutrition
                <br />
                Community
              </h1>
            </div>
          </div>

          <div className="blog-list-hero-col-side">
            <div className="blog-list-hero-media-wrap">
              <TopViewedStack blogs={topViewed} loading={loading} />
            </div>
          </div>
        </div>
      </section>

      <section
        ref={recentReveal.ref}
        className={`px-4 py-14 md:py-20 reveal${recentReveal.visible ? ' visible' : ''}`}
      >
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl">
            Recent Blogs
          </h2>

          {error ? <div className="mt-6 text-sm text-red-600">{error}</div> : null}

          <div className="mt-10 blog-list-recent-grid">
            <div className="blog-list-recent-col-main">
              {recent[0] ? (
                <article>
                  <div className="relative overflow-hidden rounded-3xl bg-neutral-100 aspect-[16/9]">
                    <Link to={`/blogs/${recent[0].id}`} className="block h-full w-full">
                      <img
                        className="absolute inset-0 h-full w-full object-cover"
                        src={resolveMediaUrl(recent[0].cover_image_url) ?? '/figma/recent-1.png'}
                        alt={recent[0].title}
                        fetchPriority="high"
                        decoding="async"
                      />
                    </Link>
                    <div className="absolute left-5 top-5">
                      <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-neutral-900">
                        {recent[0].tags[0]?.name ?? 'Our Blog'}
                      </span>
                    </div>
                  </div>

                  <h3 className="mt-6 text-2xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
                    <Link to={`/blogs/${recent[0].id}`}>{recent[0].title}</Link>
                  </h3>

                  <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500">
                    <div className="flex items-center gap-2">
                      <img src="/figma/icon-user.svg" alt="" className="h-3.5 w-3.5" />
                      <span>{recent[0].author.username}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img src="/figma/icon-calendar.svg" alt="" className="h-3.5 w-3.5" />
                      <span>{formatLongDate(recent[0].created_at)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img src="/figma/icon-clock.svg" alt="" className="h-3.5 w-3.5" />
                      <span>{estimateReadMinutes(recent[0].excerpt)} min read</span>
                    </div>
                  </div>

                  <div className="mt-6">
                    <Link
                      to={`/blogs/${recent[0].id}`}
                      className="inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-6 text-sm font-medium text-white"
                    >
                      Read more
                    </Link>
                  </div>
                </article>
              ) : (
                <div className="rounded-3xl bg-neutral-50 p-8 text-sm text-neutral-500">
                  {loading ? 'Loading...' : 'No content'}
                </div>
              )}
            </div>

            <div className="blog-list-recent-col-side">
              <div className="grid grid-cols-1 gap-8">
                {recent.slice(1, 4).map((b, idx) => (
                  <article key={b.id} className="rounded-3xl p-3 hover:bg-neutral-50">
                    <div className="flex items-start gap-[13px]">
                      <div className="relative h-[110px] w-[150px] flex-none overflow-hidden rounded-2xl bg-neutral-100 sm:h-[120px] sm:w-[170px]">
                        <Link to={`/blogs/${b.id}`} className="block h-full w-full">
                          <img
                            className="absolute inset-0 h-full w-full object-cover"
                            src={
                              resolveMediaUrl(b.cover_image_url) ??
                              (idx === 0 ? '/figma/recent-2.png' : idx === 1 ? '/figma/recent-3.png' : '/figma/featured-1.png')
                            }
                            alt={b.title}
                            loading="lazy"
                            decoding="async"
                          />
                        </Link>
                        <div className="absolute left-3 top-3">
                          <span className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-900">
                            {b.tags[0]?.name ?? 'Our Blog'}
                          </span>
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="text-lg font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2">
                          <Link to={`/blogs/${b.id}`}>{b.title}</Link>
                        </h4>
                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
                          <div className="flex items-center gap-2">
                            <img src="/figma/icon-calendar.svg" alt="" className="h-3.5 w-3.5" />
                            <span>{formatLongDate(b.created_at)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <img src="/figma/icon-clock.svg" alt="" className="h-3.5 w-3.5" />
                            <span>{estimateReadMinutes(b.excerpt)} min read</span>
                          </div>
                        </div>

                        <div className="mt-4">
                          <Link
                            to={`/blogs/${b.id}`}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-neutral-300 bg-white px-5 text-xs font-medium text-neutral-900"
                          >
                            Read more
                            <span className="text-base leading-none">{'>'}</span>
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section ref={featuredReveal.ref} className={`px-4 pt-16 md:pt-24 reveal${featuredReveal.visible ? ' visible' : ''}`}>
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-center justify-between gap-6">
            <h2 className="text-lg font-semibold text-neutral-900">Featured Blogs</h2>
          </div>

          <div
            ref={featuredGridReveal.ref}
            className={`mt-8 blog-list-featured-grid reveal-stagger${featuredGridReveal.visible ? ' visible' : ''}`}
          >
            {featured.slice(0, 3).map((b, idx) => (
              <FeaturedBlogGridCard
                key={b.id}
                blog={b}
                placeholderSrc={idx === 0 ? '/figma/featured-1.png' : idx === 1 ? '/figma/featured-2.png' : '/figma/featured-3.png'}
              />
            ))}
          </div>
        </div>
      </section>

      <section
        ref={joinReveal.ref}
        className={`px-4 pt-16 md:pt-24 pb-16 reveal${joinReveal.visible ? ' visible' : ''}`}
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="relative blog-list-join-grid rounded-3xl px-6 py-[60px] text-white shadow-xl md:px-10">
            <div className="blog-list-light-bg rounded-3xl" />
            <div className="relative z-10 blog-list-join-col-main">
              <h2 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                Share your training insights
              </h2>
              <p className="mt-4 max-w-[520px] text-sm leading-relaxed text-white md:text-base">
                Post your pose training tips, progress notes, and nutrition discoveries to help others stay consistent.
              </p>
              <div className="mt-6">
                <Link
                  to={auth.user ? '/blogs/new' : `/login?from=${encodeURIComponent('/blogs/new')}`}
                  className="inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-neutral-900"
                >
                  {auth.user ? 'Write a post' : 'Login to write'}
                </Link>
              </div>
            </div>

            <div className="relative z-10 blog-list-join-col-side">
              {hero ? (
                <div className="rounded-3xl bg-white p-3 text-neutral-900">
                  <div className="relative overflow-hidden rounded-3xl bg-neutral-100 aspect-[16/9]">
                    <Link to={`/blogs/${hero.id}`} className="block h-full w-full">
                      <img
                        className="absolute inset-0 h-full w-full object-cover"
                        src={resolveMediaUrl(hero.cover_image_url) ?? '/figma/hero-card.png'}
                        alt={hero.title}
                        loading="lazy"
                        decoding="async"
                      />
                    </Link>
                  </div>
                  <h3 className="mt-4 text-base font-semibold leading-snug tracking-tight line-clamp-2">
                    <Link to={`/blogs/${hero.id}`}>{hero.title}</Link>
                  </h3>
                  <div className="mt-2 text-xs text-neutral-500">{formatLongDate(hero.created_at)}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}



