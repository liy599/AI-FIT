import { useEffect, useState } from 'react'
import { getAdminLifecyclePolicy, runAdminLifecycleCleanup } from '../features/user'

type PolicyResponse = { retention_days: Record<string, number> }
type CleanupResponse = {
  ok: boolean
  dry_run: boolean
  retention_days: Record<string, number>
  summary: Record<string, { matched: number; deleted: number; deleted_files?: number }>
}

export default function AdminDataLifecyclePage() {
  const [retention, setRetention] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CleanupResponse | null>(null)

  useEffect(() => {
    setLoading(true)
    getAdminLifecyclePolicy<PolicyResponse>()
      .then((r) => setRetention(r.retention_days))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load policy'))
      .finally(() => setLoading(false))
  }, [])

  async function runCleanup(dryRun: boolean) {
    setRunning(true)
    setError(null)
    try {
      const r = await runAdminLifecycleCleanup<CleanupResponse>({ dry_run: dryRun, retention_days: retention })
      setResult(r)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cleanup request failed')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Admin Data Lifecycle</h1>
        <p className="mt-2 text-sm text-slate-600">Configure retention days and run dry-run before deletion.</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? <div className="text-sm text-slate-600">Loading policy...</div> : null}
        {!loading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(retention).map(([key, value]) => (
              <label key={key} className="text-sm">
                <div className="mb-1 font-medium">{key}</div>
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2"
                  value={value}
                  onChange={(e) =>
                    setRetention((prev) => ({
                      ...prev,
                      [key]: Math.max(1, Number(e.target.value) || 1)
                    }))
                  }
                />
              </label>
            ))}
          </div>
        ) : null}

        {error ? <div className="mt-3 text-sm text-rose-700">{error}</div> : null}

        <div className="mt-4 flex gap-2">
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={loading || running}
            onClick={() => void runCleanup(true)}
          >
            Dry-Run
          </button>
          <button
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            disabled={loading || running}
            onClick={() => void runCleanup(false)}
          >
            Execute Cleanup
          </button>
        </div>
      </div>

      {result ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold">Result</div>
          <pre className="mt-2 overflow-auto rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </div>
  )
}
