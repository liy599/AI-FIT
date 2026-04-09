import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { API_BASE, apiFetch } from '../lib/api'
import AppButton from '../components/ui/AppButton'
import AppInput from '../components/ui/AppInput'
import AppTag from '../components/ui/AppTag'

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

export default function BlogListPage() {
  const [sp, setSp] = useSearchParams()
  const [tags, setTags] = useState<Tag[]>([])
  const [items, setItems] = useState<BlogCard[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const q = sp.get('q') ?? ''
  const tagIds = sp.getAll('tag').map((x) => Number(x)).filter((x) => Number.isFinite(x))
  const page = Number(sp.get('page') ?? '1') || 1

  useEffect(() => {
    apiFetch<Tag[]>('/api/tags', { auth: false })
      .then(setTags)
      .catch(() => {})
  }, [])

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', '12')
    if (q.trim()) p.set('q', q.trim())
    for (const t of tagIds) p.append('tag', String(t))
    return p.toString()
  }, [page, q, tagIds])

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
    next.set('page', '1')
    setSp(next)
  }

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Blog</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Blog</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cl_h2_blog-area pt-100 pb-100">
        <div className="container">
          <div className="row mb-40">
            <div className="col-xl-8 col-lg-7">
              <div className="cl_blog-widget mb-30">
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                  }}
                >
                  <AppInput
                    type="text"
                    placeholder="Search Here"
                    value={q}
                    onChange={(e) => {
                      const next = new URLSearchParams(sp)
                      next.set('q', e.target.value)
                      next.set('page', '1')
                      setSp(next)
                    }}
                  />
                  <button type="submit">
                    <i className="fa-sharp fa-light fa-magnifying-glass"></i>
                  </button>
                </form>
              </div>

              {tags.length ? (
                <div className="cl_blog-widget mb-30">
                  <h4 className="cl_blog-widget-title mb-35">Popular tags</h4>
                  <div className="cl_blog-widget-tag">
                    {tags.map((t) => {
                      const active = tagIds.includes(t.id)
                        return (
                          <AppTag key={t.id} as="button" active={active} onClick={() => toggleTag(t.id)}>
                            {t.name}
                          </AppTag>
                        )
                      })}
                  </div>
                </div>
              ) : null}

              {error ? <div className="cl_blog-widget mb-30">{error}</div> : null}
              {loading ? <div className="cl_blog-widget mb-30">Loading…</div> : null}
            </div>
            <div className="col-xl-4 col-lg-5">
              <div className="cl_blog-widget mb-30">
                <h4 className="cl_blog-widget-title mb-30">Summary</h4>
                <ul>
                  <li>
                    <span>
                      <span>
                        <i className="fa-light fa-chevrons-right"></i>Total
                      </span>{' '}
                      ({total})
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="row">
            {items.map((b) => (
              <div className="col-xl-4 col-lg-6 col-md-6" key={b.id}>
                <div className="cl_h2_blog-item mb-30 flex h-full flex-col">
                  <div className="cl_h2_blog-item-img overflow-hidden rounded-2xl">
                    <Link to={`/blogs/${b.id}`}>
                      <div className="relative w-full aspect-video overflow-hidden bg-slate-100">
                        <img
                          className="absolute inset-0 h-full w-full object-cover object-center"
                          src={resolveMediaUrl(b.cover_image_url) ?? '/assets/images/blog/h2_1.png'}
                          alt={b.title}
                        />
                      </div>
                    </Link>
                    <span>{b.tags[0]?.name ?? 'Our Blog'}</span>
                  </div>
                  <div className="cl_h2_blog-item-content flex flex-1 flex-col">
                    <div className="cl_h2_blog-item-content-meta">
                      <span>
                        <i className="fa-light fa-user"></i>
                        <span>BY {b.author.username}</span>
                      </span>
                      <span>
                        <i className="fa-light fa-calendar"></i>
                        <span>{new Date(b.created_at).toLocaleDateString()}</span>
                      </span>
                    </div>
                    <h4>
                      <Link to={`/blogs/${b.id}`} className="line-clamp-2">
                        {b.title}
                      </Link>
                    </h4>
                  </div>
                </div>
              </div>
            ))}

            {!loading && items.length === 0 ? (
              <div className="col-12">
                <div className="cl_blog-widget">No content</div>
              </div>
            ) : null}
          </div>

          <div className="row">
            <div className="col-12">
              <div className="cl_blog_details-reply-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>Page {page}</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <AppButton
                      type="button"
                      variant="neutral"
                      size="md"
                      disabled={page <= 1}
                      onClick={() => {
                        const next = new URLSearchParams(sp)
                        next.set('page', String(page - 1))
                        setSp(next)
                      }}
                    >
                      Prev
                    </AppButton>
                    <AppButton
                      type="button"
                      variant="neutral"
                      size="md"
                      disabled={page * 12 >= total}
                      onClick={() => {
                        const next = new URLSearchParams(sp)
                        next.set('page', String(page + 1))
                        setSp(next)
                      }}
                    >
                      Next
                    </AppButton>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
