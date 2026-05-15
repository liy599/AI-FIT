import { useEffect, useState } from 'react'
import { listAdminUsers, type AdminUserItem } from '../../modules/admin'

export default function AdminUsersPage() {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [items, setItems] = useState<AdminUserItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    listAdminUsers(page, pageSize)
      .then((r) => {
        setItems(r.items)
        setTotal(r.total)
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load users'))
      .finally(() => setLoading(false))
  }, [page, pageSize])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Admin Users</h1>
        <p className="mt-2 text-sm text-slate-600">Browse accounts and admin status.</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? <div className="text-sm text-slate-600">Loading...</div> : null}
        {error ? <div className="text-sm text-rose-700">{error}</div> : null}

        {!loading && !error ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm text-slate-600">
              <div>
                Total: <span className="font-medium text-slate-900">{total}</span>
              </div>
              <div>
                Page <span className="font-medium text-slate-900">{page}</span> / {totalPages}
              </div>
            </div>

            <div className="overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Username</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Admin</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">{u.id}</td>
                      <td className="px-3 py-2">{u.username}</td>
                      <td className="px-3 py-2">{u.email}</td>
                      <td className="px-3 py-2">{u.is_admin ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2">{new Date(u.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {items.length === 0 ? (
                    <tr className="border-t border-slate-200">
                      <td className="px-3 py-6 text-center text-slate-500" colSpan={5}>
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Prev
              </button>
              <button
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

