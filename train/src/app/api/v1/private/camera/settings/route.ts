import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { getOrCreateCameraSettings, normalizeCameraSettings } from '@/lib/cameraSettings'
import { toPrismaErrorPayload } from '@/lib/prismaError'

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

  try {
    const settings = await getOrCreateCameraSettings(data.user.id)
    return NextResponse.json({ settings })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Failed to load camera settings' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as unknown
  const normalized = normalizeCameraSettings(body)
  if (!normalized) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 })

  try {
    const saved = await prisma.userSettings.upsert({
      where: { userId: data.user.id },
      create: { userId: data.user.id, ...normalized },
      update: normalized,
      select: { cameraMirror: true, cameraZoom: true, cameraViewportWidth: true }
    })

    return NextResponse.json({
      settings: {
        cameraMirror: !!saved.cameraMirror,
        cameraZoom: typeof saved.cameraZoom === 'number' ? saved.cameraZoom : 1,
        cameraViewportWidth: typeof saved.cameraViewportWidth === 'number' ? saved.cameraViewportWidth : 420
      }
    })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Failed to save camera settings' }, { status: 500 })
  }
}
