import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { createSession, SESSION_COOKIE_NAME } from '@/lib/auth'
import { checkRateLimit, getClientIp } from '@/lib/rateLimit'
import { hash as bcryptHash } from 'bcryptjs'

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
  const rl = checkRateLimit({ key: `auth:register:${ip}`, limit: 5, windowMs: 60_000 })
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
    name?: unknown
  }

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  const name = typeof body?.name === 'string' ? body.name.trim() : null

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (exists) return NextResponse.json({ error: 'Email already registered' }, { status: 409 })

  const passwordHash = await bcryptHash(password, 12)
  const user = await prisma.user.create({
    data: { email, name, passwordHash },
    select: { id: true }
  })

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

