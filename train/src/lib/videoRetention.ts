import { unlink } from 'node:fs/promises'
import type { PrismaClient } from '@prisma/client'

const globalForRetention = globalThis as unknown as {
  videoRetention?: { started: boolean; timer?: ReturnType<typeof setInterval>; running: boolean }
}

async function deleteVideoFile(storagePath: string) {
  if (!storagePath) return
  await unlink(storagePath).catch(() => null)
}

export async function runVideoRetentionOnce(prisma: PrismaClient) {
  const now = new Date()

  const candidates = await prisma.videoAsset.findMany({
    where: { expiresAt: { not: null, lt: now } },
    orderBy: { expiresAt: 'asc' },
    take: 50,
    select: { id: true, storagePath: true }
  })

  for (const v of candidates) {
    await deleteVideoFile(v.storagePath)
    await prisma.videoAsset.delete({ where: { id: v.id } }).catch(() => null)
  }
}

export function ensureVideoRetentionRunning(prisma: PrismaClient) {
  if (!globalForRetention.videoRetention) globalForRetention.videoRetention = { started: false, running: false }
  const state = globalForRetention.videoRetention
  if (state.started) return
  state.started = true

  const tick = async () => {
    if (state.running) return
    state.running = true
    try {
      await runVideoRetentionOnce(prisma)
    } finally {
      state.running = false
    }
  }

  void tick()
  state.timer = setInterval(() => void tick(), 30 * 60 * 1000)
}

