import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

function validatePostOrigin(request: Request) {
  const origin = request.headers.get('origin')
  const expected = new URL(request.url).origin
  if (!origin || origin !== expected) {
    return NextResponse.json({ error: 'Bad origin' }, { status: 403 })
  }
  return null
}

async function getOwnedCategory(categoryId: string, userId: string) {
  return prisma.exerciseCategory.findFirst({
    where: { id: categoryId, userId, isBuiltin: false },
    select: { id: true, userId: true, isBuiltin: true, parentId: true }
  })
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = context.params.id
  const exists = await getOwnedCategory(id, data.user.id)
  if (!exists) return NextResponse.json({ error: 'Category not found or readonly' }, { status: 404 })

  const body = (await request.json().catch(() => null)) as null | {
    name?: unknown
    parentId?: unknown
    sortOrder?: unknown
  }
  const nextName = typeof body?.name === 'string' ? body.name.trim() : null
  const parentId = typeof body?.parentId === 'string' ? body.parentId.trim() || null : undefined
  const sortOrder = typeof body?.sortOrder === 'number' ? Math.max(0, Math.floor(body.sortOrder)) : undefined

  if (nextName !== null && (!nextName || nextName.length > 40)) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 })
  }

  if (parentId !== undefined && parentId !== null) {
    if (parentId === id) return NextResponse.json({ error: 'Parent cannot be itself' }, { status: 400 })
    const parent = await prisma.exerciseCategory.findFirst({
      where: { id: parentId, OR: [{ isBuiltin: true, userId: null }, { userId: data.user.id }] },
      select: { id: true }
    })
    if (!parent) return NextResponse.json({ error: 'Invalid parent category' }, { status: 400 })
  }

  const item = await prisma.exerciseCategory.update({
    where: { id },
    data: {
      ...(nextName !== null ? { name: nextName } : {}),
      ...(parentId !== undefined ? { parentId } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {})
    },
    select: { id: true, name: true, parentId: true, isBuiltin: true, userId: true, sortOrder: true }
  })
  return NextResponse.json({ item: { ...item, isCustom: !!item.userId } })
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  const badOrigin = validatePostOrigin(request)
  if (badOrigin) return badOrigin

  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = context.params.id
  const exists = await getOwnedCategory(id, data.user.id)
  if (!exists) return NextResponse.json({ error: 'Category not found or readonly' }, { status: 404 })

  const childCount = await prisma.exerciseCategory.count({ where: { parentId: id } })
  if (childCount > 0) {
    return NextResponse.json({ error: 'Delete or move child categories first' }, { status: 409 })
  }
  const exerciseCount = await prisma.exercise.count({ where: { categoryId: id } })
  if (exerciseCount > 0) {
    return NextResponse.json({ error: 'This category still contains exercises. Move them first.' }, { status: 409 })
  }

  await prisma.exerciseCategory.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
