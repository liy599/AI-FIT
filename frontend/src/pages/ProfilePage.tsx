import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { API_BASE, apiFetch, apiUpload, resolveBackendUrl } from '../lib/api'
import { getPoseExerciseByType } from '../lib/pose/exercises'
import { listPoseTrainings, type PoseTrainingSession } from '../lib/poseApi'
import { buildTrainingRecordName } from '../lib/pose/trainingName'
import { useAuth } from '../state/auth-context'

type Profile = {
  id: number
  username: string
  email: string
  avatar_url: string | null
  gender: string | null
  height: number | null
  weight: number | null
  fitness_goal: string | null
  created_at: string
  updated_at: string
}

type Workout = {
  id: number
  exercise_type: string
  duration: number | null
  calories_burned: number | null
  form_score: number | null
  notes: string | null
  workout_date: string
}

type MealHistory = {
  id: number
  mealType: string
  recordedOn: string
  items: Array<{
    id: number
    grams: number
    foodId: number
    food: {
      id: number
      displayName: string
      name: string
    } | null
  }>
  totals: {
    kcal: number
    protein: number
    fat: number
    carbs: number
  }
}

type MyBlog = {
  id: number
  title: string
  cover_image_url: string | null
  is_published: boolean
  created_at: string
  updated_at: string
}

type MyComment = {
  id: number
  blog_id: number
  content: string
  created_at: string
}

type Tag = { id: number; name: string }

export default function ProfilePage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'Profile' | 'Workouts' | 'Meals' | 'Report' | 'History' | 'Blogs' | 'Comments'>('Profile')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<number | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [meals, setMeals] = useState<MealHistory[]>([])
  const [myBlogs, setMyBlogs] = useState<MyBlog[]>([])
  const [myComments, setMyComments] = useState<MyComment[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const [poseMonth, setPoseMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [poseSelectedYmd, setPoseSelectedYmd] = useState(() => formatYmdLocal(new Date()))
  const [poseSessions, setPoseSessions] = useState<PoseTrainingSession[]>([])
  const [poseLoading, setPoseLoading] = useState(false)
  const [poseError, setPoseError] = useState<string | null>(null)

  const [edit, setEdit] = useState<{
    username: string
    gender: string
    height: string
    weight: string
    fitness_goal: string
  } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const [newBlog, setNewBlog] = useState<{
    title: string
    content: string
    tag_ids: number[]
    is_published: boolean
    cover_image_url: string | null
  }>({
    title: '',
    content: '',
    tag_ids: [],
    is_published: false,
    cover_image_url: null
  })

  const report = useMemo(() => {
    const now = new Date()
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const wk = workouts.filter((w) => new Date(w.workout_date) >= since)
    const dt = meals.filter((meal) => new Date(meal.recordedOn) >= since)
    const totalDuration = wk.reduce((acc, w) => acc + (w.duration ?? 0), 0)
    const avgForm = wk.length ? wk.reduce((acc, w) => acc + (w.form_score ?? 0), 0) / wk.length : null
    const totalCaloriesIn = dt.reduce((acc, meal) => acc + meal.totals.kcal, 0)
    const days = 7
    return {
      totalDuration,
      avgForm,
      avgCaloriesIn: totalCaloriesIn ? totalCaloriesIn / days : null
    }
  }, [workouts, meals])

  const poseSessionsByDay = useMemo(() => {
    const map = new Map<string, PoseTrainingSession[]>()
    for (const session of poseSessions) {
      const key = formatYmdLocal(new Date(session.started_at))
      const prev = map.get(key)
      if (prev) prev.push(session)
      else map.set(key, [session])
    }
    for (const list of map.values()) list.sort((a, b) => (a.started_at < b.started_at ? -1 : a.started_at > b.started_at ? 1 : 0))
    return map
  }, [poseSessions])

  useEffect(() => {
    if (tab !== 'History') return
    const year = poseMonth.getFullYear()
    const month = poseMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const dateFrom = `${year}-${pad2(month + 1)}-01`
    const dateTo = `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`

    let active = true
    setPoseLoading(true)
    setPoseError(null)
    ;(async () => {
      let page = 1
      const page_size = 50
      let all: PoseTrainingSession[] = []
      while (true) {
        const r = await listPoseTrainings({ page, page_size, date_from: dateFrom, date_to: dateTo })
        all = all.concat(r.items)
        if (all.length >= r.total) break
        page += 1
        if (page > 100) break
      }
      if (!active) return
      setPoseSessions(all)
      setPoseLoading(false)
      setPoseError(null)
    })().catch((e: unknown) => {
      if (!active) return
      setPoseLoading(false)
      setPoseError(e instanceof Error ? e.message : 'Failed to load training history')
    })

    return () => {
      active = false
    }
  }, [tab, poseMonth])

  useEffect(() => {
    if (tab !== 'History') return
    const year = poseMonth.getFullYear()
    const month = pad2(poseMonth.getMonth() + 1)
    const prefix = `${year}-${month}-`
    if (!poseSelectedYmd.startsWith(prefix)) setPoseSelectedYmd(`${prefix}01`)
  }, [tab, poseMonth, poseSelectedYmd])

  function flashNotice(message: string) {
    setNotice(message)
    if (noticeTimerRef.current != null) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2500)
  }

  async function loadProfile() {
    const p = await apiFetch<Profile>('/api/user/profile')
    setProfile(p)
    setEdit((curr) => {
      if (isEditing && curr) return curr
      return {
        username: p.username,
        gender: p.gender ?? '',
        height: p.height != null ? String(p.height) : '',
        weight: p.weight != null ? String(p.weight) : '',
        fitness_goal: p.fitness_goal ?? ''
      }
    })
  }

  function resolveAvatarUrl(url: string | null | undefined) {
    if (!url) return null
    return resolveBackendUrl(url)
  }

  async function onPickAvatar(file: File) {
    setError(null)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5MB or smaller')
      return
    }
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await apiUpload<{ avatar_url: string }>('/api/user/avatar', form)
      setProfile((p) => (p ? { ...p, avatar_url: r.avatar_url } : p))
      if (auth.user) auth.setUser({ ...auth.user, avatar_url: r.avatar_url })
      flashNotice('Avatar updated')
    } catch (e: unknown) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        setError(
          `Cannot reach backend upload endpoint: ${API_BASE}. Make sure the backend is running, set VITE_API_BASE to http://127.0.0.1:5000, then restart the frontend.`
        )
        return
      }
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function onPickCover(file: File) {
    setError(null)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5MB or smaller')
      return
    }
    setCoverUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await apiUpload<{ cover_image_url: string }>('/api/blogs/cover', form)
      setNewBlog((b) => ({ ...b, cover_image_url: r.cover_image_url }))
      flashNotice('Cover uploaded')
    } catch (e: unknown) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        setError(`Cannot reach backend upload endpoint: ${API_BASE}`)
        return
      }
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setCoverUploading(false)
    }
  }

  async function loadWorkouts() {
    const r = await apiFetch<{ items: Workout[] }>('/api/workouts?page=1&page_size=20')
    setWorkouts(r.items)
  }

  async function loadMeals() {
    const r = await apiFetch<{ items: MealHistory[] }>('/api/meals/history?page=1&page_size=20')
    setMeals(r.items)
  }

  async function loadMyBlogs() {
    const r = await apiFetch<{ items: MyBlog[] }>('/api/user/blogs?page=1&page_size=20')
    setMyBlogs(r.items)
  }

  async function loadMyComments() {
    const r = await apiFetch<{ items: MyComment[] }>('/api/user/comments?page=1&page_size=20')
    setMyComments(r.items)
  }

  useEffect(() => {
    setError(null)
    loadProfile().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
    apiFetch<Tag[]>('/api/tags', { auth: false }).then(setTags).catch(() => {})
    loadWorkouts().catch(() => {})
    loadMeals().catch(() => {})
    loadMyBlogs().catch(() => {})
    loadMyComments().catch(() => {})

    return () => {
      if (noticeTimerRef.current != null) window.clearTimeout(noticeTimerRef.current)
    }
  }, [])

  async function saveProfile() {
    if (!edit) return
    setError(null)
    try {
      const p = await apiFetch<Profile>('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify({
          username: edit.username,
          gender: edit.gender || null,
          height: edit.height ? Number(edit.height) : null,
          weight: edit.weight ? Number(edit.weight) : null,
          fitness_goal: edit.fitness_goal || null
        })
      })
      setProfile(p)
      if (auth.user) auth.setUser({ ...auth.user, username: p.username, avatar_url: p.avatar_url })
      setEdit({
        username: p.username,
        gender: p.gender ?? '',
        height: p.height != null ? String(p.height) : '',
        weight: p.weight != null ? String(p.weight) : '',
        fitness_goal: p.fitness_goal ?? ''
      })
      setIsEditing(false)
      flashNotice('Saved')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function togglePublish(blog: MyBlog) {
    setError(null)
    try {
      const nowPublished = !blog.is_published
      await apiFetch(`/api/blogs/${blog.id}`, { method: 'PUT', body: JSON.stringify({ is_published: nowPublished }) })
      await loadMyBlogs()
      flashNotice(nowPublished ? 'Published' : 'Moved to draft')
      if (nowPublished) navigate(`/blogs/${blog.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Operation failed')
    }
  }

  async function deleteBlog(blogId: number) {
    setError(null)
    try {
      await apiFetch(`/api/blogs/${blogId}`, { method: 'DELETE' })
      await loadMyBlogs()
      flashNotice('Deleted')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function createBlog() {
    setError(null)
    if (!newBlog.title.trim() || !newBlog.content.trim()) {
      setError('Please fill in the title and content')
      return
    }
    try {
      const publishNow = newBlog.is_published
      const r = await apiFetch<{ id: number }>('/api/blogs', {
        method: 'POST',
        body: JSON.stringify(newBlog)
      })
      setNewBlog({ title: '', content: '', tag_ids: [], is_published: false, cover_image_url: null })
      await loadMyBlogs()
      setCreateOpen(false)
      flashNotice(publishNow ? 'Published' : 'Created')
      if (publishNow) navigate(`/blogs/${r.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  async function deleteComment(commentId: number) {
    setError(null)
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      await loadMyComments()
      flashNotice('Deleted')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="mx-auto w-full min-h-[calc(100vh-120px)] max-w-5xl space-y-6 px-4 pt-6 pb-32 text-slate-900 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Account</div>
            <div className="text-sm text-slate-600">{auth.user?.email}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/profile/privacy" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Privacy
            </Link>
            <Link to="/admin/data-lifecycle" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              Admin Cleanup
            </Link>
            <button
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                loadProfile().catch(() => {})
                loadWorkouts().catch(() => {})
                loadMeals().catch(() => {})
                loadMyBlogs().catch(() => {})
                loadMyComments().catch(() => {})
              }}
            >
              Refresh
            </button>
          </div>
        </div>
        {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="mt-2 text-sm text-emerald-700">{notice}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['Profile', 'Workouts', 'Meals', 'Report', 'History', 'Blogs', 'Comments'] as const).map((t) => (
          <button
            key={t}
            className={[
              'rounded-full border px-4 py-2 text-sm transition',
              tab === t
                ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            ].join(' ')}
            onClick={() => setTab(t)}
          >
            {t === 'History' ? (
              <span className="inline-flex items-center gap-2">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M7 2a1 1 0 0 1 1 1v1h8V3a1 1 0 1 1 2 0v1h1.5A2.5 2.5 0 0 1 22 6.5v13A2.5 2.5 0 0 1 19.5 22h-15A2.5 2.5 0 0 1 2 19.5v-13A2.5 2.5 0 0 1 4.5 4H6V3a1 1 0 0 1 1-1Zm12.5 6H4.5a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h15a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5ZM7 12h2v2H7v-2Zm4 0h2v2h-2v-2Zm4 0h2v2h-2v-2ZM7 16h2v2H7v-2Zm4 0h2v2h-2v-2Z"
                  />
                </svg>
                <span>History</span>
              </span>
            ) : (
              t
            )}
          </button>
        ))}
      </div>

      {tab === 'Profile' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="text-sm font-semibold">Profile</div>
          {!profile || !edit ? (
            <div className="mt-3 text-sm text-slate-600">Loading…</div>
          ) : isEditing ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                    {profile.avatar_url ? (
                      <img src={resolveAvatarUrl(profile.avatar_url) ?? ''} className="h-full w-full object-cover" alt={`${profile.username} avatar`} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No avatar</div>
                    )}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{profile.username}</div>
                    <div className="text-xs text-slate-600">{profile.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    disabled={avatarUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarUploading ? 'Uploading…' : 'Change avatar'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      e.target.value = ''
                      if (!f) return
                      onPickAvatar(f).catch(() => {})
                    }}
                  />
                </div>
              </div>

              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                placeholder="Username"
                value={edit.username}
                onChange={(e) => setEdit({ ...edit, username: e.target.value })}
              />
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                value={edit.gender}
                onChange={(e) => setEdit({ ...edit, gender: e.target.value })}
              >
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                placeholder="Height (cm)"
                value={edit.height}
                onChange={(e) => setEdit({ ...edit, height: e.target.value })}
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                placeholder="Weight (kg)"
                value={edit.weight}
                onChange={(e) => setEdit({ ...edit, weight: e.target.value })}
              />
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                value={edit.fitness_goal}
                onChange={(e) => setEdit({ ...edit, fitness_goal: e.target.value })}
              >
                <option value="">Select a fitness goal</option>
                <option value="Build Muscle">Build Muscle</option>
                <option value="Lose Fat">Lose Fat</option>
                <option value="Stay Healthy">Stay Healthy</option>
              </select>

              <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
                <button
                  className="w-full rounded-xl border border-slate-200 bg-white px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
                  onClick={() => {
                    setIsEditing(false)
                    setEdit({
                      username: profile.username,
                      gender: profile.gender ?? '',
                      height: profile.height != null ? String(profile.height) : '',
                      weight: profile.weight != null ? String(profile.weight) : '',
                      fitness_goal: profile.fitness_goal ?? ''
                    })
                  }}
                >
                  Cancel
                </button>
                <button
                  className="w-full rounded-xl bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto"
                  onClick={saveProfile}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                    {profile.avatar_url ? (
                      <img src={resolveAvatarUrl(profile.avatar_url) ?? ''} className="h-full w-full object-cover" alt={`${profile.username} avatar`} />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">No avatar</div>
                    )}
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{profile.username}</div>
                    <div className="text-xs text-slate-600">{profile.email}</div>
                  </div>
                </div>
                <button
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                  onClick={() => {
                    setEdit({
                      username: profile.username,
                      gender: profile.gender ?? '',
                      height: profile.height != null ? String(profile.height) : '',
                      weight: profile.weight != null ? String(profile.weight) : '',
                      fitness_goal: profile.fitness_goal ?? ''
                    })
                    setIsEditing(true)
                  }}
                >
                  Edit profile
                </button>
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div className="text-sm">
                  <div className="text-xs text-slate-600">Gender</div>
                  <div className="mt-1 font-medium">{profile.gender || '—'}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-600">Fitness Goal</div>
                  <div className="mt-1 font-medium">{profile.fitness_goal || '—'}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-600">Height (cm)</div>
                  <div className="mt-1 font-medium">{profile.height == null ? '—' : profile.height}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-600">Weight (kg)</div>
                  <div className="mt-1 font-medium">{profile.weight == null ? '—' : profile.weight}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'Workouts' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="text-sm font-semibold">Workouts</div>
          <div className="mt-4 space-y-3">
            {workouts.map((w) => (
              <div key={w.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">{w.exercise_type}</div>
                  <div className="text-xs text-slate-600">{w.workout_date}</div>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  Duration: {w.duration ?? '—'}s · Score: {w.form_score ?? '—'} · Burned: {w.calories_burned ?? '—'}kcal
                </div>
                {w.notes ? <div className="mt-2 text-sm text-slate-800">{w.notes}</div> : null}
              </div>
            ))}
            {workouts.length === 0 ? <div className="text-sm text-slate-600">No records yet</div> : null}
          </div>
        </div>
      ) : null}

      {tab === 'Meals' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="text-sm font-semibold">Meals</div>
          <div className="mt-4 space-y-3">
            {meals.map((meal) => (
              <div key={meal.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">{meal.mealType}</div>
                  <div className="text-xs text-slate-600">
                    {meal.recordedOn} · {meal.items.length} items
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  {meal.items
                    .map((item) => item.food?.displayName || item.food?.name || `food#${item.foodId}`)
                    .slice(0, 3)
                    .join(' / ')}
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  Calories {meal.totals.kcal.toFixed(1)} kcal · P {meal.totals.protein.toFixed(1)} g · F {meal.totals.fat.toFixed(1)} g · C{' '}
                  {meal.totals.carbs.toFixed(1)} g
                </div>
              </div>
            ))}
            {meals.length === 0 ? <div className="text-sm text-slate-600">No records yet</div> : null}
          </div>
        </div>
      ) : null}

      {tab === 'Report' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="text-xs text-slate-600">Total training time (7 days)</div>
            <div className="mt-2 text-2xl font-semibold">{report.totalDuration}s</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="text-xs text-slate-600">Average form score</div>
            <div className="mt-2 text-2xl font-semibold">{report.avgForm == null ? '—' : report.avgForm.toFixed(2)}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="text-xs text-slate-600">Avg daily calories</div>
            <div className="mt-2 text-2xl font-semibold">
              {report.avgCaloriesIn == null ? '—' : report.avgCaloriesIn.toFixed(0)} kcal
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'History' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold">Training History</div>
              <div className="mt-1 text-xs text-slate-600">Calendar view of your pose training sessions</div>
            </div>
            <Link
              to="/tools/pose/squat/tool/history"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Open full history
            </Link>
          </div>

          {poseError ? <div className="mt-3 text-sm text-rose-700">{poseError}</div> : null}

          <div className="mt-4 grid gap-4 lg:grid-cols-[320px_1fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setPoseMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                >
                  ←
                </button>
                <div className="text-sm font-semibold">{poseMonth.toLocaleString(undefined, { year: 'numeric', month: 'long' })}</div>
                <button
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => setPoseMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                >
                  →
                </button>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs text-slate-600">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {buildMonthCells(poseMonth).map((cell, idx) => {
                  if (!cell) return <div key={`empty-${idx}`} className="h-9" />
                  const ymd = `${cell.year}-${pad2(cell.month + 1)}-${pad2(cell.day)}`
                  const active = ymd === poseSelectedYmd
                  const hasItems = poseSessionsByDay.has(ymd)
                  return (
                    <button
                      key={ymd}
                      className={[
                        'relative h-9 rounded-xl border text-sm transition',
                        active ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      ].join(' ')}
                      onClick={() => setPoseSelectedYmd(ymd)}
                    >
                      {cell.day}
                      {hasItems ? (
                        <span
                          className={[
                            'absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
                            active ? 'bg-white' : 'bg-indigo-600'
                          ].join(' ')}
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>

              <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50" onClick={() => setPoseMonth(startOfMonth(new Date()))}>
                  This month
                </button>
                {poseLoading ? <div>Loading…</div> : <div>{poseSessions.length} sessions</div>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{poseSelectedYmd}</div>
                  <div className="mt-1 text-xs text-slate-600">
                    {poseSessionsByDay.get(poseSelectedYmd)?.length ?? 0} sessions
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                {(poseSessionsByDay.get(poseSelectedYmd) ?? []).map((s) => {
                  const started = new Date(s.started_at)
                  const ended = s.ended_at ? new Date(s.ended_at) : null
                  const totalReps = s.sets.reduce((acc, item) => acc + (item.reps ?? 0), 0)
                  const exerciseType = s.sets[0]?.exercise_type ?? 'squat'
                  const recordName = s.note?.trim() || buildTrainingRecordName({
                    startedAt: s.started_at,
                    exerciseName: getPoseExerciseByType(exerciseType).displayName
                  })
                  return (
                    <div key={s.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-sm font-semibold">{recordName}</div>
                          <div className="mt-1 text-xs text-slate-600">
                            {started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            {ended ? ` - ${ended.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                          </div>
                          <div className="mt-2 text-xs text-slate-600">
                            {s.sets.length} sets · {totalReps} reps
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Link
                            to={`/tools/pose/squat/tool/history/${s.id}`}
                            className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
                          >
                            View report
                          </Link>
                        </div>
                      </div>
                    </div>
                  )
                })}

                {(poseSessionsByDay.get(poseSelectedYmd) ?? []).length === 0 && !poseLoading ? (
                  <div className="text-sm text-slate-600">No sessions on this day</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'Blogs' ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">My Blogs</div>
              <button
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                onClick={() => setCreateOpen(true)}
              >
                + New blog
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {myBlogs.map((b) => (
                <div key={b.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-12 w-20 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {b.cover_image_url ? (
                          <img
                            src={resolveAvatarUrl(b.cover_image_url) ?? ''}
                            className="h-full w-full object-cover"
                            alt={`${b.title} cover`}
                          />
                        ) : null}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{b.title}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {b.is_published ? 'Published' : 'Draft'} · {new Date(b.updated_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => togglePublish(b).catch(() => {})}
                      >
                        {b.is_published ? 'Move to draft' : 'Publish'}
                      </button>
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-slate-50"
                        onClick={() => deleteBlog(b.id).catch(() => {})}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {myBlogs.length === 0 ? <div className="text-sm text-slate-600">No blogs yet</div> : null}
            </div>
          </div>

          {createOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setCreateOpen(false)} />
              <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">New blog</div>
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setCreateOpen(false)}
                  >
                    Close
                  </button>
                </div>

                <div className="mt-4 grid gap-3">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-16 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white">
                        {newBlog.cover_image_url ? (
                          <img
                            src={resolveAvatarUrl(newBlog.cover_image_url) ?? ''}
                            className="h-full w-full object-cover"
                            alt="New blog cover preview"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Cover</div>
                        )}
                      </div>
                      <div className="text-sm text-slate-700">{newBlog.cover_image_url ? 'Cover selected' : 'No cover'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {newBlog.cover_image_url ? (
                        <button
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => setNewBlog({ ...newBlog, cover_image_url: null })}
                        >
                          Remove
                        </button>
                      ) : null}
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={coverUploading}
                        onClick={() => coverInputRef.current?.click()}
                      >
                        {coverUploading ? 'Uploading…' : 'Upload cover'}
                      </button>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          e.target.value = ''
                          if (!f) return
                          onPickCover(f).catch(() => {})
                        }}
                      />
                    </div>
                  </div>

                  <input
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                    placeholder="Title"
                    value={newBlog.title}
                    onChange={(e) => setNewBlog({ ...newBlog, title: e.target.value })}
                  />
                  <textarea
                    className="h-32 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                    placeholder="Content"
                    value={newBlog.content}
                    onChange={(e) => setNewBlog({ ...newBlog, content: e.target.value })}
                  />

                  <div className="flex flex-wrap gap-2">
                    {tags.map((t) => {
                      const active = newBlog.tag_ids.includes(t.id)
                      return (
                        <button
                          key={t.id}
                          className={[
                            'rounded-full border px-3 py-1 text-xs transition',
                            active
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                          ].join(' ')}
                          onClick={() =>
                            setNewBlog({
                              ...newBlog,
                              tag_ids: active ? newBlog.tag_ids.filter((x) => x !== t.id) : [...newBlog.tag_ids, t.id]
                            })
                          }
                        >
                          {t.name}
                        </button>
                      )
                    })}
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={newBlog.is_published}
                      onChange={(e) => setNewBlog({ ...newBlog, is_published: e.target.checked })}
                    />
                    Publish now
                  </label>

                  <button
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    disabled={!newBlog.title.trim() || !newBlog.content.trim()}
                    onClick={() => createBlog().catch(() => {})}
                  >
                    Publish
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'Comments' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="text-sm font-semibold">My Comments</div>
          <div className="mt-4 space-y-3">
            {myComments.map((c) => (
              <div key={c.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs text-slate-600">Blog #{c.blog_id}</div>
                <div className="mt-2 text-sm text-slate-900">{c.content}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-slate-600">{new Date(c.created_at).toLocaleString()}</div>
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-slate-50"
                    onClick={() => deleteComment(c.id).catch(() => {})}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {myComments.length === 0 ? <div className="text-sm text-slate-600">No comments yet</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function formatYmdLocal(date: Date) {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function buildMonthCells(monthStart: Date) {
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const mondayIndex = (new Date(year, month, 1).getDay() + 6) % 7
  const cells: Array<{ year: number; month: number; day: number } | null> = []
  for (let i = 0; i < mondayIndex; i += 1) cells.push(null)
  for (let day = 1; day <= daysInMonth; day += 1) cells.push({ year, month, day })
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}
