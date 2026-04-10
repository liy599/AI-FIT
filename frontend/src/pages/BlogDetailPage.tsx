import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { API_BASE, apiFetch } from '../lib/api'
import { useAuth } from '../state/auth-context'

type BlogDetail = {
  id: number
  title: string
  cover_image_url: string | null
  content: string
  author: { id: number; username: string; avatar_url: string | null }
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
    <div style={{ marginBottom: 24 }}>
      <div className="cl_blog_details-comment mb-45">
        <img src={resolveMediaUrl(props.node.user.avatar_url) ?? '/assets/images/blog/blog-comment.png'} alt={`${props.node.user.username} avatar`} />
        <div className="cl_blog_details-comment-info">
          <h4 className="cl_blog_details-comment-info-title">{props.node.user.username}</h4>
          {editing ? (
            <div className="cl_blog_details-reply-item" style={{ marginTop: 10 }}>
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4}></textarea>
            </div>
          ) : (
            <p className="cl_blog_details-comment-info-text" style={{ whiteSpace: 'pre-wrap' }}>
              {props.node.content}
            </p>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 10 }}>
            <button
              type="button"
              className="text-link-btn"
              onClick={(e) => {
                if (!auth.user) return
                like().catch(() => {})
              }}
              style={!auth.user ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
              title={auth.user ? '' : 'Sign in to like'}
            >
              <i className="fa-light fa-thumbs-up" style={{ marginRight: 6 }}></i>
              {props.node.liked_by_me ? 'Liked' : 'Like'} ({props.node.like_count})
            </button>
            <button
              type="button"
              className="text-link-btn"
              onClick={(e) => {
                if (!auth.user) return
                setReplying((v) => !v)
              }}
              style={!auth.user ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
              title={auth.user ? '' : 'Sign in to reply'}
            >
              <i className="fa-light fa-reply" style={{ marginRight: 6 }}></i>Reply
            </button>
            {canEdit ? (
              editing ? (
                <button
                  type="button"
                  className="text-link-btn"
                  onClick={(e) => {
                    saveEdit().catch(() => {})
                  }}
                >
                  <i className="fa-light fa-check" style={{ marginRight: 6 }}></i>Save
                </button>
              ) : (
                <button
                  type="button"
                  className="text-link-btn"
                  onClick={(e) => {
                    setEditing(true)
                  }}
                >
                  <i className="fa-light fa-pen" style={{ marginRight: 6 }}></i>Edit
                </button>
              )
            ) : null}
            {canDelete ? (
              <button
                type="button"
                className="text-link-btn"
                onClick={(e) => {
                  remove().catch(() => {})
                }}
              >
                <i className="fa-light fa-trash" style={{ marginRight: 6 }}></i>Delete
              </button>
            ) : null}
          </div>

          {replying ? (
            <div className="cl_blog_details-reply" style={{ marginTop: 18, paddingTop: 0 }}>
              <div className="cl_blog_details-reply-item">
                <label htmlFor={`reply-${props.node.id}`}>Reply</label>
                <textarea
                  id={`reply-${props.node.id}`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                ></textarea>
              </div>
              <div className="cl_blog_details-reply-item">
                <button
                  type="button"
                  onClick={() => submitReply().catch(() => {})}
                  disabled={!replyText.trim()}
                  style={!replyText.trim() ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                >
                  Send Now
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {props.node.replies.length ? (
        <div style={{ marginLeft: 34, paddingLeft: 16, borderLeft: '1px solid rgba(255,255,255,0.15)' }}>
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
    load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [load])

  async function toggleLike() {
    if (!blog) return
    try {
      await apiFetch(`/api/blogs/${blog.id}/like`, { method: 'POST' })
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed')
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
      setError(e instanceof Error ? e.message : 'Publish failed')
    }
  }

  if (!Number.isFinite(id)) return <div className="cl_blog-widget">Invalid ID</div>

  return (
    <>
      <section className="cl_breadcrumb-area">
        <div className="cl_breadcrumb-wrap" data-background="/assets/images/bg/breadcrumb.png">
          <div className="container">
            <div className="row justify-content-center">
              <div className="col-md-9 col-12">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">Blog Details</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <Link to="/blogs">Blog</Link>
                    <span>Details</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="cl_blog_details-area pt-100 pb-60">
        <div className="container">
          {error ? (
            <div className="row">
              <div className="col-12">
                <div className="cl_blog-widget mb-30">{error}</div>
              </div>
            </div>
          ) : null}

          <div className="row">
            <div className="col-xl-8">
              <div className="cl_blog_details-left mb-40">
                {!blog ? (
                  <div className="cl_blog-widget mb-30">Loading…</div>
                ) : (
                  <>
                    <div className="cl_blog_details-content">
                      <div className="cl_blog_details-content-img mb-30">
                        <img src={resolveMediaUrl(blog.cover_image_url) ?? '/assets/images/blog/blog-classic-1.png'} alt={blog.title} />
                        {blog.tags[0]?.name ? (
                          <span className="cl_blog_details-content-img-tag">{blog.tags[0].name}</span>
                        ) : null}
                      </div>
                      <div className="cl_blog_classic-item-content-meta">
                        <span>
                          <i className="fa-light fa-user"></i>
                          <span>BY {blog.author.username}</span>
                        </span>
                        <span>
                          <i className="fa-light fa-calendar"></i>
                          <span>{new Date(blog.created_at).toLocaleDateString()}</span>
                        </span>
                      </div>
                      <h3 className="cl_blog_details-content-title mb-20">{blog.title}</h3>
                      {blog.content
                        .split(/\n{2,}/)
                        .filter((x) => x.trim().length)
                        .map((p, idx) => (
                          <p className="cl_blog_details-content-text mb-10" key={idx} style={{ whiteSpace: 'pre-wrap' }}>
                            {p}
                          </p>
                        ))}

                      <div className="cl_blog_details-content-bottom mb-40">
                        <div className="cl_blog-widget-tag">
                          {blog.tags.map((t) => (
                            <span key={t.id} className="blog-tag-static">
                              {t.name}
                            </span>
                          ))}
                        </div>
                        <div className="cl_blog_details-content-social">
                          <button
                            type="button"
                            className="text-link-btn"
                            onClick={(e) => {
                              if (!auth.user) return
                              toggleLike().catch(() => {})
                            }}
                            style={!auth.user ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
                            title={auth.user ? '' : 'Sign in to like'}
                          >
                            <i className="fa-light fa-thumbs-up"></i>
                          </button>
                          <span>
                            <i className="fa-light fa-eye"></i>
                          </span>
                          <span>{blog.like_count}</span>
                          <span>{blog.view_count}</span>
                        </div>
                      </div>
                    </div>

                    <div className="cl_blog_details-reply">
                      <h3 className="cl_blog_details-reply-title">Leave a Comment</h3>
                      <p>{auth.user ? 'Post a comment (supports replies and threads).' : 'Sign in to post a comment.'}</p>
                      <form
                        action="#"
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (!auth.user) return
                          submitComment().catch(() => {})
                        }}
                      >
                        <div className="row">
                          <div className="col-12">
                            <div className="cl_blog_details-reply-item">
                              <label htmlFor="comment">Type Comment here <span>*</span></label>
                              <textarea
                                name="comment"
                                id="comment"
                                cols={30}
                                rows={6}
                                value={commentText}
                                onChange={(e) => setCommentText(e.target.value)}
                                disabled={!auth.user}
                              ></textarea>
                            </div>
                          </div>
                          <div className="col-12">
                            <div className="cl_blog_details-reply-item">
                              <button type="submit" disabled={!auth.user || !commentText.trim()}>
                                Send Now
                              </button>
                              <button
                                type="button"
                                className="text-link-btn"
                                style={{ marginLeft: 14 }}
                                onClick={(e) => {
                                  load().catch(() => {})
                                }}
                              >
                                Refresh
                              </button>
                            </div>
                          </div>
                        </div>
                      </form>
                    </div>

                    <div style={{ marginTop: 32 }}>
                      {comments.map((c) => (
                        <CommentItem
                          key={c.id}
                          node={c}
                          blogAuthorId={blog.author.id}
                          meId={meId}
                          onReload={() => load().catch(() => {})}
                        />
                      ))}
                      {comments.length === 0 ? <div className="cl_blog-widget">No comments yet</div> : null}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="col-xl-4">
              <div className="cl_blog_details-right pb-10">
                {blog ? (
                  <div className="cl_blog-widget mb-30">
                    <div className="cl_blog-widget-author">
                      <img
                        className="cl_blog-widget-author-avatar"
                        src={resolveMediaUrl(blog.author.avatar_url) ?? '/assets/images/blog/blog_widget-1.png'}
                        alt={`${blog.author.username} avatar`}
                      />
                      <h4 className="cl_blog-widget-author-title">{blog.author.username}</h4>
                      <p>Views: {blog.view_count} · Likes: {blog.like_count}</p>
                      <div className="cl_blog-widget-author-social">
                        <button type="button" className="footer-icon-btn" aria-label="Facebook link coming soon">
                          <i className="fa-brands fa-facebook-f"></i>
                        </button>
                        <button type="button" className="footer-icon-btn" aria-label="Instagram link coming soon">
                          <i className="fa-brands fa-instagram"></i>
                        </button>
                        <button type="button" className="footer-icon-btn" aria-label="LinkedIn link coming soon">
                          <i className="fa-brands fa-linkedin-in"></i>
                        </button>
                        <button type="button" className="footer-icon-btn" aria-label="YouTube link coming soon">
                          <i className="fa-brands fa-youtube"></i>
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="cl_blog-widget mb-30">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                    }}
                  >
                    <input type="email" placeholder="Search Here" />
                    <button type="submit">
                      <i className="fa-sharp fa-light fa-magnifying-glass"></i>
                    </button>
                  </form>
                </div>

                <div className="cl_blog-widget mb-30">
                  <h4 className="cl_blog-widget-title mb-35">Popular tags</h4>
                  <div className="cl_blog-widget-tag">
                    {(blog?.tags ?? []).map((t) => (
                      <span key={t.id} className="blog-tag-static">
                        {t.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
