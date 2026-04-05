import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'

type TrainingExport = {
  id: string
  startedAt: Date
  endedAt: Date | null
  note: string | null
  report: unknown | null
  sets: {
    id: string
    order: number
    reps: number
    weight: number | null
    note: string | null
    exercise: { id: string; name: string }
  }[]
}

type AnalysisExport = {
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
  results: { id: string; createdAt: Date; report: unknown }[]
}

function csvEscape(value: unknown) {
  const s = value === null || value === undefined ? '' : String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replaceAll('"', '""')}"`
  return s
}

export async function GET(request: Request) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const format = (searchParams.get('format') || 'json').toLowerCase()
  if (format !== 'json' && format !== 'csv') return NextResponse.json({ error: 'Invalid format' }, { status: 400 })

  const trainings = (await prisma.trainingSession.findMany({
    where: { userId: data.user.id },
    orderBy: { startedAt: 'asc' },
    select: {
      id: true,
      startedAt: true,
      endedAt: true,
      note: true,
      report: true,
      sets: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          order: true,
          reps: true,
          weight: true,
          note: true,
          exercise: { select: { id: true, name: true } }
        }
      }
    }
  })) as TrainingExport[]

  const analysis = (await prisma.analysisTask.findMany({
    where: { userId: data.user.id },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      viewAngle: true,
      instruction: true,
      createdAt: true,
      updatedAt: true,
      startedAt: true,
      finishedAt: true,
      errorMessage: true,
      exercise: { select: { id: true, name: true } },
      videoAsset: { select: { id: true, originalName: true } },
      results: { orderBy: { createdAt: 'desc' }, take: 1, select: { id: true, createdAt: true, report: true } }
    }
  })) as AnalysisExport[]

  const exportedAt = new Date().toISOString()

  if (format === 'json') {
    return NextResponse.json({
      exportedAt,
      trainings: trainings.map((t: TrainingExport) => ({
        id: t.id,
        startedAt: t.startedAt.toISOString(),
        endedAt: t.endedAt ? t.endedAt.toISOString() : null,
        note: t.note ?? null,
        report: t.report ?? null,
        sets: t.sets.map((s: TrainingExport['sets'][number]) => ({
          id: s.id,
          order: s.order,
          reps: s.reps,
          weight: s.weight ?? null,
          note: s.note ?? null,
          exercise: { id: s.exercise.id, name: s.exercise.name }
        }))
      })),
      analysis: analysis.map((a: AnalysisExport) => {
        const latest = a.results[0] ?? null
        return {
          id: a.id,
          status: a.status,
          viewAngle: a.viewAngle,
          instruction: a.instruction ?? null,
          createdAt: a.createdAt.toISOString(),
          updatedAt: a.updatedAt.toISOString(),
          startedAt: a.startedAt ? a.startedAt.toISOString() : null,
          finishedAt: a.finishedAt ? a.finishedAt.toISOString() : null,
          errorMessage: a.errorMessage ?? null,
          exercise: a.exercise ? { id: a.exercise.id, name: a.exercise.name } : null,
          video: a.videoAsset ? { id: a.videoAsset.id, originalName: a.videoAsset.originalName } : null,
          result: latest ? { id: latest.id, createdAt: latest.createdAt.toISOString(), report: latest.report } : null
        }
      })
    })
  }

  const header = [
    'type',
    'entityId',
    'parentId',
    'createdAt',
    'startedAt',
    'endedAt',
    'status',
    'exerciseName',
    'viewAngle',
    'reps',
    'weight',
    'note',
    'instruction',
    'videoOriginalName',
    'reportJson'
  ].join(',')

  const rows: string[] = [header]

  for (const t of trainings) {
    if (t.sets.length === 0) {
      rows.push(
        [
          csvEscape('training_session'),
          csvEscape(t.id),
          csvEscape(''),
          csvEscape(''),
          csvEscape(t.startedAt.toISOString()),
          csvEscape(t.endedAt ? t.endedAt.toISOString() : ''),
          csvEscape(''),
          csvEscape(''),
          csvEscape(''),
          csvEscape(''),
          csvEscape(''),
          csvEscape(t.note ?? ''),
          csvEscape(''),
          csvEscape(''),
          csvEscape(t.report ? JSON.stringify(t.report) : '')
        ].join(',')
      )
      continue
    }

    for (const s of t.sets) {
      rows.push(
        [
          csvEscape('training_set'),
          csvEscape(s.id),
          csvEscape(t.id),
          csvEscape(''),
          csvEscape(t.startedAt.toISOString()),
          csvEscape(t.endedAt ? t.endedAt.toISOString() : ''),
          csvEscape(''),
          csvEscape(s.exercise.name),
          csvEscape(''),
          csvEscape(s.reps),
          csvEscape(s.weight ?? ''),
          csvEscape(s.note ?? t.note ?? ''),
          csvEscape(''),
          csvEscape(''),
          csvEscape('')
        ].join(',')
      )
    }
  }

  for (const a of analysis) {
    const latest = a.results[0] ?? null
    rows.push(
      [
        csvEscape('analysis_task'),
        csvEscape(a.id),
        csvEscape(''),
        csvEscape(a.createdAt.toISOString()),
        csvEscape(a.startedAt ? a.startedAt.toISOString() : ''),
        csvEscape(a.finishedAt ? a.finishedAt.toISOString() : ''),
        csvEscape(a.status),
        csvEscape(a.exercise?.name ?? ''),
        csvEscape(a.viewAngle),
        csvEscape(''),
        csvEscape(''),
        csvEscape(a.errorMessage ?? ''),
        csvEscape(a.instruction ?? ''),
        csvEscape(a.videoAsset?.originalName ?? ''),
        csvEscape(latest ? JSON.stringify(latest.report) : '')
      ].join(',')
    )
  }

  const csv = rows.join('\n')
  const filename = `export_${data.user.id}_${exportedAt.slice(0, 10)}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Cache-Control': 'private, max-age=0'
    }
  })
}
