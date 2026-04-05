import Link from 'next/link'
import RegisterForm from './RegisterForm'

export default function RegisterPage(props: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const nextPath = typeof props.searchParams?.next === 'string' ? props.searchParams.next : '/dashboard'
  return (
    <main className="page">
      <div className="container">
        <div className="card formCard">
          <div className="cardInner" style={{ display: 'grid', gap: 14 }}>
            <div>
              <h1 style={{ margin: 0, letterSpacing: '-0.02em' }}>Sign up</h1>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Privacy-first by default: we do not store original videos. You can export or delete your data anytime.
              </p>
            </div>
            <RegisterForm nextPath={nextPath} />
            <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Link href="/login">Already have an account? Sign in</Link>
              <Link href="/">Back to Home</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
