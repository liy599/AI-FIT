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
  getPoseExerciseByType,
  listPoseTrainings,
  type PoseTrainingSession
} from '../../modules/pose'
import { deleteBlogById, deleteComment as deleteBlogComment, updateBlog } from '../../modules/blog'
import { useAuth } from '../../state/auth-context'
import type { MealHistory, MyBlog, MyComment, ProfileEditState, UserProfile } from '../../modules/user/profileTypes'
import { formatYmdLocal, pad2, startOfWeek } from '../../modules/user/profileDate'
import { ProfileDetailsPanel } from '../../components/user/ProfileDetailsPanel'
import { DietHistoryPanel } from '../../components/user/DietHistoryPanel'
import { UserCommunityPanel } from '../../components/user/UserCommunityPanel'
import { ExerciseDashboardPanel } from '../../components/user/ExerciseDashboardPanel'

const defaultAvatarImage = '/assets/images/bg/default.jpg'

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

  const [profile, setProfile] = useState<UserProfile | null>(null)
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

  const [edit, setEdit] = useState<ProfileEditState | null>(null)
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
    const p = await getMyProfile<UserProfile>()
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
      const p = await updateMyProfile<UserProfile>({
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
        <ExerciseDashboardPanel
          poseHistoryError={poseHistoryError}
          poseRecentLoading={poseRecentLoading}
          poseRecentTotal={poseRecentTotal}
          poseRecentSessions={poseRecentSessions}
          poseMonth={poseMonth}
          poseSelectedYmd={poseSelectedYmd}
          poseSessions={poseSessions}
          poseSessionsByDay={poseSessionsByDay}
          poseLoading={poseLoading}
          poseWeekLoading={poseWeekLoading}
          poseWeekError={poseWeekError}
          poseSummary={poseSummary}
          latestPoseSession={latestPoseSession}
          latestPoseExerciseName={latestPoseExercise.displayName}
          onReload={() => setPoseReloadKey((k) => k + 1)}
          onMonthChange={setPoseMonth}
          onSelectedYmdChange={setPoseSelectedYmd}
        />
      ) : null}

      {tab === 'Profile' ? (
        <ProfileDetailsPanel
          profile={profile}
          edit={edit}
          isEditing={isEditing}
          avatarUploading={avatarUploading}
          fileInputRef={fileInputRef}
          defaultAvatarImage={defaultAvatarImage}
          resolveAvatarUrl={resolveAvatarUrl}
          onEditChange={setEdit}
          onEditingChange={setIsEditing}
          onPickAvatar={(file) => onPickAvatar(file).catch(() => {})}
          onSave={saveProfile}
        />
      ) : null}

      {tab === 'Diet' ? (
        <DietHistoryPanel
          dietMonth={dietMonth}
          dietSelectedYmd={dietSelectedYmd}
          dietMeals={dietMeals}
          dietMealsByDay={dietMealsByDay}
          dietLoading={dietLoading}
          dietError={dietError}
          dietTotal={dietTotal}
          onReload={() => setDietReloadKey((k) => k + 1)}
          onMonthChange={setDietMonth}
          onSelectedYmdChange={setDietSelectedYmd}
        />
      ) : null}

      {tab === 'Community' ? (
        <UserCommunityPanel
          myBlogs={myBlogs}
          myComments={myComments}
          resolveMediaUrl={resolveAvatarUrl}
          onTogglePublish={(blog) => togglePublish(blog).catch(() => {})}
          onDeleteBlog={(blogId) => deleteBlog(blogId).catch(() => {})}
          onDeleteComment={(commentId) => deleteComment(commentId).catch(() => {})}
        />
      ) : null}
    </div>
  )
}
