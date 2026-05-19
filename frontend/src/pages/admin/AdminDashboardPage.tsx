import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminSummary, type AdminSummary } from '../../modules/admin'

const emptySummary: AdminSummary = {
  users: { total: 0, disabled: 0, admins: 0 },
  blogs: { total: 0, published: 0, drafts: 0, unpublished: 0, restore_requested: 0 }
}

export default function AdminDashboardPage() {
  const [summary, setSummary] = useState<AdminSummary>(emptySummary)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getAdminSummary()
      .then(setSummary)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load admin summary'))
      .finally(() => setLoading(false))
  }, [])

  const activeUsers = Math.max(0, summary.users.total - summary.users.disabled)
  const activePct = percent(activeUsers, summary.users.total)
  const blogStats = normalizeBlogStats(summary)
  const publishedPct = percent(blogStats.published, blogStats.total)
  const disabledPct = percent(summary.users.disabled, summary.users.total)

  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Admin Workspace</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <span>Admin</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 brand-page-body">
        <div className="page-container">
          <div className="cl_blog-widget admin-stats-dashboard mb-30">
            <div className="admin-stats-head">
              <div>
                <h1>Admin Workspace Overview</h1>
                <p>
                  <span className="block">Manage account access and public community posts.</span>
                  <span className="block">Private training reports stay outside this console.</span>
                </p>
              </div>
            </div>

            <div className="admin-stats-summary">
              <SummaryPill icon="fa-light fa-users" label="Users" value={loading ? '-' : String(summary.users.total)} tone="emerald" />
              <SummaryPill icon="fa-light fa-newspaper" label="Blogs" value={loading ? '-' : String(blogStats.total)} tone="sky" />
              <SummaryPill icon="fa-light fa-user-shield" label="Admins" value={loading ? '-' : String(summary.users.admins)} tone="amber" />
              <SummaryPill icon="fa-light fa-rotate-left" label="Pending restore (blogs)" value={loading ? '-' : String(blogStats.restoreRequested)} tone="rose" />
            </div>

            <div className="admin-chart-row" aria-label="Admin workspace charts">
              <MiniDonut label="Active users" value={activePct} caption={`${activeUsers} active accounts`} tone="emerald" />
              <MiniDonut label="Published blogs" value={publishedPct} caption={`${blogStats.published} public posts`} tone="sky" />
              <MiniDonut label="Disabled users" value={disabledPct} caption={`${summary.users.disabled} blocked accounts`} tone="rose" />
            </div>
          </div>

          {error ? <div className="cl_blog-widget mb-30 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="cl_blog-widget mb-0">
              <h5 className="cl_blog-widget-title mb-4">Privacy boundaries</h5>
              <div className="space-y-3">
                <BoundaryLine label="Training reports" value="Not browsable by admins" />
                <BoundaryLine label="Email addresses" value="Masked until one-row reveal" />
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <AdminLink
                title="User Management"
                detail="Manage access, roles, and disabled accounts."
                to="/admin/users"
              />
              <AdminLink
                title="Blog Management"
                detail="Review, disable, restore, or remove public posts."
                to="/admin/blogs"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
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
    restoreRequested: safeNumber(summary.blogs.restore_requested),
  }
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

function BoundaryLine(props: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-50 px-4 py-3">
      <div className="text-sm font-medium text-slate-700">{props.label}</div>
      <div className="text-right text-xs text-slate-500">{props.value}</div>
    </div>
  )
}

function AdminLink(props: { title: string; detail: string; to: string }) {
  return (
    <Link to={props.to} className="cl_blog-widget group mb-0 block transition hover:-translate-y-0.5">
      <div className="flex items-center justify-between gap-4">
        <div className="text-lg font-semibold text-slate-950">{props.title}</div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition group-hover:border-emerald-300 group-hover:bg-emerald-100">
          Open
        </span>
      </div>
      <div className="mt-2 text-sm leading-6 text-slate-600">{props.detail}</div>
    </Link>
  )
}
