import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildPaginationItems } from '../../lib/pagination'
import { deleteAdminBlog, getAdminSummary, listAdminBlogs, updateAdminBlog, type AdminBlogItem, type AdminSummary } from '../../modules/admin'

type PublishFilter = 'all' | 'published' | 'unpublished' | 'restore_requested' | 'draft'
type BlogSort = 'id:asc' | 'id:desc' | 'updated_at:desc' | 'updated_at:asc' | 'view_count:desc' | 'like_count:desc'

const emptySummary: AdminSummary = {
  users: { total: 0, disabled: 0, admins: 0 },
  blogs: { total: 0, published: 0, drafts: 0, unpublished: 0, restore_requested: 0 }
}

function statusLabel(blog: AdminBlogItem) {
  if (blog.status === 'published') return 'Published'
  if (blog.status === 'unpublished') return 'Admin disabled'
  return 'Draft'
}

export default function AdminBlogsPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [publishFilter, setPublishFilter] = useState<PublishFilter>('all')
  const [sort, setSort] = useState<BlogSort>('id:asc')
  const [items, setItems] = useState<AdminBlogItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<AdminSummary>(emptySummary)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setSummaryLoading(true)
    getAdminSummary()
      .then(setSummary)
      .catch(() => {})
      .finally(() => setSummaryLoading(false))
  }, [total])

  useEffect(() => {
    const [sortBy, sortDir] = sort.split(':') as [string, 'asc' | 'desc']
    setLoading(true)
    setError(null)
    listAdminBlogs({
      page,
      pageSize,
      q: appliedQuery,
      status: publishFilter === 'all' ? null : publishFilter,
      sortBy,
      sortDir
    })
      .then((r) => {
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load blogs'))
      .finally(() => setLoading(false))
  }, [page, pageSize, appliedQuery, publishFilter, sort])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const paginationItems = useMemo(() => buildPaginationItems(page, totalPages), [page, totalPages])
  const blogStats = normalizeBlogStats(summary)
  const totalBlogs = blogStats.total
  const publishedPct = percent(blogStats.published, totalBlogs)
  const draftPct = percent(blogStats.drafts, totalBlogs)
  const disabledPct = percent(blogStats.disabled, totalBlogs)
  const restorePct = percent(blogStats.restoreRequested, totalBlogs)

  async function togglePublish(blog: AdminBlogItem) {
    setSavingId(blog.id)
    setError(null)
    try {
      const next = await updateAdminBlog(blog.id, { action: blog.status === 'unpublished' ? 'restore' : 'disable' })
      setItems((prev) => prev.map((item) => (item.id === next.id ? next : item)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteBlog(blog: AdminBlogItem) {
    const confirmed = window.confirm(`Delete blog "${blog.title}"? This cannot be undone.`)
    if (!confirmed) return
    setSavingId(blog.id)
    setError(null)
    try {
      await deleteAdminBlog(blog.id)
      setItems((prev) => prev.filter((item) => item.id !== blog.id))
      setTotal((prev) => Math.max(0, prev - 1))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Admin Blogs</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <Link to="/admin">Admin</Link>
                    <span>Blogs</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 brand-page-body">
        <div className="page-container space-y-5">
      <div className="cl_blog-widget admin-stats-dashboard mb-0">
        <div className="admin-stats-head">
          <div>
            <h1>Blog Management Overview</h1>
            <p>Publication health, moderation workload, and content review signals.</p>
          </div>
          <Link to="/admin" className="profile-btn-secondary">
            Admin home
          </Link>
        </div>

        <div className="admin-stats-summary">
          <SummaryPill icon="fa-light fa-newspaper" label="Total blogs" value={summaryLoading ? '-' : String(totalBlogs)} tone="emerald" />
          <SummaryPill icon="fa-light fa-eye" label="Published" value={summaryLoading ? '-' : String(blogStats.published)} tone="sky" />
          <SummaryPill icon="fa-light fa-ban" label="Admin disabled" value={summaryLoading ? '-' : String(blogStats.disabled)} tone="rose" />
          <SummaryPill icon="fa-light fa-rotate-left" label="Pending restore (blogs)" value={summaryLoading ? '-' : String(blogStats.restoreRequested)} tone="amber" />
        </div>

        <div className="admin-chart-row" aria-label="Blog status charts">
          <MiniDonut label="Published" value={publishedPct} caption={`${blogStats.published} visible`} tone="sky" />
          <MiniDonut label="Drafts" value={draftPct} caption={`${blogStats.drafts} drafts`} tone="amber" />
          <MiniDonut label="Admin disabled" value={disabledPct} caption={`${blogStats.disabled} hidden by admin`} tone="rose" />
        </div>

      </div>

      <div className="cl_blog-widget mb-0">
        <form
          className="admin-filter-form grid gap-3 md:grid-cols-[1fr_170px_190px_96px]"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setAppliedQuery(query)
          }}
        >
          <input className="profile-input" value={query} placeholder="Search title or author" onChange={(e) => setQuery(e.target.value)} />
          <select className="profile-input" value={publishFilter} onChange={(e) => { setPage(1); setPublishFilter(e.target.value as PublishFilter) }}>
            <option value="all">All posts</option>
            <option value="published">Published</option>
            <option value="unpublished">Admin disabled</option>
            <option value="restore_requested">Pending restore (blogs)</option>
            <option value="draft">Draft</option>
          </select>
          <select className="profile-input" value={sort} onChange={(e) => { setPage(1); setSort(e.target.value as BlogSort) }}>
            <option value="id:asc">ID ascending</option>
            <option value="id:desc">ID descending</option>
            <option value="updated_at:desc">Recently updated</option>
            <option value="updated_at:asc">Oldest updated</option>
            <option value="view_count:desc">Most viewed</option>
            <option value="like_count:desc">Most liked</option>
          </select>
          <button type="submit" className="profile-btn-primary">
            Search
          </button>
        </form>
      </div>

      <div className="cl_blog-widget mb-0">
        {loading ? <div className="text-sm text-slate-600">Loading...</div> : null}
        {error ? <div className="mb-3 text-sm text-rose-700">{error}</div> : null}

        {!loading ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <div>Total: <span className="font-medium text-slate-900">{total}</span></div>
              <div>Page <span className="font-medium text-slate-900">{page}</span> / {totalPages}</div>
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="w-[280px] px-3 py-2">Title / Content</th>
                    <th className="px-3 py-2">Author</th>
                    <th className="min-w-[140px] px-3 py-2">Status</th>
                    <th className="px-3 py-2">Views</th>
                    <th className="px-3 py-2">Likes</th>
                    <th className="px-3 py-2">Updated</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((blog) => {
                    const busy = savingId === blog.id
                    return (
                      <tr key={blog.id} className="border-t border-slate-200 align-top">
                        <td className="w-[280px] max-w-[280px] px-3 py-2">
                          <div className="admin-blog-title-cell font-medium text-slate-950">{blog.title}</div>
                          <div className="admin-blog-excerpt-cell mt-1 text-xs text-slate-500">{blog.excerpt}</div>
                        </td>
                        <td className="px-3 py-2">{blog.author.username}</td>
                        <td className="px-3 py-2">
                          <div>{statusLabel(blog)}</div>
                          {blog.restore_requested ? <div className="mt-1 whitespace-nowrap text-xs font-semibold text-emerald-700">Restore requested</div> : null}
                        </td>
                        <td className="px-3 py-2">{blog.view_count}</td>
                        <td className="px-3 py-2">{blog.like_count}</td>
                        <td className="px-3 py-2">{new Date(blog.updated_at).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <div className="flex min-w-[260px] flex-nowrap gap-2">
                            {blog.status !== 'draft' ? (
                              <Link className="inline-flex h-8 items-center gap-2.5 rounded-full border border-sky-200 bg-sky-50 px-3 text-xs font-semibold text-sky-800 shadow-sm transition hover:bg-sky-100" to={`/blogs/${blog.id}`}>
                                <i className="fa-regular fa-eye" aria-hidden="true" />
                                View
                              </Link>
                            ) : null}
                            {blog.status !== 'draft' ? (
                              <button
                                type="button"
                                className={[
                                  'inline-flex h-8 items-center gap-2.5 rounded-full px-3 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                                  blog.status === 'published'
                                    ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                    : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                ].join(' ')}
                                disabled={busy}
                                onClick={() => togglePublish(blog).catch(() => {})}
                              >
                                <i className={blog.status === 'published' ? 'fa-regular fa-eye-slash' : 'fa-regular fa-check'} aria-hidden="true" />
                                {blog.status === 'published' ? 'Disable' : 'Restore'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-2.5 rounded-full bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={busy}
                              onClick={() => deleteBlog(blog).catch(() => {})}
                            >
                              <i className="fa-regular fa-trash" aria-hidden="true" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {items.length === 0 ? (
                    <tr className="border-t border-slate-200">
                      <td className="px-3 py-6 text-center text-slate-500" colSpan={7}>
                        No blogs found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="admin-pagination">
              <button type="button" disabled={page <= 1} onClick={() => setPage(1)}>
                First
              </button>
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Prev
              </button>
              <div className="admin-page-numbers" aria-label="Admin blog pages">
                {paginationItems.map((item, index) =>
                  item === 'ellipsis' ? (
                    <span key={`ellipsis-${index}`} className="admin-page-ellipsis">...</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      className={item === page ? 'is-active' : ''}
                      aria-current={item === page ? 'page' : undefined}
                      onClick={() => setPage(item)}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next
              </button>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage(totalPages)}>
                Last
              </button>
            </div>
          </div>
        ) : null}
      </div>
        </div>
      </section>
    </>
  )
}

function percent(value: number, total: number) {
  if (total <= 0) return 0
  return Math.round((value / total) * 100)
}

function safeNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeBlogStats(summary: AdminSummary) {
  return {
    total: safeNumber(summary.blogs.total),
    published: safeNumber(summary.blogs.published),
    drafts: safeNumber(summary.blogs.drafts),
    disabled: safeNumber(summary.blogs.unpublished),
    restoreRequested: safeNumber(summary.blogs.restore_requested),
  }
}

function SummaryPill(props: { icon: string; label: string; value: string; tone: 'emerald' | 'sky' | 'amber' | 'rose' }) {
  return (
    <div className={`admin-summary-pill admin-summary-pill-${props.tone}`}>
      <i className={props.icon} aria-hidden="true" />
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function MiniDonut(props: { label: string; value: number; caption: string; tone: 'emerald' | 'sky' | 'amber' | 'rose' }) {
  return (
    <div className={`admin-mini-chart admin-mini-chart-${props.tone}`}>
      <div className="admin-mini-donut" style={{ background: `conic-gradient(var(--admin-chart-color) ${props.value}%, #e2e8f0 0)` }}>
        <span>{props.value}%</span>
      </div>
      <div>
        <div className="admin-mini-chart-label">{props.label}</div>
        <div className="admin-mini-chart-caption">{props.caption}</div>
      </div>
    </div>
  )
}
