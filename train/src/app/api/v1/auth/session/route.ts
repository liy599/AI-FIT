import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ ok: true, user: null, session: null })

  const { user, session } = data
  return NextResponse.json({
    ok: true,
    user: { id: user.id, email: user.email, name: user.name },
    session: { id: session.id, expiresAt: session.expiresAt }
  })
}
