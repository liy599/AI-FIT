import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  createBlogComment,
  deleteComment,
  getBlogComments,
  getBlogDetail,
  resolveBlogMediaUrl,
  toggleBlogLike,
  toggleCommentLike,
  updateComment,
  type BlogDetail,
  type CommentNode
} from '../modules/blog'
import { useAuth } from '../state/auth-context'

function resolveMediaUrl(url: string | null | undefined) {
  return resolveBlogMediaUrl(url)
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
    await toggleCommentLike(props.node.id)
    props.onReload()
  }

  async function submitReply() {
    if (!replyText.trim()) return
    await createBlogComment(props.node.blog_id, { content: replyText, parent_id: props.node.id })
    setReplyText('')
    setReplying(false)
    props.onReload()
  }

  async function saveEdit() {
    if (!editText.trim()) return
    await updateComment(props.node.id, editText)
    setEditing(false)
    props.onReload()
  }

  async function remove() {
    await deleteComment(props.node.id)
    props.onReload()
  }

  return (
    <div className="blog-comment-item">
      <div className="cl_blog_details-comment mb-45">
        <img src={resolveMediaUrl(props.node.user.avatar_url) ?? '/assets/images/blog/blog-comment.png'} alt={`${props.node.user.username} avatar`} />
        <div className="cl_blog_details-comment-info">
          <h4 className="cl_blog_details-comment-info-title">{props.node.user.username}</h4>
          {editing ? (
            <div className="cl_blog_details-reply-item blog-comment-edit">
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4}></textarea>
            </div>
          ) : (
            <p className="cl_blog_details-comment-info-text blog-prewrap">
              {props.node.content}
            </p>
          )}

          <div className="blog-comment-actions">
            <button
              type="button"
              className="text-link-btn"
              onClick={() => {
                if (!auth.user) return
                like().catch(() => {})
              }}
              disabled={!auth.user}
              title={auth.user ? '' : 'Sign in to like'}
            >
              <i className="fa-light fa-thumbs-up blog-action-icon"></i>
              {props.node.liked_by_me ? 'Liked' : 'Like'} ({props.node.like_count})
            </button>
            <button
              type="button"
              className="text-link-btn"
              onClick={() => {
                if (!auth.user) return
                setReplying((v) => !v)
              }}
              disabled={!auth.user}
              title={auth.user ? '' : 'Sign in to reply'}
            >
              <i className="fa-light fa-reply blog-action-icon"></i>Reply
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
                  <i className="fa-light fa-check blog-action-icon"></i>Save
                </button>
              ) : (
                <button
                  type="button"
                  className="text-link-btn"
                  onClick={(e) => {
                    setEditing(true)
                  }}
                >
                  <i className="fa-light fa-pen blog-action-icon"></i>Edit
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
                <i className="fa-light fa-trash blog-action-icon"></i>Delete
              </button>
            ) : null}
          </div>

          {replying ? (
            <div className="cl_blog_details-reply blog-comment-reply-wrap">
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
                  className={!replyText.trim() ? 'blog-btn-disabled' : undefined}
                >
                  Send Now
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {props.node.replies.length ? (
        <div className="blog-comment-children">
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
      const b = await getBlogDetail(id)
      const c = await getBlogComments(id, 1, 20)
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
      await toggleBlogLike(blog.id)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed')
    }
  }

  async function submitComment() {
    if (!blog || !commentText.trim()) return
    setError(null)
    try {
      await createBlogComment(blog.id, { content: commentText })
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
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
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

      <section className="cl_blog_details-area blog-detail-section">
        <div className="page-container">
          {error ? (
            <div className="blog-detail-error-row">
              <div>
                <div className="cl_blog-widget section-widget">{error}</div>
              </div>
            </div>
          ) : null}

          <div className="blog-detail-main-grid">
            <div className="blog-detail-main-col">
              <div className="cl_blog_details-left section-stack-lg">
                {!blog ? (
                  <div className="cl_blog-widget section-widget">Loading...</div>
                ) : (
                  <>
                    <div className="cl_blog_details-content">
                      <div className="cl_blog_details-content-img section-stack-md">
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
                      <h3 className="cl_blog_details-content-title section-stack-sm">{blog.title}</h3>
                      {blog.content
                        .split(/\n{2,}/)
                        .filter((x) => x.trim().length)
                        .map((p, idx) => (
                          <p className="cl_blog_details-content-text section-text-block blog-prewrap" key={idx}>
                            {p}
                          </p>
                        ))}

                      <div className="cl_blog_details-content-bottom section-stack-lg">
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
                            onClick={() => {
                              if (!auth.user) return
                              toggleLike().catch(() => {})
                            }}
                            disabled={!auth.user}
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
                        <div className="blog-detail-form-grid">
                          <div>
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
                          <div>
                            <div className="cl_blog_details-reply-item">
                              <button type="submit" disabled={!auth.user || !commentText.trim()}>
                                Send Now
                              </button>
                              <button
                                type="button"
                                className="text-link-btn blog-refresh-btn"
                                onClick={() => {
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

                    <div className="blog-comments-list">
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

            <div className="blog-detail-side-col">
              <div className="cl_blog_details-right pb-10">
                {blog ? (
                  <div className="cl_blog-widget section-widget">
                    <div className="cl_blog-widget-author">
                      <img
                        className="cl_blog-widget-author-avatar"
                        src={resolveMediaUrl(blog.author.avatar_url) ?? '/assets/images/blog/blog_widget-1.png'}
                        alt={`${blog.author.username} avatar`}
                      />
                      <h4 className="cl_blog-widget-author-title">{blog.author.username}</h4>
                      <p>Views: {blog.view_count} / Likes: {blog.like_count}</p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}


