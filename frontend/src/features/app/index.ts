import { apiFetch } from '../../lib/api'

export type FeedbackItem = {
  id: number
  user: { id: number; username: string } | null
  content: string
  rating: number | null
  created_at: string
}

/**
 * Fetches a small feedback list for the drawer panel.
 * Keep this in the app feature so presentational components do not depend on raw lib APIs.
 */
export function listRecentFeedback(page = 1, pageSize = 6) {
  return apiFetch<{ items: FeedbackItem[] }>(`/api/feedback?page=${page}&page_size=${pageSize}`)
}

/**
 * Submits user feedback or contact message.
 */
export function submitFeedback(payload: {
  type: 'Review' | 'Contact'
  content: string
  rating?: number
  contact_email?: string
}) {
  return apiFetch('/api/feedback', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

