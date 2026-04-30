import { useEffect, useRef, useState } from 'react'

/**
 * Throttles UI updates for rapidly changing live tips to reduce flicker.
 */
export function useThrottledMainTip<T>(currentMainTip: T, intervalMs = 1000) {
  const [displayMainTip, setDisplayMainTip] = useState(() => currentMainTip)
  const lastUpdatedRef = useRef(0)
  const timerRef = useRef<number | null>(null)
  const pendingRef = useRef(currentMainTip)

  useEffect(() => {
    pendingRef.current = currentMainTip
    const now = Date.now()
    const elapsed = now - lastUpdatedRef.current
    if (elapsed >= intervalMs) {
      lastUpdatedRef.current = now
      setDisplayMainTip(currentMainTip)
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      return
    }
    if (timerRef.current !== null) return
    const waitMs = intervalMs - elapsed
    timerRef.current = window.setTimeout(() => {
      lastUpdatedRef.current = Date.now()
      setDisplayMainTip(pendingRef.current)
      timerRef.current = null
    }, waitMs)

    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [currentMainTip, intervalMs])

  return displayMainTip
}
