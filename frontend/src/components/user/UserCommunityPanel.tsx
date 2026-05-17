import { Link } from 'react-router-dom'
import type { MyBlog, MyComment } from '../../modules/user/profileTypes'

type UserCommunityPanelProps = {
  myBlogs: MyBlog[]
  myComments: MyComment[]
  resolveMediaUrl: (url: string | null | undefined) => string | null
  onTogglePublish: (blog: MyBlog) => void
  onDeleteBlog: (blogId: number) => void
  onDeleteComment: (commentId: number) => void
}

export function UserCommunityPanel(props: UserCommunityPanelProps) {
  const { myBlogs, myComments, resolveMediaUrl, onTogglePublish, onDeleteBlog, onDeleteComment } = props

  return (
    <div className="space-y-4">
      <div className="profile-panel">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold">My Blogs</div>
          <Link to="/blogs/new" className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500">
            + New blog
          </Link>
        </div>
        <div className="mt-4 space-y-3">
          {myBlogs.map((b) => (
            <div key={b.id} className="profile-subpanel">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 h-12 w-20 overflow-hidden rounded-xl border border-slate-200 bg-white">
                    {b.cover_image_url ? (
                      <img
                        src={resolveMediaUrl(b.cover_image_url) ?? ''}
                        className="h-full w-full object-cover"
                        alt={`${b.title} cover`}
                      />
                    ) : null}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{b.title}</div>
                    <div className="mt-1 text-xs text-slate-600">
                      {b.is_published ? 'Published' : 'Draft'} / {new Date(b.updated_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    className="profile-btn-chip"
                    onClick={() => onTogglePublish(b)}
                  >
                    {b.is_published ? 'Move to draft' : 'Publish'}
                  </button>
                  <button
                    className="profile-btn-chip-danger"
                    onClick={() => onDeleteBlog(b.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
          {myBlogs.length === 0 ? <div className="text-sm text-slate-600">No blogs yet</div> : null}
        </div>
      </div>

      <div className="profile-panel">
        <div className="text-sm font-semibold">My Comments</div>
        <div className="mt-4 space-y-3">
          {myComments.map((c) => (
            <div key={c.id} className="profile-subpanel">
              <div className="text-xs text-slate-600">Blog #{c.blog_id}</div>
              <div className="mt-2 text-sm text-slate-900">{c.content}</div>
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-slate-600">{new Date(c.created_at).toLocaleString()}</div>
                <button className="profile-btn-chip-danger" onClick={() => onDeleteComment(c.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
          {myComments.length === 0 ? <div className="text-sm text-slate-600">No comments yet</div> : null}
        </div>
      </div>
    </div>
  )
}
