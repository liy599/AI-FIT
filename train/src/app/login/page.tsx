import Link from 'next/link'
import LoginForm from './LoginForm'

export default function LoginPage(props: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const nextPath = typeof props.searchParams?.next === 'string' ? props.searchParams.next : '/dashboard'
  return (
    <main className="page">
      <div className="container">
        <div className="card formCard">
          <div className="cardInner" style={{ display: 'grid', gap: 14 }}>
            <div>
              <h1 style={{ margin: 0, letterSpacing: '-0.02em' }}>Sign in</h1>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                Sign in to use training logs, video analysis, and live coaching.
              </p>
            </div>
            <LoginForm nextPath={nextPath} />
            <div className="muted" style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Link href="/register">No account? Sign up</Link>
              <Link href="/">Back to Home</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
