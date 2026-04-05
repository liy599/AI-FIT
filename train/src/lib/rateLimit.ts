type RateLimitEntry = {
  count: number
  resetAtMs: number
}

const globalForRateLimit = globalThis as unknown as {
  rateLimitStore?: Map<string, RateLimitEntry>
}

const store = globalForRateLimit.rateLimitStore ?? new Map<string, RateLimitEntry>()

if (process.env.NODE_ENV !== 'production') globalForRateLimit.rateLimitStore = store

export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() || 'unknown'
  return request.headers.get('x-real-ip') ?? 'unknown'
}

export function checkRateLimit(params: { key: string; limit: number; windowMs: number }) {
  const now = Date.now()
  const current = store.get(params.key)

  if (!current || now >= current.resetAtMs) {
    const next: RateLimitEntry = { count: 1, resetAtMs: now + params.windowMs }
    store.set(params.key, next)
    return { ok: true, remaining: params.limit - 1, resetAtMs: next.resetAtMs }
  }

  if (current.count >= params.limit) {
    return { ok: false, remaining: 0, resetAtMs: current.resetAtMs }
  }

  current.count += 1
  store.set(params.key, current)
  return { ok: true, remaining: params.limit - current.count, resetAtMs: current.resetAtMs }
}

