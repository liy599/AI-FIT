import { NextResponse } from 'next/server'

export function GET() {
  return NextResponse.json({ ok: true, version: 'v1', timestamp: Date.now() })
}

