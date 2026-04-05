import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { analyzeGenericMotion } from '@/lib/pose/genericMotion'
import { buildGenericMotionReport } from '@/lib/pose/report'
import { chooseMotionStandard } from '@/lib/pose/analysisSelector'
import { buildMotionStandardCompareReport } from '@/lib/pose/motionStandardCompareReport'
import { normalizeReportForArchive } from '@/lib/report/unified'
import { unlink } from 'node:fs/promises'

const globalForWorker = globalThis as unknown as {
  analysisWorker?: {
    queue: string[]
    queued: Set<string>
    running: Set<string>
    concurrency: number
    tickScheduled: boolean
  }
}

function getWorker() {
  if (!globalForWorker.analysisWorker) {
    globalForWorker.analysisWorker = {
      queue: [],
      queued: new Set<string>(),
      running: new Set<string>(),
      concurrency: 2,
      tickScheduled: false
    }
  }
  return globalForWorker.analysisWorker
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function tryDeleteVideoAsset(video: { id: string; storagePath: string; keepOriginal: boolean } | null) {
  if (!video || video.keepOriginal) return
  if (video.storagePath) await unlink(video.storagePath).catch(() => null)
  await prisma.videoAsset.delete({ where: { id: video.id } }).catch(() => null)
}

async function runOne(taskId: string) {
  const startedAt = new Date()

  const updated = await prisma.analysisTask.updateMany({
    where: { id: taskId, status: 'queued' },
    data: { status: 'running', startedAt, finishedAt: null, errorMessage: null }
  })
  if (updated.count === 0) return

  let videoForCleanup: { id: string; storagePath: string; keepOriginal: boolean } | null = null

  try {
    const task = await prisma.analysisTask.findFirst({
      where: { id: taskId },
      include: {
        exercise: { select: { id: true, name: true } },
        videoAsset: { select: { id: true, originalName: true, mimeType: true, sizeBytes: true, storagePath: true, keepOriginal: true } }
      }
    })

    if (!task) throw new Error('Task not found')
    if (!task.videoAsset) throw new Error('Missing video')
    videoForCleanup = { id: task.videoAsset.id, storagePath: task.videoAsset.storagePath, keepOriginal: task.videoAsset.keepOriginal }

    await sleep(1500)

    const standard = chooseMotionStandard({ viewAngle: task.viewAngle, exerciseName: task.exercise?.name })

    const video = {
      id: task.videoAsset.id,
      originalName: task.videoAsset.originalName,
      mimeType: task.videoAsset.mimeType,
      sizeBytes: task.videoAsset.sizeBytes
    }

    const report: Prisma.JsonValue = standard
      ? (buildMotionStandardCompareReport({
          taskId: task.id,
          viewAngle: task.viewAngle,
          instruction: task.instruction ?? null,
          exercise: task.exercise ? { id: task.exercise.id, name: task.exercise.name } : null,
          video,
          fps: 0,
          frames: [],
          standard
        }) as unknown as Prisma.JsonValue)
      : (buildGenericMotionReport({
          taskId: task.id,
          viewAngle: task.viewAngle,
          instruction: task.instruction ?? null,
          exercise: task.exercise ? { id: task.exercise.id, name: task.exercise.name } : null,
          video,
          fps: 0,
          analysis: analyzeGenericMotion([])
        }) as unknown as Prisma.JsonValue)

    const archivedReport = normalizeReportForArchive(report)
    const finishedAt = new Date()

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.analysisResult.create({
        data: { taskId: task.id, report: archivedReport }
      })
      const res = await tx.analysisTask.updateMany({
        where: { id: task.id, status: 'running' },
        data: { status: 'succeeded', finishedAt, errorMessage: null }
      })
      if (res.count === 0) throw new Error('State conflict')
    })
  } catch (e) {
    const finishedAt = new Date()
    const errorMessage = e instanceof Error ? e.message : 'Unknown error'
    await prisma.analysisTask.updateMany({
      where: { id: taskId, status: 'running' },
      data: { status: 'failed', finishedAt, errorMessage: errorMessage.slice(0, 500) }
    })
  } finally {
    await tryDeleteVideoAsset(videoForCleanup)
  }
}

async function tick() {
  const worker = getWorker()
  worker.tickScheduled = false

  while (worker.running.size < worker.concurrency && worker.queue.length > 0) {
    const taskId = worker.queue.shift()
    if (!taskId) break
    worker.queued.delete(taskId)
    if (worker.running.has(taskId)) continue
    worker.running.add(taskId)

    void runOne(taskId).finally(() => {
      const w = getWorker()
      w.running.delete(taskId)
      scheduleTick()
    })
  }
}

function scheduleTick() {
  const worker = getWorker()
  if (worker.tickScheduled) return
  worker.tickScheduled = true
  setTimeout(() => void tick(), 0)
}

export function enqueueAnalysisTask(taskId: string) {
  const worker = getWorker()
  if (worker.queued.has(taskId) || worker.running.has(taskId)) return
  worker.queued.add(taskId)
  worker.queue.push(taskId)
  scheduleTick()
}
