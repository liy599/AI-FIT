import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createBlog, getBlogTags, resolveBlogMediaUrl, uploadBlogCover, type BlogTag } from '../../modules/blog'

function resolveMediaUrl(url: string | null | undefined) {
  return resolveBlogMediaUrl(url)
}

type DraftBlog = {
  title: string
  content: string
  tag_ids: number[]
  is_published: boolean
  cover_image_url: string | null
}

export default function BlogEditorPage() {
  const navigate = useNavigate()
  const [tags, setTags] = useState<BlogTag[]>([])
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [coverUploading, setCoverUploading] = useState(false)
  const coverInputRef = useRef<HTMLInputElement | null>(null)

  const [blog, setBlog] = useState<DraftBlog>({
    title: '',
    content: '',
    tag_ids: [],
    is_published: false,
    cover_image_url: null
  })

  useEffect(() => {
    getBlogTags()
      .then(setTags)
      .catch(() => {})
  }, [])

  async function onPickCover(file: File) {
    setError(null)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be 5MB or smaller')
      return
    }
    setCoverUploading(true)
    try {
      const r = await uploadBlogCover(file)
      setBlog((b) => ({ ...b, cover_image_url: r.cover_image_url }))
      setNotice('Cover uploaded')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setCoverUploading(false)
    }
  }

  async function submit() {
    setError(null)
    setNotice(null)
    if (!blog.title.trim() || !blog.content.trim()) {
      setError('Please fill in the title and content')
      return
    }
    try {
      const publishNow = blog.is_published
      const r = await createBlog(blog)
      setBlog({ title: '', content: '', tag_ids: [], is_published: false, cover_image_url: null })
      if (publishNow) {
        navigate(`/blogs/${r.id}`)
        return
      }
      setNotice('Draft saved')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Create failed')
    }
  }

  const buttonText = blog.is_published ? 'Publish' : 'Save Draft'

  return (
    <div className="mx-auto w-full min-h-[calc(100vh-120px)] max-w-3xl space-y-6 px-4 pt-8 pb-32 text-slate-900 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Write a post</div>
          <div className="mt-1 text-sm text-slate-600">Share your training insights with the community.</div>
        </div>
        <Link to="/blogs" className="profile-btn-secondary">
          Back to blogs
        </Link>
      </div>

      {error ? <div className="text-sm text-rose-700">{error}</div> : null}
      {notice ? <div className="text-sm text-emerald-700">{notice}</div> : null}

      <div className="profile-panel">
        <div className="grid gap-3">
          <input
            className="profile-input"
            placeholder="Title"
            value={blog.title}
            onChange={(e) => setBlog((b) => ({ ...b, title: e.target.value }))}
          />
          <textarea
            className="profile-input profile-textarea"
            placeholder="Content"
            value={blog.content}
            onChange={(e) => setBlog((b) => ({ ...b, content: e.target.value }))}
          />

          <div className="flex flex-wrap gap-2">
            {tags.map((t) => {
              const active = blog.tag_ids.includes(t.id)
              return (
                <button
                  key={t.id}
                  type="button"
                  className={[
                    'rounded-full border px-3 py-1 text-xs transition',
                    active ? 'bg-emerald-600 text-white' : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200'
                  ].join(' ')}
                  style={active ? { borderColor: 'rgb(5 150 105)' } : undefined}
                  onClick={() =>
                    setBlog((b) => ({
                      ...b,
                      tag_ids: active ? b.tag_ids.filter((x) => x !== t.id) : [...b.tag_ids, t.id]
                    }))
                  }
                >
                  {t.name}
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <div className="h-16 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {blog.cover_image_url ? (
                  <img
                    src={resolveMediaUrl(blog.cover_image_url) ?? ''}
                    className="h-full w-full object-cover"
                    alt="Cover preview"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">Cover</div>
                )}
              </div>
              <div className="text-sm text-slate-700">{blog.cover_image_url ? 'Cover selected' : 'No cover (optional)'}</div>
            </div>
            <div className="flex items-center gap-2">
              {blog.cover_image_url ? (
                <button type="button" className="profile-btn-secondary" onClick={() => setBlog((b) => ({ ...b, cover_image_url: null }))}>
                  Remove
                </button>
              ) : null}
              <button
                type="button"
                className="profile-btn-secondary disabled:opacity-50"
                disabled={coverUploading}
                onClick={() => coverInputRef.current?.click()}
              >
                {coverUploading ? 'Uploading...' : 'Upload cover'}
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  onPickCover(f).catch(() => {})
                }}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={blog.is_published}
              onChange={(e) => setBlog((b) => ({ ...b, is_published: e.target.checked }))}
            />
            Publish now
          </label>

          <div className="flex items-center justify-end gap-2">
            <button type="button" className="profile-btn-secondary" onClick={() => setBlog({ title: '', content: '', tag_ids: [], is_published: false, cover_image_url: null })}>
              Clear
            </button>
            <button
              type="button"
              className="profile-btn-primary disabled:opacity-50"
              disabled={!blog.title.trim() || !blog.content.trim()}
              onClick={() => submit().catch(() => {})}
            >
              {buttonText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

