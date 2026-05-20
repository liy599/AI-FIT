import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { FallbackImage } from '../ui'
import { buildPaginationItems } from '../../lib/pagination'
import {
  deleteNotification,
  getMyBlogs,
  getMyComments,
  getMyNotifications,
  markNotificationRead,
  NOTIFICATIONS_CHANGED_EVENT,
  type UserNotification
} from '../../modules/user'
import { updateBlog, updateComment } from '../../modules/blog'
import type { MyBlog, MyCommentGroup } from '../../modules/user/profileTypes'

type BlogStatus = 'published' | 'draft' | 'unpublished'
type ActivityTab = 'comments' | 'notifications'
const COMMENT_MAX_LENGTH = 500

type UserCommunityPanelProps = {
  resolveMediaUrl: (url: string | null | undefined) => string | null
  onTogglePublish: (blog: MyBlog) => Promise<void>
  onDeleteBlog: (blogId: number) => Promise<void>
  onDeleteComment: (commentId: number) => Promise<void>
}

const BLOG_PAGE_SIZE = 5
const COMMENT_GROUP_PAGE_SIZE = 5
const NOTIFICATION_PAGE_SIZE = 5

function totalPages(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize))
}

function formatDate(value: string) {
  return new Date(value).toLocaleString()
}

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

function validateComment(value: string) {
  const text = normalizeComment(value)
  if (!text.length) return 'Comment is required'
  if (text.length > COMMENT_MAX_LENGTH) return `Comment must be at most ${COMMENT_MAX_LENGTH} characters`
  return null
}

function formatBlogExcerptLines(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .filter(Boolean)
    .slice(0, 2)
}

function Pagination(props: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const pages = totalPages(props.total, props.pageSize)
  const items = buildPaginationItems(props.page, pages)
  return (
    <div className="profile-pagination">
      <button type="button" disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)}>
        Prev
      </button>
      <div className="profile-page-numbers" aria-label="Profile pages">
        {items.map((item, index) =>
          item === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="profile-page-ellipsis">...</span>
          ) : (
            <button
              key={item}
              type="button"
              className={item === props.page ? 'is-active' : ''}
              aria-current={item === props.page ? 'page' : undefined}
              onClick={() => props.onPage(item)}
            >
              {item}
            </button>
          )
        )}
      </div>
      <button type="button" disabled={props.page >= pages} onClick={() => props.onPage(props.page + 1)}>
        Next
      </button>
    </div>
  )
}

export function UserCommunityPanel(props: UserCommunityPanelProps) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { resolveMediaUrl, onTogglePublish, onDeleteBlog, onDeleteComment } = props
  const [blogStatus, setBlogStatus] = useState<BlogStatus>('published')
  const [blogPage, setBlogPage] = useState(1)
  const [blogSearch, setBlogSearch] = useState('')
  const [blogSearchDraft, setBlogSearchDraft] = useState('')
  const [blogSort, setBlogSort] = useState('updated_at:desc')
  const [blogs, setBlogs] = useState<MyBlog[]>([])
  const [blogTotal, setBlogTotal] = useState(0)
  const [blogsLoading, setBlogsLoading] = useState(false)
  const [blogsError, setBlogsError] = useState<string | null>(null)
  const [blogReloadKey, setBlogReloadKey] = useState(0)

  const [commentPage, setCommentPage] = useState(1)
  const [commentSearch, setCommentSearch] = useState('')
  const [commentSearchDraft, setCommentSearchDraft] = useState('')
  const [commentSort, setCommentSort] = useState('latest_comment:desc')
  const [commentGroups, setCommentGroups] = useState<MyCommentGroup[]>([])
  const [commentTotal, setCommentTotal] = useState(0)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [openBlogIds, setOpenBlogIds] = useState<Set<number>>(new Set())
  const [commentReloadKey, setCommentReloadKey] = useState(0)
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [editingCommentText, setEditingCommentText] = useState('')
  const [savingCommentId, setSavingCommentId] = useState<number | null>(null)

  const [activityTab, setActivityTab] = useState<ActivityTab>(() => searchParams.get('activity') === 'notifications' ? 'notifications' : 'comments')
  const [notificationPage, setNotificationPage] = useState(1)
  const [notifications, setNotifications] = useState<UserNotification[]>([])
  const [notificationTotal, setNotificationTotal] = useState(0)
  const [notificationUnreadTotal, setNotificationUnreadTotal] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [notificationsError, setNotificationsError] = useState<string | null>(null)
  const [notificationReloadKey, setNotificationReloadKey] = useState(0)
  const [deletingNotificationId, setDeletingNotificationId] = useState<number | null>(null)

  const [blogSortBy, blogSortDir] = blogSort.split(':') as [string, string]
  const [commentSortBy, commentSortDir] = commentSort.split(':') as [string, string]
  const publishedCountLabel =
    blogStatus === 'published' ? `${blogTotal} published` : blogStatus === 'unpublished' ? `${blogTotal} admin disabled` : `${blogTotal} drafts`

  useEffect(() => {
    setActivityTab(searchParams.get('activity') === 'notifications' ? 'notifications' : 'comments')
  }, [searchParams])

  useEffect(() => {
    let active = true
    setBlogsLoading(true)
    setBlogsError(null)
    getMyBlogs<MyBlog>({
      page: blogPage,
      page_size: BLOG_PAGE_SIZE,
      q: blogSearch,
      status: blogStatus,
      sort_by: blogSortBy,
      sort_dir: blogSortDir,
    })
      .then((result) => {
        if (!active) return
        setBlogs(result.items)
        setBlogTotal(result.total)
      })
      .catch((error: unknown) => {
        if (!active) return
        setBlogs([])
        setBlogTotal(0)
        setBlogsError(error instanceof Error ? error.message : 'Failed to load blogs')
      })
      .finally(() => {
        if (active) setBlogsLoading(false)
      })
    return () => {
      active = false
    }
  }, [blogPage, blogReloadKey, blogSearch, blogSortBy, blogSortDir, blogStatus])

  useEffect(() => {
    if (activityTab !== 'comments') return
    let active = true
    setCommentsLoading(true)
    setCommentsError(null)
    getMyComments<MyCommentGroup>({
      page: commentPage,
      page_size: COMMENT_GROUP_PAGE_SIZE,
      q: commentSearch,
      sort_by: commentSortBy,
      sort_dir: commentSortDir,
    })
      .then((result) => {
        if (!active) return
        setCommentGroups(result.items)
        setCommentTotal(result.total)
      })
      .catch((error: unknown) => {
        if (!active) return
        setCommentGroups([])
        setCommentTotal(0)
        setCommentsError(error instanceof Error ? error.message : 'Failed to load comments')
      })
      .finally(() => {
        if (active) setCommentsLoading(false)
      })
    return () => {
      active = false
    }
  }, [activityTab, commentPage, commentReloadKey, commentSearch, commentSortBy, commentSortDir])

  useEffect(() => {
    if (activityTab !== 'notifications') return
    let active = true
    setNotificationsLoading(true)
    setNotificationsError(null)
    getMyNotifications({ page: notificationPage, page_size: NOTIFICATION_PAGE_SIZE })
      .then((result) => {
        if (!active) return
        setNotifications(result.items)
        setNotificationTotal(result.total)
        setNotificationUnreadTotal(result.unread_count)
      })
      .catch((error: unknown) => {
        if (!active) return
        setNotifications([])
        setNotificationTotal(0)
        setNotificationUnreadTotal(0)
        setNotificationsError(error instanceof Error ? error.message : 'Failed to load notifications')
      })
      .finally(() => {
        if (active) setNotificationsLoading(false)
      })
    return () => {
      active = false
    }
  }, [activityTab, notificationPage, notificationReloadKey])

  useEffect(() => {
    if (activityTab !== 'comments') return
    if (!commentSearch.trim()) return
    setOpenBlogIds(new Set(commentGroups.map((group) => group.blog.id)))
  }, [activityTab, commentGroups, commentSearch])

  const blogEmptyText = useMemo(() => {
    if (blogsLoading) return 'Loading blogs...'
    if (blogSearch) return 'No matching blogs.'
    if (blogStatus === 'published') return 'No published blogs yet.'
    if (blogStatus === 'unpublished') return 'No admin-disabled blogs.'
    return 'No drafts yet.'
  }, [blogSearch, blogStatus, blogsLoading])

  async function togglePublish(blog: MyBlog) {
    await onTogglePublish(blog)
    setBlogReloadKey((key) => key + 1)
  }

  async function removeBlog(blogId: number) {
    await onDeleteBlog(blogId)
    setBlogReloadKey((key) => key + 1)
  }

  async function requestRestore(blogId: number) {
    await updateBlog(blogId, { moderation_action: 'request_restore' })
    setBlogReloadKey((key) => key + 1)
  }

  async function removeComment(commentId: number) {
    await onDeleteComment(commentId)
    setCommentReloadKey((key) => key + 1)
  }

  async function openNotification(notification: UserNotification) {
    if (!notification.is_read) {
      await markNotificationRead(notification.id).catch(() => {})
      setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, is_read: true } : item))
      setNotificationUnreadTotal((count) => Math.max(0, count - 1))
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
    }
    navigate(`/blogs/${notification.blog.id}?comment=${notification.comment_id}&commentPage=${notification.comment_page}`)
  }

  async function removeNotification(notification: UserNotification) {
    setDeletingNotificationId(notification.id)
    setNotificationsError(null)
    try {
      await deleteNotification(notification.id)
      if (notifications.length === 1 && notificationPage > 1) {
        setNotificationPage((page) => Math.max(1, page - 1))
      } else {
        setNotifications((items) => items.filter((item) => item.id !== notification.id))
      }
      setNotificationTotal((count) => Math.max(0, count - 1))
      if (!notification.is_read) setNotificationUnreadTotal((count) => Math.max(0, count - 1))
      setNotificationReloadKey((key) => key + 1)
      window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED_EVENT))
    } catch (error: unknown) {
      setNotificationsError(error instanceof Error ? error.message : 'Delete failed')
    } finally {
      setDeletingNotificationId(null)
    }
  }

  function startEditComment(commentId: number, content: string) {
    setCommentsError(null)
    setEditingCommentId(commentId)
    setEditingCommentText(content)
  }

  function cancelEditComment() {
    setEditingCommentId(null)
    setEditingCommentText('')
  }

  async function saveComment(commentId: number) {
    const validationError = validateComment(editingCommentText)
    if (validationError) {
      setCommentsError(validationError)
      return
    }
    setCommentsError(null)
    setSavingCommentId(commentId)
    try {
      const nextContent = normalizeComment(editingCommentText)
      await updateComment(commentId, nextContent)
      setCommentGroups((groups) =>
        groups.map((group) => ({
          ...group,
          comments: group.comments.map((comment) =>
            comment.id === commentId
              ? { ...comment, content: nextContent, updated_at: new Date().toISOString() }
              : comment,
          ),
        })),
      )
      cancelEditComment()
    } catch (error: unknown) {
      setCommentsError(error instanceof Error ? error.message : 'Save failed')
    } finally {
      setSavingCommentId(null)
    }
  }

  function toggleComments(blogId: number) {
    setOpenBlogIds((current) => {
      const next = new Set(current)
      if (next.has(blogId)) next.delete(blogId)
      else next.add(blogId)
      return next
    })
  }

  function switchActivity(next: ActivityTab) {
    setActivityTab(next)
    const params = new URLSearchParams(searchParams)
    params.set('tab', 'Blogs')
    if (next === 'notifications') params.set('activity', 'notifications')
    else params.delete('activity')
    setSearchParams(params, { preventScrollReset: true })
  }

  return (
    <div className="space-y-4">
      <div className="profile-panel profile-community-panel">
        <div className="profile-community-head">
          <div>
            <div className="profile-community-title">My Blogs</div>
            <div className="profile-community-subtitle">Manage published posts and drafts separately.</div>
          </div>
          <Link to="/blogs/new" className="profile-btn-primary profile-new-blog-btn">
            + New blog
          </Link>
        </div>

        <div className="profile-community-toolbar">
          <div className="profile-segmented">
            <button type="button" className={blogStatus === 'published' ? 'is-active' : ''} onClick={() => { setBlogStatus('published'); setBlogPage(1) }}>
              Published
            </button>
            <button type="button" className={blogStatus === 'draft' ? 'is-active' : ''} onClick={() => { setBlogStatus('draft'); setBlogPage(1) }}>
              Drafts
            </button>
            <button type="button" className={blogStatus === 'unpublished' ? 'is-active' : ''} onClick={() => { setBlogStatus('unpublished'); setBlogPage(1) }}>
              Admin disabled
            </button>
          </div>
          <form
            className="profile-filterbar"
            onSubmit={(event) => {
              event.preventDefault()
              setBlogSearch(blogSearchDraft.trim())
              setBlogPage(1)
            }}
          >
            <input value={blogSearchDraft} onChange={(event) => setBlogSearchDraft(event.target.value)} placeholder="Search blog titles" />
            <select value={blogSort} onChange={(event) => { setBlogSort(event.target.value); setBlogPage(1) }}>
              <option value="updated_at:desc">Recently updated</option>
              <option value="created_at:desc">Newest created</option>
              <option value="created_at:asc">Oldest created</option>
            </select>
            <button type="submit">Search</button>
          </form>
        </div>

        <div className="profile-list-summary">{publishedCountLabel}</div>
        {blogsError ? <div className="mt-3 text-sm text-rose-700">{blogsError}</div> : null}

        <div className="mt-4 space-y-3">
          {blogs.map((blog) => (
            <div key={blog.id} className="profile-blog-card">
              <Link to={`/blogs/${blog.id}`} className="profile-blog-cover">
                {blog.cover_image_url ? (
                  <FallbackImage
                    src={resolveMediaUrl(blog.cover_image_url)}
                    fallbackSrc="/assets/images/blog/h2_1.png"
                    alt={`${blog.title} cover`}
                  />
                ) : (
                  <span>No cover</span>
                )}
              </Link>
              <div className="profile-blog-main">
                <Link to={`/blogs/${blog.id}`} className="profile-blog-title">
                  {blog.title}
                </Link>
                <div className="profile-blog-meta">
                  <span className={blog.status === 'unpublished' ? 'profile-status profile-status--unpublished' : blog.is_published ? 'profile-status profile-status--published' : 'profile-status profile-status--draft'}>
                    {blog.status === 'unpublished' ? 'Admin disabled' : blog.is_published ? 'Published' : 'Draft'}
                  </span>
                  {blog.visibility === 'private' ? <span className="profile-status profile-status--draft">Private</span> : null}
                  {blog.restore_requested ? <span className="profile-status profile-status--requested">Restore requested</span> : null}
                  <span>{formatDate(blog.updated_at)}</span>
                </div>
                {blog.excerpt ? (
                  <p className="profile-blog-excerpt">
                    {formatBlogExcerptLines(blog.excerpt).map((line, index) => (
                      <span className="profile-blog-excerpt-line" key={`${blog.id}-excerpt-${index}`}>
                        {line}
                      </span>
                    ))}
                  </p>
                ) : null}
              </div>
              <div className="profile-blog-actions">
                <Link className="profile-btn-chip" to={`/blogs/${blog.id}`}>View</Link>
                <Link className="profile-btn-chip" to={`/blogs/${blog.id}/edit`}>Edit</Link>
                {blog.status === 'unpublished' ? (
                  <button className="profile-btn-chip" type="button" disabled={blog.restore_requested} onClick={() => requestRestore(blog.id).catch(() => {})}>
                    {blog.restore_requested ? 'Requested' : 'Request restore'}
                  </button>
                ) : (
                  <button className="profile-btn-chip" type="button" onClick={() => togglePublish(blog).catch(() => {})}>
                    {blog.is_published ? 'Move to draft' : 'Publish'}
                  </button>
                )}
                <button className="profile-btn-chip-danger" type="button" onClick={() => removeBlog(blog.id).catch(() => {})}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {blogs.length === 0 ? <div className="profile-empty-state">{blogEmptyText}</div> : null}
        </div>

        <Pagination page={blogPage} total={blogTotal} pageSize={BLOG_PAGE_SIZE} onPage={setBlogPage} />
      </div>

      <div className="profile-panel profile-community-panel">
        <div className="profile-community-head">
          <div>
            <div className="profile-community-title">My Comments</div>
            <div className="profile-community-subtitle">
              {activityTab === 'comments' ? 'Grouped by blog for easier review.' : 'Replies and updates from your community activity.'}
            </div>
          </div>
        </div>

        <div className="profile-activity-toolbar">
          <div className="profile-segmented">
            <button type="button" className={activityTab === 'comments' ? 'is-active' : ''} onClick={() => switchActivity('comments')}>
              Comments
            </button>
            <button type="button" className={activityTab === 'notifications' ? 'is-active' : ''} onClick={() => switchActivity('notifications')}>
              Notifications
            </button>
          </div>

          {activityTab === 'comments' ? (
            <form
              className="profile-filterbar profile-filterbar-wide"
              onSubmit={(event) => {
                event.preventDefault()
                setCommentSearch(commentSearchDraft.trim())
                setCommentPage(1)
              }}
            >
              <input value={commentSearchDraft} onChange={(event) => setCommentSearchDraft(event.target.value)} placeholder="Search comments or blog titles" />
              <select value={commentSort} onChange={(event) => { setCommentSort(event.target.value); setCommentPage(1) }}>
                <option value="latest_comment:desc">Latest comment</option>
                <option value="latest_comment:asc">Oldest comment</option>
                <option value="comment_count:desc">Most comments</option>
              </select>
              <button type="submit">Search</button>
            </form>
          ) : null}

        </div>

        {activityTab === 'comments' ? (
          <>

            <div className="profile-list-summary">{commentTotal} blogs</div>
            {commentsError ? <div className="mt-3 text-sm text-rose-700">{commentsError}</div> : null}

            <div className="mt-4 space-y-3">
              {commentGroups.map((group) => {
                const open = openBlogIds.has(group.blog.id)
                return (
                  <div key={group.blog.id} className="profile-comment-group">
                    <button type="button" className="profile-comment-group-head" onClick={() => toggleComments(group.blog.id)}>
                      <div className="profile-comment-cover">
                        {group.blog.cover_image_url ? (
                          <FallbackImage src={resolveMediaUrl(group.blog.cover_image_url)} fallbackSrc="/assets/images/blog/h2_2.png" alt="" />
                        ) : (
                          <span>No cover</span>
                        )}
                      </div>
                      <div className="profile-comment-group-main">
                        <span className="profile-comment-blog-title">{group.blog.title}</span>
                        <span className="profile-blog-meta">{group.comment_count} comments / Latest {formatDate(group.latest_comment_at)}</span>
                      </div>
                      <span className="profile-comment-toggle">{open ? 'Hide' : 'Show'}</span>
                    </button>
                    {open ? (
                      <div className="profile-comment-list">
                        {group.comments.map((comment) => {
                          const editing = editingCommentId === comment.id
                          const commentEditError = editing ? validateComment(editingCommentText) : null
                          return (
                            <div key={comment.id} className="profile-comment-item">
                              <div>
                                {editing ? (
                                  <div className="profile-comment-edit">
                                    <textarea
                                      value={editingCommentText}
                                      maxLength={COMMENT_MAX_LENGTH}
                                      onChange={(event) => setEditingCommentText(event.target.value)}
                                    />
                                    <small>{normalizeComment(editingCommentText).length}/{COMMENT_MAX_LENGTH} characters</small>
                                    {commentEditError ? <small className="blog-field-error">{commentEditError}</small> : null}
                                  </div>
                                ) : (
                                  <div className="profile-comment-text">{comment.content}</div>
                                )}
                                <div className="mt-1 text-xs text-slate-500">{formatDate(comment.created_at)}</div>
                              </div>
                              <div className="profile-comment-actions">
                                <Link className="profile-btn-chip" to={`/blogs/${group.blog.id}`}>View blog</Link>
                                {editing ? (
                                  <>
                                    <button
                                      className="profile-btn-chip"
                                      type="button"
                                      disabled={Boolean(commentEditError) || savingCommentId === comment.id}
                                      onClick={() => saveComment(comment.id).catch(() => {})}
                                    >
                                      Save
                                    </button>
                                    <button className="profile-btn-chip" type="button" onClick={cancelEditComment}>
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button className="profile-btn-chip" type="button" onClick={() => startEditComment(comment.id, comment.content)}>
                                    Edit
                                  </button>
                                )}
                                <button className="profile-btn-chip-danger" type="button" onClick={() => removeComment(comment.id).catch(() => {})}>
                                  Delete
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : null}
                  </div>
                )
              })}
              {commentGroups.length === 0 ? <div className="profile-empty-state">{commentsLoading ? 'Loading comments...' : 'No comments found.'}</div> : null}
            </div>

            <Pagination page={commentPage} total={commentTotal} pageSize={COMMENT_GROUP_PAGE_SIZE} onPage={setCommentPage} />
          </>
        ) : (
          <>
            <div className="profile-list-summary">{notificationTotal} notifications / {notificationUnreadTotal} unread</div>
            {notificationsError ? <div className="mt-3 text-sm text-rose-700">{notificationsError}</div> : null}

            <div className="profile-notification-list">
              {notifications.map((notification) => (
                <div key={notification.id} className={`profile-notification-item${notification.is_read ? '' : ' is-unread'}`}>
                  <button type="button" className="profile-notification-main" onClick={() => openNotification(notification).catch(() => {})}>
                    <span>
                      <strong>{notification.actor.username}</strong> replied to your comment
                    </span>
                    <small>{notification.blog.title}</small>
                    <time>{formatDate(notification.created_at)}</time>
                  </button>
                  <button
                    type="button"
                    className="profile-btn-chip-danger"
                    disabled={deletingNotificationId === notification.id}
                    onClick={() => removeNotification(notification).catch(() => {})}
                  >
                    {deletingNotificationId === notification.id ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              ))}
              {notifications.length === 0 ? (
                <div className="profile-empty-state">{notificationsLoading ? 'Loading notifications...' : 'No notifications.'}</div>
              ) : null}
            </div>

            <Pagination page={notificationPage} total={notificationTotal} pageSize={NOTIFICATION_PAGE_SIZE} onPage={setNotificationPage} />
          </>
        )}
      </div>
    </div>
  )
}
