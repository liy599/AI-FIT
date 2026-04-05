import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { toPrismaErrorPayload } from '@/lib/prismaError'

function validatePostOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const expected = new URL(request.url).origin
  if (!origin || origin !== expected) {
    return NextResponse.json({ error: 'Bad origin' }, { status: 403 })
  }
  return null
}

export async function GET(request: Request) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const daysRaw = searchParams.get('days')
  const days = Math.min(365, Math.max(1, Number(daysRaw ?? 30) || 30))
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  try {
    const sessions = await prisma.trainingSession.findMany({
      where: { userId: data.user.id, startedAt: { gte: from } },
      orderBy: { startedAt: 'desc' },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        note: true,
        report: true,
        sets: { select: { exerciseId: true } }
      }
    })

    const items = sessions.map(
      (s: {
        id: string
        startedAt: Date
        endedAt: Date | null
        note: string | null
        report: unknown
        sets: { exerciseId: string }[]
      }) => {
        const distinctExercises = new Set(s.sets.map((x) => x.exerciseId)).size
        return {
          id: s.id,
          startedAt: s.startedAt,
          endedAt: s.endedAt,
          note: s.note,
          hasReport: !!s.report,
          totalSets: s.sets.length,
          distinctExercises
        }
      }
    )

    return NextResponse.json({ items })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Failed to load training history' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as null | { note?: unknown }
  const noteRaw = typeof body?.note === 'string' ? body.note.trim() : ''
  const note = noteRaw.length > 0 ? noteRaw.slice(0, 2000) : null

  try {
    const session = await prisma.trainingSession.create({
      data: { userId: data.user.id, note, startedAt: new Date() },
      select: { id: true, startedAt: true, endedAt: true, note: true }
    })

    return NextResponse.json({ session })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Failed to create training session' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const res = await prisma.trainingSession.deleteMany({ where: { userId: data.user.id } })
    return NextResponse.json({ ok: true, deleted: res.count })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Failed to clear training history' }, { status: 500 })
  }
}
