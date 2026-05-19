import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildPaginationItems } from '../../lib/pagination'
import { deleteAdminUser, getAdminUserContact, listAdminUsers, updateAdminUser, type AdminUserItem } from '../../modules/admin'
import { useAuth } from '../../state/auth-context'

type BoolFilter = 'all' | 'yes' | 'no'
type UserSort = 'id:asc' | 'id:desc' | 'created_at:desc' | 'created_at:asc'

function toBoolFilter(value: BoolFilter) {
  if (value === 'yes') return true
  if (value === 'no') return false
  return null
}

export default function AdminUsersPage() {
  const auth = useAuth()
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [query, setQuery] = useState('')
  const [appliedQuery, setAppliedQuery] = useState('')
  const [adminFilter, setAdminFilter] = useState<BoolFilter>('all')
  const [disabledFilter, setDisabledFilter] = useState<BoolFilter>('all')
  const [sort, setSort] = useState<UserSort>('id:asc')
  const [items, setItems] = useState<AdminUserItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<number | null>(null)
  const [revealedEmails, setRevealedEmails] = useState<Record<number, string>>({})
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const [sortBy, sortDir] = sort.split(':') as [string, 'asc' | 'desc']
    setLoading(true)
    setError(null)
    listAdminUsers({
      page,
      pageSize,
      q: appliedQuery,
      isAdmin: toBoolFilter(adminFilter),
      isDisabled: toBoolFilter(disabledFilter),
      sortBy,
      sortDir
    })
      .then((r) => {
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [page, pageSize, appliedQuery, adminFilter, disabledFilter, sort])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const paginationItems = useMemo(() => buildPaginationItems(page, totalPages), [page, totalPages])

  const canEditUser = useMemo(() => {
    return (user: AdminUserItem) => user.id !== auth.user?.id
  }, [auth.user?.id])

  async function updateUser(user: AdminUserItem, payload: { is_admin?: boolean; is_disabled?: boolean }) {
    setSavingId(user.id)
    setError(null)
    try {
      const next = await updateAdminUser(user.id, payload)
      setItems((prev) => prev.map((item) => (item.id === next.id ? next : item)))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setSavingId(null)
    }
  }

  async function revealEmail(user: AdminUserItem) {
    if (revealedEmails[user.id]) return
    setSavingId(user.id)
    setError(null)
    try {
      const r = await getAdminUserContact(user.id)
      setRevealedEmails((prev) => ({ ...prev, [user.id]: r.email }))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reveal email')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteUser(user: AdminUserItem) {
    const confirmedName = window.prompt(
      `Delete user "${user.username}"?\n\nThis permanently removes the account and related blogs, comments, notifications, training records, likes, and uploads.\n\nType the username to confirm:`
    )
    if (confirmedName !== user.username) {
      if (confirmedName !== null) setError('Delete cancelled: username confirmation did not match.')
      return
    }

    setSavingId(user.id)
    setError(null)
    try {
      await deleteAdminUser(user.id, confirmedName)
      setItems((prev) => prev.filter((item) => item.id !== user.id))
      setTotal((prev) => Math.max(0, prev - 1))
      setRevealedEmails((prev) => {
        const next = { ...prev }
        delete next[user.id]
        return next
      })
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
                  <h2 className="cl_breadcrumb-content-title">Admin Users</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <Link to="/admin">Admin</Link>
                    <span>Users</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 brand-page-body">
        <div className="page-container space-y-5">
      <div className="cl_blog-widget mb-0">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-950">Admin Users</h1>
            <p className="mt-2 text-sm text-slate-600">Manage access, roles, and disabled accounts.</p>
          </div>
          <Link to="/admin" className="profile-btn-secondary">
            Admin home
          </Link>
        </div>
      </div>

      <div className="cl_blog-widget mb-0">
        <form
          className="admin-filter-form grid gap-3 md:grid-cols-[1fr_160px_160px_190px_96px]"
          onSubmit={(e) => {
            e.preventDefault()
            setPage(1)
            setAppliedQuery(query)
          }}
        >
          <input
            className="profile-input"
            value={query}
            placeholder="Search username or email"
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="profile-input" value={adminFilter} onChange={(e) => { setPage(1); setAdminFilter(e.target.value as BoolFilter) }}>
            <option value="all">All roles</option>
            <option value="yes">Admins</option>
            <option value="no">Non-admins</option>
          </select>
          <select className="profile-input" value={disabledFilter} onChange={(e) => { setPage(1); setDisabledFilter(e.target.value as BoolFilter) }}>
            <option value="all">All statuses</option>
            <option value="no">Active</option>
            <option value="yes">Disabled</option>
          </select>
          <select className="profile-input" value={sort} onChange={(e) => { setPage(1); setSort(e.target.value as UserSort) }}>
            <option value="id:asc">ID ascending</option>
            <option value="id:desc">ID descending</option>
            <option value="created_at:desc">Newest first</option>
            <option value="created_at:asc">Oldest first</option>
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
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Admin</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2">Created</th>
                    <th className="px-3 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => {
                    const self = u.id === auth.user?.id
                    const disabled = savingId === u.id
                    return (
                      <tr key={u.id} className="border-t border-slate-200">
                        <td className="px-3 py-2">{u.id}</td>
                        <td className="px-3 py-2">{u.username}{self ? ' (you)' : ''}</td>
                        <td className="px-3 py-2">
                          <span>{revealedEmails[u.id] ?? u.email_masked}</span>
                          {!revealedEmails[u.id] ? (
                            <button
                              type="button"
                              className="ml-2 inline-flex h-7 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={disabled}
                              onClick={() => revealEmail(u).catch(() => {})}
                            >
                              <i className="fa-regular fa-eye" aria-hidden="true" />
                              Reveal
                            </button>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{u.is_admin ? 'Yes' : 'No'}</td>
                        <td className="px-3 py-2">{u.is_disabled ? 'Disabled' : 'Active'}</td>
                        <td className="px-3 py-2">{new Date(u.created_at).toLocaleString()}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className={[
                                'inline-flex h-8 items-center gap-2.5 rounded-full px-3 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                                u.is_admin
                                  ? 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                                  : 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                              ].join(' ')}
                              disabled={disabled || !canEditUser(u)}
                              onClick={() => updateUser(u, { is_admin: !u.is_admin }).catch(() => {})}
                            >
                              <i className={u.is_admin ? 'fa-regular fa-user-xmark' : 'fa-regular fa-user-check'} aria-hidden="true" />
                              {u.is_admin ? 'Remove admin' : 'Make admin'}
                            </button>
                            <button
                              type="button"
                              className={[
                                'inline-flex h-8 items-center gap-2.5 rounded-full px-3 text-xs font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50',
                                u.is_disabled
                                  ? 'border border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
                                  : 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100'
                              ].join(' ')}
                              disabled={disabled || !canEditUser(u)}
                              onClick={() => updateUser(u, { is_disabled: !u.is_disabled }).catch(() => {})}
                            >
                              <i className={u.is_disabled ? 'fa-regular fa-unlock-alt' : 'fa-regular fa-lock'} aria-hidden="true" />
                              {u.is_disabled ? 'Enable' : 'Disable'}
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-2.5 rounded-full bg-rose-600 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                              disabled={disabled || !canEditUser(u)}
                              onClick={() => deleteUser(u).catch(() => {})}
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
                        No users found.
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
              <div className="admin-page-numbers" aria-label="Admin user pages">
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
