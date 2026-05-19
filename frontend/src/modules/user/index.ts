import { API_BASE, apiFetch, apiUpload, resolveBackendUrl } from '../../lib/api'
import type { AuthUser } from '../../lib/auth'

export { API_BASE, resolveBackendUrl }

export const NOTIFICATIONS_CHANGED_EVENT = 'aifitguard:notifications-changed'

export function loginByPassword(email: string, password: string) {
  return apiFetch<{
    user: AuthUser
  }>('/api/auth/login', { method: 'POST', auth: false, body: JSON.stringify({ email, password }) })
}

export function registerByPassword(email: string, username: string, password: string) {
  return apiFetch<{
    user: AuthUser
  }>('/api/auth/register', { method: 'POST', auth: false, body: JSON.stringify({ email, username, password }) })
}

export function requestPasswordReset(email: string) {
  return apiFetch<{ ok: boolean; email_sent?: boolean; reset_code?: string }>('/api/auth/forgot-password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email })
  })
}

export function requestEmailVerification(email: string) {
  return apiFetch<{ ok: boolean; email_sent?: boolean; verification_code?: string }>(
    '/api/auth/request-email-verification',
    {
      method: 'POST',
      auth: false,
      body: JSON.stringify({ email })
    }
  )
}

export function verifyEmail(email: string, code: string) {
  return apiFetch<{ ok: boolean; email: string }>('/api/auth/verify-email', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, code })
  })
}

export function getEmailVerificationStatus(email: string) {
  const query = new URLSearchParams()
  query.set('email', email)
  return apiFetch<{ ok: boolean; email_verified: boolean }>(`/api/auth/email-verification-status?${query.toString()}`, {
    method: 'GET',
    auth: false
  })
}

export function logoutSession() {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST'
  })
}

export function confirmPasswordReset(email: string, code: string, newPassword: string) {
  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, code, new_password: newPassword })
  })
}

export function verifyPasswordResetCode(email: string, code: string) {
  return apiFetch<{ ok: boolean; email: string }>('/api/auth/verify-reset-code', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email, code })
  })
}

export function getMyProfile<T>() {
  return apiFetch<T>('/api/user/profile')
}

export function updateMyProfile<T>(payload: Record<string, unknown>) {
  return apiFetch<T>('/api/user/profile', { method: 'PUT', body: JSON.stringify(payload) })
}

export function deleteMyAccount(confirmUsername: string) {
  return apiFetch<{ ok: boolean }>('/api/user/account', {
    method: 'DELETE',
    body: JSON.stringify({ confirm_username: confirmUsername })
  })
}

export function uploadMyAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiUpload<{ avatar_url: string }>('/api/user/avatar', form)
}

export function getMyWorkouts<T>() {
  return apiFetch<{ items: T[] }>('/api/workouts?page=1&page_size=20')
}

export function getMyBlogs<T>(params: { page?: number; page_size?: number; q?: string; status?: string; sort_by?: string; sort_dir?: string } = {}) {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('page_size', String(params.page_size ?? 6))
  if (params.q) query.set('q', params.q)
  if (params.status) query.set('status', params.status)
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_dir) query.set('sort_dir', params.sort_dir)
  return apiFetch<{ items: T[]; page: number; page_size: number; total: number }>(`/api/user/blogs?${query.toString()}`)
}

export function getMyComments<T>(params: { page?: number; page_size?: number; q?: string; sort_by?: string; sort_dir?: string } = {}) {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('page_size', String(params.page_size ?? 5))
  if (params.q) query.set('q', params.q)
  if (params.sort_by) query.set('sort_by', params.sort_by)
  if (params.sort_dir) query.set('sort_dir', params.sort_dir)
  return apiFetch<{ items: T[]; page: number; page_size: number; total: number }>(`/api/user/comments?${query.toString()}`)
}

export type UserNotification = {
  id: number
  type: 'comment_reply'
  is_read: boolean
  created_at: string
  actor: { id: number; username: string; avatar_url: string | null }
  blog: { id: number; title: string }
  comment_id: number
  root_comment_id: number
  comment_page: number
}

export function getMyNotifications(params: { page?: number; page_size?: number } = {}) {
  const query = new URLSearchParams()
  query.set('page', String(params.page ?? 1))
  query.set('page_size', String(params.page_size ?? 5))
  return apiFetch<{ items: UserNotification[]; page: number; page_size: number; total: number; unread_count: number }>(`/api/user/notifications?${query.toString()}`)
}

export function markNotificationRead(notificationId: number) {
  return apiFetch<{ ok: boolean }>(`/api/user/notifications/${notificationId}/read`, { method: 'POST' })
}

export function deleteNotification(notificationId: number) {
  return apiFetch<{ ok: boolean }>(`/api/user/notifications/${notificationId}`, { method: 'DELETE' })
}
