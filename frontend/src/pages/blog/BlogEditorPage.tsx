import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { createBlog, displayBlogTagName, getBlogDetail, getBlogTags, resolveBlogMediaUrl, updateBlog, uploadBlogCover, type BlogTag } from '../../modules/blog'

function resolveMediaUrl(url: string | null | undefined) {
  return resolveBlogMediaUrl(url)
}

type DraftBlog = {
  title: string
  content: string
  tag_ids: number[]
  is_published: boolean
  visibility: 'public' | 'private'
  cover_image_url: string | null
  image_urls: string[]
}

const TITLE_MIN_LENGTH = 5
const TITLE_MAX_LENGTH = 80
const CONTENT_MIN_LENGTH = 1
const CONTENT_MAX_LENGTH = 4000
const MAX_BLOG_IMAGES = 9
const ALLOWED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp'])

const defaultCovers = [
  { label: 'Diet', url: '/assets/images/blog/blog_list-1.png' },
  { label: 'Training', url: '/assets/images/blog/blog_list-2.png' },
  { label: 'Other', url: '/assets/images/blog/blog_details-1.png' },
]

function normalizeTitle(value: string) {
  return value.replace(/\s+/g, ' ').trim()
}

function normalizeContent(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t\f\v]+/g, ' ').trim())
    .join('\n')
    .trim()
    .replace(/\n{3,}/g, '\n\n')
}

function validateLength(label: string, length: number, min: number, max: number) {
  if (length < min) return `${label} needs at least ${min} characters`
  if (length > max) return `${label} must be at most ${max} characters`
  return null
}

export default function BlogEditorPage() {
  const navigate = useNavigate()
  const params = useParams()
  const editId = params.id ? Number(params.id) : null
  const isEditingBlog = editId != null && Number.isFinite(editId)
  const [tags, setTags] = useState<BlogTag[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEditingBlog)
  const [blogStatus, setBlogStatus] = useState<'published' | 'unpublished' | 'draft'>('draft')

  const [coverUploading, setCoverUploading] = useState(false)

  const [blog, setBlog] = useState<DraftBlog>({
    title: '',
    content: '',
    tag_ids: [],
    is_published: false,
    visibility: 'public',
    cover_image_url: null,
    image_urls: []
  })

  const selectedCover = blog.image_urls[0] ?? blog.cover_image_url ?? defaultCovers[0].url
  const normalizedTitle = normalizeTitle(blog.title)
  const normalizedContent = normalizeContent(blog.content)
  const titleLength = normalizedTitle.length
  const contentLength = normalizedContent.length
  const titleError = validateLength('Title', titleLength, TITLE_MIN_LENGTH, TITLE_MAX_LENGTH)
  const contentError = validateLength('Content', contentLength, CONTENT_MIN_LENGTH, CONTENT_MAX_LENGTH)
  const categoryError = blog.tag_ids.length === 0 ? 'Choose one category' : null
  const submitHelp = titleError ?? contentError ?? categoryError

  useEffect(() => {
    getBlogTags()
      .then(setTags)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!isEditingBlog || editId == null) return
    let active = true
    setLoading(true)
    setError(null)
    getBlogDetail(editId, { countView: false })
      .then((detail) => {
        if (!active) return
        setBlog({
          title: detail.title,
          content: detail.content,
          tag_ids: detail.tags.map((tag) => tag.id),
          is_published: detail.is_published && detail.status !== 'unpublished',
          visibility: detail.visibility ?? 'public',
          cover_image_url: detail.cover_image_url,
          image_urls: detail.image_urls ?? [],
        })
        setBlogStatus(detail.status)
      })
      .catch((e: unknown) => {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Failed to load blog')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [editId, isEditingBlog])

  async function onPickCover(files: FileList | File[]) {
    setError(null)
    const allFiles = Array.from(files)
    const remainingSlots = MAX_BLOG_IMAGES - blog.image_urls.length
    if (remainingSlots <= 0) {
      setError(`You can upload up to ${MAX_BLOG_IMAGES} images`)
      return
    }
    if (allFiles.length > remainingSlots) {
      setError(`Only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} can be added`)
      return
    }
    const unsupported = allFiles.find((file) => {
      const ext = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() : ''
      return !ext || !ALLOWED_IMAGE_EXTENSIONS.has(ext)
    })
    if (unsupported) {
      setError('Only PNG, JPG, JPEG, and WEBP images are supported')
      return
    }
    const oversized = allFiles.find((file) => file.size > 5 * 1024 * 1024)
    if (oversized) {
      setError('Each image must be 5MB or smaller')
      return
    }
    const picked = allFiles
    if (!picked.length) return
    setCoverUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of picked) {
        const r = await uploadBlogCover(file)
        uploaded.push(r.cover_image_url)
      }
      setBlog((b) => {
        const image_urls = [...b.image_urls, ...uploaded].slice(0, MAX_BLOG_IMAGES)
        return { ...b, image_urls, cover_image_url: image_urls[0] ?? b.cover_image_url }
      })
      setNotice('Images uploaded')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setCoverUploading(false)
    }
  }

  async function submit() {
    setError(null)
    setNotice(null)
    if (titleError) {
      setError(titleError)
      return
    }
    if (contentError) {
      setError(contentError)
      return
    }
    if (categoryError) {
      setError(categoryError)
      return
    }
    try {
      const publishNow = blog.is_published
      if (isEditingBlog && editId != null) {
        const payload = {
          title: normalizedTitle,
          content: normalizedContent,
          tag_ids: blog.tag_ids,
          cover_image_url: selectedCover,
          image_urls: blog.image_urls,
          visibility: blog.visibility,
          ...(blogStatus === 'unpublished' ? {} : { is_published: blog.is_published }),
        }
        await updateBlog(editId, payload)
        if (publishNow && blogStatus !== 'unpublished') {
          navigate(`/blogs/${editId}`)
          return
        }
        setNotice(blogStatus === 'unpublished' ? 'Changes saved. Request restore when ready.' : 'Draft saved.')
        return
      }
      const r = await createBlog({ ...blog, title: normalizedTitle, content: normalizedContent, cover_image_url: selectedCover, image_urls: blog.image_urls })
      setBlog({ title: '', content: '', tag_ids: [], is_published: false, visibility: 'public', cover_image_url: null, image_urls: [] })
      if (publishNow) {
        navigate(`/blogs/${r.id}`)
        return
      }
      setNotice('Draft saved. You can find it in Profile > Blogs > My Blogs.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : isEditingBlog ? 'Save failed' : 'Create failed')
    }
  }

  const buttonText = isEditingBlog ? 'Save changes' : blog.is_published ? 'Publish' : 'Save Draft'
  const pageTitle = isEditingBlog ? 'Edit Post' : 'Write a Post'

  return (
    <>
      <section className="cl_breadcrumb-area brand-page-theme">
        <div className="cl_breadcrumb-wrap brand-page-hero" data-background="/assets/images/bg/breadcrumb.png">
          <div className="page-container">
            <div className="page-row-center">
              <div className="page-col-breadcrumb">
                <div className="cl_breadcrumb-content">
                  <h2 className="cl_breadcrumb-content-title">{pageTitle}</h2>
                  <div className="cl_breadcrumb-content-list">
                    <Link to="/">Home</Link>
                    <Link to="/blogs">Blog</Link>
                    <span>{isEditingBlog ? 'Edit' : 'Write'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="pt-100 pb-100 brand-page-body">
        <div className="page-container">
          <div className="cl_blog-widget mb-30">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="cl_blog-widget-title mb-2">{isEditingBlog ? 'Edit your post' : 'Share your training insights'}</h4>
                <p className="max-w-2xl text-sm text-slate-600">
                  {blogStatus === 'unpublished'
                    ? 'This post was unpublished by an admin. You can edit it here, then request restore from Profile > Blogs.'
                    : 'Choose one category, a default cover, and write a clear post for the community.'}
                </p>
              </div>
              <Link to="/blogs" className="profile-btn-secondary">Back to blogs</Link>
            </div>
          </div>

          {error ? <div className="cl_blog-widget mb-30 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}
          {notice ? (
            <div className="cl_blog-widget mb-30 border-emerald-200 bg-emerald-50 text-sm text-emerald-700">
              <span>{notice}</span>
              <Link to="/profile?tab=Blogs" className="ml-10 font-semibold underline">Open My Blogs</Link>
            </div>
          ) : null}

          {loading ? <div className="cl_blog-widget mb-30 text-sm text-slate-600">Loading post...</div> : null}

          {!loading ? <div className="cl_blog-widget blog-editor-panel mb-0">
            <div className="blog-editor-grid">
              <div className="blog-editor-form">
                <label>
                  <span>Title</span>
                  <input
                    className="profile-input"
                    maxLength={TITLE_MAX_LENGTH}
                    placeholder="5-80 characters"
                    value={blog.title}
                    onChange={(e) => setBlog((b) => ({ ...b, title: e.target.value }))}
                  />
                  <small>{TITLE_MIN_LENGTH}-{TITLE_MAX_LENGTH} characters | {titleLength}/{TITLE_MAX_LENGTH}</small>
                  {blog.title.length > 0 && titleError ? <small className="blog-field-error">{titleError}</small> : null}
                </label>

                <label>
                  <span>Content</span>
                  <textarea
                    className="profile-input blog-editor-textarea"
                    maxLength={CONTENT_MAX_LENGTH}
                    placeholder="1-4000 characters"
                    value={blog.content}
                    onChange={(e) => setBlog((b) => ({ ...b, content: e.target.value }))}
                  />
                  <small>{CONTENT_MIN_LENGTH}-{CONTENT_MAX_LENGTH} characters | {contentLength}/{CONTENT_MAX_LENGTH}</small>
                  {blog.content.length > 0 && contentError ? <small className="blog-field-error">{contentError}</small> : null}
                </label>

                <div>
                  <div className="blog-editor-label">Category</div>
                  <div className="blog-editor-choice-row">
                    {tags.map((t) => {
                      const active = blog.tag_ids.includes(t.id)
                      return (
                        <button
                          key={t.id}
                          type="button"
                          className={`blog-editor-choice${active ? ' is-active' : ''}`}
                          onClick={() => setBlog((b) => ({ ...b, tag_ids: [t.id] }))}
                        >
                          {displayBlogTagName(t.name)}
                        </button>
                      )
                    })}
                  </div>
                  {categoryError ? <small className="blog-field-error">{categoryError}</small> : null}
                </div>

                <div>
                  <div className="blog-editor-label">Visibility</div>
                  <div className="blog-editor-choice-row">
                    <button
                      type="button"
                      className={`blog-editor-choice${blog.visibility === 'public' ? ' is-active' : ''}`}
                      onClick={() => setBlog((b) => ({ ...b, visibility: 'public' }))}
                    >
                      Public
                    </button>
                    <button
                      type="button"
                      className={`blog-editor-choice${blog.visibility === 'private' ? ' is-active' : ''}`}
                      onClick={() => setBlog((b) => ({ ...b, visibility: 'private' }))}
                    >
                      Private
                    </button>
                  </div>
                  <small>{blog.visibility === 'private' ? 'Only you can view this post.' : 'Visible in the community after publishing.'}</small>
                </div>

                <label className="blog-editor-publish">
                  <input
                    type="checkbox"
                    checked={blog.is_published}
                    disabled={blogStatus === 'unpublished'}
                    onChange={(e) => setBlog((b) => ({ ...b, is_published: e.target.checked }))}
                  />
                  {blogStatus === 'unpublished' ? 'Admin unpublished - save changes only' : 'Publish now'}
                </label>

                <div className="blog-editor-actions">
                  {!isEditingBlog ? (
                    <button type="button" className="profile-btn-secondary" onClick={() => setBlog({ title: '', content: '', tag_ids: [], is_published: false, visibility: 'public', cover_image_url: null, image_urls: [] })}>
                      Clear
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="profile-btn-primary disabled:opacity-50"
                    disabled={Boolean(submitHelp)}
                    onClick={() => submit().catch(() => {})}
                  >
                    {buttonText}
                  </button>
                </div>
                {submitHelp ? <div className="blog-form-status">{submitHelp}</div> : null}
              </div>

              <aside className="blog-editor-cover">
                <div className="blog-editor-label">Images</div>
                <div className="blog-editor-cover-preview">
                  <img src={resolveMediaUrl(selectedCover) ?? selectedCover} alt="Selected cover preview" />
                </div>
                <p>Up to 9 images. First image becomes the cover.</p>
                {blog.image_urls.length ? (
                  <div className="blog-editor-image-grid">
                    {blog.image_urls.map((url, index) => (
                      <button
                        key={`${url}-${index}`}
                        type="button"
                        title="Remove image"
                        onClick={() => setBlog((b) => {
                          const image_urls = b.image_urls.filter((_, i) => i !== index)
                          return { ...b, image_urls, cover_image_url: image_urls[0] ?? null }
                        })}
                      >
                        <img src={resolveMediaUrl(url) ?? url} alt={`Uploaded image ${index + 1}`} />
                        <span>{index + 1}</span>
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="blog-editor-cover-options">
                  {defaultCovers.map((cover) => (
                    <button
                      key={cover.url}
                      type="button"
                      className={selectedCover === cover.url ? 'is-active' : ''}
                      onClick={() => setBlog((b) => ({ ...b, cover_image_url: cover.url }))}
                    >
                      <img src={cover.url} alt="" />
                      <span>{cover.label}</span>
                    </button>
                  ))}
                </div>
                <div className="blog-editor-upload-row">
                  <label
                    className={`profile-btn-secondary${coverUploading ? ' profile-btn-disabled' : ''}`}
                    htmlFor={coverUploading ? undefined : 'blog-image-upload'}
                  >
                    {coverUploading ? 'Uploading...' : 'Upload images'}
                  </label>
                  <span className="blog-editor-upload-hint">Click an image to remove it.</span>
                  <input
                    id="blog-image-upload"
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/webp"
                    className="blog-image-upload-input"
                    disabled={coverUploading}
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? [])
                      e.target.value = ''
                      if (!files.length) return
                      onPickCover(files).catch(() => {})
                    }}
                  />
                </div>
              </aside>
            </div>
          </div> : null}
        </div>
      </section>
    </>
  )
}

