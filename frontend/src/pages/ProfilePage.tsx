import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const navigate = useNavigate()
  const [tab, setTab] = useState<'资料' | '运动记录' | '饮食记录' | '专属报告' | '我的博客' | '我的评论'>('资料')
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
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    if (url.startsWith('/')) return `${API_BASE}${url}`
    return url
  }

  async function onPickAvatar(file: File) {
    setError(null)
    if (file.size > 5 * 1024 * 1024) {
      setError('图片不能超过 5MB')
      return
    }
    setAvatarUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await apiUpload<{ avatar_url: string }>('/api/user/avatar', form)
      setProfile((p) => (p ? { ...p, avatar_url: r.avatar_url } : p))
      if (auth.user) auth.setUser({ ...auth.user, avatar_url: r.avatar_url })
      flashNotice('头像已更新')
    } catch (e: unknown) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        setError(`无法连接到后端上传接口：${API_BASE}。请确认后端已启动，并将 VITE_API_BASE 配置为 http://127.0.0.1:5000 后重启前端`)
        return
      }
      setError(e instanceof Error ? e.message : '上传失败')
    } finally {
      setAvatarUploading(false)
    }
  }

  async function onPickCover(file: File) {
    setError(null)
    if (file.size > 5 * 1024 * 1024) {
      setError('图片不能超过 5MB')
      return
    }
    setCoverUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const r = await apiUpload<{ cover_image_url: string }>('/api/blogs/cover', form)
      setNewBlog((b) => ({ ...b, cover_image_url: r.cover_image_url }))
      flashNotice('封面已上传')
    } catch (e: unknown) {
      if (e instanceof TypeError && e.message === 'Failed to fetch') {
        setError(`无法连接到后端上传接口：${API_BASE}`)
        return
      }
      setError(e instanceof Error ? e.message : '上传失败')
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
    loadProfile().catch((e: unknown) => setError(e instanceof Error ? e.message : '加载失败'))
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
      flashNotice('保存成功')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败')
    }
  }

  async function togglePublish(blog: MyBlog) {
    setError(null)
    try {
      const nowPublished = !blog.is_published
      await apiFetch(`/api/blogs/${blog.id}`, { method: 'PUT', body: JSON.stringify({ is_published: nowPublished }) })
      await loadMyBlogs()
      flashNotice(nowPublished ? '发布成功' : '已设为草稿')
      if (nowPublished) navigate(`/blogs/${blog.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  async function deleteBlog(blogId: number) {
    setError(null)
    try {
      await apiFetch(`/api/blogs/${blogId}`, { method: 'DELETE' })
      await loadMyBlogs()
      flashNotice('已删除')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  async function createBlog() {
    setError(null)
    if (!newBlog.title.trim() || !newBlog.content.trim()) {
      setError('请填写标题和正文')
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
      flashNotice(publishNow ? '发布成功' : '创建成功')
      if (publishNow) navigate(`/blogs/${r.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '创建失败')
    }
  }

  async function deleteComment(commentId: number) {
    setError(null)
    try {
      await apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
      await loadMyComments()
      flashNotice('已删除')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '删除失败')
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">个人中心</div>
            <div className="text-sm text-slate-600">{auth.user?.email}</div>
          </div>
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
            刷新
          </button>
        </div>
        {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="mt-2 text-sm text-emerald-700">{notice}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['资料', '运动记录', '饮食记录', '专属报告', '我的博客', '我的评论'] as const).map((t) => (
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
            {t}
          </button>
        ))}
      </div>

      {tab === '资料' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="text-sm font-semibold">个人资料</div>
          {!profile || !edit ? (
            <div className="mt-3 text-sm text-slate-600">加载中…</div>
          ) : isEditing ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                    {profile.avatar_url ? (
                      <img src={resolveAvatarUrl(profile.avatar_url) ?? ''} className="h-full w-full object-cover" alt="" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">无头像</div>
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
                    {avatarUploading ? '上传中…' : '修改头像'}
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
                placeholder="用户名"
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
                placeholder="身高(cm)"
                value={edit.height}
                onChange={(e) => setEdit({ ...edit, height: e.target.value })}
              />
              <input
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                placeholder="体重(kg)"
                value={edit.weight}
                onChange={(e) => setEdit({ ...edit, weight: e.target.value })}
              />
              <select
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                value={edit.fitness_goal}
                onChange={(e) => setEdit({ ...edit, fitness_goal: e.target.value })}
              >
                <option value="">选择健身目标</option>
                <option value="增肌">增肌</option>
                <option value="减脂">减脂</option>
                <option value="保持健康">保持健康</option>
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
                  取消
                </button>
                <button
                  className="w-full rounded-xl bg-indigo-600 px-6 py-2 text-sm font-medium text-white hover:bg-indigo-500 sm:w-auto"
                  onClick={saveProfile}
                >
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                    {profile.avatar_url ? (
                      <img src={resolveAvatarUrl(profile.avatar_url) ?? ''} className="h-full w-full object-cover" alt="" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">无头像</div>
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
                  编辑资料
                </button>
              </div>

              <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div className="text-sm">
                  <div className="text-xs text-slate-600">性别</div>
                  <div className="mt-1 font-medium">{profile.gender || '—'}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-600">健身目标</div>
                  <div className="mt-1 font-medium">{profile.fitness_goal || '—'}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-600">身高(cm)</div>
                  <div className="mt-1 font-medium">{profile.height == null ? '—' : profile.height}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-600">体重(kg)</div>
                  <div className="mt-1 font-medium">{profile.weight == null ? '—' : profile.weight}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === '运动记录' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="text-sm font-semibold">运动记录</div>
          <div className="mt-4 space-y-3">
            {workouts.map((w) => (
              <div key={w.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">{w.exercise_type}</div>
                  <div className="text-xs text-slate-600">{w.workout_date}</div>
                </div>
                <div className="mt-2 text-xs text-slate-600">
                  时长：{w.duration ?? '—'}s · 得分：{w.form_score ?? '—'} · 消耗：{w.calories_burned ?? '—'}kcal
                </div>
                {w.notes ? <div className="mt-2 text-sm text-slate-800">{w.notes}</div> : null}
              </div>
            ))}
            {workouts.length === 0 ? <div className="text-sm text-slate-600">暂无记录</div> : null}
          </div>
        </div>
      ) : null}

      {tab === '饮食记录' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="text-sm font-semibold">饮食记录</div>
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
            {meals.length === 0 ? <div className="text-sm text-slate-600">暂无记录</div> : null}
          </div>
        </div>
      ) : null}

      {tab === '专属报告' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="text-xs text-slate-600">近一周训练总时长</div>
            <div className="mt-2 text-2xl font-semibold">{report.totalDuration}s</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="text-xs text-slate-600">平均动作评分</div>
            <div className="mt-2 text-2xl font-semibold">{report.avgForm == null ? '—' : report.avgForm.toFixed(2)}</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="text-xs text-slate-600">日均热量摄入</div>
            <div className="mt-2 text-2xl font-semibold">
              {report.avgCaloriesIn == null ? '—' : report.avgCaloriesIn.toFixed(0)} kcal
            </div>
          </div>
        </div>
      ) : null}

      {tab === '我的博客' ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">我的博客</div>
              <button
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                onClick={() => setCreateOpen(true)}
              >
                + 发布新博客
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
                            alt=""
                          />
                        ) : null}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">{b.title}</div>
                        <div className="mt-1 text-xs text-slate-600">
                          {b.is_published ? '已发布' : '草稿'} · {new Date(b.updated_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        onClick={() => togglePublish(b).catch(() => {})}
                      >
                        {b.is_published ? '设为草稿' : '发布'}
                      </button>
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs text-rose-700 hover:bg-slate-50"
                        onClick={() => deleteBlog(b.id).catch(() => {})}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {myBlogs.length === 0 ? <div className="text-sm text-slate-600">暂无博客</div> : null}
            </div>
          </div>

          {createOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40" onClick={() => setCreateOpen(false)} />
              <div className="relative w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-4 shadow-xl sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold">发布新博客</div>
                  <button
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    onClick={() => setCreateOpen(false)}
                  >
                    关闭
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
                            alt=""
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">封面</div>
                        )}
                      </div>
                      <div className="text-sm text-slate-700">{newBlog.cover_image_url ? '已选择封面' : '未选择封面'}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {newBlog.cover_image_url ? (
                        <button
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                          onClick={() => setNewBlog({ ...newBlog, cover_image_url: null })}
                        >
                          移除
                        </button>
                      ) : null}
                      <button
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={coverUploading}
                        onClick={() => coverInputRef.current?.click()}
                      >
                        {coverUploading ? '上传中…' : '上传封面'}
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
                    placeholder="标题"
                    value={newBlog.title}
                    onChange={(e) => setNewBlog({ ...newBlog, title: e.target.value })}
                  />
                  <textarea
                    className="h-32 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
                    placeholder="正文"
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
                    立即发布
                  </label>

                  <button
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                    disabled={!newBlog.title.trim() || !newBlog.content.trim()}
                    onClick={() => createBlog().catch(() => {})}
                  >
                    发布
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === '我的评论' ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="text-sm font-semibold">我的评论</div>
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
                    删除
                  </button>
                </div>
              </div>
            ))}
            {myComments.length === 0 ? <div className="text-sm text-slate-600">暂无评论</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

