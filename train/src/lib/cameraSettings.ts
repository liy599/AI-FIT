import { prisma } from '@/lib/db'

export type CameraSettings = {
  cameraMirror: boolean
  cameraZoom: number
  cameraViewportWidth: number
}

export async function getOrCreateCameraSettings(userId: string): Promise<CameraSettings> {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { cameraMirror: true, cameraZoom: true, cameraViewportWidth: true }
  })

  return {
    cameraMirror: !!settings.cameraMirror,
    cameraZoom: typeof settings.cameraZoom === 'number' ? Math.min(2, Math.max(0.5, settings.cameraZoom)) : 1,
    cameraViewportWidth: typeof settings.cameraViewportWidth === 'number' ? settings.cameraViewportWidth : 420
  }
}

export function normalizeCameraSettings(input: unknown): Partial<CameraSettings> | null {
  if (!input || typeof input !== 'object') return null
  const obj = input as Record<string, unknown>

  const out: Partial<CameraSettings> = {}

  if ('cameraMirror' in obj) {
    out.cameraMirror = !!obj.cameraMirror
  }

  if ('cameraZoom' in obj) {
    const raw = obj.cameraZoom
    const zoom = typeof raw === 'number' ? raw : Number(raw)
    if (!Number.isFinite(zoom) || zoom < 0.5 || zoom > 2) return null
    out.cameraZoom = zoom
  }

  if ('cameraViewportWidth' in obj) {
    const raw = obj.cameraViewportWidth
    const w = typeof raw === 'number' ? raw : Number(raw)
    const allowed = new Set([320, 420, 520, 560])
    if (!Number.isFinite(w) || !Number.isInteger(w) || !allowed.has(w)) return null
    out.cameraViewportWidth = w
  }

  if (Object.keys(out).length === 0) return null
  return out
}
