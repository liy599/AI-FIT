import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from '../lib/api'
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

type Diet = {
  id: number
  food_name: string
  quantity: number | null
  calories: number | null
  protein: number | null
  fat: number | null
  carbohydrates: number | null
  meal_type: string | null
  meal_date: string
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
  const [tab, setTab] = useState<'资料' | '运动记录' | '饮食记录' | '专属报告' | '我的博客' | '我的评论'>('资料')
  const [error, setError] = useState<string | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [diets, setDiets] = useState<Diet[]>([])
  const [myBlogs, setMyBlogs] = useState<MyBlog[]>([])
  const [myComments, setMyComments] = useState<MyComment[]>([])
  const [tags, setTags] = useState<Tag[]>([])

  const [edit, setEdit] = useState<{ username: string; avatar_url: string; gender: string; height: string; weight: string; fitness_goal: string } | null>(null)

  const [newBlog, setNewBlog] = useState<{ title: string; content: string; tag_ids: number[]; is_published: boolean }>({
    title: '',
    content: '',
    tag_ids: [],
    is_published: false
  })

  const report = useMemo(() => {
    const now = new Date()
    const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const wk = workouts.filter((w) => new Date(w.workout_date) >= since)
    const dt = diets.filter((d) => new Date(d.meal_date) >= since)
    const totalDuration = wk.reduce((acc, w) => acc + (w.duration ?? 0), 0)
    const avgForm = wk.length ? wk.reduce((acc, w) => acc + (w.form_score ?? 0), 0) / wk.length : null
    const totalCaloriesIn = dt.reduce((acc, d) => acc + (d.calories ?? 0), 0)
    const days = 7
    return {
      totalDuration,
      avgForm,
      avgCaloriesIn: totalCaloriesIn ? totalCaloriesIn / days : null
    }
  }, [workouts, diets])

  async function loadProfile() {
    const p = await apiFetch<Profile>('/api/user/profile')
    setProfile(p)
    setEdit({
      username: p.username,
      avatar_url: p.avatar_url ?? '',
      gender: p.gender ?? '',
      height: p.height != null ? String(p.height) : '',
      weight: p.weight != null ? String(p.weight) : '',
      fitness_goal: p.fitness_goal ?? ''
    })
  }

  async function loadWorkouts() {
    const r = await apiFetch<{ items: Workout[] }>('/api/workouts?page=1&page_size=20')
    setWorkouts(r.items)
  }

  async function loadDiets() {
    const r = await apiFetch<{ items: Diet[] }>('/api/diets?page=1&page_size=20')
    setDiets(r.items)
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
    loadDiets().catch(() => {})
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
          avatar_url: edit.avatar_url || null,
          gender: edit.gender || null,
          height: edit.height ? Number(edit.height) : null,
          weight: edit.weight ? Number(edit.weight) : null,
          fitness_goal: edit.fitness_goal || null
        })
      })
      setProfile(p)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '保存失败')
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
    setNewBlog({ title: '', content: '', tag_ids: [], is_published: false })
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
            <div className="text-lg font-semibold">个人中心</div>
            <div className="text-sm text-slate-400">{auth.user?.email}</div>
          </div>
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200 hover:bg-white/10"
            onClick={() => {
              loadProfile().catch(() => {})
              loadWorkouts().catch(() => {})
              loadDiets().catch(() => {})
              loadMyBlogs().catch(() => {})
              loadMyComments().catch(() => {})
            }}
          >
            刷新
          </button>
        </div>
        {error ? <div className="mt-2 text-sm text-rose-300">{error}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(['资料', '运动记录', '饮食记录', '专属报告', '我的博客', '我的评论'] as const).map((t) => (
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

      {tab === '资料' ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">个人资料</div>
          {edit ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <input
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder="用户名"
                value={edit.username}
                onChange={(e) => setEdit({ ...edit, username: e.target.value })}
              />
              <input
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder="头像URL"
                value={edit.avatar_url}
                onChange={(e) => setEdit({ ...edit, avatar_url: e.target.value })}
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
                placeholder="身高(cm)"
                value={edit.height}
                onChange={(e) => setEdit({ ...edit, height: e.target.value })}
              />
              <input
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder="体重(kg)"
                value={edit.weight}
                onChange={(e) => setEdit({ ...edit, weight: e.target.value })}
              />
              <select
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                value={edit.fitness_goal}
                onChange={(e) => setEdit({ ...edit, fitness_goal: e.target.value })}
              >
                <option value="">选择健身目标</option>
                <option value="增肌">增肌</option>
                <option value="减脂">减脂</option>
                <option value="保持健康">保持健康</option>
              </select>
              <button
                className="md:col-span-2 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-400"
                onClick={saveProfile}
              >
                保存
              </button>
            </div>
          ) : (
            <div className="mt-3 text-sm text-slate-400">加载中…</div>
          )}
        </div>
      ) : null}

      {tab === '运动记录' ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">运动记录</div>
          <div className="mt-4 space-y-3">
            {workouts.map((w) => (
              <div key={w.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">{w.exercise_type}</div>
                  <div className="text-xs text-slate-400">{w.workout_date}</div>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  时长：{w.duration ?? '—'}s · 得分：{w.form_score ?? '—'} · 消耗：{w.calories_burned ?? '—'}kcal
                </div>
                {w.notes ? <div className="mt-2 text-sm text-slate-200">{w.notes}</div> : null}
              </div>
            ))}
            {workouts.length === 0 ? <div className="text-sm text-slate-400">暂无记录</div> : null}
          </div>
        </div>
      ) : null}

      {tab === '饮食记录' ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">饮食记录</div>
          <div className="mt-4 space-y-3">
            {diets.map((d) => (
              <div key={d.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="font-semibold">{d.food_name}</div>
                  <div className="text-xs text-slate-400">
                    {d.meal_date} {d.meal_type ? `· ${d.meal_type}` : ''}
                  </div>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  {d.quantity ?? '—'}g · 热量 {d.calories ?? '—'}kcal · P {d.protein ?? '—'}g · F {d.fat ?? '—'}g · C{' '}
                  {d.carbohydrates ?? '—'}g
                </div>
              </div>
            ))}
            {diets.length === 0 ? <div className="text-sm text-slate-400">暂无记录</div> : null}
          </div>
        </div>
      ) : null}

      {tab === '专属报告' ? (
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-slate-400">近一周训练总时长</div>
            <div className="mt-2 text-2xl font-semibold">{report.totalDuration}s</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-slate-400">平均动作评分</div>
            <div className="mt-2 text-2xl font-semibold">{report.avgForm == null ? '—' : report.avgForm.toFixed(2)}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-xs text-slate-400">日均热量摄入</div>
            <div className="mt-2 text-2xl font-semibold">
              {report.avgCaloriesIn == null ? '—' : report.avgCaloriesIn.toFixed(0)} kcal
            </div>
          </div>
        </div>
      ) : null}

      {tab === '我的博客' ? (
        <div className="space-y-4">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold">创建博客</div>
            <div className="mt-3 grid gap-2">
              <input
                className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                placeholder="标题"
                value={newBlog.title}
                onChange={(e) => setNewBlog({ ...newBlog, title: e.target.value })}
              />
              <textarea
                className="h-28 resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
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
                立即发布
              </label>
              <button
                className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
                disabled={!newBlog.title.trim() || !newBlog.content.trim()}
                onClick={() => createBlog().catch(() => {})}
              >
                创建
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="text-sm font-semibold">我的博客</div>
            <div className="mt-4 space-y-3">
              {myBlogs.map((b) => (
                <div key={b.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-semibold">{b.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{b.is_published ? '已发布' : '草稿'} · {new Date(b.updated_at).toLocaleString()}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                        onClick={() => togglePublish(b).catch(() => {})}
                      >
                        {b.is_published ? '设为草稿' : '发布'}
                      </button>
                      <button
                        className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-rose-200 hover:bg-white/10"
                        onClick={() => deleteBlog(b.id).catch(() => {})}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {myBlogs.length === 0 ? <div className="text-sm text-slate-400">暂无博客</div> : null}
            </div>
          </div>
        </div>
      ) : null}

      {tab === '我的评论' ? (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="text-sm font-semibold">我的评论</div>
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
                    删除
                  </button>
                </div>
              </div>
            ))}
            {myComments.length === 0 ? <div className="text-sm text-slate-400">暂无评论</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

