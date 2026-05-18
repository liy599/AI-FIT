import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMyBlogs, getMyComments } from '../../modules/user'
import { updateBlog, updateComment } from '../../modules/blog'
import type { MyBlog, MyCommentGroup } from '../../modules/user/profileTypes'

type BlogStatus = 'published' | 'draft' | 'unpublished'
const COMMENT_MAX_LENGTH = 500

type UserCommunityPanelProps = {
  resolveMediaUrl: (url: string | null | undefined) => string | null
  onTogglePublish: (blog: MyBlog) => Promise<void>
  onDeleteBlog: (blogId: number) => Promise<void>
  onDeleteComment: (commentId: number) => Promise<void>
}

const BLOG_PAGE_SIZE = 5
const COMMENT_GROUP_PAGE_SIZE = 4

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

function Pagination(props: { page: number; total: number; pageSize: number; onPage: (page: number) => void }) {
  const pages = totalPages(props.total, props.pageSize)
  return (
    <div className="profile-pagination">
      <button type="button" disabled={props.page <= 1} onClick={() => props.onPage(props.page - 1)}>
        Prev
      </button>
      <span>Page {props.page} / {pages}</span>
      <button type="button" disabled={props.page >= pages} onClick={() => props.onPage(props.page + 1)}>
        Next
      </button>
    </div>
  )
}

export function UserCommunityPanel(props: UserCommunityPanelProps) {
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

  const [blogSortBy, blogSortDir] = blogSort.split(':') as [string, string]
  const [commentSortBy, commentSortDir] = commentSort.split(':') as [string, string]
  const publishedCountLabel =
    blogStatus === 'published' ? `${blogTotal} published` : blogStatus === 'unpublished' ? `${blogTotal} unpublished` : `${blogTotal} drafts`

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
  }, [commentPage, commentReloadKey, commentSearch, commentSortBy, commentSortDir])

  const blogEmptyText = useMemo(() => {
    if (blogsLoading) return 'Loading blogs...'
    if (blogSearch) return 'No matching blogs.'
    if (blogStatus === 'published') return 'No published blogs yet.'
    if (blogStatus === 'unpublished') return 'No unpublished blogs.'
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
              Unpublished
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
            <input value={blogSearchDraft} onChange={(event) => setBlogSearchDraft(event.target.value)} placeholder="Search blogs" />
            <select value={blogSort} onChange={(event) => { setBlogSort(event.target.value); setBlogPage(1) }}>
              <option value="updated_at:desc">Recently updated</option>
              <option value="created_at:desc">Newest created</option>
              <option value="created_at:asc">Oldest created</option>
              <option value="title:asc">Title A-Z</option>
              <option value="title:desc">Title Z-A</option>
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
                  <img src={resolveMediaUrl(blog.cover_image_url) ?? ''} alt={`${blog.title} cover`} />
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
                    {blog.status === 'unpublished' ? 'Unpublished' : blog.is_published ? 'Published' : 'Draft'}
                  </span>
                  {blog.visibility === 'private' ? <span className="profile-status profile-status--draft">Private</span> : null}
                  {blog.restore_requested ? <span className="profile-status profile-status--requested">Restore requested</span> : null}
                  <span>{formatDate(blog.updated_at)}</span>
                </div>
                {blog.excerpt ? <p className="profile-blog-excerpt">{blog.excerpt}</p> : null}
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
            <div className="profile-community-subtitle">Grouped by blog for easier review.</div>
          </div>
          <div className="profile-list-summary">{commentTotal} blogs</div>
        </div>

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
            <option value="title:asc">Blog title A-Z</option>
            <option value="comment_count:desc">Most comments</option>
          </select>
          <button type="submit">Search</button>
        </form>

        {commentsError ? <div className="mt-3 text-sm text-rose-700">{commentsError}</div> : null}

        <div className="mt-4 space-y-3">
          {commentGroups.map((group) => {
            const open = openBlogIds.has(group.blog.id)
            return (
              <div key={group.blog.id} className="profile-comment-group">
                <button type="button" className="profile-comment-group-head" onClick={() => toggleComments(group.blog.id)}>
                  <div className="profile-comment-cover">
                    {group.blog.cover_image_url ? <img src={resolveMediaUrl(group.blog.cover_image_url) ?? ''} alt="" /> : <span>No cover</span>}
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
      </div>
    </div>
  )
}
