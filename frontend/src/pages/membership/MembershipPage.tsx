import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cancelMembership, getMyMembership, getPlans, subscribe } from '../../lib/membership/api'
import type { MembershipPlan, MyMembership } from '../../lib/membership/api'
import { useAuth } from '../../state/auth-context'

type BillingCycle = 'monthly' | 'yearly'

const PLAN_HIGHLIGHTS: Record<string, { color: string; badge?: string }> = {
  free:    { color: '#64748b' },
  premium: { color: 'var(--color-brand)', badge: 'Most Popular' },
  annual:  { color: '#7c3aed', badge: 'Best Value' },
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="8" fill="var(--color-brand)" opacity="0.15" />
      <path d="M5 8l2 2 4-4" stroke="var(--color-brand)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MembershipStatusCard({ membership, onCancel }: { membership: MyMembership; onCancel: () => void }) {
  const [cancelling, setCancelling] = useState(false)
  const isPremium = membership.status === 'active' && membership.plan?.slug !== 'free'

  async function handleCancel() {
    if (!confirm('Cancel your membership? You will keep access until the expiry date.')) return
    setCancelling(true)
    try {
      await onCancel()
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div style={{
      background: isPremium ? 'linear-gradient(135deg, #ecfdf5, #d1fae5)' : 'var(--color-bg-soft)',
      border: `1.5px solid ${isPremium ? 'rgba(52, 204, 149, 0.3)' : 'var(--color-border-default)'}`,
      borderRadius: 'var(--radius-lg)', padding: '20px 24px', marginBottom: 40,
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16
    }}>
      <div style={{ flex: 1, minWidth: 200 }}>
        <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
          Current Plan
        </p>
        <p style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: 'var(--color-text-primary)' }}>
          {membership.plan?.name ?? 'Free'}
          {isPremium && (
            <span style={{ marginLeft: 8, fontSize: 12, background: 'var(--color-brand)', color: '#fff', padding: '2px 10px', borderRadius: 999, fontWeight: 700 }}>
              ACTIVE
            </span>
          )}
        </p>
        {membership.expires_at && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-text-muted)' }}>
            {membership.status === 'cancelled' ? 'Access until' : 'Renews'}{' '}
            {new Date(membership.expires_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>
      {isPremium && membership.status !== 'cancelled' && (
        <button
          type="button"
          onClick={() => void handleCancel()}
          disabled={cancelling}
          style={{
            height: 36, padding: '0 16px', borderRadius: 999, fontSize: 13, fontWeight: 600,
            border: '1.5px solid var(--color-border-default)', background: 'var(--color-bg-surface)',
            color: 'var(--color-text-muted)', cursor: 'pointer'
          }}
        >
          {cancelling ? 'Cancelling…' : 'Cancel membership'}
        </button>
      )}
    </div>
  )
}

export default function MembershipPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [membership, setMembership] = useState<MyMembership | null>(null)
  const [cycle, setCycle] = useState<BillingCycle>('monthly')
  const [subscribing, setSubscribing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    getPlans().then(setPlans).catch(() => {})
    if (auth.user) {
      getMyMembership().then(setMembership).catch(() => {})
    }
  }, [auth.user])

  async function handleSubscribe(plan: MembershipPlan) {
    if (!auth.user) { navigate('/login?from=/membership'); return }
    if (plan.slug === 'free') return
    setSubscribing(plan.slug)
    setError('')
    setSuccess('')
    try {
      await subscribe(plan.slug, cycle)
      const updated = await getMyMembership()
      setMembership(updated)
      setSuccess(`You're now on the ${plan.name} plan!`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Subscription failed')
    } finally {
      setSubscribing(null)
    }
  }

  async function handleCancel() {
    try {
      await cancelMembership()
      const updated = await getMyMembership()
      setMembership(updated)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancellation failed')
    }
  }

  const currentPlanSlug = membership?.plan?.slug ?? 'free'
  const isActive = membership?.status === 'active'

  return (
    <section className="pt-100 pb-100">
      <div className="container">

        {/* Hero */}
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto 48px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-brand)', letterSpacing: 1.4, textTransform: 'uppercase', margin: '0 0 12px' }}>
            MEMBERSHIP
          </p>
          <h1 style={{ fontSize: 36, fontWeight: 900, color: 'var(--color-text-primary)', margin: '0 0 14px', lineHeight: 1.2 }}>
            Upgrade your fitness journey
          </h1>
          <p style={{ fontSize: 16, color: 'var(--color-text-muted)', margin: '0 0 28px', lineHeight: 1.6 }}>
            Access premium courses, advanced analytics, and AI training insights.
          </p>

          {/* Billing toggle */}
          <div style={{ display: 'inline-flex', background: 'var(--color-bg-soft)', borderRadius: 999, padding: 4, border: '1.5px solid var(--color-border-default)' }}>
            {(['monthly', 'yearly'] as BillingCycle[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCycle(c)}
                style={{
                  height: 36, padding: '0 20px', borderRadius: 999, fontSize: 14, fontWeight: 700,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: cycle === c ? 'var(--color-bg-surface)' : 'transparent',
                  color: cycle === c ? 'var(--color-text-primary)' : 'var(--color-text-muted)',
                  boxShadow: cycle === c ? 'var(--shadow-soft)' : 'none',
                }}
              >
                {c === 'monthly' ? 'Monthly' : 'Yearly'}
                {c === 'yearly' && (
                  <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-brand)', fontWeight: 800 }}>
                    SAVE 25%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Current membership status */}
        {membership && (
          <MembershipStatusCard membership={membership} onCancel={handleCancel} />
        )}

        {/* Status messages */}
        {error && (
          <div style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 24, fontSize: 14 }}>
            {error}
          </div>
        )}
        {success && (
          <div style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: 24, fontSize: 14, fontWeight: 600 }}>
            🎉 {success}
          </div>
        )}

        {/* Plan cards */}
        <div className="row" style={{ justifyContent: 'center' }}>
          {plans.map((plan) => {
            const highlight = PLAN_HIGHLIGHTS[plan.slug] ?? { color: 'var(--color-text-muted)' }
            const isCurrent = currentPlanSlug === plan.slug && isActive
            const price = plan.slug === 'free' ? 0 : cycle === 'yearly' ? plan.price_yearly / 12 : plan.price_monthly
            const isPopular = !!highlight.badge

            return (
              <div className="col-lg-4 col-md-6" key={plan.id} style={{ marginBottom: 28 }}>
                <div style={{
                  background: 'var(--color-bg-surface)', borderRadius: 'var(--radius-xl)',
                  padding: '32px 28px', height: '100%', display: 'flex', flexDirection: 'column',
                  boxShadow: isPopular ? 'var(--shadow-brand)' : 'var(--shadow-soft)',
                  border: `2px solid ${isPopular ? 'var(--color-brand)' : 'var(--color-border-default)'}`,
                  position: 'relative', overflow: 'hidden'
                }}>
                  {highlight.badge && (
                    <div style={{
                      position: 'absolute', top: 16, right: -28, transform: 'rotate(45deg)',
                      background: 'var(--color-brand)', color: '#fff',
                      fontSize: 11, fontWeight: 800, padding: '4px 36px', letterSpacing: 0.5,
                    }}>
                      {highlight.badge}
                    </div>
                  )}

                  <div style={{ marginBottom: 20 }}>
                    <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 700, color: highlight.color, textTransform: 'uppercase', letterSpacing: 1 }}>
                      {plan.name}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                      <span style={{ fontSize: 38, fontWeight: 900, color: 'var(--color-text-primary)' }}>
                        {plan.slug === 'free' ? 'Free' : `€${price.toFixed(2)}`}
                      </span>
                      {plan.slug !== 'free' && (
                        <span style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>/mo</span>
                      )}
                    </div>
                    {cycle === 'yearly' && plan.slug !== 'free' && (
                      <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-brand)', fontWeight: 600 }}>
                        Billed €{plan.price_yearly.toFixed(2)}/year
                      </p>
                    )}
                    <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                      {plan.description}
                    </p>
                  </div>

                  {/* CTA button */}
                  <div style={{ marginBottom: 24 }}>
                    {isCurrent ? (
                      <div style={{
                        height: 46, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--color-success-bg)', color: 'var(--color-success)', fontWeight: 700, fontSize: 14
                      }}>
                        ✓ Current plan
                      </div>
                    ) : plan.slug === 'free' ? (
                      <div style={{
                        height: 46, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--color-bg-soft)', color: 'var(--color-text-muted)', fontWeight: 600, fontSize: 14,
                        border: '1.5px solid var(--color-border-default)'
                      }}>
                        Default plan
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void handleSubscribe(plan)}
                        disabled={subscribing === plan.slug}
                        className="app-btn app-btn--brand"
                        style={{ width: '100%', height: 46, fontSize: 15, justifyContent: 'center' }}
                      >
                        {subscribing === plan.slug ? 'Processing…' : `Get ${plan.name}`}
                      </button>
                    )}
                  </div>

                  {/* Features list */}
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                      Includes
                    </p>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {plan.features.map((f) => (
                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                          <CheckIcon />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer note */}
        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', marginTop: 32 }}>
          All plans include a 7-day free trial. Cancel anytime.
        </p>

      </div>
    </section>
  )
}
