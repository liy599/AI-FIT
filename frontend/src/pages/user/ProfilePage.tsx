import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  API_BASE,
  getMyBlogs,
  getMyComments,
  getMyProfile,
  listMyMealHistory,
  resolveBackendUrl,
  updateMyProfile,
  uploadMyAvatar
} from '../../modules/user'
import {
  buildPoseReportPath,
  buildTrainingRecordName,
  getPoseExerciseByType,
  listPoseTrainings,
  type PoseTrainingSession
} from '../../modules/pose'
import { deleteBlogById, deleteComment as deleteBlogComment, updateBlog } from '../../modules/blog'
import { useAuth } from '../../state/auth-context'
import defaultAvatarImage from '../../static/assets/images/bg/default.jpg'

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

export default function ProfilePage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'Dashboard' | 'Profile' | 'Diet' | 'Community'>('Dashboard')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<number | null>(null)
  const loadedRef = useRef({
    profile: false,
    blogs: false,
    comments: false
  })
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [myBlogs, setMyBlogs] = useState<MyBlog[]>([])
  const [myComments, setMyComments] = useState<MyComment[]>([])

  const [poseMonth, setPoseMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [poseSelectedYmd, setPoseSelectedYmd] = useState(() => formatYmdLocal(new Date()))
  const [poseSessions, setPoseSessions] = useState<PoseTrainingSession[]>([])
  const [poseLoading, setPoseLoading] = useState(false)
  const [poseError, setPoseError] = useState<string | null>(null)
  const [poseRecentSessions, setPoseRecentSessions] = useState<PoseTrainingSession[]>([])
  const [poseRecentTotal, setPoseRecentTotal] = useState<number | null>(null)
  const [poseRecentLoading, setPoseRecentLoading] = useState(false)
  const [poseRecentError, setPoseRecentError] = useState<string | null>(null)
  const [poseWeekSessions, setPoseWeekSessions] = useState<PoseTrainingSession[]>([])
  const [poseWeekLoading, setPoseWeekLoading] = useState(false)
  const [poseWeekError, setPoseWeekError] = useState<string | null>(null)
  const [poseReloadKey, setPoseReloadKey] = useState(0)

  const [dietMonth, setDietMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const [dietSelectedYmd, setDietSelectedYmd] = useState(() => formatYmdLocal(new Date()))
  const [dietMeals, setDietMeals] = useState<MealHistory[]>([])
  const [dietLoading, setDietLoading] = useState(false)
  const [dietError, setDietError] = useState<string | null>(null)
  const [dietTotal, setDietTotal] = useState<number | null>(null)
  const [dietReloadKey, setDietReloadKey] = useState(0)

  const [edit, setEdit] = useState<{
    username: string
    gender: string
    height: string
    weight: string
    fitness_goal: string
  } | null>(null)
  const [isEditing, setIsEditing] = useState(false)

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

  const dietMealsByDay = useMemo(() => {
    const map = new Map<string, MealHistory[]>()
    for (const meal of dietMeals) {
      const key = meal.recordedOn
      const prev = map.get(key)
      if (prev) prev.push(meal)
      else map.set(key, [meal])
    }
    for (const list of map.values()) list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    return map
  }, [dietMeals])

  useEffect(() => {
    if (tab !== 'Dashboard') return
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
  }, [tab, poseMonth, poseReloadKey])

  useEffect(() => {
    if (tab !== 'Dashboard') return
    const year = poseMonth.getFullYear()
    const month = pad2(poseMonth.getMonth() + 1)
    const prefix = `${year}-${month}-`
    if (!poseSelectedYmd.startsWith(prefix)) setPoseSelectedYmd(`${prefix}01`)
  }, [tab, poseMonth, poseSelectedYmd])

  useEffect(() => {
    if (tab !== 'Diet') return
    const year = dietMonth.getFullYear()
    const month = dietMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const dateFrom = `${year}-${pad2(month + 1)}-01`
    const dateTo = `${year}-${pad2(month + 1)}-${pad2(daysInMonth)}`

    let active = true
    setDietLoading(true)
    setDietError(null)
    ;(async () => {
      let page = 1
      const page_size = 50
      let all: MealHistory[] = []
      let total: number | null = null
      while (true) {
        const r = await listMyMealHistory<MealHistory>({ page, page_size })
        if (!active) return
        if (total == null) total = r.total
        const filtered = r.items.filter((m) => m.recordedOn >= dateFrom && m.recordedOn <= dateTo)
        all = all.concat(filtered)

        if (r.items.length === 0) break
        const last = r.items[r.items.length - 1]
        if (last && last.recordedOn < dateFrom) break
        if (page * page_size >= r.total) break
        page += 1
        if (page > 100) break
      }
      if (!active) return
      setDietMeals(all)
      setDietTotal(total ?? 0)
      setDietLoading(false)
      setDietError(null)
    })().catch((e: unknown) => {
      if (!active) return
      setDietLoading(false)
      setDietTotal(null)
      setDietError(e instanceof Error ? e.message : 'Failed to load diet history')
    })

    return () => {
      active = false
    }
  }, [tab, dietMonth, dietReloadKey])

  useEffect(() => {
    if (tab !== 'Diet') return
    const year = dietMonth.getFullYear()
    const month = pad2(dietMonth.getMonth() + 1)
    const prefix = `${year}-${month}-`
    if (!dietSelectedYmd.startsWith(prefix)) setDietSelectedYmd(`${prefix}01`)
  }, [tab, dietMonth, dietSelectedYmd])

  useEffect(() => {
    if (tab !== 'Dashboard') return
    let active = true
    setPoseRecentLoading(true)
    setPoseRecentError(null)
    listPoseTrainings({ page: 1, page_size: 5 })
      .then((r) => {
        if (!active) return
        setPoseRecentSessions(r.items)
        setPoseRecentTotal(r.total)
      })
      .catch((e: unknown) => {
        if (!active) return
        setPoseRecentSessions([])
        setPoseRecentTotal(null)
        setPoseRecentError(e instanceof Error ? e.message : 'Failed to load recent sessions')
      })
      .finally(() => {
        if (!active) return
        setPoseRecentLoading(false)
      })
    return () => {
      active = false
    }
  }, [tab, poseReloadKey])

  useEffect(() => {
    if (tab !== 'Dashboard') return
    const now = new Date()
    const weekStart = startOfWeek(now)
    const dateFrom = formatYmdLocal(weekStart)
    const dateTo = formatYmdLocal(now)

    let active = true
    setPoseWeekLoading(true)
    setPoseWeekError(null)
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
      setPoseWeekSessions(all)
      setPoseWeekLoading(false)
      setPoseWeekError(null)
    })().catch((e: unknown) => {
      if (!active) return
      setPoseWeekLoading(false)
      setPoseWeekError(e instanceof Error ? e.message : 'Failed to load weekly stats')
    })

    return () => {
      active = false
    }
  }, [tab, poseReloadKey])

  const latestPoseSession = poseRecentSessions[0] ?? null
  const latestPoseExerciseType = latestPoseSession?.sets[0]?.exercise_type ?? null
  const latestPoseExercise = getPoseExerciseByType(latestPoseExerciseType)
  const poseHistoryError = poseError || poseRecentError

  const poseSummary = useMemo(() => {
    const totalReps = poseWeekSessions.reduce((acc, s) => acc + s.sets.reduce((inner, setItem) => inner + (setItem.reps ?? 0), 0), 0)
    return {
      weekSessions: poseWeekSessions.length,
      weekReps: totalReps
    }
  }, [poseWeekSessions])

  function flashNotice(message: string) {
    setNotice(message)
    if (noticeTimerRef.current != null) window.clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 2500)
  }

  async function loadProfile() {
    const p = await getMyProfile<Profile>()
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
      const r = await uploadMyAvatar(file)
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

  async function loadMyBlogs() {
    const r = await getMyBlogs<MyBlog>()
    setMyBlogs(r.items)
  }

  async function loadMyComments() {
    const r = await getMyComments<MyComment>()
    setMyComments(r.items)
  }

  useEffect(() => {
    setError(null)
    loadedRef.current.profile = true
    loadProfile().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
    return () => {
      if (noticeTimerRef.current != null) window.clearTimeout(noticeTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (tab === 'Community') {
      if (!loadedRef.current.blogs) {
        loadedRef.current.blogs = true
        loadMyBlogs().catch(() => {})
      }
      if (!loadedRef.current.comments) {
        loadedRef.current.comments = true
        loadMyComments().catch(() => {})
      }
    }
  }, [tab])

  async function saveProfile() {
    if (!edit) return
    setError(null)
    try {
      const p = await updateMyProfile<Profile>({
        username: edit.username,
        gender: edit.gender || null,
        height: edit.height ? Number(edit.height) : null,
        weight: edit.weight ? Number(edit.weight) : null,
        fitness_goal: edit.fitness_goal || null
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
      await updateBlog(blog.id, { is_published: nowPublished })
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
      await deleteBlogById(blogId)
      await loadMyBlogs()
      flashNotice('Deleted')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function deleteComment(commentId: number) {
    setError(null)
    try {
      await deleteBlogComment(commentId)
      await loadMyComments()
      flashNotice('Deleted')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="mx-auto w-full min-h-[calc(100vh-120px)] max-w-5xl space-y-6 px-4 pt-6 pb-32 text-slate-900 sm:px-6 lg:px-8">
      <div className="profile-panel">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Account</div>
            <div className="text-sm text-slate-600">{auth.user?.email}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/profile/privacy" className="profile-btn-secondary">
              Privacy
            </Link>
            {auth.user?.is_admin ? (
              <Link to="/admin/data-lifecycle" className="profile-btn-secondary">
                Admin Cleanup
              </Link>
            ) : null}
            <button
              className={[
                'profile-btn-secondary',
                tab === 'Profile' ? 'bg-emerald-600 text-white shadow-sm' : ''
              ].join(' ')}
              onClick={() => setTab('Profile')}
              style={tab === 'Profile' ? { borderColor: 'rgb(5 150 105)' } : undefined}
            >
              Profile
            </button>
          </div>
        </div>
        {error ? <div className="mt-2 text-sm text-rose-700">{error}</div> : null}
        {notice ? <div className="mt-2 text-sm text-emerald-700">{notice}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { key: 'Dashboard', label: 'Exercise' },
            { key: 'Diet', label: 'Diet' },
            { key: 'Community', label: 'Community' }
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            className={[
              'rounded-full border px-4 py-2 text-sm transition',
              tab === t.key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
            ].join(' ')}
            onClick={() => setTab(t.key)}
            style={tab === t.key ? { borderColor: 'rgb(5 150 105)' } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'Dashboard' ? (
        <div className="space-y-4">
          {poseHistoryError ? (
            <div className="profile-panel">
              <div className="text-sm font-semibold">Pose</div>
              <div className="mt-2 text-sm text-rose-700">{poseHistoryError}</div>
              <button className="mt-3 profile-btn-secondary" onClick={() => setPoseReloadKey((k) => k + 1)}>
                Retry
              </button>
            </div>
          ) : null}

          {poseRecentLoading || poseRecentTotal == null ? (
            <div className="profile-panel">
              <div className="text-sm text-slate-600">Loading pose dashboard...</div>
            </div>
          ) : poseRecentTotal === 0 ? (
            <div className="profile-panel">
              <div className="text-sm font-semibold">Start your first pose session</div>
              <div className="mt-2 text-sm text-slate-600">You have no pose training history yet.</div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/tools/pose" className="profile-btn-primary">
                  Start Live Coaching
                </Link>
                <Link to="/tools/pose" className="profile-btn-secondary">
                  Analyze Video
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Pose History</div>
                    <div className="mt-1 text-xs text-slate-600">Calendar view of your pose training sessions</div>
                  </div>
                </div>

                <div className="mt-4 profile-history-main-grid">
                  <div className="profile-subpanel">
                    <div className="flex items-center justify-between">
                      <button className="profile-btn-secondary" onClick={() => setPoseMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                        {'<'}
                      </button>
                      <div className="text-sm font-semibold">{poseMonth.toLocaleString(undefined, { year: 'numeric', month: 'long' })}</div>
                      <button className="profile-btn-secondary" onClick={() => setPoseMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                        {'>'}
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
                            active ? 'bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                            ].join(' ')}
                            onClick={() => setPoseSelectedYmd(ymd)}
                          style={active ? { borderColor: 'rgb(5 150 105)' } : undefined}
                          >
                            {cell.day}
                            {hasItems ? (
                              <span
                                className={[
                                  'absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
                                active ? 'bg-white' : 'bg-emerald-600'
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
                      {poseLoading ? <div>Loading...</div> : <div>{poseSessions.length} sessions</div>}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold">{poseSelectedYmd}</div>
                        <div className="mt-1 text-xs text-slate-600">{poseSessionsByDay.get(poseSelectedYmd)?.length ?? 0} sessions</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      {(poseSessionsByDay.get(poseSelectedYmd) ?? []).map((s) => {
                        const started = new Date(s.started_at)
                        const ended = s.ended_at ? new Date(s.ended_at) : null
                        const totalReps = s.sets.reduce((acc, item) => acc + (item.reps ?? 0), 0)
                        const exerciseType = s.sets[0]?.exercise_type ?? 'squat'
                        const exercise = getPoseExerciseByType(exerciseType)
                        const recordName =
                          s.note?.trim() ||
                          buildTrainingRecordName({
                            startedAt: s.started_at,
                            exerciseName: exercise.displayName
                          })
                        return (
                          <div key={s.id} className="profile-subpanel">
                            <div className="profile-history-session-head">
                              <div>
                                <div className="text-sm font-semibold">{recordName}</div>
                                <div className="mt-1 text-xs text-slate-600">
                                  {started.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {ended ? ` - ${ended.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                                </div>
                                <div className="mt-2 text-xs text-slate-600">{totalReps} reps</div>
                              </div>
                              <div className="flex gap-2">
                                <Link to={buildPoseReportPath(exercise.slug, s.id)} className="profile-btn-secondary">
                                  View Report
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

              <div className="profile-panel">
                <div className="text-sm font-semibold">Pose Summary</div>
                <div className="mt-1 text-xs text-slate-600">This week and your latest session</div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="profile-subpanel">
                    <div className="text-xs text-slate-600">Sessions (week)</div>
                    <div className="mt-2 text-2xl font-semibold">{poseWeekLoading ? '...' : poseSummary.weekSessions}</div>
                    {poseWeekError ? <div className="mt-2 text-xs text-rose-700">{poseWeekError}</div> : null}
                  </div>
                  <div className="profile-subpanel">
                    <div className="text-xs text-slate-600">Total reps (week)</div>
                    <div className="mt-2 text-2xl font-semibold">{poseWeekLoading ? '...' : poseSummary.weekReps}</div>
                  </div>
                  <div className="profile-subpanel">
                    <div className="text-xs text-slate-600">Latest session</div>
                    <div className="mt-2 text-sm font-semibold">{latestPoseSession ? new Date(latestPoseSession.started_at).toLocaleString() : '-'}</div>
                  </div>
                  <div className="profile-subpanel">
                    <div className="text-xs text-slate-600">Latest exercise</div>
                    <div className="mt-2 text-sm font-semibold">{latestPoseSession ? latestPoseExercise.displayName : '-'}</div>
                  </div>
                </div>
              </div>

              <div className="profile-panel">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">Recent Pose Sessions</div>
                    <div className="mt-1 text-xs text-slate-600">Most recent 5 sessions</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="profile-btn-secondary" onClick={() => setPoseReloadKey((k) => k + 1)}>
                      Refresh
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {poseRecentSessions.slice(0, 5).map((s) => {
                    const totalReps = s.sets.reduce((acc, item) => acc + (item.reps ?? 0), 0)
                    const exerciseType = s.sets[0]?.exercise_type ?? 'squat'
                    const exercise = getPoseExerciseByType(exerciseType)
                    const recordName =
                      s.note?.trim() ||
                      buildTrainingRecordName({
                        startedAt: s.started_at,
                        exerciseName: exercise.displayName
                      })
                    return (
                      <div key={s.id} className="profile-subpanel">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{recordName}</div>
                            <div className="mt-1 text-xs text-slate-600">{new Date(s.started_at).toLocaleString()}</div>
                            <div className="mt-2 text-xs text-slate-600">{totalReps} reps</div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Link to={buildPoseReportPath(exercise.slug, s.id)} className="profile-btn-secondary">
                              View Report
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}

      {tab === 'Profile' ? (
        <div className="profile-panel">
          <div className="text-sm font-semibold">Profile</div>
          {!profile || !edit ? (
            <div className="mt-3 text-sm text-slate-600">Loading...</div>
          ) : isEditing ? (
            <div className="mt-4 profile-edit-grid">
              <div className="profile-edit-header-row">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                    <img
                      src={resolveAvatarUrl(profile.avatar_url) ?? defaultAvatarImage}
                      className="h-full w-full object-cover"
                      alt={`${profile.username} avatar`}
                    />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{profile.username}</div>
                    <div className="text-xs text-slate-600">{profile.email}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="profile-btn-secondary disabled:opacity-50"
                    disabled={avatarUploading}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {avatarUploading ? 'Uploading...' : 'Change avatar'}
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
                className="profile-input"
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
                className="profile-input"
                placeholder="Height (cm)"
                value={edit.height}
                onChange={(e) => setEdit({ ...edit, height: e.target.value })}
              />
              <input
                className="profile-input"
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

              <div className="profile-edit-actions-row">
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
                  className="w-full rounded-xl bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 sm:w-auto"
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
                    <img
                      src={resolveAvatarUrl(profile.avatar_url) ?? defaultAvatarImage}
                      className="h-full w-full object-cover"
                      alt={`${profile.username} avatar`}
                    />
                  </div>
                  <div className="text-sm">
                    <div className="font-medium">{profile.username}</div>
                    <div className="text-xs text-slate-600">{profile.email}</div>
                  </div>
                </div>
                <button
                  className="profile-btn-primary"
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

              <div className="profile-meta-grid profile-subpanel">
                <div className="text-sm">
                  <div className="text-xs text-slate-600">Gender</div>
                  <div className="mt-1 font-medium">{profile.gender || '-'}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-600">Fitness Goal</div>
                  <div className="mt-1 font-medium">{profile.fitness_goal || '-'}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-600">Height (cm)</div>
                  <div className="mt-1 font-medium">{profile.height == null ? '-' : profile.height}</div>
                </div>
                <div className="text-sm">
                  <div className="text-xs text-slate-600">Weight (kg)</div>
                  <div className="mt-1 font-medium">{profile.weight == null ? '-' : profile.weight}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'Diet' ? (
        <div className="profile-panel">
          <div className="profile-history-head-row">
            <div>
              <div className="text-sm font-semibold">Diet History</div>
              <div className="mt-1 text-xs text-slate-600">Calendar view of your meal records</div>
            </div>
            <button className="profile-btn-secondary" onClick={() => setDietReloadKey((k) => k + 1)}>
              Refresh
            </button>
          </div>

          {dietError ? (
            <div className="mt-3">
              <div className="text-sm text-rose-700">{dietError}</div>
              <button className="mt-3 profile-btn-secondary" onClick={() => setDietReloadKey((k) => k + 1)}>
                Retry
              </button>
            </div>
          ) : null}

          {dietLoading ? <div className="mt-3 text-sm text-slate-600">Loading diet history...</div> : null}

          {dietTotal === 0 && !dietLoading && !dietError ? <div className="mt-4 text-sm text-slate-600">No diet records yet</div> : null}

          {!dietError && dietTotal !== 0 ? (
            <div className="mt-4 profile-history-main-grid">
              <div className="profile-subpanel">
                <div className="flex items-center justify-between">
                  <button className="profile-btn-secondary" onClick={() => setDietMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
                    {'<'}
                  </button>
                  <div className="text-sm font-semibold">{dietMonth.toLocaleString(undefined, { year: 'numeric', month: 'long' })}</div>
                  <button className="profile-btn-secondary" onClick={() => setDietMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
                    {'>'}
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
                  {buildMonthCells(dietMonth).map((cell, idx) => {
                    if (!cell) return <div key={`diet-empty-${idx}`} className="h-9" />
                    const ymd = `${cell.year}-${pad2(cell.month + 1)}-${pad2(cell.day)}`
                    const active = ymd === dietSelectedYmd
                    const hasItems = dietMealsByDay.has(ymd)
                    return (
                      <button
                        key={ymd}
                        className={[
                          'relative h-9 rounded-xl border text-sm transition',
                      active ? 'bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                        ].join(' ')}
                        onClick={() => setDietSelectedYmd(ymd)}
                    style={active ? { borderColor: 'rgb(5 150 105)' } : undefined}
                      >
                        {cell.day}
                        {hasItems ? (
                          <span
                            className={[
                              'absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full',
                          active ? 'bg-white' : 'bg-emerald-600'
                            ].join(' ')}
                          />
                        ) : null}
                      </button>
                    )
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
                  <button className="rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50" onClick={() => setDietMonth(startOfMonth(new Date()))}>
                    This month
                  </button>
                  {dietLoading ? <div>Loading...</div> : <div>{dietMeals.length} records</div>}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold">{dietSelectedYmd}</div>
                    <div className="mt-1 text-xs text-slate-600">{dietMealsByDay.get(dietSelectedYmd)?.length ?? 0} meals</div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {(dietMealsByDay.get(dietSelectedYmd) ?? []).map((meal) => {
                    const foods = meal.items
                      .map((item) => item.food?.displayName || item.food?.name || `food#${item.foodId}`)
                      .slice(0, 3)
                      .join(' / ')
                    return (
                      <div key={meal.id} className="profile-subpanel">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{meal.mealType}</div>
                            <div className="mt-1 text-xs text-slate-600">{foods || `${meal.items.length} items`}</div>
                          </div>
                          <div className="text-right text-xs text-slate-600">
                            <div>{meal.totals.kcal.toFixed(0)} kcal</div>
                            <div>
                              P {meal.totals.protein.toFixed(1)} / F {meal.totals.fat.toFixed(1)} / C {meal.totals.carbs.toFixed(1)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}

                  {(dietMealsByDay.get(dietSelectedYmd) ?? []).length === 0 && !dietLoading ? (
                    <div className="text-sm text-slate-600">No meals on this day</div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === 'Community' ? (
        <div className="space-y-4">
          <div className="profile-panel">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-semibold">My Blogs</div>
              <Link to="/blogs/new" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
                + New blog
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {myBlogs.map((b) => (
                <div key={b.id} className="profile-subpanel">
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
                          {b.is_published ? 'Published' : 'Draft'} / {new Date(b.updated_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="profile-btn-chip"
                        onClick={() => togglePublish(b).catch(() => {})}
                      >
                        {b.is_published ? 'Move to draft' : 'Publish'}
                      </button>
                      <button
                        className="profile-btn-chip-danger"
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

          <div className="profile-panel">
            <div className="text-sm font-semibold">My Comments</div>
            <div className="mt-4 space-y-3">
              {myComments.map((c) => (
                <div key={c.id} className="profile-subpanel">
                  <div className="text-xs text-slate-600">Blog #{c.blog_id}</div>
                  <div className="mt-2 text-sm text-slate-900">{c.content}</div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="text-xs text-slate-600">{new Date(c.created_at).toLocaleString()}</div>
                    <button className="profile-btn-chip-danger" onClick={() => deleteComment(c.id).catch(() => {})}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {myComments.length === 0 ? <div className="text-sm text-slate-600">No comments yet</div> : null}
            </div>
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

function startOfWeek(date: Date) {
  const copy = new Date(date.getTime())
  const dayIndex = (copy.getDay() + 6) % 7
  copy.setDate(copy.getDate() - dayIndex)
  copy.setHours(0, 0, 0, 0)
  return copy
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
