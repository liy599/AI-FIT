import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { displayBlogTagName, getBlogTags, queryBlogs, type BlogCard, type BlogTag as Tag } from '../../modules/blog'
import { useAuth } from '../../state/auth-context'
import {
  estimateReadMinutes,
  FeaturedBlogGridCard,
  formatLongDate,
  getBlogCover,
  getBlogTag,
  getViewCount,
  TopViewedStack,
  useRevealOnScroll
} from '../../components/blog/BlogListParts'
export default function BlogListPage() {
  const auth = useAuth()
  const [sp, setSp] = useSearchParams()
  const [tags, setTags] = useState<Tag[]>([])
  const [items, setItems] = useState<BlogCard[]>([])
  const [recentItems, setRecentItems] = useState<BlogCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recentIndex, setRecentIndex] = useState(0)
  const [searchDraft, setSearchDraft] = useState(sp.get('q') ?? '')

  const q = sp.get('q') ?? ''
  const page = Math.max(1, Number(sp.get('page') ?? '1') || 1)
  const sort = sp.get('sort') ?? 'created_at:desc'
  const tagValues = sp.getAll('tag')
  const tagKey = tagValues.join(',')
  const tagIds = useMemo(() => tagValues.map((x) => Number(x)).filter((x) => Number.isFinite(x)), [tagKey])
  const [sortBy, sortDir] = sort.split(':') as [string, 'asc' | 'desc']

  useEffect(() => {
    getBlogTags()
      .then(setTags)
      .catch(() => {})
  }, [])

  useEffect(() => {
    setSearchDraft(q)
  }, [q])

  useEffect(() => {
    let cancelled = false
    queryBlogs('page=1&page_size=4&sort_by=created_at&sort_dir=desc')
      .then((r) => {
        if (!cancelled) setRecentItems(r.items)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', '9')
    p.set('sort_by', sortBy)
    p.set('sort_dir', sortDir === 'asc' ? 'asc' : 'desc')
    if (q.trim()) p.set('q', q.trim())
    for (const t of tagIds) p.append('tag', String(t))
    return p.toString()
  }, [page, q, sortBy, sortDir, tagIds])

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

  const hero = recentItems[0] ?? items[0]
  const recent = recentItems
  const featured = items
  const activeRecent = recent[recentIndex] ?? recent[0] ?? null
  const activeRecentTag = getBlogTag(activeRecent)
  const topViewed = useMemo(() => {
    const source = recentItems.length ? recentItems : items
    if (!source.length) return []
    const sorted = [...source].sort((a, b) => getViewCount(b) - getViewCount(a))
    const best = sorted.slice(0, 3)
    const hasViews = best.some((b) => getViewCount(b) > 0)
    if (!hasViews) return source.slice(0, 3)
    return best
  }, [items, recentItems])
  const totalPages = Math.max(1, Math.ceil(total / 9))

  const recentReveal = useRevealOnScroll<HTMLElement>()
  const featuredReveal = useRevealOnScroll<HTMLElement>()
  const joinReveal = useRevealOnScroll<HTMLElement>()
  const featuredGridReveal = useRevealOnScroll<HTMLDivElement>()

  useEffect(() => {
    if (recentIndex < recent.length) return
    setRecentIndex(0)
  }, [recent.length, recentIndex])

  useEffect(() => {
    if (recent.length <= 1) return
    const id = window.setInterval(() => {
      setRecentIndex((current) => (current + 1) % recent.length)
    }, 4500)
    return () => window.clearInterval(id)
  }, [recent.length])

  function shiftRecent(direction: -1 | 1) {
    if (!recent.length) return
    setRecentIndex((current) => (current + direction + recent.length) % recent.length)
  }

  function updateFilters(next: { q?: string; sort?: string; tagId?: number | null; page?: number }) {
    const params = new URLSearchParams(sp)
    if (next.q !== undefined) {
      const text = next.q.trim()
      if (text) params.set('q', text)
      else params.delete('q')
      params.set('page', '1')
    }
    if (next.sort !== undefined) {
      params.set('sort', next.sort)
      params.set('page', '1')
    }
    if (next.tagId !== undefined) {
      params.delete('tag')
      if (next.tagId != null) params.append('tag', String(next.tagId))
      params.set('page', '1')
    }
    if (next.page !== undefined) {
      params.set('page', String(Math.max(1, next.page)))
    }
    setSp(params)
  }

  const previewBlogs = recent.length
    ? {
        prev: recent[(recentIndex - 1 + recent.length) % recent.length],
        next: recent[(recentIndex + 1) % recent.length],
      }
    : { prev: null, next: null }

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
          background: linear-gradient(135deg, #e7f8f1 0%, #ffffff 46%, rgba(53, 204, 149, 0.24) 100%);
        }
      `}</style>
      <section className="relative overflow-hidden px-4 pb-16 pt-10 md:pb-24 md:pt-16">
        <div className="pointer-events-none absolute inset-0">
          <div className="blog-list-light-bg" />
          <div className="blog-list-soft-overlay absolute inset-0" />
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

          <div className="blog-list-recent-stage mt-10">
            {activeRecent ? (
              <>
                <button type="button" className="blog-list-recent-side-btn blog-list-recent-side-btn--prev" aria-label="Previous recent blog" onClick={() => shiftRecent(-1)}>
                  <i className="fa-regular fa-arrow-left" aria-hidden="true" />
                </button>
                <button type="button" className="blog-list-recent-side-btn blog-list-recent-side-btn--next" aria-label="Next recent blog" onClick={() => shiftRecent(1)}>
                  <i className="fa-regular fa-arrow-right" aria-hidden="true" />
                </button>

                {previewBlogs.prev ? (
                  <button type="button" className="blog-list-recent-shadow blog-list-recent-shadow--left" onClick={() => shiftRecent(-1)} aria-label="Show previous recent blog">
                    <img src={getBlogCover(previewBlogs.prev)} alt="" />
                  </button>
                ) : null}

                <article className="blog-card-surface blog-list-recent-focus rounded-3xl p-3 md:p-5">
                  <div className="blog-list-recent-focus-media blog-card-media relative overflow-hidden rounded-3xl">
                    <Link to={`/blogs/${activeRecent.id}`} className="block h-full w-full">
                      <img
                        className="absolute inset-0 h-full w-full object-cover"
                        src={getBlogCover(activeRecent)}
                        alt={activeRecent.title}
                        fetchPriority="high"
                        decoding="async"
                      />
                    </Link>
                    {activeRecentTag ? (
                      <div className="absolute left-5 top-5">
                        <span className="blog-category-pill">
                          {activeRecentTag}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="blog-list-recent-focus-copy">
                    <div className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700">
                      Recent {recentIndex + 1} / {recent.length}
                    </div>
                    <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-tight text-neutral-900 sm:text-3xl md:text-4xl">
                      <Link to={`/blogs/${activeRecent.id}`}>{activeRecent.title}</Link>
                    </h3>

                    <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500">
                      <div className="flex items-center gap-2">
                        <img src="/figma/icon-user.svg" alt="" className="h-3.5 w-3.5" />
                        <span>{activeRecent.author.username}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img src="/figma/icon-calendar.svg" alt="" className="h-3.5 w-3.5" />
                        <span>{formatLongDate(activeRecent.created_at)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img src="/figma/icon-clock.svg" alt="" className="h-3.5 w-3.5" />
                        <span>{estimateReadMinutes(activeRecent.excerpt)} min read</span>
                      </div>
                    </div>

                    <div className="mt-6">
                      <Link
                        to={`/blogs/${activeRecent.id}`}
                        className="blog-theme-btn inline-flex h-11 items-center justify-center rounded-full bg-neutral-900 px-6 text-sm font-medium text-white"
                      >
                        Read more
                      </Link>
                    </div>

                    <div className="mt-6 flex gap-2">
                      {recent.map((item, index) => (
                        <button
                          key={item.id}
                          type="button"
                          className={`blog-list-recent-dot${index === recentIndex ? ' is-active' : ''}`}
                          aria-label={`Show recent blog ${index + 1}`}
                          onClick={() => setRecentIndex(index)}
                        />
                      ))}
                    </div>
                  </div>
                </article>

                {previewBlogs.next ? (
                  <button type="button" className="blog-list-recent-shadow blog-list-recent-shadow--right" onClick={() => shiftRecent(1)} aria-label="Show next recent blog">
                    <img src={getBlogCover(previewBlogs.next)} alt="" />
                  </button>
                ) : null}
              </>
            ) : (
              <div className="blog-card-surface rounded-3xl p-8 text-sm text-neutral-500">
                {loading ? 'Loading...' : 'No content'}
              </div>
            )}
          </div>
        </div>
      </section>

      <section ref={featuredReveal.ref} className={`px-4 pt-16 md:pt-24 reveal${featuredReveal.visible ? ' visible' : ''}`}>
        <div className="mx-auto max-w-[1200px]">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <h2 className="text-lg font-semibold text-neutral-900">Featured Blogs</h2>
              <span className="text-sm text-neutral-500">{total} total</span>
            </div>
            <form
              className="blog-list-filterbar"
              onSubmit={(event) => {
                event.preventDefault()
                updateFilters({ q: searchDraft })
              }}
            >
              <input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search blogs" />
              <select value={tagIds[0] ? String(tagIds[0]) : ''} onChange={(event) => updateFilters({ tagId: event.target.value ? Number(event.target.value) : null })}>
                <option value="">All tags</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={tag.id}>{displayBlogTagName(tag.name)}</option>
                ))}
              </select>
              <select value={sort} onChange={(event) => updateFilters({ sort: event.target.value })}>
                <option value="created_at:desc">Newest</option>
                <option value="created_at:asc">Oldest</option>
                <option value="title:asc">Title A-Z</option>
                <option value="title:desc">Title Z-A</option>
                <option value="view_count:desc">Most viewed</option>
                <option value="like_count:desc">Most liked</option>
              </select>
              <button type="submit">Search</button>
            </form>
          </div>

          <div
            ref={featuredGridReveal.ref}
            className={`mt-8 blog-list-featured-grid reveal-stagger${featuredGridReveal.visible ? ' visible' : ''}`}
          >
            {featured.map((b, idx) => (
              <FeaturedBlogGridCard
                key={b.id}
                blog={b}
                placeholderSrc={idx === 0 ? '/assets/images/blog/h2_1.png' : idx === 1 ? '/assets/images/blog/h2_2.png' : '/assets/images/blog/h2_3.png'}
              />
            ))}
            {!loading && featured.length === 0 ? (
              <div className="blog-card-surface rounded-3xl p-8 text-sm text-neutral-500">No blogs found.</div>
            ) : null}
          </div>
          <div className="blog-list-pagination">
            <button type="button" disabled={page <= 1} onClick={() => updateFilters({ page: page - 1 })}>
              Prev
            </button>
            <span>Page {page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => updateFilters({ page: page + 1 })}>
              Next
            </button>
          </div>
        </div>
      </section>

      <section
        ref={joinReveal.ref}
        className={`px-4 pt-16 md:pt-24 pb-16 reveal${joinReveal.visible ? ' visible' : ''}`}
      >
        <div className="mx-auto max-w-[1200px]">
          <div className="relative blog-list-join-grid rounded-3xl px-6 py-[60px] md:px-10">
            <div className="blog-list-light-bg rounded-3xl" />
            <div className="relative z-10 blog-list-join-col-main">
              <h2 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                Share your training insights
              </h2>
              <p className="mt-4 max-w-[520px] text-sm leading-relaxed md:text-base">
                Post your pose training tips, progress notes, and nutrition discoveries to help others stay consistent.
              </p>
              <div className="mt-6">
                <Link
                  to={auth.user ? '/blogs/new' : `/login?from=${encodeURIComponent('/blogs/new')}`}
                  className="blog-theme-btn inline-flex h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-medium text-neutral-900"
                >
                  {auth.user ? 'Write a post' : 'Login to write'}
                </Link>
              </div>
            </div>

            <div className="relative z-10 blog-list-join-col-side">
              {hero ? (
                <div className="blog-card-surface rounded-3xl p-3 text-neutral-900">
                  <div className="blog-card-media relative overflow-hidden rounded-3xl aspect-[16/9]">
                    <Link to={`/blogs/${hero.id}`} className="block h-full w-full">
                      <img
                        className="absolute inset-0 h-full w-full object-cover"
                        src={getBlogCover(hero)}
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



