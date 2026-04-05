import { prisma } from '@/lib/db'

export type PrivacySettings = {
  saveOriginalVideos: boolean
  videoTtlDays: number | null
}

const MAX_TTL_DAYS = 3650

export async function getOrCreateUserSettings(userId: string): Promise<PrivacySettings> {
  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: {},
    create: { userId },
    select: { saveOriginalVideos: true, videoTtlDays: true }
  })

  return {
    saveOriginalVideos: settings.saveOriginalVideos,
    videoTtlDays: typeof settings.videoTtlDays === 'number' ? settings.videoTtlDays : null
  }
}

export function normalizePrivacySettings(input: unknown): PrivacySettings | null {
  if (!input || typeof input !== 'object') return null
  const obj = input as Record<string, unknown>

  const saveOriginalVideos = !!obj.saveOriginalVideos

  const rawTtl = obj.videoTtlDays
  const ttl =
    rawTtl === null || rawTtl === undefined || rawTtl === ''
      ? null
      : typeof rawTtl === 'number'
        ? rawTtl
        : Number(rawTtl)

  if (ttl !== null) {
    if (!Number.isFinite(ttl) || !Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_TTL_DAYS) return null
  }

  return { saveOriginalVideos, videoTtlDays: ttl }
}

