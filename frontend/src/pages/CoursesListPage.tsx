import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'

type CourseCard = {
  id: number
  title: string
  cover_image_url: string | null
  instructor_name: string
  is_free: boolean
  price: number | null
  enroll_count: number
  avg_rating: number | null
}

export default function CoursesListPage() {
  const [sp, setSp] = useSearchParams()
  const [items, setItems] = useState<CourseCard[]>([])
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const q = sp.get('q') ?? ''
  const isFree = sp.get('is_free') ?? ''
  const sort = sp.get('sort') ?? 'new'
  const page = Number(sp.get('page') ?? '1') || 1

  const queryString = useMemo(() => {
    const p = new URLSearchParams()
    p.set('page', String(page))
    p.set('page_size', '12')
    p.set('sort', sort)
    if (q.trim()) p.set('q', q.trim())
    if (isFree) p.set('is_free', isFree)
    return p.toString()
  }, [page, q, isFree, sort])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    apiFetch<{ items: CourseCard[]; total: number }>(`/api/courses?${queryString}`)
      .then((r) => {
        if (cancelled) return
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : '加载失败')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [queryString])

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Courses</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Courses</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-70">
        <div className="container">
          <div className="row mb-40">
            <div className="col-xl-8 col-lg-7">
              <div className="cl_blog-widget mb-30">
                <form action="#" onSubmit={(e) => e.preventDefault()}>
                  <input
                    type="text"
                    placeholder="Search Course"
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
            </div>
            <div className="col-xl-4 col-lg-5">
              <div className="cl_blog-widget mb-30">
                <h4 className="cl_blog-widget-title mb-30">Filter</h4>
                <div style={{ display: 'grid', gap: 10 }}>
                  <select
                    value={isFree}
                    onChange={(e) => {
                      const next = new URLSearchParams(sp)
                      const v = e.target.value
                      if (!v) next.delete('is_free')
                      else next.set('is_free', v)
                      next.set('page', '1')
                      setSp(next)
                    }}
                  >
                    <option value="">全部</option>
                    <option value="true">免费</option>
                    <option value="false">付费</option>
                  </select>
                  <select
                    value={sort}
                    onChange={(e) => {
                      const next = new URLSearchParams(sp)
                      next.set('sort', e.target.value)
                      next.set('page', '1')
                      setSp(next)
                    }}
                  >
                    <option value="new">最新</option>
                    <option value="hot">最热</option>
                    <option value="rating">评分最高</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {error ? (
            <div className="row">
              <div className="col-12">
                <div className="cl_blog-widget mb-30">{error}</div>
              </div>
            </div>
          ) : null}
          {loading ? (
            <div className="row">
              <div className="col-12">
                <div className="cl_blog-widget mb-30">Loading…</div>
              </div>
            </div>
          ) : null}

          <div className="row">
            {items.map((c) => (
              <div className="col-xl-4 col-md-6" key={c.id}>
                <div className="cl_price-item mb-30">
                  <span className="cl_price-item-subtitle">{c.is_free ? 'FREE' : 'PREMIUM'}</span>
                  <h4 className="cl_price-item-title">{c.title}</h4>
                  <h2 className="cl_price-item-amount">
                    {c.is_free ? '0' : c.price ?? '-'}
                    <span>{c.is_free ? '' : ' / course'}</span>
                  </h2>
                  <ul className="cl_price-item-feature">
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>讲师：{c.instructor_name}
                    </li>
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>报名人数：{c.enroll_count}
                    </li>
                    <li>
                      <i className="fa-sharp fa-light fa-check"></i>评分：{c.avg_rating ? c.avg_rating.toFixed(1) : '-'}
                    </li>
                  </ul>
                  <div className="cl_price-item-btn">
                    <Link to={`/courses/${c.id}`}>View Details</Link>
                  </div>
                </div>
              </div>
            ))}
            {!loading && items.length === 0 ? (
              <div className="col-12">
                <div className="cl_blog-widget mb-30">暂无课程</div>
              </div>
            ) : null}
          </div>

          <div className="row">
            <div className="col-12">
              <div className="cl_blog_details-reply-item">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>Total: {total}</div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button
                      type="button"
                      disabled={page <= 1}
                      onClick={() => {
                        const next = new URLSearchParams(sp)
                        next.set('page', String(page - 1))
                        setSp(next)
                      }}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      disabled={page * 12 >= total}
                      onClick={() => {
                        const next = new URLSearchParams(sp)
                        next.set('page', String(page + 1))
                        setSp(next)
                      }}
                    >
                      Next
                    </button>
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

