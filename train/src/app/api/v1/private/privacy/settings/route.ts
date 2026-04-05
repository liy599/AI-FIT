import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getOrCreateUserSettings, normalizePrivacySettings } from '@/lib/userSettings'

export const runtime = 'nodejs'

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

  const settings = await getOrCreateUserSettings(data.user.id)
  return NextResponse.json({ settings })
}

export async function PUT(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as unknown
  const normalized = normalizePrivacySettings(body)
  if (!normalized) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })

  const saved = await prisma.userSettings.upsert({
    where: { userId: data.user.id },
    create: { userId: data.user.id, saveOriginalVideos: normalized.saveOriginalVideos, videoTtlDays: normalized.videoTtlDays },
    update: { saveOriginalVideos: normalized.saveOriginalVideos, videoTtlDays: normalized.videoTtlDays },
    select: { saveOriginalVideos: true, videoTtlDays: true }
  })

  return NextResponse.json({
    settings: {
      saveOriginalVideos: saved.saveOriginalVideos,
      videoTtlDays: typeof saved.videoTtlDays === 'number' ? saved.videoTtlDays : null
    }
  })
}

