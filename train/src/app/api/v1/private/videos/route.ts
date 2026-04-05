import path from 'node:path'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ensureDir, getUploadsRootDir, writeWebFileToDisk } from '@/lib/uploads'
import { getOrCreateUserSettings } from '@/lib/userSettings'

export const runtime = 'nodejs'

const MAX_VIDEO_BYTES = 80 * 1024 * 1024
const ALLOWED_VIDEO_MIME_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'])

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

export async function GET(request: Request) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? 30) || 30))

  const items = await prisma.videoAsset.findMany({
    where: { userId: data.user.id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true }
  })

  return NextResponse.json({
    items: items.map((v: { id: string; originalName: string; mimeType: string; sizeBytes: number; createdAt: Date }) => ({
      ...v,
      createdAt: v.createdAt.toISOString()
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

  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
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
    select: { id: true, createdAt: true }
  })

  const storagePath = path.join(uploadDir, `${video.id}${ext}`)

  try {
    await writeWebFileToDisk(file, storagePath)
    await prisma.videoAsset.update({
      where: { id: video.id },
      data: { storagePath }
    })
  } catch {
    await prisma.videoAsset.delete({ where: { id: video.id } }).catch(() => null)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }

  const full = await prisma.videoAsset.findFirst({
    where: { id: video.id, userId: data.user.id },
    select: { id: true, originalName: true, mimeType: true, sizeBytes: true, createdAt: true }
  })

  if (!full) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })

  return NextResponse.json({
    video: {
      ...full,
      createdAt: full.createdAt.toISOString()
    }
  })
}
