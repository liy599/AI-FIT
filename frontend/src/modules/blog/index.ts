import { apiFetch, apiUpload, resolveBackendUrl } from '../../lib/api'

export type BlogTag = { id: number; name: string }
export type BlogAuthor = { id: number; username: string; avatar_url?: string | null }

export type BlogCard = {
  id: number
  title: string
  excerpt: string
  cover_image_url: string | null
  author: BlogAuthor
  created_at: string
  tags: BlogTag[]
}

export type BlogDetail = {
  id: number
  title: string
  cover_image_url: string | null
  content: string
  author: { id: number; username: string; avatar_url: string | null }
  view_count: number
  like_count: number
  liked_by_me: boolean
  created_at: string
  tags: BlogTag[]
}

export type CommentNode = {
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

export function resolveBlogMediaUrl(url: string | null | undefined) {
  if (!url) return null
  return resolveBackendUrl(url)
}

export function getBlogs(params: { page?: number; page_size?: number; auth?: boolean } = {}) {
  const page = params.page ?? 1
  const pageSize = params.page_size ?? 20
  const auth = params.auth ?? true
  return apiFetch<{ items: BlogCard[] }>(`/api/blogs?page=${page}&page_size=${pageSize}`, { auth })
}

export function getBlogTags() {
  return apiFetch<BlogTag[]>('/api/tags', { auth: false })
}

export function queryBlogs(queryString: string) {
  return apiFetch<{ items: BlogCard[]; total: number }>(`/api/blogs?${queryString}`, { auth: false })
}

export function getBlogDetail(id: number) {
  return apiFetch<BlogDetail>(`/api/blogs/${id}`)
}

export function toggleBlogLike(id: number) {
  return apiFetch(`/api/blogs/${id}/like`, { method: 'POST' })
}

export function getBlogComments(blogId: number, page = 1, pageSize = 20) {
  return apiFetch<{ items: CommentNode[] }>(`/api/blogs/${blogId}/comments?page=${page}&page_size=${pageSize}`)
}

export function createBlogComment(blogId: number, input: { content: string; parent_id?: number }) {
  return apiFetch(`/api/blogs/${blogId}/comments`, {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function toggleCommentLike(commentId: number) {
  return apiFetch(`/api/comments/${commentId}/like`, { method: 'POST' })
}

export function updateComment(commentId: number, content: string) {
  return apiFetch(`/api/comments/${commentId}`, {
    method: 'PUT',
    body: JSON.stringify({ content })
  })
}

export function deleteComment(commentId: number) {
  return apiFetch(`/api/comments/${commentId}`, { method: 'DELETE' })
}

export function updateBlog(id: number, payload: Record<string, unknown>) {
  return apiFetch(`/api/blogs/${id}`, { method: 'PUT', body: JSON.stringify(payload) })
}

export function deleteBlogById(id: number) {
  return apiFetch(`/api/blogs/${id}`, { method: 'DELETE' })
}

export function createBlog(payload: Record<string, unknown>) {
  return apiFetch<{ id: number }>('/api/blogs', { method: 'POST', body: JSON.stringify(payload) })
}

export function uploadBlogCover(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiUpload<{ cover_image_url: string }>('/api/blogs/cover', form)
}

