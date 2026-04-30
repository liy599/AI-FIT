import type { PoseToolMode } from './types'

/**
 * Resolves current pose tool mode from route pathname and querystring.
 */
export function resolvePoseToolMode(pathname: string, search: string): PoseToolMode {
  const lowerPath = pathname.toLowerCase()
  if (lowerPath.endsWith('/video')) return 'offline'
  if (lowerPath.endsWith('/live')) return 'live'
  const raw = new URLSearchParams(search).get('mode')
  return raw === 'offline' ? 'offline' : 'live'
}

