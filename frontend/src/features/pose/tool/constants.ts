export const LIVE_TARGET_FPS = 40
export const LIVE_TARGET_FRAME_MS = 1000 / LIVE_TARGET_FPS
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const OFFLINE_ANALYSIS_LIMIT_SEC = 2 * 60
export const OFFLINE_ANALYSIS_TARGET_FPS = 40
export const OFFLINE_ANALYSIS_MAX_FRAMES = OFFLINE_ANALYSIS_LIMIT_SEC * OFFLINE_ANALYSIS_TARGET_FPS
export const LIVE_SESSION_LIMIT_MS = 2 * 60 * 1000
export const OFFLINE_DEDICATED_REPLAY_ACTIONS = new Set(['squat', 'pushup', 'pullup', 'lateral-raise', 'bent-over-row'])

