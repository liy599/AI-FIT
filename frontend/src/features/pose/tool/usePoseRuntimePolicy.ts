import { useEffect, useMemo, useState } from 'react'

import { getPosePolicy, type PosePolicy } from '../../pose'
import { LIVE_TARGET_FPS, LIVE_SESSION_LIMIT_MS, MAX_VIDEO_BYTES } from './constants'
import type { PoseToolMode } from './types'

type UsePoseRuntimePolicyResult = {
  posePolicy: PosePolicy | null
  liveTargetFps: number
  liveTargetFrameMs: number
  liveSessionLimitMs: number
  maxVideoBytes: number
}

export function usePoseRuntimePolicy(_mode: PoseToolMode): UsePoseRuntimePolicyResult {
  const [posePolicy, setPosePolicy] = useState<PosePolicy | null>(null)

  useEffect(() => {
    let active = true
    getPosePolicy()
      .then((policy) => {
        if (!active) return
        setPosePolicy(policy)
      })
      .catch(() => {
        if (!active) return
        setPosePolicy(null)
      })
    return () => {
      active = false
    }
  }, [])

  const liveTargetFps = Number(posePolicy?.live?.target_fps ?? LIVE_TARGET_FPS)
  const liveTargetFrameMs = useMemo(() => 1000 / Math.max(1, liveTargetFps), [liveTargetFps])
  const liveSessionLimitMs = Number(posePolicy?.live?.session_limit_seconds ?? LIVE_SESSION_LIMIT_MS / 1000) * 1000
  const maxVideoBytes = Number(posePolicy?.offline?.max_video_bytes ?? MAX_VIDEO_BYTES)

  return {
    posePolicy,
    liveTargetFps,
    liveTargetFrameMs,
    liveSessionLimitMs,
    maxVideoBytes
  }
}
