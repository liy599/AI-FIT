import type { MutableRefObject } from 'react'

type LiveMediaCleanupRefs = {
  cleanupRef: MutableRefObject<(() => void) | null>
  videoRef: MutableRefObject<HTMLVideoElement | null>
}

// Stop the realtime loop and release camera tracks in one canonical path.
export function cleanupLiveMedia(refs: LiveMediaCleanupRefs) {
  refs.cleanupRef.current?.()
  refs.cleanupRef.current = null
  const video = refs.videoRef.current
  const stream = video?.srcObject as MediaStream | null
  stream?.getTracks().forEach((track) => track.stop())
  if (video) video.srcObject = null
}

