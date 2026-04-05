import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'
import { ensureBuiltinExerciseCatalog } from '@/lib/exerciseCatalog'

type CategoryRow = {
  id: string
  name: string
  parentId: string | null
  isBuiltin: boolean
  userId: string | null
  sortOrder: number
}

function validatePostOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const expected = new URL(request.url).origin
  if (!origin || origin !== expected) {
    return NextResponse.json({ error: 'Bad origin' }, { status: 403 })
  }
  return null
}

function buildTree(rows: CategoryRow[]) {
  const byParent = new Map<string | null, CategoryRow[]>()
  for (const row of rows) {
    const list = byParent.get(row.parentId) ?? []
    list.push(row)
    byParent.set(row.parentId, list)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'))
  }

  function walk(parentId: string | null): Array<{
    id: string
    name: string
    parentId: string | null
    isBuiltin: boolean
    isCustom: boolean
    sortOrder: number
    children: ReturnType<typeof walk>
  }> {
    return (byParent.get(parentId) ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      parentId: item.parentId,
      isBuiltin: item.isBuiltin,
      isCustom: !!item.userId,
      sortOrder: item.sortOrder,
      children: walk(item.id)
    }))
  }

  return walk(null)
}

export async function GET(request: Request) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureBuiltinExerciseCatalog()

  const rows = (await prisma.exerciseCategory.findMany({
    where: {
      OR: [{ isBuiltin: true, userId: null }, { userId: data.user.id }]
    },
    select: { id: true, name: true, parentId: true, isBuiltin: true, userId: true, sortOrder: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }]
  })) as CategoryRow[]

  return NextResponse.json({ items: rows, tree: buildTree(rows) })
}

export async function POST(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureBuiltinExerciseCatalog()

  const body = (await request.json().catch(() => null)) as null | {
    name?: unknown
    parentId?: unknown
  }
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name || name.length > 40) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }
  const parentId = typeof body?.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null

  if (parentId) {
    const parent = await prisma.exerciseCategory.findFirst({
      where: { id: parentId, OR: [{ isBuiltin: true, userId: null }, { userId: data.user.id }] },
      select: { id: true }
    })
    if (!parent) return NextResponse.json({ error: 'Invalid parent category' }, { status: 400 })
  }

  const siblingCount = await prisma.exerciseCategory.count({
    where: { parentId, userId: data.user.id }
  })

  const item = await prisma.exerciseCategory.create({
    data: {
      name,
      parentId,
      isBuiltin: false,
      userId: data.user.id,
      sortOrder: siblingCount + 1
    },
    select: { id: true, name: true, parentId: true, isBuiltin: true, userId: true, sortOrder: true }
  })

  return NextResponse.json({
    item: { ...item, isCustom: !!item.userId },
    created: true
  })
}

export async function PATCH(request: Request) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as null | {
    action?: unknown
    parentId?: unknown
    orderedIds?: unknown
  }
  if (body?.action !== 'reorder') return NextResponse.json({ error: 'Unsupported action' }, { status: 400 })

  const parentId = typeof body.parentId === 'string' && body.parentId.trim() ? body.parentId.trim() : null
  const orderedIds = Array.isArray(body.orderedIds)
    ? body.orderedIds.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    : []
  if (orderedIds.length === 0) return NextResponse.json({ error: 'orderedIds is required' }, { status: 400 })

  const siblings = await prisma.exerciseCategory.findMany({
    where: {
      id: { in: orderedIds },
      userId: data.user.id,
      isBuiltin: false,
      parentId
    },
    select: { id: true }
  })
  if (siblings.length !== orderedIds.length) {
    return NextResponse.json({ error: 'Some categories are invalid for reorder' }, { status: 400 })
  }

  await prisma.$transaction(
    orderedIds.map((id, idx) =>
      prisma.exerciseCategory.update({
        where: { id },
        data: { sortOrder: idx + 1 }
      })
    )
  )

  return NextResponse.json({ ok: true, updated: orderedIds.length })
}
