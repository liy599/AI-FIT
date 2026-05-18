import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getAdminSummary, type AdminSummary } from '../../modules/admin'

const emptySummary: AdminSummary = {
  users: { total: 0, disabled: 0, admins: 0 },
  blogs: { total: 0, published: 0, drafts: 0 }
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

  const totalUsers = Math.max(1, summary.users.total)
  const totalBlogs = Math.max(1, summary.blogs.total)
  const activeUsers = Math.max(0, summary.users.total - summary.users.disabled)
  const activePct = Math.round((activeUsers / totalUsers) * 100)
  const publishedPct = Math.round((summary.blogs.published / totalBlogs) * 100)

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
          <div className="cl_blog-widget mb-30">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
              <div>
                <h4 className="cl_blog-widget-title mb-2">Admin workspace</h4>
                <p className="max-w-2xl text-sm leading-6 text-slate-600">
                  <span className="block">Manage account access and public community posts.</span>
                  <span className="block">Private meal records and training reports stay outside this console.</span>
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <SignalCard label="Active users" value={`${activePct}%`} caption={`${activeUsers} of ${summary.users.total || 0} accounts`} color="emerald" loading={loading} />
              <SignalCard label="Published content" value={`${publishedPct}%`} caption={`${summary.blogs.published} public posts`} color="sky" loading={loading} />
              <SignalCard label="Admins" value={String(summary.users.admins)} caption="Privileged accounts" color="amber" loading={loading} />
              <SignalCard label="Disabled" value={String(summary.users.disabled)} caption="Blocked from login" color="rose" loading={loading} />
            </div>
          </div>

          {error ? <div className="cl_blog-widget mb-30 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="cl_blog-widget mb-0">
              <h5 className="cl_blog-widget-title mb-4">Privacy boundaries</h5>
              <div className="space-y-3">
                <BoundaryLine label="Training reports" value="Not browsable by admins" />
                <BoundaryLine label="Meal records" value="Not browsable by admins" />
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
                detail="Review, unpublish, or remove public posts."
                to="/admin/blogs"
              />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function SignalCard(props: { label: string; value: string; caption: string; color: 'emerald' | 'sky' | 'amber' | 'rose'; loading: boolean }) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-slate-100 p-4 shadow-[0_10px_30px_rgba(15,23,42,0.1)] transition duration-200 hover:-translate-y-1 hover:bg-slate-50 hover:shadow-[0_18px_45px_rgba(15,23,42,0.16)] ${cardBorderTone(props.color)}`}>
      <div className={`absolute inset-x-0 top-0 h-1.5 ${dotTone(props.color)}`} />
      <div className={`absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 ${dotTone(props.color)}`} />
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-medium uppercase tracking-[0.08em] text-slate-600">{props.label}</div>
        <div className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] transition ${liveTone(props.color)}`}>
          Live
        </div>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold text-slate-950">{props.loading ? '-' : props.value}</div>
          <div className="mt-1 text-xs text-slate-600">{props.caption}</div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${softTone(props.color)} transition group-hover:scale-105`}>
          <span className={`h-3 w-3 rounded-full ${dotTone(props.color)}`} />
        </div>
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

function softTone(color: 'emerald' | 'sky' | 'amber' | 'rose') {
  if (color === 'sky') return 'bg-sky-100'
  if (color === 'amber') return 'bg-amber-100'
  if (color === 'rose') return 'bg-rose-100'
  return 'bg-emerald-100'
}

function cardBorderTone(color: 'emerald' | 'sky' | 'amber' | 'rose') {
  if (color === 'sky') return 'border-sky-200 hover:border-sky-400'
  if (color === 'amber') return 'border-amber-200 hover:border-amber-400'
  if (color === 'rose') return 'border-rose-200 hover:border-rose-400'
  return 'border-emerald-200 hover:border-emerald-400'
}

function liveTone(color: 'emerald' | 'sky' | 'amber' | 'rose') {
  if (color === 'sky') return 'bg-sky-100 text-sky-800 group-hover:bg-sky-200'
  if (color === 'amber') return 'bg-amber-100 text-amber-800 group-hover:bg-amber-200'
  if (color === 'rose') return 'bg-rose-100 text-rose-800 group-hover:bg-rose-200'
  return 'bg-emerald-100 text-emerald-800 group-hover:bg-emerald-200'
}

function dotTone(color: 'emerald' | 'sky' | 'amber' | 'rose') {
  if (color === 'sky') return 'bg-sky-500'
  if (color === 'amber') return 'bg-amber-500'
  if (color === 'rose') return 'bg-rose-500'
  return 'bg-emerald-500'
}
