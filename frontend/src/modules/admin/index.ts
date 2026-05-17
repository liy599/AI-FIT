import { apiFetch } from '../../lib/api'

export type AdminUserItem = {
  id: number
  username: string
  email: string
  created_at: string
  is_admin: boolean
}

export function listAdminUsers(page = 1, pageSize = 20) {
  return apiFetch<{ items: AdminUserItem[]; page: number; page_size: number; total: number }>(
    `/api/admin/users?page=${page}&page_size=${pageSize}`
  )
}

