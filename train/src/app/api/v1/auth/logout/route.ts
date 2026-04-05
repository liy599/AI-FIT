import { NextResponse } from 'next/server'
import { getSessionFromRequest, revokeSessionByToken, SESSION_COOKIE_NAME } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'

function validatePostOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const expected = new URL(request.url).origin
  if (!origin || origin !== expected) {
    return NextResponse.json({ error: 'Bad origin' }, { status: 403 })
  }
  return null
}

export async function POST(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const ip = getClientIp(request)
  const rl = checkRateLimit({ key: `auth:logout:${ip}`, limit: 30, windowMs: 60_000 })
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAtMs - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const data = await getSessionFromRequest(request)
  if (data) await revokeSessionByToken(data.token)

  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0)
  })
  return res
}

