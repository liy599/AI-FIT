import { API_BASE, apiFetch, apiUpload, resolveBackendUrl } from '../../lib/api'
import type { AuthUser } from '../../lib/auth'

export { API_BASE, resolveBackendUrl }

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

export function getMyProfile<T>() {
  return apiFetch<T>('/api/user/profile')
}

export function updateMyProfile<T>(payload: Record<string, unknown>) {
  return apiFetch<T>('/api/user/profile', { method: 'PUT', body: JSON.stringify(payload) })
}

export function uploadMyAvatar(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiUpload<{ avatar_url: string }>('/api/user/avatar', form)
}

export function getMyWorkouts<T>() {
  return apiFetch<{ items: T[] }>('/api/workouts?page=1&page_size=20')
}

export function getMyMeals<T>() {
  return apiFetch<{ items: T[] }>('/api/meals/history?page=1&page_size=20')
}

export function listMyMealHistory<T>(params?: { page?: number; page_size?: number }) {
  const query = new URLSearchParams()
  if (params?.page) query.set('page', String(params.page))
  if (params?.page_size) query.set('page_size', String(params.page_size))
  const suffix = query.toString()
  return apiFetch<{ items: T[]; page: number; page_size: number; total: number }>(`/api/meals/history${suffix ? `?${suffix}` : ''}`)
}

export function getMyBlogs<T>() {
  return apiFetch<{ items: T[] }>('/api/user/blogs?page=1&page_size=20')
}

export function getMyComments<T>() {
  return apiFetch<{ items: T[] }>('/api/user/comments?page=1&page_size=20')
}

export function previewOrDeleteMyData(payload: Record<string, unknown>) {
  return apiFetch('/api/user/data-lifecycle/delete', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

export function getAdminLifecyclePolicy<T>() {
  return apiFetch<T>('/api/admin/data-lifecycle/policy')
}

export function runAdminLifecycleCleanup<T>(payload: Record<string, unknown>) {
  return apiFetch<T>('/api/admin/data-lifecycle/cleanup', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

