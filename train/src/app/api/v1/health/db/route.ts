import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { toPrismaErrorPayload } from '@/lib/prismaError'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await prisma.$queryRawUnsafe('SELECT "cameraMirror","cameraZoom","cameraViewportWidth" FROM "UserSettings" LIMIT 1')
    await prisma.$queryRawUnsafe('SELECT "report" FROM "TrainingSession" LIMIT 1')
    return NextResponse.json({
      ok: true,
      checks: ['UserSettings.camera*', 'TrainingSession.report'],
      message: 'Database schema check passed'
    })
  } catch (e) {
    const payload = toPrismaErrorPayload(e)
    if (payload) return NextResponse.json(payload, { status: payload.status })
    return NextResponse.json({ error: 'Database schema check failed' }, { status: 500 })
  }
}
