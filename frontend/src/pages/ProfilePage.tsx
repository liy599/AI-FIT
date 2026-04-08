import { useEffect, useMemo, useRef, useState } from 'react'
import { API_BASE, apiFetch, apiUpload } from '../lib/api'
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
  const [tab, setTab] = useState<'Profile' | 'Workouts' | 'Meals' | 'Reports' | 'My Blogs' | 'My Comments'>('Profile')
  const [error, setError] = useState<string | null>(null)
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

  const [edit, setEdit] = useState<{
    username: string
    gender: string
    height: string
    weight: string
    fitness_goal: string
  } | null>(null)

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

  async function loadProfile() {
    const p = await apiFetch<Profile>('/api/user/profile')
    setProfile(p)
    setEdit({
      username: p.username,
      gender: p.gender ?? '',
      height: p.height != null ? String(p.height) : '',
      weight: p.weight != null ? String(p.weight) : '',
      fitness_goal: p.fitness_goal ?? ''
    })
  }

  function resolveAvatarUrl(url: string | null | undefined) {
    if (!url) return null
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    if (url.startsWith('/')) return `${API_BASE}${url}`
    return url
  }

  async function onPickAvatar(file: File) {
    setError(null)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB')
      return
    }
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await apiUpload<{ avatar_url: string }>('/api/user/avatar', form)
      setProfile((p) => (p ? { ...p, avatar_url: r.avatar_url } : p))
      if (auth.user) auth.setUser({ ...auth.user, avatar_url: r.avatar_url })
    } catch (e: unknown) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        setError(
          `Unable to reach backend upload endpoint: ${API_BASE}. Make sure the backend is running and set VITE_API_BASE to http://127.0.0.1:5000, then restart the frontend.`
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
      setError('Image must be smaller than 5MB')
      return
    }
    setCoverUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await apiUpload<{ cover_image_url: string }>('/api/blogs/cover', form)
      setNewBlog((b) => ({ ...b, cover_image_url: r.cover_image_url }))
    } catch (e: unknown) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        setError(`Unable to reach backend upload endpoint: ${API_BASE}`)
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    }
  }

  async function togglePublish(blog: MyBlog) {
    await apiFetch(`/api/blogs/${blog.id}`, { method: 'PUT', body: JSON.stringify({ is_published: !blog.is_published }) })
    await loadMyBlogs()
  }

  async function deleteBlog(blogId: number) {
    await apiFetch(`/api/blogs/${blogId}`, { method: 'DELETE' })
    await loadMyBlogs()
  }

  async function createBlog() {
    if (!newBlog.title.trim() || !newBlog.content.trim()) return
    await apiFetch('/api/blogs', {
      method: 'POST',
      body: JSON.stringify(newBlog)
    })
    setNewBlog({ title: '', content: '', tag_ids: [], is_published: false, cover_image_url: null })
    await loadMyBlogs()
  }

  async function deleteComment(commentId: number) {
    await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
    await loadMyComments()
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Account</div>
            <div className="text-sm text-slate-400">{auth.user?.email}</div>
          </div>
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
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
        {error ? <div className="mt-2 text-sm text-rose-300">{error}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['Profile', 'Workouts', 'Meals', 'Reports', 'My Blogs', 'My Comments'] as const).map((t) => (
          <button
            key={t}
            className={[
              'rounded-full border px-4 py-2 text-sm transition',
              tab === t
                ? 'border-indigo-400/40 bg-indigo-500/20 text-white'
                : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
            ].join(' ')}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'Profile' ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Profile</div>
          {edit ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="md:col-span-2 flex items-center gap-4">
                <div className="h-16 w-16 overflow-hidden rounded-full border border-white/10 bg-white/5">
                  {profile?.avatar_url ? (
                    <img src={resolveAvatarUrl(profile.avatar_url) ?? ''} className="h-full w-full object-cover" alt="" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-slate-300">No avatar</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
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
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Username"
                value={edit.username}
                onChange={(e) => setEdit({ ...edit, username: e.target.value })}
              />
              <select
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                value={edit.gender}
                onChange={(e) => setEdit({ ...edit, gender: e.target.value })}
              >
                <option value="">Prefer not to say</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
              <input
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Height (cm)"
                value={edit.height}
                onChange={(e) => setEdit({ ...edit, height: e.target.value })}
              />
              <input
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Weight (kg)"
                value={edit.weight}
                onChange={(e) => setEdit({ ...edit, weight: e.target.value })}
              />
              <select
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                value={edit.fitness_goal}
                onChange={(e) => setEdit({ ...edit, fitness_goal: e.target.value })}
              >
                <option value="">Select a fitness goal</option>
                <option value="Build Muscle">Build muscle</option>
                <option value="Fat Loss">Fat loss</option>
                <option value="Stay Healthy">Stay healthy</option>
              </select>
              <button
                className="md:col-span-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
                onClick={saveProfile}
              >
                Save
              </button>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-400">Loading…</div>
          )}
        </div>
      ) : null}

      {tab === 'Workouts' ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Workouts</div>
          <div className="mt-4 space-y-3">
            {workouts.map((w) => (
              <div key={w.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">{w.exercise_type}</div>
                  <div className="text-xs text-slate-400">{w.workout_date}</div>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Duration: {w.duration ?? '—'}s · Score: {w.form_score ?? '—'} · Burned: {w.calories_burned ?? '—'}kcal
                </div>
                {w.notes ? <div className="mt-2 text-sm text-slate-200">{w.notes}</div> : null}
              </div>
            ))}
            {workouts.length === 0 ? <div className="text-sm text-slate-400">No records</div> : null}
          </div>
        </div>
      ) : null}

      {tab === 'Meals' ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">Meals</div>
          <div className="mt-4 space-y-3">
            {meals.map((meal) => (
              <div key={meal.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">{meal.mealType}</div>
                  <div className="text-xs text-slate-400">
                    {meal.recordedOn} · {meal.items.length} items
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {meal.items
                    .map((item) => item.food?.displayName || item.food?.name || `food#${item.foodId}`)
                    .slice(0, 3)
                    .join(' / ')}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Calories {meal.totals.kcal.toFixed(1)} kcal · P {meal.totals.protein.toFixed(1)} g · F {meal.totals.fat.toFixed(1)} g · C{' '}
                  {meal.totals.carbs.toFixed(1)} g
                </div>
              </div>
            ))}
            {meals.length === 0 ? <div className="text-sm text-slate-400">No records</div> : null}
          </div>
        </div>
      ) : null}

      {tab === 'Reports' ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-slate-400">Total training duration (last 7 days)</div>
            <div className="mt-2 text-2xl font-semibold">{report.totalDuration}s</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-slate-400">Average form score</div>
            <div className="mt-2 text-2xl font-semibold">{report.avgForm == null ? '—' : report.avgForm.toFixed(2)}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-slate-400">Average daily calories (last 7 days)</div>
            <div className="mt-2 text-2xl font-semibold">
              {report.avgCaloriesIn == null ? '—' : report.avgCaloriesIn.toFixed(0)} kcal
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'My Blogs' ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold">Create a blog</div>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-28 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                    {newBlog.cover_image_url ? (
                      <img
                        src={resolveAvatarUrl(newBlog.cover_image_url) ?? ''}
                        className="h-full w-full object-cover"
                        alt=""
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-300">Cover</div>
                    )}
                  </div>
                  <div className="text-sm text-slate-300">{newBlog.cover_image_url ? 'Cover selected' : 'No cover selected'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {newBlog.cover_image_url ? (
                    <button
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
                      onClick={() => setNewBlog({ ...newBlog, cover_image_url: null })}
                    >
                      Remove
                    </button>
                  ) : null}
                  <button
                    className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:opacity-50"
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
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder="Title"
                value={newBlog.title}
                onChange={(e) => setNewBlog({ ...newBlog, title: e.target.value })}
              />
              <textarea
                className="h-28 resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
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
                          ? 'border-indigo-400/40 bg-indigo-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
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
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={newBlog.is_published}
                  onChange={(e) => setNewBlog({ ...newBlog, is_published: e.target.checked })}
                />
                Publish now
              </label>
              <button
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
                disabled={!newBlog.title.trim() || !newBlog.content.trim()}
                onClick={() => createBlog().catch(() => {})}
              >
                Create
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold">My blogs</div>
            <div className="mt-4 space-y-3">
              {myBlogs.map((b) => (
                <div key={b.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 h-12 w-20 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        {b.cover_image_url ? (
                          <img
                            src={resolveAvatarUrl(b.cover_image_url) ?? ''}
                            className="h-full w-full object-cover"
                            alt=""
                          />
                        ) : null}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{b.title}</div>
                        <div className="mt-1 text-xs text-slate-400">{b.is_published ? 'Published' : 'Draft'} · {new Date(b.updated_at).toLocaleString()}</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                        onClick={() => togglePublish(b).catch(() => {})}
                      >
                        {b.is_published ? 'Mark as draft' : 'Publish'}
                      </button>
                      <button
                        className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-rose-200 hover:bg-white/10"
                        onClick={() => deleteBlog(b.id).catch(() => {})}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {myBlogs.length === 0 ? <div className="text-sm text-slate-400">No blogs</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === 'My Comments' ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">My comments</div>
          <div className="mt-4 space-y-3">
            {myComments.map((c) => (
              <div key={c.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-slate-400">Blog #{c.blog_id}</div>
                <div className="mt-2 text-sm text-slate-100">{c.content}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</div>
                  <button
                    className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-rose-200 hover:bg-white/10"
                    onClick={() => deleteComment(c.id).catch(() => {})}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {myComments.length === 0 ? <div className="text-sm text-slate-400">No comments</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
