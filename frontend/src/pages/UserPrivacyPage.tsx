import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { previewOrDeleteMyData } from '../modules/user'
import { useAuth } from '../state/auth-context'

const TARGETS = [
  { key: 'workouts', label: 'Workouts' },
  { key: 'meals', label: 'Meals' },
  { key: 'trainings', label: 'Trainings' },
  { key: 'pose_media', label: 'Pose Media (videos/tasks)' },
  { key: 'feedback', label: 'Feedback' },
  { key: 'blogs', label: 'Blogs' },
  { key: 'comments', label: 'Comments' },
  { key: 'account', label: 'Delete My Account' }
] as const

type DeleteResponse = {
  ok: boolean
  dry_run: boolean
  before: string | null
  targets: string[]
  counts: Record<string, number>
}

export default function UserPrivacyPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<string[]>(['workouts'])
  const [beforeDays, setBeforeDays] = useState('180')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<DeleteResponse | null>(null)

  const accountSelected = useMemo(() => selected.includes('account'), [selected])

  function toggleTarget(key: string) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
  }

  async function submit(dryRun: boolean) {
    setBusy(true)
    setError(null)
    try {
      const payload = {
        targets: selected,
        before_days: beforeDays ? Number(beforeDays) : undefined,
        dry_run: dryRun,
        confirm: accountSelected ? confirmText : undefined
      }
      const r = await previewOrDeleteMyData(payload) as DeleteResponse
      setResult(r)
      if (!dryRun && accountSelected) {
        auth.logout()
        navigate('/')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Privacy Center</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose the data you want to remove. You can run a dry-run first to preview affected rows.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="text-sm font-semibold">Delete Targets</div>
          <div className="mt-3 privacy-grid-two-col">
          {TARGETS.map((item) => (
            <label key={item.key} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
              <input type="checkbox" checked={selected.includes(item.key)} onChange={() => toggleTarget(item.key)} />
              <span>{item.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium">Delete data older than N days (optional)</label>
          <input
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            value={beforeDays}
            onChange={(e) => setBeforeDays(e.target.value)}
            placeholder="e.g. 180"
          />
        </div>

        {accountSelected ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
            <div className="text-sm text-rose-700">Account deletion is irreversible.</div>
            <input
              className="mt-2 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Type DELETE_MY_ACCOUNT"
            />
          </div>
        ) : null}

        {error ? <div className="mt-3 text-sm text-rose-700">{error}</div> : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={busy || selected.length === 0}
            onClick={() => void submit(true)}
          >
            Preview (Dry-Run)
          </button>
          <button
            className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-500 disabled:opacity-50"
            disabled={busy || selected.length === 0}
            onClick={() => void submit(false)}
          >
            Delete Now
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

