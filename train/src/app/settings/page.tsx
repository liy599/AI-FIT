'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import LoginCtaCard from '@/components/LoginCtaCard'
import { useSession } from '@/lib/client/useSession'
import { invalidateSessionCache } from '@/lib/client/session'

const CAMERA_MIRROR_KEY = 'train_cameraMirror'
const CAMERA_ZOOM_KEY = 'train_cameraZoom'
const CAMERA_VIEWPORT_WIDTH_KEY = 'train_cameraViewportWidth'

const VIEWPORT_PRESETS: Array<{ label: string; width: number }> = [
  { label: 'S', width: 320 },
  { label: 'M', width: 420 },
  { label: 'L', width: 520 },
  { label: 'XL', width: 560 }
]

export default function SettingsPage() {
  const router = useRouter()
  const { loading: sessionLoading, session } = useSession()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cameraMirror, setCameraMirror] = useState(true)
  const [cameraZoom, setCameraZoom] = useState(1)
  const [cameraViewportWidth, setCameraViewportWidth] = useState(420)
  const [cameraLoading, setCameraLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    async function load() {
      try {
        if (session) {
          const res = await fetch('/api/v1/private/camera/settings', { method: 'GET', cache: 'no-store', credentials: 'include' })
          if (res.ok) {
            const data = (await res.json().catch(() => null)) as null | {
              settings?: { cameraMirror?: unknown; cameraZoom?: unknown; cameraViewportWidth?: unknown }
            }
            const v = data?.settings?.cameraMirror
            const z = data?.settings?.cameraZoom
            const w = data?.settings?.cameraViewportWidth
            if (mounted) {
              setCameraMirror(typeof v === 'boolean' ? v : true)
              setCameraZoom(typeof z === 'number' && Number.isFinite(z) ? z : 1)
              setCameraViewportWidth(typeof w === 'number' && Number.isFinite(w) ? w : 420)
            }
            return
          }
        }
        const local = window.localStorage.getItem(CAMERA_MIRROR_KEY)
        const localZoom = window.localStorage.getItem(CAMERA_ZOOM_KEY)
        const localWidth = window.localStorage.getItem(CAMERA_VIEWPORT_WIDTH_KEY)
        const parsedZoom = localZoom === null ? 1 : Number(localZoom)
        const parsedWidth = localWidth === null ? 420 : Number(localWidth)
        if (mounted) {
          setCameraMirror(local === null ? true : local === '1')
          setCameraZoom(Number.isFinite(parsedZoom) ? Math.min(2, Math.max(0.5, parsedZoom)) : 1)
          setCameraViewportWidth(Number.isFinite(parsedWidth) ? Math.round(parsedWidth) : 420)
        }
      } finally {
        if (mounted) setCameraLoading(false)
      }
    }
    void load()
    return () => {
      mounted = false
    }
  }, [session])

  async function saveCameraSettings(patch: { cameraMirror?: boolean; cameraZoom?: number; cameraViewportWidth?: number }) {
    setError(null)
    if (typeof patch.cameraMirror === 'boolean') {
      setCameraMirror(patch.cameraMirror)
      window.localStorage.setItem(CAMERA_MIRROR_KEY, patch.cameraMirror ? '1' : '0')
    }
    if (typeof patch.cameraZoom === 'number' && Number.isFinite(patch.cameraZoom)) {
      const z = Math.min(2, Math.max(0.5, patch.cameraZoom))
      setCameraZoom(z)
      window.localStorage.setItem(CAMERA_ZOOM_KEY, String(z))
    }
    if (typeof patch.cameraViewportWidth === 'number' && Number.isFinite(patch.cameraViewportWidth)) {
      const w = Math.round(patch.cameraViewportWidth)
      setCameraViewportWidth(w)
      window.localStorage.setItem(CAMERA_VIEWPORT_WIDTH_KEY, String(w))
    }
    if (!session) return
    try {
      const res = await fetch('/api/v1/private/camera/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      })
      if (!res.ok) return
      const data = (await res.json().catch(() => null)) as null | {
        settings?: { cameraMirror?: unknown; cameraZoom?: unknown; cameraViewportWidth?: unknown }
      }
      const v = data?.settings?.cameraMirror
      const z = data?.settings?.cameraZoom
      const w = data?.settings?.cameraViewportWidth
      if (typeof v === 'boolean') {
        window.localStorage.setItem(CAMERA_MIRROR_KEY, v ? '1' : '0')
        setCameraMirror(v)
      }
      if (typeof z === 'number' && Number.isFinite(z)) {
        window.localStorage.setItem(CAMERA_ZOOM_KEY, String(z))
        setCameraZoom(Math.min(2, Math.max(0.5, z)))
      }
      if (typeof w === 'number' && Number.isFinite(w)) {
        window.localStorage.setItem(CAMERA_VIEWPORT_WIDTH_KEY, String(w))
        setCameraViewportWidth(w)
      }
    } catch {
    }
  }

  async function logout() {
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'include'
      })

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as null | { error?: string }
        setError(data?.error || 'Sign-out failed')
        return
      }

      invalidateSessionCache(null)
      router.push('/')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (sessionLoading) {
    return (
      <main className="container page" style={{ maxWidth: 600 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 24px 0' }}>Account</h1>
        <p>Loading…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="container page" style={{ maxWidth: 600 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 24px 0' }}>Account</h1>
        <LoginCtaCard title="Sign in to view settings" subtitle="When signed out, no private APIs are called (prevents 401 storms)" />
      </main>
    )
  }

  return (
    <main className="container page" style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 24px 0' }}>Account</h1>

      <div style={{ display: 'grid', gap: 16 }}>
        <div className="card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 64, height: 64, borderRadius: 32, background: 'linear-gradient(135deg, var(--primary), #818cf8)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700 }}>
            T
          </div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Athlete</div>
            <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>Edit profile</div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'grid' }}>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>📊</span>
                <span style={{ fontWeight: 500 }}>Body stats</span>
              </div>
              <span style={{ color: 'var(--muted)' }}>&gt;</span>
            </div>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>📸</span>
                <span style={{ fontWeight: 500 }}>Photos</span>
              </div>
              <span style={{ color: 'var(--muted)' }}>&gt;</span>
            </div>
            <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => router.push('/privacy')}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 20 }}>🔒</span>
                <span style={{ fontWeight: 500 }}>Privacy</span>
              </div>
              <span style={{ color: 'var(--muted)' }}>&gt;</span>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 600 }}>Mirror camera</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>On by default (front camera friendly)</div>
            </div>
            <label className="switch" aria-label="Mirror camera">
              <input
                className="switchInput"
                type="checkbox"
                checked={cameraMirror}
                disabled={cameraLoading}
                onChange={(e) => void saveCameraSettings({ cameraMirror: e.target.checked })}
              />
              <span className="switchTrack" aria-hidden="true" />
              <span className="switchThumb" aria-hidden="true" />
            </label>
          </div>
        </div>

        <div className="card" style={{ padding: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Preview size</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Affects the video preview width on the Live page</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {VIEWPORT_PRESETS.map((p) => (
                <button
                  key={p.width}
                  disabled={cameraLoading}
                  onClick={() => void saveCameraSettings({ cameraViewportWidth: p.width })}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: cameraViewportWidth === p.width ? '#dbeafe' : '#fff',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                >
                  {p.label}
                </button>
              ))}
              <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--muted)', display: 'flex', alignItems: 'center' }}>
                {cameraViewportWidth}px
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600 }}>Zoom</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>Adjust zoom level (0.50–2.00)</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.05}
                value={cameraZoom}
                disabled={cameraLoading}
                onChange={(e) => {
                  const next = Number(e.target.value)
                  if (!Number.isFinite(next)) return
                  const z = Math.min(2, Math.max(0.5, next))
                  setCameraZoom(z)
                  window.localStorage.setItem(CAMERA_ZOOM_KEY, String(z))
                }}
                onMouseUp={(e) => void saveCameraSettings({ cameraZoom: Number((e.currentTarget as HTMLInputElement).value) })}
                onTouchEnd={(e) => void saveCameraSettings({ cameraZoom: Number((e.currentTarget as HTMLInputElement).value) })}
                onBlur={(e) => void saveCameraSettings({ cameraZoom: Number((e.currentTarget as HTMLInputElement).value) })}
                style={{ flex: 1 }}
                aria-label="Zoom"
              />
              <div style={{ width: 52, textAlign: 'right', fontSize: 12, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
                {cameraZoom.toFixed(2)}x
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', marginTop: 8 }}>
          <div style={{ display: 'grid' }}>
            <button 
              onClick={logout} 
              disabled={loading}
              style={{ padding: 16, background: 'none', border: 'none', width: '100%', textAlign: 'center', color: 'var(--danger)', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}
            >
              {loading ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        </div>
        {error ? <p style={{ color: 'var(--danger)', textAlign: 'center' }}>{error}</p> : null}
      </div>
    </main>
  )
}
