import type { ExerciseMovementType, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { BUILTIN_EXERCISES, BUILTIN_MAJOR_CATEGORIES, EXERCISE_ROOT_NAME } from '@/lib/builtinExercises'

type CategoryNode = {
  id: string
  name: string
  parentId: string | null
  isBuiltin: boolean
  userId: string | null
  sortOrder: number
}

export async function ensureBuiltinExerciseCatalog() {
  const root = await upsertBuiltinCategory({
    name: EXERCISE_ROOT_NAME,
    parentId: null,
    sortOrder: 0
  })

  const majorMap = new Map<string, CategoryNode>()
  for (const [idx, name] of BUILTIN_MAJOR_CATEGORIES.entries()) {
    const cat = await upsertBuiltinCategory({ name, parentId: root.id, sortOrder: idx })
    majorMap.set(name, cat)
  }

  for (const seed of BUILTIN_EXERCISES) {
    const major = majorMap.get(seed.categoryPath[0])
    if (!major) continue
    const detail = await upsertBuiltinCategory({
      name: seed.categoryPath[1],
      parentId: major.id,
      sortOrder: 0
    })

    const existing = await prisma.exercise.findFirst({
      where: {
        isBuiltin: true,
        userId: null,
        name: seed.name
      },
      select: { id: true }
    })
    if (!existing) {
      await prisma.exercise.create({
        data: {
          name: seed.name,
          isBuiltin: true,
          userId: null,
          movementType: seed.movementType,
          categoryId: detail.id
        }
      })
      continue
    }
    await prisma.exercise.update({
      where: { id: existing.id },
      data: { movementType: seed.movementType, categoryId: detail.id }
    })
  }
}

export async function getReadableCategoryIds(userId: string) {
  const rows = await prisma.exerciseCategory.findMany({
    where: {
      OR: [{ isBuiltin: true, userId: null }, { userId }]
    },
    select: { id: true }
  })
  return new Set(rows.map((r: { id: string }) => r.id))
}

export async function getCategoryPathMap(userId: string) {
  const rows = (await prisma.exerciseCategory.findMany({
    where: { OR: [{ isBuiltin: true, userId: null }, { userId }] },
    select: { id: true, name: true, parentId: true, isBuiltin: true, userId: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  })) as CategoryNode[]

  const byId = new Map<string, CategoryNode>()
  for (const r of rows) byId.set(r.id, r)

  const toPath = (id: string | null | undefined): string[] => {
    if (!id) return []
    const visited = new Set<string>()
    const parts: string[] = []
    let current: string | null | undefined = id
    while (current) {
      if (visited.has(current)) break
      visited.add(current)
      const node = byId.get(current)
      if (!node) break
      parts.push(node.name)
      current = node.parentId
    }
    return parts.reverse()
  }

  const out = new Map<string, string[]>()
  for (const row of rows) out.set(row.id, toPath(row.id))
  return out
}

export async function createCustomExercise(input: {
  userId: string
  name: string
  movementType: ExerciseMovementType
  categoryId: string | null
}) {
  const createData: Prisma.ExerciseCreateInput = {
    name: input.name,
    isBuiltin: false,
    movementType: input.movementType,
    user: { connect: { id: input.userId } }
  }
  if (input.categoryId) {
    createData.category = { connect: { id: input.categoryId } }
  }
  return prisma.exercise.create({
    data: createData,
    select: { id: true, name: true, isBuiltin: true, userId: true, movementType: true, categoryId: true }
  })
}

async function upsertBuiltinCategory(input: { name: string; parentId: string | null; sortOrder: number }): Promise<CategoryNode> {
  const exists = await prisma.exerciseCategory.findFirst({
    where: {
      isBuiltin: true,
      userId: null,
      name: input.name,
      parentId: input.parentId
    },
    select: { id: true, name: true, parentId: true, isBuiltin: true, userId: true, sortOrder: true }
  })
  if (exists) {
    if (exists.sortOrder !== input.sortOrder) {
      await prisma.exerciseCategory.update({
        where: { id: exists.id },
        data: { sortOrder: input.sortOrder }
      })
    }
    return exists
  }

  return prisma.exerciseCategory.create({
    data: {
      name: input.name,
      parentId: input.parentId,
      isBuiltin: true,
      userId: null,
      sortOrder: input.sortOrder
    },
    select: { id: true, name: true, parentId: true, isBuiltin: true, userId: true, sortOrder: true }
  })
}

