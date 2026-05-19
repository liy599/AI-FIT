import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { getBlogCover } from '../../components/blog/BlogListParts'
import { FallbackImage } from '../../components/ui'
import {
  createBlogComment,
  deleteComment,
  displayBlogTagName,
  getBlogComments,
  getBlogDetail,
  resolveBlogMediaUrl,
  toggleBlogLike,
  toggleCommentLike,
  updateComment,
  type BlogDetail,
  type CommentNode
} from '../../modules/blog'
import { useAuth } from '../../state/auth-context'

function resolveMediaUrl(url: string | null | undefined) {
  return resolveBlogMediaUrl(url)
}

const COMMENT_MIN_LENGTH = 1
const COMMENT_MAX_LENGTH = 500
const COMMENT_PAGE_SIZE = 10

function normalizeComment(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n')
}

function validateCommentContent(value: string) {
  const text = normalizeComment(value)
  if (text.length < COMMENT_MIN_LENGTH) return 'Comment is required'
  if (text.length > COMMENT_MAX_LENGTH) return `Comment must be at most ${COMMENT_MAX_LENGTH} characters`
  return null
}

function formatCommentTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function updateCommentLikeInTree(nodes: CommentNode[], commentId: number, liked: boolean, likeCount: number): CommentNode[] {
  return nodes.map((node) => {
    if (node.id === commentId) {
      return { ...node, liked_by_me: liked, like_count: likeCount }
    }
    if (!node.replies.length) return node
    return { ...node, replies: updateCommentLikeInTree(node.replies, commentId, liked, likeCount) }
  })
}

function CommentItem(props: {
  node: CommentNode
  blogAuthorId: number
  meId: number | null
  targetCommentId?: number | null
  depth?: number
  onReload: () => void
  onLikeUpdate: (commentId: number, liked: boolean, likeCount: number) => void
  onError: (message: string) => void
  onNotice: (message: string) => void
  interactionDisabledReason?: string | null
}) {
  const auth = useAuth()
  const [replying, setReplying] = useState(false)
  const hasTargetReply = props.node.replies.some((reply) => reply.id === props.targetCommentId)
  const [repliesOpen, setRepliesOpen] = useState(hasTargetReply)
  const [replyText, setReplyText] = useState('')
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(props.node.content)
  const [likeSaving, setLikeSaving] = useState(false)
  const [localNotice, setLocalNotice] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const canEdit = auth.user && props.meId === props.node.user.id
  const canDelete = auth.user && (props.meId === props.node.user.id || props.meId === props.blogAuthorId)
  const isReply = Boolean(props.depth)
  const replyParentId = props.node.id
  const replyCount = props.node.replies.length
  const interactionsLocked = Boolean(props.interactionDisabledReason)

  useEffect(() => {
    if (hasTargetReply) setRepliesOpen(true)
  }, [hasTargetReply])

  async function like() {
    setLikeSaving(true)
    try {
      const result = await toggleCommentLike(props.node.id)
      props.onLikeUpdate(
        props.node.id,
        Boolean((result as { liked?: boolean }).liked),
        Number((result as { like_count?: number }).like_count ?? props.node.like_count),
      )
    } finally {
      setLikeSaving(false)
    }
  }

  async function submitReply() {
    const validationError = validateCommentContent(replyText)
    if (validationError) {
      setLocalNotice(null)
      setLocalError(validationError)
      return
    }
    try {
      await createBlogComment(props.node.blog_id, { content: normalizeComment(replyText), parent_id: replyParentId })
      setReplyText('')
      setReplying(false)
      setLocalError(null)
      setLocalNotice('Reply posted.')
      props.onReload()
    } catch (e: unknown) {
      setLocalNotice(null)
      setLocalError(e instanceof Error ? e.message : 'Reply failed')
    }
  }

  async function saveEdit() {
    const validationError = validateCommentContent(editText)
    if (validationError) {
      setLocalNotice(null)
      setLocalError(validationError)
      return
    }
    try {
      await updateComment(props.node.id, normalizeComment(editText))
      setEditing(false)
      setLocalError(null)
      setLocalNotice('Comment updated.')
      props.onReload()
    } catch (e: unknown) {
      setLocalNotice(null)
      setLocalError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function remove() {
    try {
      await deleteComment(props.node.id)
      setLocalError(null)
      props.onNotice('Comment deleted.')
      props.onReload()
    } catch (e: unknown) {
      setLocalNotice(null)
      setLocalError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div
      className={`blog-comment-item${props.node.id === props.targetCommentId ? ' is-targeted' : ''}`}
      id={`comment-${props.node.id}`}
    >
      <div className="cl_blog_details-comment mb-45">
        <FallbackImage
          src={resolveMediaUrl(props.node.user.avatar_url) ?? '/assets/images/blog/blog-comment.png'}
          fallbackSrc="/assets/images/blog/blog-comment.png"
          alt={`${props.node.user.username} avatar`}
        />
        <div className="cl_blog_details-comment-info">
          <div className="blog-comment-head">
            <h4 className="cl_blog_details-comment-info-title">{props.node.user.username}</h4>
            <time dateTime={props.node.created_at}>{formatCommentTime(props.node.created_at)}</time>
          </div>
          {isReply && props.node.reply_to ? (
            <div className="blog-comment-reply-context">
              Replying to <strong>@{props.node.reply_to.username}</strong>
              <span>{props.node.reply_to.content}</span>
            </div>
          ) : null}
          {editing ? (
            <div className="cl_blog_details-reply-item blog-comment-edit">
              <textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={4}></textarea>
              <small>{normalizeComment(editText).length}/{COMMENT_MAX_LENGTH} characters</small>
              {validateCommentContent(editText) ? <small className="blog-field-error">{validateCommentContent(editText)}</small> : null}
            </div>
          ) : (
            <p className="cl_blog_details-comment-info-text blog-prewrap blog-break-text">
              {props.node.content}
            </p>
          )}

          <div className="blog-comment-actions">
            <button
              type="button"
              className={`blog-comment-action-btn${props.node.liked_by_me ? ' is-active' : ''}`}
              onClick={() => {
                if (!auth.user || interactionsLocked) return
                like().catch(() => {})
              }}
              disabled={!auth.user || interactionsLocked || likeSaving}
              title={props.interactionDisabledReason ?? (auth.user ? '' : 'Sign in to like')}
            >
              <i className="fa-light fa-thumbs-up blog-action-icon"></i>
              <span>{props.node.liked_by_me ? 'Liked' : 'Like'}</span>
              <strong>{props.node.like_count}</strong>
            </button>
            <button
              type="button"
              className="blog-comment-action-btn"
              onClick={() => {
                if (!auth.user || interactionsLocked) return
                setReplying((v) => !v)
              }}
              disabled={!auth.user || interactionsLocked}
              title={props.interactionDisabledReason ?? (auth.user ? '' : 'Sign in to reply')}
            >
              <i className="fa-light fa-reply blog-action-icon"></i>Reply
            </button>
            {!isReply && replyCount ? (
              <button
                type="button"
                className="blog-comment-action-btn"
                onClick={() => setRepliesOpen((v) => !v)}
              >
                <i className={`fa-light ${repliesOpen ? 'fa-chevron-up' : 'fa-chevron-down'} blog-action-icon`}></i>
                {repliesOpen ? 'Hide' : 'Show'} replies
                <strong>{replyCount}</strong>
              </button>
            ) : null}
            {canEdit ? (
              editing ? (
                <>
                  <button
                    type="button"
                    className="blog-comment-action-btn"
                    onClick={() => {
                      saveEdit().catch(() => {})
                    }}
                  >
                    <i className="fa-light fa-check blog-action-icon"></i>Save
                  </button>
                  <button
                    type="button"
                    className="blog-comment-action-btn"
                    onClick={() => {
                      setEditText(props.node.content)
                      setEditing(false)
                    }}
                  >
                    <i className="fa-light fa-xmark blog-action-icon"></i>Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="blog-comment-action-btn"
                  onClick={() => {
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
                className="blog-comment-action-btn is-danger"
                onClick={(e) => {
                  remove().catch(() => {})
                }}
              >
                <i className="fa-light fa-trash blog-action-icon"></i>Delete
              </button>
            ) : null}
          </div>

          {localError ? <div className="blog-inline-message blog-inline-message--error">{localError}</div> : null}
          {localNotice ? <div className="blog-inline-message blog-inline-message--success">{localNotice}</div> : null}

          {replying ? (
            <div className="cl_blog_details-reply blog-comment-reply-wrap">
              <div className="cl_blog_details-reply-item">
                <label htmlFor={`reply-${props.node.id}`}>{isReply ? 'Reply in thread' : 'Reply'}</label>
                <textarea
                  id={`reply-${props.node.id}`}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={4}
                ></textarea>
                <small>{normalizeComment(replyText).length}/{COMMENT_MAX_LENGTH} characters</small>
                {replyText.length > 0 && validateCommentContent(replyText) ? <small className="blog-field-error">{validateCommentContent(replyText)}</small> : null}
              </div>
              <div className="cl_blog_details-reply-item">
                <button
                  type="button"
                  onClick={() => submitReply().catch(() => {})}
                  disabled={Boolean(validateCommentContent(replyText))}
                  className={validateCommentContent(replyText) ? 'blog-btn-disabled' : undefined}
                >
                  Send Now
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {!isReply && repliesOpen && props.node.replies.length ? (
        <div className="blog-comment-children">
          {props.node.replies.map((r) => (
            <CommentItem
              key={r.id}
              node={r}
              blogAuthorId={props.blogAuthorId}
              meId={props.meId}
              targetCommentId={props.targetCommentId}
              depth={1}
              onReload={props.onReload}
              onLikeUpdate={props.onLikeUpdate}
              onError={props.onError}
              onNotice={props.onNotice}
              interactionDisabledReason={props.interactionDisabledReason}
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
  const [searchParams] = useSearchParams()
  const id = Number(params.id)

  const [blog, setBlog] = useState<BlogDetail | null>(null)
  const [comments, setComments] = useState<CommentNode[]>([])
  const [commentPage, setCommentPage] = useState(() => Math.max(1, Number(searchParams.get('commentPage')) || 1))
  const [commentTotal, setCommentTotal] = useState(0)
  const [commentText, setCommentText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [commentFormNotice, setCommentFormNotice] = useState<string | null>(null)
  const [commentFormError, setCommentFormError] = useState<string | null>(null)
  const [likeSaving, setLikeSaving] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const targetCommentId = Math.max(0, Number(searchParams.get('comment')) || 0) || null

  const meId = auth.user?.id ?? null

  const load = useMemo(
    () => async () => {
      if (!Number.isFinite(id)) return
      setError(null)
      const viewKey = `blog:viewed:${id}`
      const countView = typeof window !== 'undefined' && window.sessionStorage.getItem(viewKey) !== '1'
      if (countView) window.sessionStorage.setItem(viewKey, '1')
      const b = await getBlogDetail(id, { countView })
      setBlog(b)
      const c = await getBlogComments(id, commentPage, COMMENT_PAGE_SIZE)
      setComments(c.items)
      setCommentTotal(c.total)
    },
    [commentPage, id]
  )

  useEffect(() => {
    load().catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [load])

  useEffect(() => {
    const requestedPage = Math.max(1, Number(searchParams.get('commentPage')) || 1)
    setCommentPage(requestedPage)
  }, [searchParams])

  useEffect(() => {
    if (!targetCommentId || !comments.length) return
    const handle = window.setTimeout(() => {
      document.getElementById(`comment-${targetCommentId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
    return () => window.clearTimeout(handle)
  }, [comments, targetCommentId])

  useEffect(() => {
    if (lightboxIndex === null) return undefined

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLightboxIndex(null)
      } else if (event.key === 'ArrowLeft') {
        setLightboxIndex((current) => current === null ? current : Math.max(0, current - 1))
      } else if (event.key === 'ArrowRight') {
        const maxIndex = Math.max(0, (blog?.image_urls?.slice(0, 9).length ?? 1) - 1)
        setLightboxIndex((current) => current === null ? current : Math.min(maxIndex, current + 1))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [blog?.image_urls, lightboxIndex])

  async function toggleLike() {
    if (!blog) return
    setLikeSaving(true)
    try {
      const result = await toggleBlogLike(blog.id)
      setBlog((current) => current ? {
        ...current,
        liked_by_me: Boolean((result as { liked?: boolean }).liked),
        like_count: Number((result as { like_count?: number }).like_count ?? current.like_count),
      } : current)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setLikeSaving(false)
    }
  }

  async function submitComment() {
    if (!blog) return
    const validationError = validateCommentContent(commentText)
    if (validationError) {
      setCommentFormNotice(null)
      setCommentFormError(validationError)
      return
    }
    setError(null)
    setCommentFormError(null)
    try {
      await createBlogComment(blog.id, { content: normalizeComment(commentText) })
      setCommentText('')
      setCommentPage(1)
      setCommentFormNotice('Comment posted.')
      if (commentPage === 1) await load()
    } catch (e: unknown) {
      setCommentFormNotice(null)
      setCommentFormError(e instanceof Error ? e.message : 'Publish failed')
    }
  }

  function updateCommentLike(commentId: number, liked: boolean, likeCount: number) {
    setComments((current) => updateCommentLikeInTree(current, commentId, liked, likeCount))
  }

  function showNotice(message: string) {
    setError(null)
    setCommentFormError(null)
    setCommentFormNotice(message)
  }

  const commentLength = normalizeComment(commentText).length
  const commentValidationError = validateCommentContent(commentText)
  const commentTotalPages = Math.max(1, Math.ceil(commentTotal / COMMENT_PAGE_SIZE))
  const canInteract = Boolean(blog?.is_published && blog.visibility === 'public')
  const detailImages = blog?.image_urls?.slice(0, 9) ?? []
  const interactionDisabledReason = blog && !canInteract
    ? blog.visibility === 'private'
      ? 'This post is private. Only you can view it, and public interactions are disabled.'
      : 'This post is not public right now. Existing comments remain visible to the owner/admin, but new comments and likes are disabled until it is published again.'
    : null

  if (!Number.isFinite(id)) return <div className="cl_blog-widget">Invalid ID</div>

  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
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

      <section className="cl_blog_details-area blog-detail-section brand-page-body">
        <div className="page-container">
          {error ? (
            <div className="blog-detail-error-row">
              <div>
                <div className="cl_blog-widget section-widget border-rose-200 bg-rose-50 text-rose-700">{error}</div>
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
                        <FallbackImage
                          src={getBlogCover(blog, '/assets/images/blog/blog_details-1.png')}
                          fallbackSrc="/assets/images/blog/blog_details-1.png"
                          alt={blog.title}
                          fetchPriority="high"
                          decoding="async"
                        />
                        {blog.tags[0]?.name ? (
                          <span className="cl_blog_details-content-img-tag blog-category-pill">{displayBlogTagName(blog.tags[0].name)}</span>
                        ) : null}
                      </div>
                      <h3 className="cl_blog_details-content-title section-stack-sm blog-break-text">{blog.title}</h3>
                      <div className="cl_blog_classic-item-content-meta blog-detail-author-meta">
                        <span className="blog-detail-author-inline">
                          <FallbackImage
                            src={resolveMediaUrl(blog.author.avatar_url) ?? '/assets/images/blog/blog_widget-1.png'}
                            fallbackSrc="/assets/images/blog/blog_widget-1.png"
                            alt={`${blog.author.username} avatar`}
                          />
                          <span>BY {blog.author.username}</span>
                        </span>
                        <span>
                          <i className="fa-light fa-calendar"></i>
                          <span>{new Date(blog.created_at).toLocaleDateString()}</span>
                        </span>
                        <span>
                          <i className="fa-light fa-eye"></i>
                          <span>{blog.view_count} views</span>
                        </span>
                        <span>
                          <i className="fa-light fa-thumbs-up"></i>
                          <span>{blog.like_count} likes</span>
                        </span>
                      </div>
                      {!blog.is_published ? <div className="blog-draft-badge section-stack-sm">Draft preview</div> : null}
                      {blog.visibility === 'private' ? <div className="blog-draft-badge section-stack-sm">Private</div> : null}
                      {detailImages.length ? (
                        <div className={`blog-detail-image-grid blog-detail-image-grid--count-${Math.min(detailImages.length, 9)}`}>
                          {detailImages.map((url, index) => (
                            <FallbackImage
                              key={`${url}-${index}`}
                              src={resolveMediaUrl(url) ?? url}
                              fallbackSrc="/assets/images/blog/blog_details-1.png"
                              alt={`${blog.title} image ${index + 1}`}
                              loading="lazy"
                              decoding="async"
                              role="button"
                              tabIndex={0}
                              onClick={() => setLightboxIndex(index)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                  event.preventDefault()
                                  setLightboxIndex(index)
                                }
                              }}
                            />
                          ))}
                        </div>
                      ) : null}
                      {blog.content
                        .split(/\n{2,}/)
                        .filter((x) => x.trim().length)
                        .map((p, idx) => (
                          <p className="cl_blog_details-content-text section-text-block blog-prewrap blog-break-text" key={idx}>
                            {p}
                          </p>
                        ))}

                      <div className="cl_blog_details-content-bottom section-stack-lg">
                        <div className="cl_blog-widget-tag">
                          {blog.tags.map((t) => (
                            <span key={t.id} className="blog-tag-static">
                              {displayBlogTagName(t.name)}
                            </span>
                          ))}
                        </div>
                        <div className="cl_blog_details-content-social blog-detail-stats">
                          <button
                            type="button"
                            className={`blog-detail-stat-btn${blog.liked_by_me ? ' is-active' : ''}`}
                            onClick={() => {
                              if (!auth.user || !canInteract) return
                              toggleLike().catch(() => {})
                            }}
                            disabled={!auth.user || !canInteract || likeSaving}
                            title={interactionDisabledReason ?? (auth.user ? '' : 'Sign in to like')}
                          >
                            <i className="fa-light fa-thumbs-up" aria-hidden="true"></i>
                            <span>{blog.liked_by_me ? 'Liked' : 'Like'}</span>
                            <strong>{blog.like_count}</strong>
                          </button>
                          <span className="blog-detail-stat">
                            <i className="fa-light fa-eye" aria-hidden="true"></i>
                            <span>Views</span>
                            <strong>{blog.view_count}</strong>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="cl_blog_details-reply">
                      <h3 className="cl_blog_details-reply-title">Leave a Comment</h3>
                      <p>
                        {!canInteract
                          ? 'Historical comments are visible here, but new comments are disabled while this post is not public.'
                          : auth.user
                            ? 'Post a comment or reply in a single-level thread.'
                            : 'Sign in to post a comment.'}
                      </p>
                      {interactionDisabledReason ? (
                        <div className="blog-readonly-note">
                          {interactionDisabledReason}
                        </div>
                      ) : null}
                      <form
                        action="#"
                        onSubmit={(e) => {
                          e.preventDefault()
                          if (!auth.user || !canInteract) return
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
                                disabled={!auth.user || !canInteract}
                              ></textarea>
                              <small>
                                {COMMENT_MIN_LENGTH}-{COMMENT_MAX_LENGTH} characters | {commentLength}/{COMMENT_MAX_LENGTH}
                              </small>
                              {commentText.length > 0 && commentValidationError ? <small className="blog-field-error">{commentValidationError}</small> : null}
                              {commentFormError ? <div className="blog-inline-message blog-inline-message--error">{commentFormError}</div> : null}
                              {commentFormNotice ? <div className="blog-inline-message blog-inline-message--success">{commentFormNotice}</div> : null}
                            </div>
                          </div>
                          <div>
                            <div className="cl_blog_details-reply-item">
                              <button type="submit" disabled={!auth.user || !canInteract || Boolean(commentValidationError)}>
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
                      <div className="blog-comments-head">
                        <h3>Comments</h3>
                        <span>{commentTotal} total</span>
                      </div>
                      {comments.map((c) => (
                        <CommentItem
                          key={c.id}
                          node={c}
                          blogAuthorId={blog.author.id}
                          meId={meId}
                          targetCommentId={targetCommentId}
                          onReload={() => load().catch(() => {})}
                          onLikeUpdate={updateCommentLike}
                          onError={setError}
                          onNotice={showNotice}
                          interactionDisabledReason={interactionDisabledReason}
                        />
                      ))}
                      {comments.length === 0 ? (
                        <div className="cl_blog-widget">
                          {blog.is_published ? 'No comments yet' : 'Comments are available after publishing.'}
                        </div>
                      ) : null}
                      {commentTotalPages > 1 ? (
                        <div className="blog-comments-pagination">
                          <button type="button" disabled={commentPage <= 1} onClick={() => setCommentPage((page) => Math.max(1, page - 1))}>
                            Prev
                          </button>
                          <span>Page {commentPage} / {commentTotalPages}</span>
                          <button type="button" disabled={commentPage >= commentTotalPages} onClick={() => setCommentPage((page) => Math.min(commentTotalPages, page + 1))}>
                            Next
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      </section>
      {lightboxIndex !== null && detailImages[lightboxIndex] ? (
        <div className="blog-image-lightbox" role="dialog" aria-modal="true" aria-label="Blog image preview" onClick={() => setLightboxIndex(null)}>
          <button type="button" className="blog-image-lightbox-close" onClick={() => setLightboxIndex(null)} aria-label="Close image preview">
            <i className="fa-light fa-xmark" aria-hidden="true"></i>
          </button>
          <button
            type="button"
            className="blog-image-lightbox-nav blog-image-lightbox-nav--prev"
            onClick={(event) => {
              event.stopPropagation()
              setLightboxIndex((current) => current === null ? current : Math.max(0, current - 1))
            }}
            disabled={lightboxIndex <= 0}
            aria-label="Previous image"
          >
            <i className="fa-light fa-arrow-left" aria-hidden="true"></i>
          </button>
          <FallbackImage
            src={resolveMediaUrl(detailImages[lightboxIndex]) ?? detailImages[lightboxIndex]}
            fallbackSrc="/assets/images/blog/blog_details-1.png"
            alt={`${blog?.title ?? 'Blog'} image ${lightboxIndex + 1}`}
            onClick={(event) => event.stopPropagation()}
          />
          <button
            type="button"
            className="blog-image-lightbox-nav blog-image-lightbox-nav--next"
            onClick={(event) => {
              event.stopPropagation()
              setLightboxIndex((current) => current === null ? current : Math.min(detailImages.length - 1, current + 1))
            }}
            disabled={lightboxIndex >= detailImages.length - 1}
            aria-label="Next image"
          >
            <i className="fa-light fa-arrow-right" aria-hidden="true"></i>
          </button>
          <span className="blog-image-lightbox-count">{lightboxIndex + 1} / {detailImages.length}</span>
        </div>
      ) : null}
    </>
  )
}


