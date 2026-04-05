import { createHash, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db'

export const SESSION_COOKIE_NAME = 'session_token'
export const SESSION_TTL_DAYS = 30

function parseCookies(cookieHeader: string | null): Map<string, string> {
  const out = new Map<string, string>()
  if (!cookieHeader) return out

  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=')
    if (!rawName) continue
    out.set(rawName, decodeURIComponent(rest.join('=')))
  }

  return out
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string) {
  const token = generateSessionToken()
  const tokenHash = hashSessionToken(token)
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt }
  })

  return { token, expiresAt }
}

export async function revokeSessionByToken(token: string) {
  const tokenHash = hashSessionToken(token)
  await prisma.session.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() }
  })
}

export async function getSessionFromRequest(request: Request) {
  const cookies = parseCookies(request.headers.get('cookie'))
  const token = cookies.get(SESSION_COOKIE_NAME)
  if (!token) return null

  const tokenHash = hashSessionToken(token)
  const session = await prisma.session.findFirst({
    where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true }
  })

  if (!session) return null
  return { session, token }
}

export async function getUserFromRequest(request: Request) {
  const data = await getSessionFromRequest(request)
  if (!data) return null
  return { user: data.session.user, session: data.session, token: data.token }
}

