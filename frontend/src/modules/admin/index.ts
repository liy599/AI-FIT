import { apiFetch } from '../../lib/api'

export type AdminUserItem = {
  id: number
  username: string
  email_masked: string
  created_at: string
  is_admin: boolean
  is_disabled: boolean
}

export type AdminBlogItem = {
  id: number
  title: string
  excerpt: string
  cover_image_url: string | null
  author: { id: number; username: string }
  view_count: number
  like_count: number
  is_published: boolean
  status: 'published' | 'unpublished' | 'draft'
  visibility?: 'public' | 'private'
  restore_requested: boolean
  created_at: string
  updated_at: string
  tags: { id: number; name: string }[]
}

export type AdminSummary = {
  users: { total: number; disabled: number; admins: number }
  blogs: { total: number; published: number; drafts: number }
}

export function getAdminSummary() {
  return apiFetch<AdminSummary>('/api/admin/summary')
}

export function listAdminUsers(params: {
  page?: number
  pageSize?: number
  q?: string
  isAdmin?: boolean | null
  isDisabled?: boolean | null
  sortBy?: string
  sortDir?: 'asc' | 'desc'
} = {}) {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('page_size', String(params.pageSize ?? 20))
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.isAdmin !== undefined && params.isAdmin !== null) query.set('is_admin', String(params.isAdmin))
  if (params.isDisabled !== undefined && params.isDisabled !== null) query.set('is_disabled', String(params.isDisabled))
  query.set('sort_by', params.sortBy ?? 'id')
  query.set('sort_dir', params.sortDir ?? 'asc')
  return apiFetch<{ items: AdminUserItem[]; page: number; page_size: number; total: number }>(
    `/api/admin/users?${query.toString()}`
  )
}

export function updateAdminUser(id: number, payload: { is_admin?: boolean; is_disabled?: boolean }) {
  return apiFetch<AdminUserItem>(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function deleteAdminUser(id: number, confirmUsername: string) {
  return apiFetch<{ ok: boolean }>(`/api/admin/users/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ confirm_username: confirmUsername })
  })
}

export function getAdminUserContact(id: number) {
  return apiFetch<{ id: number; email: string }>(`/api/admin/users/${id}/contact`)
}

export function listAdminBlogs(params: {
  page?: number
  pageSize?: number
  q?: string
  status?: string | null
  sortBy?: string
  sortDir?: 'asc' | 'desc'
} = {}) {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('page_size', String(params.pageSize ?? 20))
  if (params.q?.trim()) query.set('q', params.q.trim())
  if (params.status) query.set('status', params.status)
  query.set('sort_by', params.sortBy ?? 'id')
  query.set('sort_dir', params.sortDir ?? 'asc')
  return apiFetch<{ items: AdminBlogItem[]; page: number; page_size: number; total: number }>(
    `/api/admin/blogs?${query.toString()}`
  )
}

export function updateAdminBlog(id: number, payload: { action: 'unpublish' | 'restore' }) {
  return apiFetch<AdminBlogItem>(`/api/admin/blogs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

export function deleteAdminBlog(id: number) {
  return apiFetch<{ ok: boolean }>(`/api/admin/blogs/${id}`, { method: 'DELETE' })
}

