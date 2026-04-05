import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { enqueueAnalysisTask } from '@/lib/analysisWorker'

function shouldUseClientPose() {
  if (process.env.CLIENT_POSE_ENABLED === '0') return false
  return true
}

function validatePostOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const expected = new URL(request.url).origin
  if (!origin || origin !== expected) {
    return NextResponse.json({ error: 'Bad origin' }, { status: 403 })
  }
  return null
}

export async function GET(request: Request, context: { params: { id: string } }) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = context.params.id

  const task = await prisma.analysisTask.findFirst({
    where: { id, userId: data.user.id },
    include: {
      exercise: { select: { id: true, name: true } },
      videoAsset: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true } },
      results: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, report: true, createdAt: true } }
    }
  })

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.status === 'queued' && !shouldUseClientPose()) enqueueAnalysisTask(task.id)

  const latest = task.results[0] ?? null

  return NextResponse.json({
    job: {
      id: task.id,
      status: task.status,
      viewAngle: task.viewAngle,
      instruction: task.instruction ?? null,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
      startedAt: task.startedAt ? task.startedAt.toISOString() : null,
      finishedAt: task.finishedAt ? task.finishedAt.toISOString() : null,
      errorMessage: task.errorMessage ?? null,
      exercise: task.exercise ? { id: task.exercise.id, name: task.exercise.name } : null,
      video: task.videoAsset
        ? {
            id: task.videoAsset.id,
            originalName: task.videoAsset.originalName,
            mimeType: task.videoAsset.mimeType,
            sizeBytes: task.videoAsset.sizeBytes,
            createdAt: task.videoAsset.createdAt.toISOString()
          }
        : null
    },
    result: latest
      ? { id: latest.id, report: latest.report, createdAt: latest.createdAt.toISOString() }
      : null
  })
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = context.params.id
  const exists = await prisma.analysisTask.findFirst({ where: { id, userId: data.user.id }, select: { id: true } })
  if (!exists) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.analysisTask.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
