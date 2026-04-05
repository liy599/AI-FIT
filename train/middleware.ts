import { NextResponse, type NextRequest } from 'next/server'

const SESSION_COOKIE_NAME = 'session_token'

function isPublicApi(pathname: string) {
  return pathname === '/api/health' || pathname === '/api/v1/health' || pathname.startsWith('/api/v1/auth/')
}

const protectedPagePrefixes = ['/dashboard', '/train', '/history', '/analysis', '/exercises', '/settings', '/privacy']

async function hasValidSession(req: NextRequest) {
  const cookieHeader = req.headers.get('cookie') ?? ''
  if (!cookieHeader.includes(`${SESSION_COOKIE_NAME}=`)) return false

  const url = req.nextUrl.clone()
  url.pathname = '/api/v1/auth/session'
  url.search = ''

  const res = await fetch(url, {
    method: 'GET',
    headers: { cookie: cookieHeader },
    cache: 'no-store'
  })

  if (!res.ok) return false
  const data = (await res.json().catch(() => null)) as unknown
  if (!data || typeof data !== 'object') return false
  const obj = data as Record<string, unknown>
  const ok = obj.ok === true
  const user = obj.user
  return ok && !!user && typeof user === 'object'
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (pathname.startsWith('/api')) {
    if (isPublicApi(pathname)) return NextResponse.next()

    if (pathname.startsWith('/api/v1/private/')) {
      if (await hasValidSession(req)) return NextResponse.next()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    return NextResponse.next()
  }

  const isProtectedPage = protectedPagePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  if (!isProtectedPage) return NextResponse.next()

  if (await hasValidSession(req)) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
}
