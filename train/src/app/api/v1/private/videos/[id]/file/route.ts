import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getUserFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'

function parseRange(rangeHeader: string | null, size: number): { start: number; end: number } | null {
  if (!rangeHeader) return null
  const m = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim())
  if (!m) return null
  const startStr = m[1]
  const endStr = m[2]

  let start = startStr ? Number(startStr) : NaN
  let end = endStr ? Number(endStr) : NaN

  if (!Number.isFinite(start) && !Number.isFinite(end)) return null

  if (!Number.isFinite(start)) {
    const suffix = end
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    start = Math.max(0, size - suffix)
    end = size - 1
  } else if (!Number.isFinite(end)) {
    end = size - 1
  }

  start = Math.max(0, Math.min(size - 1, start))
  end = Math.max(start, Math.min(size - 1, end))

  return { start, end }
}

export async function GET(request: Request, context: { params: { id: string } }) {
  const data = await getUserFromRequest(request)
  if (!data) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = context.params.id
  const video = await prisma.videoAsset.findFirst({
    where: { id, userId: data.user.id },
    select: { id: true, mimeType: true, storagePath: true, originalName: true, sizeBytes: true }
  })
  if (!video) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!video.storagePath) return NextResponse.json({ error: 'Missing file' }, { status: 404 })

  const st = await stat(video.storagePath).catch(() => null)
  if (!st || !st.isFile()) return NextResponse.json({ error: 'Missing file' }, { status: 404 })

  const size = st.size
  const range = parseRange(request.headers.get('range'), size)

  if (range) {
    const stream = createReadStream(video.storagePath, { start: range.start, end: range.end })
    const body = Readable.toWeb(stream) as unknown as ReadableStream
    return new Response(body, {
      status: 206,
      headers: {
        'Content-Type': video.mimeType || 'application/octet-stream',
        'Content-Length': String(range.end - range.start + 1),
        'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=0',
        'Content-Disposition': `inline; filename="${encodeURIComponent(video.originalName || `${video.id}.bin`)}"`
      }
    })
  }

  const stream = createReadStream(video.storagePath)
  const body = Readable.toWeb(stream) as unknown as ReadableStream
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': video.mimeType || 'application/octet-stream',
      'Content-Length': String(size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=0',
      'Content-Disposition': `inline; filename="${encodeURIComponent(video.originalName || `${video.id}.bin`)}"`
    }
  })
}

