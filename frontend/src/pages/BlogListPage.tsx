import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE, apiFetch } from '../lib/api'

type Tag = { id: number; name: string }
type BlogCard = {
  id: number
  title: string
  excerpt: string
  cover_image_url: string | null
  author: { id: number; username: string }
  created_at: string
  tags: Tag[]
}

function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return url
}

function formatLongDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function estimateReadMinutes(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const minutes = Math.round(words / 200)
  return Math.max(1, minutes || 1)
}

function clamp01(n: number) {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

function getViewCount(blog: BlogCard) {
  const v = (blog as unknown as { views?: unknown; view_count?: unknown; viewCount?: unknown }).views
  const vc = (blog as unknown as { views?: unknown; view_count?: unknown; viewCount?: unknown }).view_count
  const vcc = (blog as unknown as { views?: unknown; view_count?: unknown; viewCount?: unknown }).viewCount
  const n = Number(v ?? vc ?? vcc ?? 0)
  return Number.isFinite(n) ? n : 0
}

type TeaserVariant = 'hero' | 'recentLarge' | 'recentSmall' | 'grid'

function BlogTeaserCard({
  blog,
  placeholderSrc,
  variant,
}: {
  blog: BlogCard
  placeholderSrc: string
  variant: TeaserVariant
}) {
  const cover = resolveMediaUrl(blog.cover_image_url) ?? placeholderSrc
  const tag = blog.tags[0]?.name ?? 'Our Blog'
  const minutes = estimateReadMinutes(blog.excerpt)

  const baseCard = 'rounded-3xl border border-neutral-200 bg-white overflow-hidden'
  const imageWrap =
    variant === 'hero'
      ? 'relative w-full overflow-hidden rounded-3xl bg-neutral-100 aspect-[16/9]'
      : variant === 'recentLarge'
        ? 'relative w-full overflow-hidden rounded-3xl bg-neutral-100 aspect-[16/10]'
        : 'relative w-full overflow-hidden rounded-3xl bg-neutral-100 aspect-[16/9]'

  const titleClass =
    variant === 'hero'
      ? 'mt-3 text-lg font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2'
      : variant === 'recentLarge'
        ? 'mt-3 text-xl font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2'
        : 'mt-3 text-base font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2'

  const metaTextClass = variant === 'hero' ? 'text-xs' : 'text-xs'

  return (
    <article className={baseCard}>
      <div className="p-3">
        <div className={imageWrap}>
          <Link to={`/blogs/${blog.id}`} className="block h-full w-full">
            <img className="absolute inset-0 h-full w-full object-cover" src={cover} alt={blog.title} />
          </Link>
          <div className="absolute left-4 top-4">
            <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-neutral-900 shadow-sm">
              {tag}
            </span>
          </div>
        </div>

        <h3 className={titleClass}>
          <Link to={`/blogs/${blog.id}`}>{blog.title}</Link>
        </h3>

        <div className={`mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 ${metaTextClass} text-neutral-500`}>
          <div className="flex items-center gap-2">
            <img src="/figma/icon-user.svg" alt="" className="h-3.5 w-3.5" />
            <span>{blog.author.username}</span>
          </div>
          <div className="flex items-center gap-2">
            <img src="/figma/icon-calendar.svg" alt="" className="h-3.5 w-3.5" />
            <span>{formatLongDate(blog.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <img src="/figma/icon-clock.svg" alt="" className="h-3.5 w-3.5" />
            <span>{minutes} min read</span>
          </div>
        </div>
      </div>
    </article>
  )
}

function TopViewedStackCard({
  blog,
  placeholderSrc,
}: {
  blog: BlogCard | null
  placeholderSrc: string
}) {
  const cover = blog ? resolveMediaUrl(blog.cover_image_url) ?? placeholderSrc : placeholderSrc
  const tag = blog?.tags[0]?.name ?? 'Popular'
  const title = blog?.title ?? 'Popular blog'
  const author = blog?.author.username ?? 'Wordcraft'
  const date = blog?.created_at ? formatLongDate(blog.created_at) : null
  const minutes = blog ? estimateReadMinutes(blog.excerpt) : null

  const content = (
    <div className="w-[320px] sm:w-[380px] md:w-[420px] scale-75 origin-bottom rounded-[28px] border border-neutral-200 bg-white p-3 shadow-[0_22px_70px_rgba(0,0,0,0.12)]">
      <div className="relative overflow-hidden rounded-[28px] bg-neutral-100 aspect-[16/10]">
        {blog ? (
          <Link to={`/blogs/${blog.id}`} className="block h-full w-full">
            <img className="absolute inset-0 h-full w-full object-cover" src={cover} alt={title} />
          </Link>
        ) : (
          <img className="absolute inset-0 h-full w-full object-cover" src={cover} alt="" />
        )}
        <div className="absolute left-4 top-4">
          <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-neutral-900 shadow-sm">
            {tag}
          </span>
        </div>
      </div>

      <div className="px-2 pb-2 pt-4">
        <div className="text-[11px] font-medium tracking-wide text-neutral-500">{author}</div>
        <div className="mt-1 text-base font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2">
          {blog ? <Link to={`/blogs/${blog.id}`}>{title}</Link> : title}
        </div>

        {blog ? (
          <>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
              <div className="flex items-center gap-2">
                <img src="/figma/icon-calendar.svg" alt="" className="h-3.5 w-3.5" />
                <span>{date}</span>
              </div>
              <div className="flex items-center gap-2">
                <img src="/figma/icon-clock.svg" alt="" className="h-3.5 w-3.5" />
                <span>{minutes} min read</span>
              </div>
            </div>

            <div className="mt-4">
              <Link
                to={`/blogs/${blog.id}`}
                className="inline-flex h-11 items-center justify-center rounded-full border border-neutral-900 bg-white px-6 text-sm font-medium text-neutral-900"
              >
                Read more
              </Link>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )

  return content
}

function getStackTransform(position: number, count: number) {
  if (count <= 1) return 'translateX(-50%) translateY(0px) rotate(0deg) scale(1)'
  if (count === 2) {
    if (position === 0) return 'translateX(-50%) translateY(0px) translateX(-66px) rotate(0deg) scale(1)'
    return 'translateX(-50%) translateY(14px) translateX(0px) rotate(5deg) scale(0.95)'
  }
  if (position === 0) return 'translateX(-50%) translateY(0px) translateX(-72px) rotate(0deg) scale(1)'
  if (position === 1) return 'translateX(-50%) translateY(14px) translateX(0px) rotate(5deg) scale(0.95)'
  return 'translateX(-50%) translateY(27px) translateX(72px) rotate(10deg) scale(0.92)'
}

function TopViewedStack({ blogs, loading }: { blogs: BlogCard[]; loading: boolean }) {
  const [step, setStep] = useState(0)
  const [fading, setFading] = useState(false)

  const reducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }, [])

  const padded = useMemo(() => {
    const out: (BlogCard | null)[] = blogs.slice(0, 3)
    while (out.length < 3) out.push(null)
    return out
  }, [blogs])

  useEffect(() => {
    if (reducedMotion) return
    if (blogs.length < 3) return

    if (step === 3) {
      const t = window.setTimeout(() => setStep(0), 120)
      return () => window.clearTimeout(t)
    }

    setFading(false)
    const fadeDelayMs = 1800
    const fadeDurationMs = 650

    const t1 = window.setTimeout(() => setFading(true), fadeDelayMs)
    const t2 = window.setTimeout(() => {
      setFading(false)
      setStep((s) => (s >= 2 ? 3 : s + 1))
    }, fadeDelayMs + fadeDurationMs)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [blogs.length, reducedMotion, step])

  const visible = reducedMotion ? padded : padded.slice(step)
  const count = visible.length

  return (
    <div className="relative mx-auto h-[380px] w-full max-w-[520px] sm:h-[420px]">
      {loading && blogs.length === 0 ? (
        <div className="absolute inset-0 flex items-end justify-center pb-2 text-sm text-neutral-500">Loading…</div>
      ) : null}

      {visible
        .slice()
        .reverse()
        .map((blog, rIndex) => {
          const position = count - 1 - rIndex
          const isTop = position === 0
          const shouldFade = !reducedMotion && fading && isTop && step !== 3 && blogs.length >= 3
          const baseTransform = getStackTransform(position, count)
          const transform = shouldFade ? `${baseTransform} translateY(10px)` : baseTransform

          return (
            <div
              key={blog?.id ?? `placeholder-${position}`}
              className="absolute bottom-0 left-1/2 transition-[transform,opacity] duration-700 ease-out"
              style={{
                transform,
                transformOrigin: '50% 100%',
                opacity: shouldFade ? 0 : 1,
                zIndex: 30 - position * 10,
                pointerEvents: shouldFade ? 'none' : undefined,
              }}
            >
              <TopViewedStackCard
                blog={blog}
                placeholderSrc={
                  position === 0
                    ? '/figma/featured-2.png'
                    : position === 1
                      ? '/figma/featured-3.png'
                      : '/figma/featured-4.png'
                }
              />
            </div>
          )
        })}
    </div>
  )
}

export default function BlogListPage() {
  const [sp, setSp] = useSearchParams()
  const [tags, setTags] = useState<Tag[]>([])
  const [items, setItems] = useState<BlogCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')

  const q = sp.get('q') ?? ''
  const tagIds = sp.getAll('tag').map((x) => Number(x)).filter((x) => Number.isFinite(x))

  useEffect(() => {
    apiFetch<Tag[]>('/api/tags', { auth: false })
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
    apiFetch<{ items: BlogCard[]; total: number }>(`/api/blogs?${queryString}`, { auth: false })
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

  return (
    <main className="bg-white">
      <style>{`
        @keyframes blogFadeUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .blog-fade-up {
          animation: blogFadeUp 700ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .blog-fade-up {
            animation: none;
          }
        }
      `}</style>
      <section className="bg-neutral-50 px-4 pb-20 pt-14 md:pb-32 md:pt-20">
        <div className="mx-auto grid max-w-[1200px] grid-cols-1 gap-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <div className="flex min-h-[220px] items-center lg:min-h-[420px]">
              <h1 className="text-[44px] font-semibold leading-[1.02] tracking-tight text-neutral-900 sm:text-[56px] md:text-[64px]">
                Fitness / Nutrition
                <br />
                Community
              </h1>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="flex items-end justify-center lg:justify-end">
              <TopViewedStack blogs={topViewed} loading={loading} />
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-14 md:py-20 blog-fade-up" style={{ animationDelay: '60ms' }}>
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight text-neutral-900 md:text-4xl">
            Recent Blogs
          </h2>

          {error ? <div className="mt-6 text-sm text-red-600">{error}</div> : null}

          <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-12 lg:items-start">
            <div className="lg:col-span-7">
              {recent[0] ? (
                <article>
                  <div className="relative overflow-hidden rounded-3xl bg-neutral-100 aspect-[16/9]">
                    <Link to={`/blogs/${recent[0].id}`} className="block h-full w-full">
                      <img
                        className="absolute inset-0 h-full w-full object-cover"
                        src={resolveMediaUrl(recent[0].cover_image_url) ?? '/figma/recent-1.png'}
                        alt={recent[0].title}
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
                  {loading ? 'Loading…' : 'No content'}
                </div>
              )}
            </div>

            <div className="lg:col-span-5">
              <div className="grid grid-cols-1 gap-8">
                {recent.slice(1, 4).map((b, idx) => (
                  <article key={b.id} className="rounded-3xl p-3 hover:bg-neutral-50">
                    <div className="flex items-start gap-5">
                      <div className="relative h-[110px] w-[150px] flex-none overflow-hidden rounded-2xl bg-neutral-100 sm:h-[120px] sm:w-[170px]">
                        <Link to={`/blogs/${b.id}`} className="block h-full w-full">
                          <img
                            className="absolute inset-0 h-full w-full object-cover"
                            src={
                              resolveMediaUrl(b.cover_image_url) ??
                              (idx === 0 ? '/figma/recent-2.png' : idx === 1 ? '/figma/recent-3.png' : '/figma/featured-1.png')
                            }
                            alt={b.title}
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
                            <span className="text-base leading-none">→</span>
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

      <section className="px-4 pt-16 md:pt-24 blog-fade-up" style={{ animationDelay: '140ms' }}>
        <div className="mx-auto max-w-[1200px]">
          <h2 className="text-center text-lg font-semibold text-neutral-900">Blog Categories</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {categoryPills.map((c) => {
              const active = c.id != null ? tagIds.includes(c.id) : false
              const interactive = c.id != null
              return (
                <button
                  key={c.name}
                  type="button"
                  disabled={!interactive}
                  onClick={interactive ? () => toggleTag(c.id as number) : undefined}
                  className={[
                    'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                    interactive ? 'border border-neutral-300' : 'border border-neutral-200 opacity-60',
                    active ? 'bg-neutral-900 text-white border-neutral-900' : 'bg-white text-neutral-900 hover:bg-neutral-50',
                  ].join(' ')}
                >
                  {c.name}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="px-4 pt-16 md:pt-24">
        <div className="mx-auto max-w-[1200px]">
          <div className="flex items-center justify-between gap-6">
            <h2 className="text-lg font-semibold text-neutral-900">Featured Blogs</h2>
            <div className="flex items-center gap-3">
              <div className="h-1 w-24 rounded-full bg-neutral-200">
                <div className="h-1 rounded-full bg-neutral-900" style={{ width: `${featuredProgress * 100}%` }} />
              </div>
              <div className="text-xs text-neutral-500">
                01 / {String(Math.max(1, Math.min(6, featuredCount))).padStart(2, '0')}
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {featured[0] ? (
              <div className="lg:col-span-3">
                <BlogTeaserCard blog={featured[0]} placeholderSrc="/figma/featured-1.png" variant="grid" />
              </div>
            ) : null}
            {featured[1] ? (
              <div className="lg:col-span-6">
                <BlogTeaserCard blog={featured[1]} placeholderSrc="/figma/featured-2.png" variant="grid" />
              </div>
            ) : null}
            {featured[2] ? (
              <div className="lg:col-span-3">
                <BlogTeaserCard blog={featured[2]} placeholderSrc="/figma/featured-3.png" variant="grid" />
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.slice(3, 7).map((b, idx) => (
              <BlogTeaserCard
                key={b.id}
                blog={b}
                placeholderSrc={idx === 0 ? '/figma/featured-4.png' : idx === 1 ? '/figma/featured-5.png' : '/figma/featured-1.png'}
                variant="grid"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pt-16 md:pt-24 blog-fade-up" style={{ animationDelay: '220ms' }}>
        <div className="mx-auto max-w-[1200px]">
          <div className="grid grid-cols-1 gap-8 rounded-3xl bg-neutral-950 px-6 py-10 text-white md:px-10 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-7">
              <h2 className="text-2xl font-semibold leading-tight tracking-tight md:text-3xl">
                Join the community –
                <br />
                Get Updates and Tips
              </h2>
              <p className="mt-4 max-w-[520px] text-sm leading-relaxed text-white/70 md:text-base">
                Get the latest articles, resources, and insights straight to your inbox.
              </p>

              <form
                className="mt-6 flex max-w-[520px] flex-col gap-3 sm:flex-row"
                onSubmit={(e) => {
                  e.preventDefault()
                }}
              >
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="h-11 flex-1 rounded-full bg-white/10 px-4 text-sm text-white placeholder:text-white/50 outline-none ring-1 ring-inset ring-white/15 focus:ring-white/30"
                />
                <button
                  type="submit"
                  className="h-11 rounded-full bg-white px-5 text-sm font-medium text-neutral-900"
                >
                  Subscribe
                </button>
              </form>
            </div>

            <div className="lg:col-span-5">
              {hero ? (
                <div className="rounded-3xl bg-white p-3 text-neutral-900">
                  <div className="relative overflow-hidden rounded-3xl bg-neutral-100 aspect-[16/9]">
                    <Link to={`/blogs/${hero.id}`} className="block h-full w-full">
                      <img
                        className="absolute inset-0 h-full w-full object-cover"
                        src={resolveMediaUrl(hero.cover_image_url) ?? '/figma/hero-card.png'}
                        alt={hero.title}
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
