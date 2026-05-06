import { useEffect } from 'react'

type WarmupFn = (variant: 'lightning' | 'thunder') => Promise<void>

// Prewarm the browser model during idle time without blocking first paint.
export function usePoseModelWarmup(prewarm: WarmupFn) {
  useEffect(() => {
    const runWarmup = () => {
      prewarm('lightning').catch(() => {})
    }
    if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
      const id = (window as Window & { requestIdleCallback: (cb: () => void) => number }).requestIdleCallback(runWarmup)
      return () => {
        if ('cancelIdleCallback' in window) {
          ;(window as Window & { cancelIdleCallback: (id: number) => void }).cancelIdleCallback(id)
        }
      }
    }
    const timer = globalThis.setTimeout(runWarmup, 300)
    return () => globalThis.clearTimeout(timer)
  }, [prewarm])
}

