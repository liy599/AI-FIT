export function isPoseDebugEnabled() {
  try {
    if (typeof window === 'undefined') return false
    const search = new URLSearchParams(window.location.search)
    const qp = search.get('poseDebug')
    if (qp === '1' || qp === 'true') return true
    const ls = window.localStorage.getItem('POSE_DEBUG')
    if (ls === '1' || ls === 'true') return true
    const path = window.location.pathname || ''
    if (path.startsWith('/tools/pose/lateral-raise/video')) return true
    return false
  } catch {
    return false
  }
}

export function getPoseDebugServerUrl() {
  try {
    if (typeof window === 'undefined') return 'http://127.0.0.1:7777/event'
    const ls = window.localStorage.getItem('POSE_DEBUG_SERVER_URL')
    if (ls && ls.trim()) return ls.trim()
    return 'http://127.0.0.1:7777/event'
  } catch {
    return 'http://127.0.0.1:7777/event'
  }
}
