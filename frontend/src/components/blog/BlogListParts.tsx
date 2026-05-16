import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { resolveBlogMediaUrl, type BlogCard } from '../../modules/blog'

export function resolveMediaUrl(url: string | null | undefined) {
  return resolveBlogMediaUrl(url)
}

export function formatLongDate(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function estimateReadMinutes(text: string) {
  const words = text.trim() ? text.trim().split(/\s+/).length : 0
  const minutes = Math.round(words / 200)
  return Math.max(1, minutes || 1)
}

export function clamp01(n: number) {
  if (n < 0) return 0
  if (n > 1) return 1
  return n
}

export function getViewCount(blog: BlogCard) {
  const v = (blog as unknown as { views?: unknown; view_count?: unknown; viewCount?: unknown }).views
  const vc = (blog as unknown as { views?: unknown; view_count?: unknown; viewCount?: unknown }).view_count
  const vcc = (blog as unknown as { views?: unknown; view_count?: unknown; viewCount?: unknown }).viewCount
  const n = Number(v ?? vc ?? vcc ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function useRevealOnScroll<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true)
      return
    }

    const el = ref.current
    if (!el) return

    const io = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (!entry) return
        if (entry.isIntersecting) {
          setVisible(true)
          return
        }

        const viewportH = window.innerHeight || 0
        if (entry.boundingClientRect.top >= viewportH) {
          setVisible(false)
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, visible }
}

type TeaserVariant = 'hero' | 'recentLarge' | 'recentSmall' | 'grid'

export function BlogTeaserCard({
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
            <img className="absolute inset-0 h-full w-full object-cover" src={cover} alt={blog.title} loading="lazy" decoding="async" />
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

export function FeaturedBlogGridCard({
  blog,
  placeholderSrc,
}: {
  blog: BlogCard
  placeholderSrc: string
}) {
  const cover = resolveMediaUrl(blog.cover_image_url) ?? placeholderSrc
  const tag = blog.tags[0]?.name ?? 'Our Blog'
  const minutes = estimateReadMinutes(blog.excerpt)

  return (
    <article className="group rounded-xl bg-white shadow-sm ring-1 ring-inset ring-neutral-200 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-md">
      <div className="flex h-full flex-col p-3">
        <div className="relative overflow-hidden rounded-xl bg-neutral-100 aspect-[16/9]">
          <Link to={`/blogs/${blog.id}`} className="block h-full w-full">
            <img
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              src={cover}
              alt={blog.title}
              loading="lazy"
              decoding="async"
            />
          </Link>
          <div className="absolute left-4 top-4">
            <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-neutral-900 shadow-sm">
              {tag}
            </span>
          </div>
        </div>

        <h3 className="mt-4 text-base font-semibold leading-snug tracking-tight text-neutral-900 line-clamp-2">
          <Link to={`/blogs/${blog.id}`}>{blog.title}</Link>
        </h3>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <img src="/figma/icon-calendar.svg" alt="" className="h-3.5 w-3.5" />
            <span>{formatLongDate(blog.created_at)}</span>
          </div>
          <div className="flex items-center gap-2">
            <img src="/figma/icon-clock.svg" alt="" className="h-3.5 w-3.5" />
            <span>{minutes} min read</span>
          </div>
        </div>

        <div className="mt-auto pt-5">
          <Link
            to={`/blogs/${blog.id}`}
            className="inline-flex h-10 w-full items-center justify-center rounded-full border border-neutral-900 bg-white px-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-white"
          >
            Read more
          </Link>
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

  return (
    <div className="w-[320px] sm:w-[380px] md:w-[420px] scale-75 origin-bottom rounded-[28px] border border-neutral-200 bg-white p-3 shadow-[0_22px_70px_rgba(0,0,0,0.12)]">
      <div className="relative overflow-hidden rounded-[28px] bg-neutral-100 aspect-[16/10]">
        {blog ? (
          <Link to={`/blogs/${blog.id}`} className="block h-full w-full">
            <img className="absolute inset-0 h-full w-full object-cover" src={cover} alt={title} loading="lazy" decoding="async" />
          </Link>
        ) : (
          <img className="absolute inset-0 h-full w-full object-cover" src={cover} alt="" loading="lazy" decoding="async" />
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
}

function getStackClass(position: number, count: number) {
  if (count <= 1) return 'blog-stack-pos-single'
  if (count === 2) return position === 0 ? 'blog-stack-pos-two-top' : 'blog-stack-pos-two-bottom'
  if (position === 0) return 'blog-stack-pos-top'
  if (position === 1) return 'blog-stack-pos-mid'
  return 'blog-stack-pos-back'
}

export function TopViewedStack({ blogs, loading }: { blogs: BlogCard[]; loading: boolean }) {
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
    <div className="relative mx-auto h-[285px] w-full max-w-[520px] sm:h-[315px]">
      {loading && blogs.length === 0 ? (
        <div className="absolute inset-0 flex items-end justify-center pb-2 text-sm text-neutral-500">Loading...</div>
      ) : null}

      {visible
        .slice()
        .reverse()
        .map((blog, rIndex) => {
          const position = count - 1 - rIndex
          const isTop = position === 0
          const shouldFade = !reducedMotion && fading && isTop && step !== 3 && blogs.length >= 3
          const stackClass = getStackClass(position, count)
          const fadeClass = shouldFade ? 'blog-stack-card-fading' : ''

          return (
            <div
              key={blog?.id ?? `placeholder-${position}`}
              className={`blog-stack-card absolute bottom-0 left-1/2 transition-[transform,opacity] duration-700 ease-out ${stackClass} ${fadeClass}`}
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
