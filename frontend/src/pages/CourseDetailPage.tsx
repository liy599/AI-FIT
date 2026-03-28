import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useAuth } from '../state/auth-context'

type CourseDetail = {
  id: number
  title: string
  description: string
  cover_image_url: string | null
  intro_video_url: string | null
  instructor_name: string
  instructor_bio: string | null
  instructor_avatar_url: string | null
  is_free: boolean
  price: number | null
  view_count: number
  enroll_count: number
  avg_rating: number | null
  enrolled: boolean
}

type CourseComment = {
  id: number
  user: { id: number; username: string; avatar_url: string | null }
  rating: number
  content: string
  like_count: number
  liked_by_me: boolean
  created_at: string
}

export default function CourseDetailPage() {
  const auth = useAuth()
  const params = useParams()
  const id = Number(params.id)

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [comments, setComments] = useState<CourseComment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')

  const load = useMemo(
    () => async () => {
      if (!Number.isFinite(id)) return
      const c = await apiFetch<CourseDetail>(`/api/courses/${id}`)
      const cm = await apiFetch<{ items: CourseComment[] }>(`/api/courses/${id}/comments?page=1&page_size=10&sort=new`)
      setCourse(c)
      setComments(cm.items)
    },
    [id]
  )

  useEffect(() => {
    load().catch((e: unknown) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [load])

  async function enroll() {
    if (!course) return
    setError(null)
    setBusy(true)
    try {
      await apiFetch(`/api/courses/${course.id}/enroll`, {
        method: 'POST',
        body: JSON.stringify({ paid: course.is_free ? true : true })
      })
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '报名失败')
    } finally {
      setBusy(false)
    }
  }

  async function likeComment(commentId: number) {
    await apiFetch(`/api/course-comments/${commentId}/like`, { method: 'POST' })
    await load()
  }

  async function submitComment() {
    if (!course || !content.trim()) return
    setError(null)
    setBusy(true)
    try {
      await apiFetch(`/api/courses/${course.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ rating, content })
      })
      setContent('')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '评论失败')
    } finally {
      setBusy(false)
    }
  }

  if (!Number.isFinite(id)) return <div className="text-sm text-slate-400">无效ID</div>

  return (
    <div className="space-y-8">
      <div className="text-xs text-slate-400">
        <Link to="/courses" className="hover:text-white">
          课程
        </Link>{' '}
        / 详情
      </div>

      {error ? <div className="text-sm text-rose-300">{error}</div> : null}

      {course ? (
        <>
          <section className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h1 className="text-2xl font-semibold">{course.title}</h1>
                <div className="mt-2 text-sm text-slate-300">讲师：{course.instructor_name}</div>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
                  <div>{course.is_free ? '免费' : `€${course.price ?? '-'}`}</div>
                  <div>·</div>
                  <div>{course.enroll_count} 人报名</div>
                  <div>·</div>
                  <div>{course.avg_rating ? course.avg_rating.toFixed(1) : '-'}★</div>
                </div>
              </div>

              <div className="flex gap-2">
                {course.enrolled ? (
                  <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm text-emerald-100">
                    已报名
                  </div>
                ) : (
                  <button
                    className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                    disabled={busy}
                    onClick={enroll}
                  >
                    {course.is_free ? '报名课程' : '模拟支付并报名'}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-slate-400">介绍视频</div>
                <div className="mt-2 text-sm text-slate-300">
                  {course.intro_video_url ? course.intro_video_url : '（待填充视频链接）'}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-slate-400">讲师介绍</div>
                <div className="mt-2 text-sm text-slate-300">{course.instructor_bio ?? '（待补充）'}</div>
              </div>
            </div>

            <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-100">{course.description}</div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">学员反馈</h2>
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
                onClick={() => load().catch(() => {})}
              >
                刷新
              </button>
            </div>

            {course.enrolled ? (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-xs text-slate-400">发表评论</div>
                <div className="mt-2 grid gap-2 md:grid-cols-3">
                  <select
                    className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                  <div className="md:col-span-2">
                    <input
                      className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
                      placeholder="写下你的体验…"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>
                </div>
                <button
                  className="mt-3 w-full rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
                  disabled={busy || !content.trim()}
                  onClick={submitComment}
                >
                  发布
                </button>
              </div>
            ) : (
              <div className="mt-4 text-sm text-slate-400">报名后可发表评论。</div>
            )}

            <div className="mt-6 space-y-3">
              {comments.map((c) => (
                <div key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-400">
                        {c.user.username} · {'★'.repeat(c.rating)}
                      </div>
                      <div className="mt-2 text-sm text-slate-100">{c.content}</div>
                      <div className="mt-2 text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</div>
                    </div>
                    <button
                      className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                      onClick={() => likeComment(c.id)}
                      title={auth.user ? '' : '登录后可点赞'}
                      disabled={!auth.user}
                    >
                      {c.liked_by_me ? '已赞' : '点赞'} {c.like_count}
                    </button>
                  </div>
                </div>
              ))}
              {comments.length === 0 ? <div className="text-sm text-slate-400">暂无评价</div> : null}
            </div>
          </section>
        </>
      ) : (
        <div className="text-sm text-slate-400">加载中…</div>
      )}
    </div>
  )
}

