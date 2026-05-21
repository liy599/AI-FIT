import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { getPoseDebugServerUrl, isPoseDebugEnabled } from './modules/pose/debugFlags'

// Import global styles. Order matters: base -> layout -> page styles -> components -> utilities.
import './styles/legacy-vendor.css'        // Third-party / legacy styles
import './styles/base.css'                 // Reset & base styles (html, body, typography)
import './styles/layout.css'               // Layout system (grid, containers, spacing)
import './styles/blog.css'                 // Blog page styles
import './styles/profile.css'              // Profile page styles
import './styles/pose.css'                 // Pose video analysis styles
import './styles/app.css'                  // App-specific styles
import './styles/tokens.css'               // Design tokens (colors, spacing, variables)
import './styles/ui-components.css'        // Reusable UI components styles
import './styles/generated/utilities-compat.css' // Utility classes (auto-generated)

// Create React root and mount the app into the DOM element with id="root"
// #region debug-point A:global-errors
;(() => {
  if (!isPoseDebugEnabled()) return
  const url = getPoseDebugServerUrl()
  const send = (hypothesisId: string, msg: string, data: Record<string, unknown>) => {
    fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        sessionId: 'pose-analysis-blank-page',
        runId: 'pre-fix',
        hypothesisId,
        location: 'main.tsx',
        msg: `[DEBUG] ${msg}`,
        data,
        ts: Date.now()
      })
    }).catch(() => {})
  }
  window.addEventListener('error', (e) => {
    send('A', 'window.error', {
      message: String(e.message ?? ''),
      filename: String((e as ErrorEvent).filename ?? ''),
      lineno: (e as ErrorEvent).lineno ?? null,
      colno: (e as ErrorEvent).colno ?? null,
      stack: (e as ErrorEvent).error instanceof Error ? (e as ErrorEvent).error.stack : null
    })
  })
  window.addEventListener('unhandledrejection', (e) => {
    const reason = (e as PromiseRejectionEvent).reason
    send('D', 'window.unhandledrejection', {
      reason: reason instanceof Error ? reason.message : String(reason ?? ''),
      stack: reason instanceof Error ? reason.stack : null
    })
  })
  send('A', 'app-mounted', { href: window.location.href })
})()
// #endregion
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Enables React development checks and warnings */}

    <BrowserRouter>
      {/* Provides routing (URL-based navigation) for the entire app */}

      <App />
      {/* Root component of your application */}

    </BrowserRouter>
  </React.StrictMode>
)
