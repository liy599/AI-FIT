import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { enqueueAnalysisTask } from '@/lib/analysisWorker'
import { ensureDir, getUploadsRootDir, writeWebFileToDisk } from '@/lib/uploads'
import { getOrCreateUserSettings } from '@/lib/userSettings'
import path from 'node:path'

export const runtime = 'nodejs'

const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const ALLOWED_VIEW_ANGLES = new Set(['unknown', 'front', 'side', 'back'])
const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'])

type AnalysisTaskListItem = {
  id: string
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  viewAngle: 'unknown' | 'front' | 'side' | 'back'
  instruction: string | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  finishedAt: Date | null
  errorMessage: string | null
  exercise: { id: string; name: string } | null
  videoAsset: { id: string; originalName: string } | null
}

type ViewAngle = AnalysisTaskListItem['viewAngle']

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

function extFromMime(mimeType: string) {
  const map: Record<string, string> = {
    'video/mp4': '.mp4',
    'video/quicktime': '.mov',
    'video/webm': '.webm',
    'video/x-matroska': '.mkv'
  }
  return map[mimeType] ?? ''
}

function computeVideoRetention(settings: { saveOriginalVideos: boolean; videoTtlDays: number | null }) {
  if (!settings.saveOriginalVideos) {
    return { keepOriginal: false, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) }
  }

  if (settings.videoTtlDays === null) return { keepOriginal: true, expiresAt: null }
  return { keepOriginal: true, expiresAt: new Date(Date.now() + settings.videoTtlDays * 24 * 60 * 60 * 1000) }
}

async function ensureExerciseReadableByUser(exerciseId: string, userId: string) {
  const ex = await prisma.exercise.findFirst({
    where: { id: exerciseId, OR: [{ isBuiltin: true, userId: null }, { userId }] },
    select: { id: true }
  })
  return !!ex
}

export async function GET(request: Request) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const days = Math.min(365, Math.max(1, Number(searchParams.get('days') ?? 90) || 90))
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const limit = Math.min(200, Math.max(1, Number(searchParams.get('limit') ?? 50) || 50))

  const tasks = (await prisma.analysisTask.findMany({
    where: { userId: data.user.id, createdAt: { gte: from } },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      exercise: { select: { id: true, name: true } },
      videoAsset: { select: { id: true, originalName: true } }
    }
  })) as AnalysisTaskListItem[]

  for (const t of tasks) {
    if (t.status === 'queued' && !shouldUseClientPose()) enqueueAnalysisTask(t.id)
  }

  return NextResponse.json({
    items: tasks.map((t: AnalysisTaskListItem) => ({
      id: t.id,
      status: t.status,
      viewAngle: t.viewAngle,
      instruction: t.instruction ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      startedAt: t.startedAt ? t.startedAt.toISOString() : null,
      finishedAt: t.finishedAt ? t.finishedAt.toISOString() : null,
      errorMessage: t.errorMessage ?? null,
      exercise: t.exercise ? { id: t.exercise.id, name: t.exercise.name } : null,
      video: t.videoAsset ? { id: t.videoAsset.id, originalName: t.videoAsset.originalName } : null
    }))
  })
}

export async function POST(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const settings = await getOrCreateUserSettings(data.user.id)
  const retention = computeVideoRetention(settings)

  const form = await request.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })

  const rawExerciseId = form.get('exerciseId')
  const exerciseId = typeof rawExerciseId === 'string' && rawExerciseId.trim() ? rawExerciseId.trim() : null
  if (exerciseId && !(await ensureExerciseReadableByUser(exerciseId, data.user.id))) {
    return NextResponse.json({ error: 'Invalid exercise' }, { status: 400 })
  }

  const rawViewAngle = form.get('viewAngle')
  const viewAngle = (typeof rawViewAngle === 'string' ? rawViewAngle.trim() : 'unknown') as ViewAngle
  if (!ALLOWED_VIEW_ANGLES.has(viewAngle)) return NextResponse.json({ error: 'Invalid viewAngle' }, { status: 400 })

  const rawInstruction = form.get('instruction')
  const instructionText = typeof rawInstruction === 'string' ? rawInstruction.trim() : ''
  const instruction = instructionText ? instructionText.slice(0, 2000) : null

  const file = form.get('file')
  const rawVideoAssetId = form.get('videoAssetId')
  const videoAssetId = typeof rawVideoAssetId === 'string' && rawVideoAssetId.trim() ? rawVideoAssetId.trim() : null

  if (file instanceof File && videoAssetId) {
    return NextResponse.json({ error: 'Provide either file or videoAssetId' }, { status: 400 })
  }

  let resolvedVideoAssetId: string | null = null

  if (file instanceof File) {
    if (!file.type || !ALLOWED_VIDEO_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Invalid video type' }, { status: 400 })
    }
    if (file.size <= 0 || file.size > MAX_VIDEO_BYTES) return NextResponse.json({ error: 'Invalid video size' }, { status: 400 })

    const originalName = String(file.name || 'video').slice(0, 200)
    const ext = extFromMime(file.type)
    if (!ext) return NextResponse.json({ error: 'Invalid video type' }, { status: 400 })
    const uploadDir = path.join(getUploadsRootDir(), 'videos', data.user.id)
    await ensureDir(uploadDir)

    const video = await prisma.videoAsset.create({
      data: {
        userId: data.user.id,
        originalName,
        mimeType: file.type,
        sizeBytes: file.size,
        storagePath: '',
        keepOriginal: retention.keepOriginal,
        expiresAt: retention.expiresAt
      },
      select: { id: true }
    })
    const storagePath = path.join(uploadDir, `${video.id}${ext}`)

    try {
      await writeWebFileToDisk(file, storagePath)
      await prisma.videoAsset.update({ where: { id: video.id }, data: { storagePath } })
      resolvedVideoAssetId = video.id
    } catch {
      await prisma.videoAsset.delete({ where: { id: video.id } }).catch(() => null)
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    }
  } else if (videoAssetId) {
    const v = await prisma.videoAsset.findFirst({
      where: { id: videoAssetId, userId: data.user.id },
      select: { id: true }
    })
    if (!v) return NextResponse.json({ error: 'Invalid video' }, { status: 400 })
    resolvedVideoAssetId = v.id
  } else {
    return NextResponse.json({ error: 'Missing video' }, { status: 400 })
  }

  const task = await prisma.analysisTask.create({
    data: {
      userId: data.user.id,
      status: shouldUseClientPose() ? 'running' : 'queued',
      videoAssetId: resolvedVideoAssetId,
      exerciseId,
      viewAngle,
      instruction,
      startedAt: shouldUseClientPose() ? new Date() : null
    },
    select: { id: true, status: true, createdAt: true }
  })

  if (task.status === 'queued') enqueueAnalysisTask(task.id)

  return NextResponse.json({
    job: { id: task.id, status: task.status, createdAt: task.createdAt.toISOString() }
  })
}

export async function DELETE(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const res = await prisma.analysisTask.deleteMany({ where: { userId: data.user.id } })
  return NextResponse.json({ ok: true, deleted: res.count })
}
