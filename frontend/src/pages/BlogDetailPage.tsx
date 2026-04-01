import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { API_BASE, apiFetch } from '../lib/api'
import { useAuth } from '../state/auth-context'

type BlogDetail = {
  id: number
  title: string
  cover_image_url: string | null
  content: string
  author: { id: number; username: string }
  view_count: number
  like_count: number
  liked_by_me: boolean
  created_at: string
  tags: { id: number; name: string }[]
}

type CommentNode = {
  id: number
  blog_id: number
  parent_id: number | null
  content: string
  like_count: number
  liked_by_me: boolean
  created_at: string
  updated_at: string
  user: { id: number; username: string; avatar_url: string | null }
  replies: CommentNode[]
}

function resolveMediaUrl(url: string | null | undefined) {
  if (!url) return null
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  if (url.startsWith('/')) return `${API_BASE}${url}`
  return url
}

function CommentItem(props: {
  node: CommentNode
  blogAuthorId: number
  meId: number | null
  onReload: () => void
}) {
  const auth = useAuth()
  const [replying, setReplying] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(props.node.content)
  const canEdit = auth.user && props.meId === props.node.user.id
  const canDelete = auth.user && (props.meId === props.node.user.id || props.meId === props.blogAuthorId)

  async function like() {
    await apiFetch(`/api/comments/${props.node.id}/like`, { method: 'POST' })
    props.onReload()
  }

  async function submitReply() {
    if (!replyText.trim()) return
    await apiFetch(`/api/blogs/${props.node.blog_id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content: replyText, parent_id: props.node.id })
    })
    setReplyText('')
    setReplying(false)
    props.onReload()
  }

  async function saveEdit() {
    if (!editText.trim()) return
    await apiFetch(`/api/comments/${props.node.id}`, {
      method: 'PUT',
      body: JSON.stringify({ content: editText })
    })
    setEditing(false)
    props.onReload()
  }

  async function remove() {
    await apiFetch(`/api/comments/${props.node.id}`, { method: 'DELETE' })
    props.onReload()
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400">{props.node.user.username}</div>
          {editing ? (
            <textarea
              className="mt-2 h-20 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
            />
          ) : (
            <div className="mt-2 text-sm text-slate-100">{props.node.content}</div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
            onClick={like}
            disabled={!auth.user}
            title={auth.user ? '' : '登录后可点赞'}
          >
            {props.node.liked_by_me ? '已赞' : '点赞'} {props.node.like_count}
          </button>
          {canEdit ? (
            editing ? (
              <button
                className="rounded-xl bg-indigo-500 px-2 py-1 text-xs text-white hover:bg-indigo-400"
                onClick={saveEdit}
              >
                保存
              </button>
            ) : (
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200 hover:bg-white/10"
                onClick={() => setEditing(true)}
              >
                编辑
              </button>
            )
          ) : null}
          {canDelete ? (
            <button
              className="rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-xs text-rose-200 hover:bg-white/10"
              onClick={remove}
            >
              删除
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          className="text-xs text-slate-300 hover:text-white"
          onClick={() => setReplying((v) => !v)}
          disabled={!auth.user}
          title={auth.user ? '' : '登录后可回复'}
        >
          回复
        </button>
      </div>

      {replying ? (
        <div className="mt-3 space-y-2">
          <textarea
            className="h-20 w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
            placeholder="写下回复…"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <button
            className="rounded-xl bg-emerald-500 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
            disabled={!replyText.trim()}
            onClick={submitReply}
          >
            发送回复
          </button>
        </div>
      ) : null}

      {props.node.replies.length ? (
        <div className="mt-4 space-y-3 border-l border-white/10 pl-4">
          {props.node.replies.map((r) => (
            <CommentItem
              key={r.id}
              node={r}
              blogAuthorId={props.blogAuthorId}
              meId={props.meId}
              onReload={props.onReload}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

export default function BlogDetailPage() {
  const auth = useAuth()
  const params = useParams()
  const id = Number(params.id)

  const [blog, setBlog] = useState<BlogDetail | null>(null)
  const [comments, setComments] = useState<CommentNode[]>([])
  const [commentText, setCommentText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const meId = auth.user?.id ?? null

  const load = useMemo(
    () => async () => {
      if (!Number.isFinite(id)) return
      setError(null)
      const b = await apiFetch<BlogDetail>(`/api/blogs/${id}`)
      const c = await apiFetch<{ items: CommentNode[] }>(`/api/blogs/${id}/comments?page=1&page_size=20`)
      setBlog(b)
      setComments(c.items)
    },
    [id]
  )

  useEffect(() => {
    load().catch((e: unknown) => setError(e instanceof Error ? e.message : '加载失败'))
  }, [load])

  async function toggleLike() {
    if (!blog) return
    try {
      await apiFetch(`/api/blogs/${blog.id}/like`, { method: 'POST' })
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }

  async function submitComment() {
    if (!blog || !commentText.trim()) return
    setError(null)
    try {
      await apiFetch(`/api/blogs/${blog.id}/comments`, {
        method: 'POST',
        body: JSON.stringify({ content: commentText })
      })
      setCommentText('')
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '发布失败')
    }
  }

  if (!Number.isFinite(id)) return <div className="text-sm text-slate-400">无效ID</div>

  return (
    <div className="space-y-8">
      <div className="text-xs text-slate-400">
        <Link to="/blogs" className="hover:text-white">
          博客
        </Link>{' '}
        / 详情
      </div>

      {error ? <div className="text-sm text-rose-300">{error}</div> : null}

      {blog ? (
        <>
          <article className="rounded-3xl border border-white/10 bg-white/5 p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="text-2xl font-semibold">{blog.title}</h1>
              <button
                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
                disabled={!auth.user}
                onClick={toggleLike}
                title={auth.user ? '' : '登录后可点赞'}
              >
                {blog.liked_by_me ? '已赞' : '点赞'} {blog.like_count}
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-400">
              <div>by {blog.author.username}</div>
              <div>·</div>
              <div>{new Date(blog.created_at).toLocaleString()}</div>
              <div>·</div>
              <div>{blog.view_count} views</div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {blog.tags.map((t) => (
                <span key={t.id} className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300">
                  {t.name}
                </span>
              ))}
            </div>
            {blog.cover_image_url ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                <img src={resolveMediaUrl(blog.cover_image_url) ?? ''} className="h-64 w-full object-cover" alt="" />
              </div>
            ) : null}
            <div className="mt-6 whitespace-pre-wrap text-sm leading-7 text-slate-100">{blog.content}</div>
          </article>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">评论</h2>
              <button
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 hover:bg-white/10"
                onClick={() => load().catch(() => {})}
              >
                刷新
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <textarea
                className="h-24 w-full resize-none rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
                placeholder={auth.user ? '写下评论…' : '登录后可发表评论'}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                disabled={!auth.user}
              />
              <button
                className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
                disabled={!auth.user || !commentText.trim()}
                onClick={submitComment}
              >
                发布评论
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {comments.map((c) => (
                <CommentItem
                  key={c.id}
                  node={c}
                  blogAuthorId={blog.author.id}
                  meId={meId}
                  onReload={() => load().catch(() => {})}
                />
              ))}
              {comments.length === 0 ? <div className="text-sm text-slate-400">暂无评论</div> : null}
            </div>
          </section>
        </>
      ) : (
        <div className="text-sm text-slate-400">加载中…</div>
      )}
    </div>
  )
}

