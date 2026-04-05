import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { compare as bcryptCompare } from 'bcryptjs'

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
  const rl = checkRateLimit({ key: `auth:login:${ip}`, limit: 10, windowMs: 60_000 })
  if (!rl.ok) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAtMs - Date.now()) / 1000))
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  const body = (await request.json().catch(() => null)) as null | {
    email?: unknown
    password?: unknown
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''

  if (!email || !password) return NextResponse.json({ error: 'Invalid credentials' }, { status: 400 })

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true }
  })
  if (!user) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  const ok = await bcryptCompare(password, user.passwordHash)
  if (!ok) return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })

  const session = await createSession(user.id)
  const res = NextResponse.json({ ok: true })
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: session.token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: session.expiresAt
  })
  return res
}

