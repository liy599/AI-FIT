import { useCallback, useEffect, useRef } from 'react'
import type { RealtimePoseProvider } from '../../vision/livePoseProvider'

type Factory = () => Promise<RealtimePoseProvider>

/**
 * Lazily creates and caches a single realtime pose provider instance.
 * The provider is preloaded once and closed automatically on unmount.
 */
export function useRealtimePoseProvider(factory: Factory) {
  const providerRef = useRef<RealtimePoseProvider | null>(null)
  const providerPromiseRef = useRef<Promise<RealtimePoseProvider> | null>(null)

  const getProvider = useCallback(async () => {
    if (providerRef.current) return providerRef.current
    if (!providerPromiseRef.current) {
      providerPromiseRef.current = factory()
        .then((provider) => {
          providerRef.current = provider
          return provider
        })
        .catch((e) => {
          providerPromiseRef.current = null
          throw e
        })
    }
    return providerPromiseRef.current
  }, [factory])

  useEffect(() => {
    let active = true
    if (!providerRef.current && !providerPromiseRef.current) {
      const preload = factory().then((provider) => {
        if (!active) {
          provider.close()
          return provider
        }
        providerRef.current = provider
        return provider
      })
      providerPromiseRef.current = preload
      void preload.catch(() => {
        providerPromiseRef.current = null
      })
    }
    return () => {
      active = false
    }
  }, [factory])

  useEffect(() => {
    return () => {
      providerRef.current?.close()
      providerRef.current = null
      providerPromiseRef.current = null
    }
  }, [])

  return { getProvider }
}


