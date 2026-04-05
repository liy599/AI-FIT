import { NextResponse } from 'next/server'
import type { ExerciseMovementType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ensureBuiltinExerciseCatalog, getCategoryPathMap, getReadableCategoryIds } from '@/lib/exerciseCatalog'

const MOVEMENT_TYPES = new Set<ExerciseMovementType>([
  'strength',
  'cardio',
  'reps_only',
  'duration_only',
  'stretch',
  'tabata'
])

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

  await ensureBuiltinExerciseCatalog()

  const { searchParams } = new URL(request.url)
  const rawQuery = (searchParams.get('query') ?? '').trim()
  const movementType = (searchParams.get('movementType') ?? '').trim() as ExerciseMovementType
  const categoryId = (searchParams.get('categoryId') ?? '').trim() || null
  const allowedExerciseNames = ['Squat', '深蹲']

  const readableCategoryIds = await getReadableCategoryIds(data.user.id)
  if (categoryId && !readableCategoryIds.has(categoryId)) {
    return NextResponse.json({ error: 'Invalid categoryId' }, { status: 400 })
  }

  const items = await prisma.exercise.findMany({
    where: {
      AND: [
        { name: { in: allowedExerciseNames } },
        ...(rawQuery ? [{ name: { contains: rawQuery } }] : []),
        ...(MOVEMENT_TYPES.has(movementType) ? [{ movementType }] : []),
        ...(categoryId ? [{ categoryId }] : [])
      ],
      OR: [{ isBuiltin: true, userId: null }, { userId: data.user.id }]
    },
    orderBy: [{ isBuiltin: 'desc' }, { name: 'asc' }],
    select: { id: true, name: true, isBuiltin: true, userId: true, movementType: true, categoryId: true }
  })

  const pathMap = await getCategoryPathMap(data.user.id)

  return NextResponse.json({
    items: items.map((e) => ({
      id: e.id,
      name: e.name,
      isBuiltin: e.isBuiltin,
      isCustom: !!e.userId,
      movementType: e.movementType,
      categoryId: e.categoryId,
      categoryPath: e.categoryId ? pathMap.get(e.categoryId) ?? [] : []
    }))
  })
}

export async function POST(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ error: 'Single exercise mode' }, { status: 403 })
}

export async function PATCH(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ error: 'Single exercise mode' }, { status: 403 })
}
