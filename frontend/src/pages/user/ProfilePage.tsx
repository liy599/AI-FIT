import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  API_BASE,
  deleteMyAccount,
  getMyProfile,
  resolveBackendUrl,
  updateMyProfile,
  uploadMyAvatar
} from '../../modules/user'
import {
  deletePoseTraining,
  getPoseExerciseByType,
  listPoseTrainings,
  type PoseTrainingSession
} from '../../modules/pose'
import { deleteBlogById, deleteComment as deleteBlogComment, resolveBlogMediaUrl, updateBlog } from '../../modules/blog'
import { useAuth } from '../../state/auth-context'
import type { MyBlog, ProfileEditState, UserProfile } from '../../modules/user/profileTypes'
import { formatYmdLocal, pad2, startOfWeek } from '../../modules/user/profileDate'
import { ProfileDetailsPanel } from '../../components/user/ProfileDetailsPanel'
import { UserCommunityPanel } from '../../components/user/UserCommunityPanel'
import { ExerciseDashboardPanel } from '../../components/user/ExerciseDashboardPanel'

const defaultAvatarImage = '/assets/images/bg/default.jpg'

export default function ProfilePage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState<'Dashboard' | 'Blogs'>(() => {
    const requested = searchParams.get('tab')
    if (requested === 'Blogs') return requested
    if (requested === 'Community') return 'Blogs'
    return 'Dashboard'
  })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const noticeTimerRef = useRef<number | null>(null)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [profile, setProfile] = useState<UserProfile | null>(null)
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

  useEffect(() => {
    const requested = searchParams.get('tab')
    if (requested === 'Dashboard' || requested === 'Blogs') {
      setTab(requested)
    } else if (requested === 'Profile') {
      setTab('Dashboard')
    } else if (requested === 'Community') {
      setTab('Blogs')
    }
  }, [searchParams])

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

  useEffect(() => {
    setError(null)
    loadProfile().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
    return () => {
      if (noticeTimerRef.current != null) window.clearTimeout(noticeTimerRef.current)
    }
  }, [])

  async function saveProfile() {
    if (!edit) return
    setError(null)
    try {
      const nextUsername = edit.username.trim()
      if (!nextUsername) {
        setError('Username is required.')
        return
      }
      if (nextUsername.length < 3 || nextUsername.length > 15) {
        setError('Username length must be 3-15.')
        return
      }
      if (/\s/.test(nextUsername)) {
        setError('Username cannot contain whitespace.')
        return
      }

      let nextHeight: number | null = null
      if (edit.height) {
        const h = Number(edit.height)
        if (!Number.isFinite(h) || h < 50 || h > 260) {
          setError('Invalid height')
          return
        }
        nextHeight = h
      }

      let nextWeight: number | null = null
      if (edit.weight) {
        const w = Number(edit.weight)
        if (!Number.isFinite(w) || w < 20 || w > 400) {
          setError('Invalid weight')
          return
        }
        nextWeight = w
      }

      const p = await updateMyProfile<UserProfile>({
        username: nextUsername,
        gender: edit.gender || null,
        height: nextHeight,
        weight: nextWeight,
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
      flashNotice('Deleted')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function deleteComment(commentId: number) {
    setError(null)
    try {
      await deleteBlogComment(commentId)
      flashNotice('Deleted')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function deleteAccount() {
    if (!profile) return
    const confirmedName = window.prompt(
      `Delete account "${profile.username}"?\n\nThis permanently removes your account and related blogs, comments, notifications, training records, likes, and uploads.\n\nType your username to confirm:`
    )
    if (confirmedName !== profile.username) {
      if (confirmedName !== null) setError('Delete cancelled: username confirmation did not match.')
      return
    }

    setError(null)
    try {
      await deleteMyAccount(confirmedName)
      await auth.logout()
      navigate('/login', { replace: true })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete account failed')
    }
  }

  async function deletePoseSession(session: PoseTrainingSession) {
    const label = session.note?.trim() || new Date(session.started_at).toLocaleString()
    const confirmed = window.confirm(`Delete report "${label}"? This cannot be undone.`)
    if (!confirmed) {
      setError('Delete cancelled: report deletion requires confirmation.')
      return
    }
    setError(null)
    try {
      await deletePoseTraining(session.id)
      flashNotice('Report deleted')
      setPoseReloadKey((key) => key + 1)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="mx-auto w-full min-h-[calc(100vh-120px)] max-w-5xl space-y-6 px-4 pt-6 pb-32 text-slate-900 sm:px-6 lg:px-8">
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
        onDeleteAccount={() => deleteAccount().catch(() => {})}
        error={error}
        notice={notice}
      />

      <div className="profile-section-switch">
        {(
          [
            { key: 'Dashboard', label: 'Exercise', detail: 'Training history, pose reports, and weekly activity.', icon: 'fa-light fa-calendar' },
            { key: 'Blogs', label: 'Blogs', detail: 'Posts, comments, and community notifications.', icon: 'fa-light fa-pen' }
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            className={[
              'profile-section-card',
              tab === t.key ? 'is-active' : ''
            ].join(' ')}
            onClick={() => {
              setTab(t.key)
              if (t.key === 'Dashboard') setSearchParams({})
              else setSearchParams({ tab: t.key })
            }}
          >
            <span className="profile-section-card-icon">
              <i className={t.icon} aria-hidden="true" />
            </span>
            <span>
              <strong>{t.label}</strong>
              <small>{t.detail}</small>
            </span>
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
          onDeleteSession={deletePoseSession}
          onMonthChange={setPoseMonth}
          onSelectedYmdChange={setPoseSelectedYmd}
        />
      ) : null}

      {tab === 'Blogs' ? (
        <UserCommunityPanel
          resolveMediaUrl={resolveBlogMediaUrl}
          onTogglePublish={togglePublish}
          onDeleteBlog={deleteBlog}
          onDeleteComment={deleteComment}
        />
      ) : null}
    </div>
  )
}
