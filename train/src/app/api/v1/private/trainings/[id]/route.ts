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

type PutBody = {
  note?: unknown
  sets?: unknown
}

type IncomingSet = {
  exerciseId?: unknown
  reps?: unknown
  weight?: unknown
  note?: unknown
}

export async function GET(request: Request, context: { params: { id: string } }) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = context.params.id

  try {
    const session = await prisma.trainingSession.findFirst({
      where: { id, userId: data.user.id },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        note: true,
        report: true,
        sets: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            reps: true,
            weight: true,
            note: true,
            exercise: { select: { id: true, name: true, isBuiltin: true } }
          }
        }
      }
    })

    if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ session })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Failed to load training session' }, { status: 500 })
  }
}

export async function PUT(request: Request, context: { params: { id: string } }) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = context.params.id
  try {
    const exists = await prisma.trainingSession.findFirst({
      where: { id, userId: data.user.id },
      select: { id: true, endedAt: true }
    })
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (exists.endedAt) return NextResponse.json({ error: 'Training already completed' }, { status: 409 })

    const body = (await request.json().catch(() => null)) as null | PutBody

    const noteRaw = typeof body?.note === 'string' ? body.note.trim() : ''
    const note = noteRaw.length > 0 ? noteRaw.slice(0, 2000) : null

    const incomingSets = Array.isArray(body?.sets) ? (body?.sets as IncomingSet[]) : null
    if (!incomingSets) return NextResponse.json({ error: 'Invalid sets' }, { status: 400 })

    const normalizedSets = incomingSets
      .map((s) => {
        const exerciseId = typeof s.exerciseId === 'string' ? s.exerciseId : ''
        const reps = typeof s.reps === 'number' ? s.reps : Number(s.reps)
        const weight = s.weight === null || s.weight === undefined || s.weight === '' ? null : Number(s.weight)
        const setNoteRaw = typeof s.note === 'string' ? s.note.trim() : ''
        const setNote = setNoteRaw.length > 0 ? setNoteRaw.slice(0, 500) : null

        return {
          exerciseId,
          reps,
          weight: Number.isFinite(weight as number) ? (weight as number) : null,
          note: setNote
        }
      })
      .filter((s) => !!s.exerciseId)

    if (normalizedSets.some((s) => !Number.isInteger(s.reps) || s.reps <= 0 || s.reps > 500)) {
      return NextResponse.json({ error: 'Invalid reps' }, { status: 400 })
    }
    if (normalizedSets.some((s) => s.weight !== null && (!Number.isFinite(s.weight) || s.weight < 0 || s.weight > 2000))) {
      return NextResponse.json({ error: 'Invalid weight' }, { status: 400 })
    }

    await prisma.$transaction([
      prisma.trainingSession.update({
        where: { id },
        data: { note }
      }),
      prisma.trainingSet.deleteMany({ where: { trainingId: id } }),
      prisma.trainingSet.createMany({
        data: normalizedSets.map((s, idx) => ({
          trainingId: id,
          exerciseId: s.exerciseId,
          order: idx,
          reps: s.reps,
          weight: s.weight,
          note: s.note
        }))
      })
    ])

    const session = await prisma.trainingSession.findFirst({
      where: { id, userId: data.user.id },
      select: {
        id: true,
        startedAt: true,
        endedAt: true,
        note: true,
        report: true,
        sets: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            reps: true,
            weight: true,
            note: true,
            exercise: { select: { id: true, name: true, isBuiltin: true } }
          }
        }
      }
    })

    return NextResponse.json({ session })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Failed to save training sets' }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = context.params.id
  try {
    const exists = await prisma.trainingSession.findFirst({ where: { id, userId: data.user.id }, select: { id: true } })
    if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    await prisma.trainingSession.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Failed to delete training session' }, { status: 500 })
  }
}
