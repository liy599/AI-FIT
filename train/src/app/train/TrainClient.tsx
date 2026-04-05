'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import LoginCtaCard from '@/components/LoginCtaCard'
import { useSession } from '@/lib/client/useSession'
import { NotLoggedInError, privateFetch, privateJson } from '@/lib/client/privateFetch'

type ExerciseItem = {
  id: string
  name: string
  isBuiltin: boolean
  isCustom: boolean
  movementType?: string
  categoryPath?: string[]
}
type TrainingSetItem = {
  exerciseId: string | null
  exerciseName: string
  reps: number
  weight: string
  note: string
}

type TrainingSessionDto = {
  id: string
  startedAt: string
  endedAt: string | null
  note: string | null
  report: unknown
  sets: {
    id: string
    order: number
    reps: number
    weight: number | null
    note: string | null
    exercise: { id: string; name: string; isBuiltin: boolean }
  }[]
}

async function readJsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const error =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null
    throw new Error(error ?? `HTTP ${res.status}`)
  }
  if (!data) throw new Error(`HTTP ${res.status}`)
  return data as T
}

export default function TrainClient({ trainingId }: { trainingId: string | null }) {
  const router = useRouter()
  const { loading: sessionLoading, session: authSession } = useSession()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exercises, setExercises] = useState<ExerciseItem[]>([])
  const [trainingSession, setTrainingSession] = useState<TrainingSessionDto | null>(null)
  const [sets, setSets] = useState<TrainingSetItem[]>([])
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [squatPromptHref, setSquatPromptHref] = useState<string | null>(null)

  const exerciseNameToId = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of exercises) map.set(e.name, e.id)
    return map
  }, [exercises])

  const isCompleted = !!trainingSession?.endedAt

  const refreshExercises = useCallback(async (query = '') => {
    const url = new URL('/api/v1/private/exercises', window.location.origin)
    if (query) url.searchParams.set('query', query)
    const data = await privateJson<{ items: ExerciseItem[] }>(url.toString(), { method: 'GET' })
    setExercises(data.items)
  }, [])

  const loadSessionById = useCallback(async (id: string) => {
    const data = await privateJson<{ session: TrainingSessionDto }>(`/api/v1/private/trainings/${encodeURIComponent(id)}`, {
      method: 'GET'
    })
    setTrainingSession(data.session)
    setNote(data.session.note ?? '')
    setSets(
      data.session.sets.map((s) => ({
        exerciseId: s.exercise.id,
        exerciseName: s.exercise.name,
        reps: s.reps,
        weight: s.weight === null ? '' : String(s.weight),
        note: s.note ?? ''
      }))
    )
  }, [])

  const loadActiveIfAny = useCallback(async () => {
    const data = await privateJson<{ session: null | { id: string } }>('/api/v1/private/trainings/active', { method: 'GET' })
    if (data.session?.id) router.replace(`/train/session?trainingId=${encodeURIComponent(data.session.id)}`)
  }, [router])

  useEffect(() => {
    let mounted = true

    async function run() {
      if (!authSession) {
        if (!mounted) return
        setLoading(false)
        return
      }
      try {
        await refreshExercises()
        if (!mounted) return

        if (trainingId) {
          await loadSessionById(trainingId)
        } else {
          await loadActiveIfAny()
        }
      } catch (e) {
        if (!mounted) return
        if (e instanceof NotLoggedInError) {
          setError(null)
          setLoading(false)
          return
        }
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    run()
    return () => {
      mounted = false
    }
  }, [trainingId, refreshExercises, loadActiveIfAny, loadSessionById, authSession])

  async function startTraining() {
    setError(null)
    setSaving(true)
    try {
      const res = await privateFetch('/api/v1/private/trainings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await readJsonOrThrow<{ session: { id: string } }>(res)
      router.replace(`/train/session?trainingId=${encodeURIComponent(data.session.id)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start training')
    } finally {
      setSaving(false)
    }
  }

  function addSet() {
    const squatId = exerciseNameToId.get('Squat') ?? exerciseNameToId.get('深蹲') ?? null
    setSets((prev) => [
      ...prev,
      {
        exerciseId: squatId,
        exerciseName: squatId ? 'Squat' : '深蹲',
        reps: 10,
        weight: '',
        note: ''
      }
    ])
  }

  function removeSet(index: number) {
    setSets((prev) => prev.filter((_, i) => i !== index))
  }

  async function persistTrainingOrThrow() {
    if (!trainingSession) throw new Error('No training session')
    const payload = {
      note,
      sets: sets
        .map((s) => ({
          exerciseId: s.exerciseId,
          reps: s.reps,
          weight: s.weight === '' ? null : Number(s.weight),
          note: s.note
        }))
        .filter((s) => typeof s.exerciseId === 'string' && s.exerciseId.length > 0)
    }

    const res = await privateFetch(`/api/v1/private/trainings/${encodeURIComponent(trainingSession.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await readJsonOrThrow<{ session: TrainingSessionDto }>(res)
    return data.session
  }

  async function saveTraining() {
    if (!trainingSession) return
    setError(null)
    setSaving(true)
    try {
      const nextSession = await persistTrainingOrThrow()
      setTrainingSession(nextSession)
      setNote(nextSession.note ?? '')
      setSets(
        nextSession.sets.map((s) => ({
          exerciseId: s.exercise.id,
          exerciseName: s.exercise.name,
          reps: s.reps,
          weight: s.weight === null ? '' : String(s.weight),
          note: s.note ?? ''
        }))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function completeTraining() {
    if (!trainingSession) return
    setError(null)
    setCompleting(true)
    try {
      const nextSession = await persistTrainingOrThrow()
      setTrainingSession(nextSession)
      setNote(nextSession.note ?? '')
      setSets(
        nextSession.sets.map((s) => ({
          exerciseId: s.exercise.id,
          exerciseName: s.exercise.name,
          reps: s.reps,
          weight: s.weight === null ? '' : String(s.weight),
          note: s.note ?? ''
        }))
      )

      const res = await privateFetch(`/api/v1/private/trainings/${encodeURIComponent(trainingSession.id)}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await readJsonOrThrow<{ session: { endedAt: string | null } }>(res)
      setTrainingSession((prev) => (prev ? { ...prev, endedAt: data.session.endedAt } : prev))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Complete failed')
    } finally {
      setCompleting(false)
    }
  }

  if (sessionLoading || loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Training</h1>
        <p>Loading…</p>
      </main>
    )
  }

  if (!authSession) {
    return (
      <main className="container page">
        <div className="pageTop">
          <div>
            <div className="pageTitle">Training</div>
            <div className="pageSub">Log your training and pick an exercise</div>
          </div>
        </div>
        <LoginCtaCard title="Sign in to start training" subtitle="When signed out, no private APIs are called (prevents 401 storms)" />
      </main>
    )
  }

  if (!trainingId || !trainingSession) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Training</h1>
        {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}
        <button onClick={startTraining} disabled={saving}>
          Start a training session
        </button>
        <p style={{ marginTop: 12 }}>
          Or go to <a href="/history">History</a> to view past sessions.
        </p>
      </main>
    )
  }

  return (
    <main style={{ padding: 24, maxWidth: 920 }}>
      <h1>Training</h1>
      <p style={{ color: '#555' }}>
        Started: {new Date(trainingSession.startedAt).toLocaleString('en-US')} {isCompleted ? '(Completed)' : ''}
      </p>

      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      <section style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <strong>Session note</strong>
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isCompleted}
          rows={3}
          style={{ width: '100%', marginTop: 8 }}
        />
      </section>

      <section style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>Exercises & sets</strong>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addSet} disabled={isCompleted}>
              Add a set
            </button>
            <button onClick={saveTraining} disabled={isCompleted || saving}>
              Save
            </button>
            <button onClick={completeTraining} disabled={isCompleted || completing || saving}>
              Complete
            </button>
          </div>
        </div>

        <datalist id="exercise-options">
          {exercises.map((e) => (
            <option key={e.id} value={e.name}>
              {e.categoryPath && e.categoryPath.length > 0 ? `${e.categoryPath.join(' - ')} - ${e.name}` : e.name}
            </option>
          ))}
        </datalist>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sets.length === 0 ? <p style={{ color: '#666' }}>No sets yet. Add your first set.</p> : null}
          {sets.map((s, idx) => {
            const isSquat = s.exerciseName.trim() === 'Squat' || s.exerciseName.trim() === '深蹲'

            return (
              <div key={idx} style={{ border: '1px solid #ddd', borderRadius: 8, padding: 12 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ flex: '1 1 240px' }}>
                    <div style={{ fontSize: 12, color: '#666' }}>Exercise</div>
                    <input
                      value={s.exerciseName}
                      onChange={(e) => {
                        const nextName = e.target.value
                        const nextId = exerciseNameToId.get(nextName) ?? null
                        setSets((prev) =>
                          prev.map((x, i) => (i === idx ? { ...x, exerciseName: nextName, exerciseId: nextId } : x))
                        )
                      }}
                      disabled={isCompleted}
                      list="exercise-options"
                      placeholder="Type or search an exercise name"
                      style={{ width: '100%', padding: 8 }}
                    />
                    {!isSquat ? <div style={{ marginTop: 8, fontSize: 12, color: '#b91c1c' }}>Only Squat is supported for now</div> : null}
                  </div>

                  <div style={{ width: 120 }}>
                    <div style={{ fontSize: 12, color: '#666' }}>Reps</div>
                    <input
                      type="number"
                      value={s.reps}
                      min={1}
                      max={500}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setSets((prev) => prev.map((x, i) => (i === idx ? { ...x, reps: v } : x)))
                      }}
                      disabled={isCompleted}
                      style={{ width: '100%', padding: 8 }}
                    />
                  </div>

                  <div style={{ width: 140 }}>
                    <div style={{ fontSize: 12, color: '#666' }}>Weight (kg)</div>
                    <input
                      type="number"
                      value={s.weight}
                      min={0}
                      step="0.5"
                      onChange={(e) => {
                        setSets((prev) => prev.map((x, i) => (i === idx ? { ...x, weight: e.target.value } : x)))
                      }}
                      disabled={isCompleted}
                      style={{ width: '100%', padding: 8 }}
                    />
                  </div>

                  <div style={{ flex: '2 1 260px' }}>
                    <div style={{ fontSize: 12, color: '#666' }}>Note</div>
                    <input
                      value={s.note}
                      onChange={(e) => setSets((prev) => prev.map((x, i) => (i === idx ? { ...x, note: e.target.value } : x)))}
                      disabled={isCompleted}
                      placeholder="e.g. RPE, notes, safety cues…"
                      style={{ width: '100%', padding: 8 }}
                    />
                  </div>

                  {!isCompleted ? (
                    <button onClick={() => removeSet(idx)} style={{ background: '#fff', border: '1px solid #ddd' }}>
                      Delete
                    </button>
                  ) : null}
                  
                  {s.exerciseId && isSquat ? (
                    <div style={{ width: '100%', marginTop: 8, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="btn btnOutline"
                        style={{ flex: 1, padding: '6px 0', fontSize: 12 }}
                        onClick={() => setSquatPromptHref(`/analysis?exerciseId=${s.exerciseId}`)}
                      >
                        Video analysis
                      </button>
                      <button
                        type="button"
                        className="btn btnOutline"
                        style={{ flex: 1, padding: '6px 0', fontSize: 12, color: 'var(--success)' }}
                        onClick={() => setSquatPromptHref(`/live?exerciseId=${s.exerciseId}`)}
                      >
                        Live coaching
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {isCompleted && trainingSession?.report ? (
        <section style={{ marginTop: 18, border: '1px solid #ddd', borderRadius: 12, padding: 12, background: '#fff' }}>
          <h2 style={{ marginTop: 0 }}>Saved report</h2>
          <details>
            <summary>View report JSON</summary>
            <pre style={{ marginTop: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12 }}>
              {JSON.stringify(trainingSession.report, null, 2)}
            </pre>
          </details>
        </section>
      ) : isCompleted ? (
        <section style={{ marginTop: 18, border: '1px solid #f59e0b', borderRadius: 12, padding: 12, background: '#fffbeb', color: '#92400e' }}>
          This training is completed, but no report was saved yet. Go back to Live Coaching to save it, or edit notes here and complete again.
        </section>
      ) : null}

      <section style={{ marginTop: 18 }}>
        <a href="/history">Go to History</a> · <a href="/exercises">Go to Exercises</a>
      </section>

      {squatPromptHref ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18
          }}
          onClick={() => setSquatPromptHref(null)}
        >
          <div className="card" style={{ width: 'min(520px, 100%)' }} onClick={(e) => e.stopPropagation()}>
            <div className="cardInner">
              <div style={{ fontWeight: 900, fontSize: 16 }}>Squat tips</div>
              <div style={{ marginTop: 10, display: 'grid', gap: 8, color: 'var(--muted)', fontSize: 14, lineHeight: 1.6 }}>
                <div>1) Keep your full body in the camera frame</div>
                <div>2) Stand in a clear side view facing the camera</div>
                <div>3) We take privacy seriously</div>
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 16, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                <button type="button" className="btn btnGhost" onClick={() => setSquatPromptHref(null)}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btnPrimary"
                  onClick={() => {
                    const href = squatPromptHref
                    setSquatPromptHref(null)
                    router.push(href)
                  }}
                >
                  Got it, continue
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}
