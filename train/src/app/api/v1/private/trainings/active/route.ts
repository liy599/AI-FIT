import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { toPrismaErrorPayload } from '@/lib/prismaError'

export async function GET(request: Request) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const session = await prisma.trainingSession.findFirst({
      where: { userId: data.user.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
      select: { id: true, startedAt: true, endedAt: true, note: true }
    })

    return NextResponse.json({ session })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Failed to load active training session' }, { status: 500 })
  }
}
