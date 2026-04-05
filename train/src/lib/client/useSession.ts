'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSessionCached, getSessionSnapshot, subscribeSession, type SessionOk } from './session'

export function useSession(): { loading: boolean; session: SessionOk | null } {
  const [snap, setSnap] = useState(() => getSessionSnapshot())

  useEffect(() => {
    return subscribeSession(() => setSnap(getSessionSnapshot()))
  }, [])

  useEffect(() => {
    if (snap.status === 'idle') void getSessionCached()
  }, [snap.status])

  return useMemo(() => {
    if (snap.status === 'ready') return { loading: false, session: snap.value ?? null }
    return { loading: true, session: null }
  }, [snap])
}

