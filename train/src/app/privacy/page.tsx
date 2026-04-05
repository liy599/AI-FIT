'use client'

import { useEffect, useMemo, useState } from 'react'
import LoginCtaCard from '@/components/LoginCtaCard'
import { useSession } from '@/lib/client/useSession'
import { NotLoggedInError, privateFetch, privateJson } from '@/lib/client/privateFetch'

type PrivacySettings = {
  saveOriginalVideos: boolean
  videoTtlDays: number | null
}

async function readJsonOrThrow<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => null)) as unknown
  if (!res.ok) {
    const error =
      data && typeof data === 'object' && 'error' in data && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : null
    throw new Error(error ?? `HTTP ${res.status}`)
  }
  if (!data) throw new Error(`HTTP ${res.status}`)
  return data as T
}

function todayKey() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export default function PrivacyPage() {
  const { loading: sessionLoading, session } = useSession()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<PrivacySettings | null>(null)
  const [saveOriginal, setSaveOriginal] = useState(false)
  const [ttlEnabled, setTtlEnabled] = useState(false)
  const [ttlDays, setTtlDays] = useState(30)

  const ttlDisabled = useMemo(() => !saveOriginal, [saveOriginal])

  useEffect(() => {
    let mounted = true
    async function run() {
      if (!session) {
        if (!mounted) return
        setLoading(false)
        return
      }
      try {
        const data = await privateJson<{ settings: PrivacySettings }>('/api/v1/private/privacy/settings', { method: 'GET' })
        if (!mounted) return
        setSettings(data.settings)
        setSaveOriginal(!!data.settings.saveOriginalVideos)
        setTtlEnabled(typeof data.settings.videoTtlDays === 'number')
        setTtlDays(typeof data.settings.videoTtlDays === 'number' ? data.settings.videoTtlDays : 30)
      } catch (e) {
        if (!mounted) return
        if (e instanceof NotLoggedInError) {
          setError(null)
          setLoading(false)
          return
        }
        setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }
    run()
    return () => {
      mounted = false
    }
  }, [session])

  async function save() {
    setError(null)
    setSaving(true)
    try {
      const res = await privateFetch('/api/v1/private/privacy/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          saveOriginalVideos: saveOriginal,
          videoTtlDays: saveOriginal && ttlEnabled ? ttlDays : null
        })
      })
      const data = await readJsonOrThrow<{ settings: PrivacySettings }>(res)
      setSettings(data.settings)
      setSaveOriginal(!!data.settings.saveOriginalVideos)
      setTtlEnabled(typeof data.settings.videoTtlDays === 'number')
      setTtlDays(typeof data.settings.videoTtlDays === 'number' ? data.settings.videoTtlDays : ttlDays)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function download(format: 'json' | 'csv') {
    setError(null)
    try {
      const res = await privateFetch(`/api/v1/private/privacy/export?format=${encodeURIComponent(format)}`, {
        method: 'GET',
        cache: 'no-store'
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as null | { error?: string }
        throw new Error(data?.error || `HTTP ${res.status}`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `train_export_${todayKey()}.${format}`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed')
    }
  }

  async function deleteAllTrainings() {
    if (!window.confirm('Delete all training records? This action cannot be undone.')) return
    setError(null)
    try {
      const res = await privateFetch('/api/v1/private/trainings', { method: 'DELETE', credentials: 'include' })
      await readJsonOrThrow<{ ok: true; deleted: number }>(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function deleteAllAnalysis() {
    if (!window.confirm('Delete all analysis jobs and reports? This action cannot be undone.')) return
    setError(null)
    try {
      const res = await privateFetch('/api/v1/private/analysis/jobs', { method: 'DELETE', credentials: 'include' })
      await readJsonOrThrow<{ ok: true; deleted: number }>(res)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (sessionLoading || loading) {
    return (
      <main style={{ padding: 24 }}>
        <h1>Privacy</h1>
        <p>Loading…</p>
      </main>
    )
  }

  if (!session) {
    return (
      <main className="container page" style={{ maxWidth: 720 }}>
        <div className="pageTop">
          <div>
            <div className="pageTitle">Privacy & Data</div>
            <div className="pageSub">Export and delete your data</div>
          </div>
        </div>
        <LoginCtaCard title="Sign in to manage privacy settings" subtitle="When signed out, no private APIs are called (prevents 401 storms)" />
      </main>
    )
  }

  return (
    <main style={{ padding: 24, maxWidth: 980 }}>
      <h1>Privacy & Data</h1>
      {error ? <p style={{ color: 'crimson' }}>{error}</p> : null}

      <section style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Store original videos</h2>
        <p style={{ color: '#666', marginTop: 8 }}>
          By default, original videos are not stored. Uploaded files are cleaned up after analysis. If you enable storage, you can set an automatic expiry (TTL).
        </p>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input
            type="checkbox"
            checked={saveOriginal}
            onChange={(e) => {
              setSaveOriginal(e.target.checked)
              if (!e.target.checked) setTtlEnabled(false)
            }}
          />
          Store original videos
        </label>

        <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={ttlEnabled}
              disabled={ttlDisabled}
              onChange={(e) => setTtlEnabled(e.target.checked)}
            />
            Enable TTL (auto-delete on expiry)
          </label>

          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: ttlDisabled || !ttlEnabled ? '#999' : '#111' }}>Days</span>
            <input
              type="number"
              value={ttlDays}
              min={1}
              max={3650}
              disabled={ttlDisabled || !ttlEnabled}
              onChange={(e) => setTtlDays(Number(e.target.value || 0))}
              style={{ width: 120 }}
            />
          </label>

          <button onClick={save} disabled={saving} type="button">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>

        {settings ? (
          <p style={{ marginTop: 10, color: '#666', fontSize: 12 }}>
            Current: {settings.saveOriginalVideos ? 'Store originals' : 'Do not store originals'}
            {settings.saveOriginalVideos
              ? ` · TTL: ${typeof settings.videoTtlDays === 'number' ? `${settings.videoTtlDays} days` : 'no auto-expiry'}`
              : ''}
          </p>
        ) : null}
      </section>

      <section style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Export</h2>
        <p style={{ color: '#666', marginTop: 8 }}>Includes: training logs + analysis jobs + latest reports.</p>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void download('json')}>
            Export JSON
          </button>
          <button type="button" onClick={() => void download('csv')}>
            Export CSV
          </button>
        </div>
      </section>

      <section style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Delete data</h2>
        <p style={{ color: '#666', marginTop: 8 }}>You can delete individual items in History. This page provides one-click clearing.</p>
        <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => void deleteAllTrainings()}>
            Delete all trainings
          </button>
          <button type="button" onClick={() => void deleteAllAnalysis()}>
            Delete all analyses
          </button>
        </div>
      </section>
    </main>
  )
}
