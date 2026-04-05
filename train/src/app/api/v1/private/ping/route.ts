import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'

export async function GET(request: Request) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ ok: true, userId: data.user.id })
}
