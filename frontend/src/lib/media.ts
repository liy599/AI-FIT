function isLocalhostLikeHost(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1'
}

function buildCameraUnavailableMessage() {
  if (typeof window === 'undefined') {
    return 'Camera API is unavailable in this runtime.'
  }

  const protocol = window.location.protocol
  const host = window.location.hostname
  const secure = window.isSecureContext

  if (!secure && protocol === 'http:' && !isLocalhostLikeHost(host)) {
    return 'Camera access requires HTTPS on this domain. Please open the site with https:// and try again.'
  }

  return 'Camera API is unavailable in this browser/context. Use a modern browser, enable camera permissions, and retry.'
}

function mapGetUserMediaError(error: unknown) {
  if (!(error instanceof DOMException)) {
    return error instanceof Error ? error.message : 'Unable to access camera.'
  }

  if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
    return 'Camera permission was denied. Please allow camera access in browser settings.'
  }
  if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
    return 'No camera device was found. Please connect a camera and retry.'
  }
  if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
    return 'Camera is busy or blocked by another app. Close other camera apps and retry.'
  }
  if (error.name === 'OverconstrainedError') {
    return 'Requested camera settings are not supported by this device.'
  }
  if (error.name === 'AbortError') {
    return 'Camera initialization was interrupted. Please retry.'
  }

  return error.message || 'Unable to access camera.'
}

export async function requestCameraStream(constraints: MediaStreamConstraints) {
  const mediaDevices =
    typeof navigator !== 'undefined' && navigator && 'mediaDevices' in navigator
      ? navigator.mediaDevices
      : undefined

  if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
    throw new Error(buildCameraUnavailableMessage())
  }

  try {
    return await mediaDevices.getUserMedia(constraints)
  } catch (error: unknown) {
    throw new Error(mapGetUserMediaError(error))
  }
}

