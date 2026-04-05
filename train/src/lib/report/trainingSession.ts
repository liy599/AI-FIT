import { normalizeReportForArchive, type UnifiedReport } from '@/lib/report/unified'

type TrainingSetLite = { order: number; reps: number; weight: number | null; exercise: { id: string; name: string } }

function sampleSets<T>(sets: T[], max: number) {
  if (sets.length <= max) return sets
  if (max <= 0) return []
  if (max === 1) return [sets[sets.length - 1]]

  const idx = new Set<number>()
  idx.add(0)
  idx.add(sets.length - 1)
  while (idx.size < max) {
    const t = Math.floor(((idx.size - 1) / (max - 1)) * (sets.length - 1))
    idx.add(t)
    if (idx.size >= max) break
    idx.add(Math.floor(sets.length / 2))
  }
  return Array.from(idx)
    .sort((a, b) => a - b)
    .slice(0, max)
    .map((i) => sets[i])
}

export function buildTrainingSessionReport(input: {
  trainingId: string
  startedAt: Date
  endedAt: Date
  note: string | null
  sets: TrainingSetLite[]
}): UnifiedReport {
  const totalSets = input.sets.length
  const distinctExercises = new Set(input.sets.map((s) => s.exercise.id)).size
  const totalReps = input.sets.reduce((acc, s) => acc + (Number.isFinite(s.reps) ? s.reps : 0), 0)
  const totalVolume = input.sets.reduce((acc, s) => acc + (typeof s.weight === 'number' ? s.weight * s.reps : 0), 0)
  const durationSec = Math.max(0, Math.round((input.endedAt.getTime() - input.startedAt.getTime()) / 1000))

  const timelineSampled = sampleSets(
    input.sets.map((s) => ({ order: s.order, exerciseName: s.exercise.name, reps: s.reps, weight: s.weight })),
    5
  )

  const base = {
    version: 3,
    generatedAt: input.endedAt.toISOString(),
    status: 'ok' as const,
    task: { id: input.trainingId, viewAngle: 'unknown', instruction: null },
    exercise: null,
    video: null,
    summary: `训练完成：${distinctExercises} 个动作 · ${totalSets} 组`,
    keyMetrics: {
      totalSets,
      distinctExercises,
      totalReps,
      totalVolume,
      durationSec,
      startedAt: input.startedAt.toISOString(),
      endedAt: input.endedAt.toISOString()
    },
    issues: [],
    suggestions: [
      '记录体感与动作质量感受（RPE/关节不适等），下次更容易复盘。',
      '优先保证动作标准与可控深度，再逐步增加重量或次数。',
      '训练后做 5–10 分钟放松与活动度，帮助恢复。'
    ],
    details: {
      type: 'training_session',
      note: input.note ?? null,
      timelineSampled
    }
  }

  return normalizeReportForArchive(base)
}
