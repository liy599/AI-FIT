import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { normalizeReportForArchive } from '@/lib/report/unified'
import { unlink } from 'node:fs/promises'

export const runtime = 'nodejs'

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
  const body = (await request.json().catch(() => null)) as unknown
  const report = body && typeof body === 'object' && 'report' in (body as Record<string, unknown>) ? (body as { report: unknown }).report : null
  if (!report) return NextResponse.json({ error: 'Missing report' }, { status: 400 })
  const archivedReport = normalizeReportForArchive(report)

  let videoForCleanup: { id: string; storagePath: string; keepOriginal: boolean } | null = null

  try {
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const task = await tx.analysisTask.findFirst({
        where: { id, userId: data.user.id },
        select: {
          id: true,
          status: true,
          startedAt: true,
          videoAsset: { select: { id: true, storagePath: true, keepOriginal: true } }
        }
      })
      if (!task) throw new Error('NOT_FOUND')
      if (task.status === 'succeeded') throw new Error('ALREADY_SUCCEEDED')
      if (task.status === 'failed') throw new Error('ALREADY_FAILED')

      const video = (task as unknown as { videoAsset?: unknown }).videoAsset
      if (video && typeof video === 'object') {
        const v = video as { id?: unknown; storagePath?: unknown; keepOriginal?: unknown }
        if (typeof v.id === 'string' && typeof v.storagePath === 'string' && typeof v.keepOriginal === 'boolean') {
          videoForCleanup = { id: v.id, storagePath: v.storagePath, keepOriginal: v.keepOriginal }
        }
      }

      const now = new Date()
      await tx.analysisResult.create({ data: { taskId: task.id, report: archivedReport as Prisma.InputJsonValue } })

      const startedAt = task.startedAt ?? now
      const updated = await tx.analysisTask.updateMany({
        where: { id: task.id, userId: data.user.id, status: { in: ['queued', 'running'] } },
        data: { status: 'succeeded', startedAt, finishedAt: now, errorMessage: null }
      })
      if (updated.count === 0) throw new Error('STATE_CONFLICT')
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (msg === 'ALREADY_SUCCEEDED') return NextResponse.json({ error: 'Already succeeded' }, { status: 409 })
    if (msg === 'ALREADY_FAILED') return NextResponse.json({ error: 'Already failed' }, { status: 409 })
    if (msg === 'STATE_CONFLICT') return NextResponse.json({ error: 'State conflict' }, { status: 409 })
    return NextResponse.json({ error: 'Write report failed' }, { status: 500 })
  }

  const cleanup = videoForCleanup as unknown as { id: string; storagePath: string; keepOriginal: boolean } | null
  if (cleanup && cleanup.keepOriginal === false) {
    if (cleanup.storagePath) await unlink(cleanup.storagePath).catch(() => null)
    await prisma.videoAsset.delete({ where: { id: cleanup.id } }).catch(() => null)
  }

  return NextResponse.json({ ok: true })
}
