import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { buildTrainingSessionReport } from '@/lib/report/trainingSession'
import { normalizeReportForArchive } from '@/lib/report/unified'
import { toPrismaErrorPayload } from '@/lib/prismaError'

function validatePostOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const expected = new URL(request.url).origin
  if (!origin || origin !== expected) {
    return NextResponse.json({ error: 'Bad origin' }, { status: 403 })
  }
  return null
}

export async function POST(request: Request, context: { params: { id: string } }) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = context.params.id
  const body = (await request.json().catch(() => null)) as null | { report?: unknown }
  try {
    const updated = await prisma.$transaction(async (tx) => {
      const session = await tx.trainingSession.findFirst({
        where: { id, userId: data.user.id },
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          note: true,
          sets: { orderBy: { order: 'asc' }, select: { order: true, reps: true, weight: true, exercise: { select: { id: true, name: true } } } }
        }
      })
      if (!session) throw new Error('NOT_FOUND')
      if (session.endedAt) throw new Error('ALREADY_COMPLETED')

      const endedAt = new Date()
      const report =
        body && typeof body === 'object' && 'report' in body && body.report
          ? normalizeReportForArchive(body.report)
          : buildTrainingSessionReport({
              trainingId: session.id,
              startedAt: session.startedAt,
              endedAt,
              note: session.note ?? null,
              sets: session.sets
            })

      return await tx.trainingSession.update({
        where: { id: session.id },
        data: { endedAt, report },
        select: { id: true, startedAt: true, endedAt: true, note: true }
      })
    })

    return NextResponse.json({ session: updated })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown'
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (msg === 'ALREADY_COMPLETED') return NextResponse.json({ error: 'Training already completed' }, { status: 409 })
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Complete training failed' }, { status: 500 })
  }
}
