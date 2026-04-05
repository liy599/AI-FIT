import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { enqueueAnalysisTask } from '@/lib/analysisWorker'

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

  const task = await prisma.analysisTask.findFirst({
    where: { id, userId: data.user.id },
    select: { id: true, status: true }
  })
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (task.status !== 'failed') return NextResponse.json({ error: 'Only failed jobs can be retried' }, { status: 409 })

  const useClient = process.env.CLIENT_POSE_ENABLED !== '0'

  await prisma.analysisTask.update({
    where: { id: task.id },
    data: {
      status: useClient ? 'running' : 'queued',
      startedAt: useClient ? new Date() : null,
      finishedAt: null,
      errorMessage: null
    }
  })

  if (!useClient) enqueueAnalysisTask(task.id)

  return NextResponse.json({ ok: true })
}
