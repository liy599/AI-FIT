import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { formatLongDate, HomeBlogTagPills } from '../../components/blog/BlogListParts'
import { FallbackImage } from '../../components/ui'
import { formatLocalDateTimeMinute } from '../../lib/datetime'
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
const TOPIC_TAG_NAMES = ['Diet', 'Training'] as const
const POST_TYPE_TAG_NAMES = ['Record', 'Experience'] as const

const defaultCovers = [
  { label: 'Diet', url: '/assets/images/blog/blog_list-1.png' },
  { label: 'Training', url: '/assets/images/blog/blog_list-2.png' },
  { label: 'Other', url: '/assets/images/blog/blog_details-1.png' },
]

const blogTemplates = [
  {
    key: 'diet',
    label: 'Diet Record',
    description: 'Record meals, hydration, and nutrition notes for the day.',
    title: 'Daily Diet Record',
    cover: defaultCovers[0].url,
    topic: 'Diet',
    postType: 'Record',
    content: [
      'Daily Diet Record',
      '',
      'Date:',
      '',
      'Breakfast:',
      '-',
      '',
      'Lunch:',
      '-',
      '',
      'Dinner:',
      '-',
      '',
      'Snacks:',
      '-',
      '',
      'Hydration:',
      '-',
      '',
      'Energy and appetite:',
      '-',
      '',
      'Notes for tomorrow:',
      '-'
    ].join('\n')
  },
  {
    key: 'training',
    label: 'Training Record',
    description: 'Draft a post from one pose training report.',
    title: 'Training Report Notes',
    cover: defaultCovers[1].url,
    topic: 'Training',
    postType: 'Record',
    content: [
      'Training Report Notes',
      '',
      'Date:',
      '',
      'Exercise:',
      '-',
      '',
      'Report summary:',
      '- Avg Accuracy:',
      '- Result:',
      '',
      'Main feedback:',
      '-',
      '',
      'What I will improve next:',
      '-',
      '',
      'Personal note:',
      '-'
    ].join('\n')
  }
] as const

type ReportDraftState = {
  template?: string
  reportPath?: string | null
  reportDraft?: {
    exerciseName?: string
    startedAt?: string
    endedAt?: string | null
    reps?: number
    accuracy?: string | null
    summary?: string
    issues?: string[]
    suggestions?: string[]
  }
}

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

function isTagNamed(tag: BlogTag, names: readonly string[]) {
  const displayName = displayBlogTagName(tag.name)
  return names.includes(tag.name) || names.includes(displayName)
}

function findTagIdByName(tags: BlogTag[], name: string) {
  return tags.find((tag) => isTagNamed(tag, [name]))?.id
}

function getSelectedTagId(tags: BlogTag[], tagIds: number[], names: readonly string[]) {
  return tags.find((tag) => tagIds.includes(tag.id) && isTagNamed(tag, names))?.id ?? null
}

function replaceTagGroup(currentIds: number[], tags: BlogTag[], groupNames: readonly string[], nextId: number) {
  const groupIds = new Set(tags.filter((tag) => isTagNamed(tag, groupNames)).map((tag) => tag.id))
  return [...currentIds.filter((id) => !groupIds.has(id)), nextId]
}

function getEditorPreviewTagLabels(tags: BlogTag[], tagIds: number[]) {
  const selectedLabels = tags.filter((tag) => tagIds.includes(tag.id)).map((tag) => displayBlogTagName(tag.name))
  const topic = selectedLabels.find((name) => name === 'Diet' || name === 'Training')
  const postType = selectedLabels.find((name) => name === 'Record' || name === 'Experience')
  const labels: string[] = []
  if (topic) labels.push(topic)
  if (postType) labels.push(postType)
  return labels
}

function formatPreviewExcerpt(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function buildTrainingReportBlogContent(reportDraft: NonNullable<ReportDraftState['reportDraft']>) {
  const startedAt = formatReportDraftDate(reportDraft.startedAt)
  const exerciseName = reportDraft.exerciseName?.trim() || '-'
  const accuracy = reportDraft.accuracy?.trim() || '-'
  const reps = typeof reportDraft.reps === 'number' && Number.isFinite(reportDraft.reps) ? String(reportDraft.reps) : '-'
  const summary = reportDraft.summary?.trim() || '-'
  const issues = formatBulletLines(reportDraft.issues, '-')
  const suggestions = formatBulletLines(reportDraft.suggestions, '-')

  return [
    'Training Report Notes',
    '',
    `Date: ${startedAt}`,
    '',
    `Exercise: ${exerciseName}`,
    '',
    'Report summary:',
    `- Avg Accuracy: ${accuracy}`,
    `- Total Reps: ${reps}`,
    `- Result: ${summary}`,
    '',
    'Main feedback:',
    issues,
    '',
    'What I will improve next:',
    suggestions,
    '',
    'Personal note:',
    '-'
  ].join('\n')
}

function formatReportDraftDate(value: string | undefined) {
  return value ? formatLocalDateTimeMinute(value) : '-'
}

function formatBulletLines(items: string[] | undefined, fallback: string) {
  const lines = (items ?? []).map((item) => item.trim()).filter(Boolean)
  return lines.length ? lines.map((item) => `- ${item}`).join('\n') : fallback
}

export default function BlogEditorPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()
  const editId = params.id ? Number(params.id) : null
  const isEditingBlog = editId != null && Number.isFinite(editId)
  const [tags, setTags] = useState<BlogTag[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(isEditingBlog)
  const [blogStatus, setBlogStatus] = useState<'published' | 'unpublished' | 'draft'>('draft')
  const reportDraftApplied = useRef(false)

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

  const selectedCover = blog.cover_image_url ?? blog.image_urls[0] ?? defaultCovers[0].url
  const normalizedTitle = normalizeTitle(blog.title)
  const normalizedContent = normalizeContent(blog.content)
  const titleLength = normalizedTitle.length
  const contentLength = normalizedContent.length
  const titleError = validateLength('Title', titleLength, TITLE_MIN_LENGTH, TITLE_MAX_LENGTH)
  const contentError = validateLength('Content', contentLength, CONTENT_MIN_LENGTH, CONTENT_MAX_LENGTH)
  const selectedTopicTagId = getSelectedTagId(tags, blog.tag_ids, TOPIC_TAG_NAMES)
  const selectedPostTypeTagId = getSelectedTagId(tags, blog.tag_ids, POST_TYPE_TAG_NAMES)
  const topicTags = TOPIC_TAG_NAMES.map((name) => tags.find((tag) => isTagNamed(tag, [name]))).filter((tag): tag is BlogTag => Boolean(tag))
  const postTypeTags = POST_TYPE_TAG_NAMES.map((name) => tags.find((tag) => isTagNamed(tag, [name]))).filter((tag): tag is BlogTag => Boolean(tag))
  const categoryError = !selectedTopicTagId ? 'Choose one topic' : !selectedPostTypeTagId ? 'Choose one post type' : null
  const submitHelp = titleError ?? contentError ?? categoryError
  const previewTagLabels = getEditorPreviewTagLabels(tags, blog.tag_ids)
  const previewTitle = normalizedTitle || 'Blog title preview'
  const previewExcerpt = formatPreviewExcerpt(normalizedContent) || 'Your post summary will appear here as you write.'
  const showNoticeBlogLink = notice?.includes('Profile > Blogs')
  const stateReportPath = (location.state as ReportDraftState | null)?.reportPath ?? null

  useEffect(() => {
    getBlogTags()
      .then(setTags)
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (isEditingBlog || reportDraftApplied.current) return
    if (tags.length === 0) return
    const state = location.state as ReportDraftState | null
    if (state?.template !== 'training' || !state.reportDraft) return
    const template = blogTemplates.find((item) => item.key === 'training')
    if (!template) return

    const topicTagId = findTagIdByName(tags, template.topic)
    const postTypeTagId = findTagIdByName(tags, template.postType)
    const exerciseName = state.reportDraft.exerciseName?.trim() || 'Training'
    const content = buildTrainingReportBlogContent(state.reportDraft)
    setBlog((current) => ({
      ...current,
      title: `${exerciseName} Training Report`,
      content,
      tag_ids: [topicTagId, postTypeTagId].filter((id): id is number => Boolean(id)),
      cover_image_url: template.cover,
      image_urls: []
    }))
    setNotice('Training report template applied.')
    setError(null)
    reportDraftApplied.current = true
  }, [isEditingBlog, location.state, tags])

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
        const hadUploadedImages = b.image_urls.length > 0
        const image_urls = [...b.image_urls, ...uploaded].slice(0, MAX_BLOG_IMAGES)
        return {
          ...b,
          image_urls,
          cover_image_url: hadUploadedImages ? b.cover_image_url : uploaded[0] ?? b.cover_image_url ?? image_urls[0] ?? null,
        }
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
      if (publishNow) {
        navigate(`/blogs/${r.id}`)
        return
      }
      setNotice('Draft saved. You can find it in Profile > Blogs > My Blogs.')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : isEditingBlog ? 'Save failed' : 'Create failed')
    }
  }

  function applyTemplate(template: (typeof blogTemplates)[number]) {
    const topicTagId = findTagIdByName(tags, template.topic)
    const postTypeTagId = findTagIdByName(tags, template.postType)
    setBlog((current) => ({
      ...current,
      title: template.title,
      content: template.content,
      tag_ids: [topicTagId, postTypeTagId].filter((id): id is number => Boolean(id)),
      cover_image_url: template.cover,
      image_urls: []
    }))
    setNotice(`${template.label} template applied.`)
    setError(null)
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
                    ? 'This post was disabled by an admin. You can edit it here, then request restore from Profile > Blogs.'
                    : 'Choose a topic and post type, pick a cover, and write a clear post for the community.'}
                </p>
              </div>
              <div className="blog-editor-head-actions">
                {stateReportPath ? <Link to={stateReportPath} className="profile-btn-secondary">Open Saved Report</Link> : null}
                <button type="button" className="profile-btn-secondary" onClick={() => navigate(-1)}>Back</button>
              </div>
            </div>
          </div>

          {error ? <div className="cl_blog-widget mb-30 border-rose-200 bg-rose-50 text-sm text-rose-700">{error}</div> : null}
          {loading ? <div className="cl_blog-widget mb-30 text-sm text-slate-600">Loading post...</div> : null}

          {!loading ? <div className="cl_blog-widget blog-editor-panel mb-0">
            <div className="blog-editor-grid">
              <div className="blog-editor-form">
                {!isEditingBlog ? (
                  <div className="blog-template-panel">
                    <div>
                      <div className="blog-editor-label">Blog templates</div>
                      <small>Start with a daily diet or training structure, then edit it freely.</small>
                    </div>
                    <div className="blog-template-grid">
                      {blogTemplates.map((template) => (
                        <button key={template.key} type="button" className="blog-template-card" onClick={() => applyTemplate(template)}>
                          <strong>{template.label}</strong>
                          <span>{template.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

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
                  <div className="blog-editor-taxonomy-grid">
                    <div>
                      <div className="blog-editor-label">Topic <span>*</span></div>
                      <div className="blog-editor-choice-row">
                        {topicTags.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={`blog-editor-choice${selectedTopicTagId === t.id ? ' is-active' : ''}`}
                            onClick={() => setBlog((b) => ({ ...b, tag_ids: replaceTagGroup(b.tag_ids, tags, TOPIC_TAG_NAMES, t.id) }))}
                          >
                            {displayBlogTagName(t.name)}
                          </button>
                        ))}
                      </div>
                      {!selectedTopicTagId ? <small className="blog-field-error">Choose one topic</small> : null}
                    </div>
                    <div>
                      <div className="blog-editor-label">Post Type <span>*</span></div>
                      <div className="blog-editor-choice-row">
                        {postTypeTags.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={`blog-editor-choice${selectedPostTypeTagId === t.id ? ' is-active' : ''}`}
                            onClick={() => setBlog((b) => ({ ...b, tag_ids: replaceTagGroup(b.tag_ids, tags, POST_TYPE_TAG_NAMES, t.id) }))}
                          >
                            {displayBlogTagName(t.name)}
                          </button>
                        ))}
                      </div>
                      {!selectedPostTypeTagId ? <small className="blog-field-error">Choose one post type</small> : null}
                    </div>
                  </div>
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
                  {blogStatus === 'unpublished' ? 'Admin disabled - save changes only' : 'Publish now'}
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
                <div className="blog-editor-label">Cover and Images</div>
                <article className="cl_home-blog-card blog-editor-preview-card">
                  <div className="cl_home-blog-card-media">
                    <FallbackImage
                      src={resolveMediaUrl(selectedCover) ?? selectedCover}
                      fallbackSrc="/assets/images/blog/blog_list-1.png"
                      alt="Selected cover preview"
                    />
                    <HomeBlogTagPills labels={previewTagLabels} fallback="AI FitGuard" />
                  </div>
                  <div className="cl_home-blog-card-body">
                    <h3 className="cl_home-blog-card-title">
                      <span>{previewTitle}</span>
                    </h3>
                    <p className="cl_home-blog-card-excerpt">{previewExcerpt}</p>
                    <div className="cl_home-blog-card-meta">
                      <div className="flex items-center gap-2">
                        <img src="/figma/icon-user.svg" alt="" className="h-3.5 w-3.5" />
                        <span>You</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <img src="/figma/icon-calendar.svg" alt="" className="h-3.5 w-3.5" />
                        <span>{formatLongDate(new Date().toISOString())}</span>
                      </div>
                    </div>
                    <div className="mt-auto pt-5">
                      <span className="blog-theme-btn inline-flex h-10 w-full items-center justify-center rounded-full border border-neutral-900 bg-white px-5 text-sm font-medium text-neutral-900">
                        Read more
                      </span>
                    </div>
                  </div>
                </article>
                <ol className="blog-editor-image-notes">
                  <li>Choose a default cover or upload up to 9 images.</li>
                  <li>The first uploaded image becomes the cover automatically.</li>
                  <li>Click any uploaded image to set it as the cover; use x to remove it.</li>
                </ol>
                {blog.image_urls.length ? (
                  <div className="blog-editor-image-grid">
                    {blog.image_urls.map((url, index) => (
                      <div
                        key={`${url}-${index}`}
                        className={`blog-editor-image-item${selectedCover === url ? ' is-active' : ''}`}
                      >
                        <button
                          type="button"
                          className="blog-editor-image-select"
                          title="Set as cover"
                          onClick={() => setBlog((b) => ({ ...b, cover_image_url: url }))}
                        >
                          <FallbackImage
                            src={resolveMediaUrl(url) ?? url}
                            fallbackSrc="/assets/images/blog/blog_list-1.png"
                            alt={`Uploaded image ${index + 1}`}
                          />
                          <span>{selectedCover === url ? 'Cover' : index + 1}</span>
                        </button>
                        <button
                          type="button"
                          className="blog-editor-image-remove"
                          title="Remove image"
                          aria-label={`Remove uploaded image ${index + 1}`}
                          onClick={() => setBlog((b) => {
                            const removedUrl = b.image_urls[index]
                            const image_urls = b.image_urls.filter((_, i) => i !== index)
                            const cover_image_url = b.cover_image_url === removedUrl ? image_urls[0] ?? null : b.cover_image_url
                            return { ...b, image_urls, cover_image_url }
                          })}
                        >
                          x
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
                <div className="blog-editor-cover-section-title">
                  <span>Default covers</span>
                  <small>Click one to set the preview cover.</small>
                </div>
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

          {notice ? (
            <div className="cl_blog-widget mt-30 mb-0 border-emerald-200 bg-emerald-50 text-sm text-emerald-700">
              <span>{notice}</span>
              {showNoticeBlogLink ? <Link to="/profile?tab=Blogs" className="ml-10 font-semibold underline">Open My Blogs</Link> : null}
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}

