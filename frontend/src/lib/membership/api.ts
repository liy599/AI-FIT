import { apiFetch } from '../api'

export type MembershipPlan = {
  id: number
  slug: string
  name: string
  description: string
  price_monthly: number
  price_yearly: number
  features: string[]
}

export type MyMembership = {
  status: 'free' | 'active' | 'cancelled' | 'expired' | 'pending'
  billing_cycle?: 'monthly' | 'yearly'
  starts_at?: string
  expires_at?: string | null
  plan?: { id?: number; slug: string; name: string } | null
}

export function getPlans() {
  return apiFetch<MembershipPlan[]>('/api/memberships/plans', { auth: false })
}

export function getMyMembership() {
  return apiFetch<MyMembership>('/api/memberships/me')
}

export function subscribe(plan_slug: string, billing_cycle: 'monthly' | 'yearly') {
  return apiFetch<{ ok: boolean; membership: { status: string; plan: string; expires_at: string } }>(
    '/api/memberships/subscribe',
    { method: 'POST', body: JSON.stringify({ plan_slug, billing_cycle }) }
  )
}

export function cancelMembership() {
  return apiFetch<{ ok: boolean; message: string }>('/api/memberships/cancel', { method: 'POST' })
}
