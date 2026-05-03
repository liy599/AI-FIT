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
  return apiFetch<{ ok: boolean; reset_link: string }>('/api/auth/forgot-password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ email })
  })
}

export function logoutSession() {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST'
  })
}

export function confirmPasswordReset(token: string, newPassword: string) {
  return apiFetch('/api/auth/reset-password', {
    method: 'POST',
    auth: false,
    body: JSON.stringify({ token, new_password: newPassword })
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

export function uploadBlogCover(file: File) {
  const form = new FormData()
  form.append('file', file)
  return apiUpload<{ cover_image_url: string }>('/api/blogs/cover', form)
}

export function getMyWorkouts<T>() {
  return apiFetch<{ items: T[] }>('/api/workouts?page=1&page_size=20')
}

export function getMyMeals<T>() {
  return apiFetch<{ items: T[] }>('/api/meals/history?page=1&page_size=20')
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

